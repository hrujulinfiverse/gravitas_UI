# execution_walkthrough.md
# Nyaya Platform — End-to-End Execution Walkthrough

**Purpose:** Step-by-step trace of a single legal query from the moment a user types in the React UI to the moment a validated decision is rendered on screen. Every function call, data transformation, and gate check is documented in sequence.

---

## The Single Execution Path

There is exactly one valid path through the system. Any deviation from this path is either a bug or a security event. The path is:

```
React UI
  → nyayaApiClient (axios interceptor)
    → POST /nyaya/query
      → AuditLogMiddleware
        → add_trace_id_middleware
          → request_validation_middleware
            → router.query_legal()
              → JurisdictionRouterAgent.process()
                → LegalAgent.process()
                  → ObserverPipeline.process_result()
                    → ResponseBuilder.build_nyaya_response()
                      → validate_decision_contract()
                        → NyayaResponse { metadata.Formatted: true }
              ← HTTP 200 JSON
          ← AuditLogMiddleware writes audit record
        ← axios response interceptor validates Formatted + schema
      ← React component receives validated DecisionContract
    ← UI renders GravitasDecisionPanel / EnforcementGatekeeper
```

---

## Step-by-Step Trace

### Step 1 — User Submits Query (React UI)

**File:** `src/components/LegalQueryCard.jsx` or `LegalDecisionDocument.jsx`

The user fills in a legal query and selects a jurisdiction. On submit, the component calls `legalQueryService.submitQuery()`:

```javascript
// src/services/nyayaApi.js
const payload = {
    query: "What are my rights if my employer withholds salary?",
    jurisdiction_hint: "India",
    user_context: { role: "citizen", confidence_required: true }
}
const response = await apiClient.post('/nyaya/query', payload)
```

Before the request leaves the browser, the axios request interceptor fires:

```javascript
// src/lib/nyayaApiClient.js — request interceptor
config.headers['X-Pipeline-Entry'] = 'black-box-execution'
config.headers['X-No-Bypass'] = 'true'
config.headers['X-Trace-ID'] = window.__gravitas_active_trace_id  // if set
```

These headers signal to the backend that the request originated from the unified pipeline entry point.

---

### Step 2 — Request Arrives at FastAPI (Middleware Stack)

**File:** `nyaya/backend/main.py`

FastAPI processes middleware in reverse registration order. The effective order for an incoming request is:

```
1. AuditLogMiddleware.dispatch()     — starts timer, will write audit log on exit
2. add_trace_id_middleware()         — generates UUID, sets request.state.trace_id
3. request_validation_middleware()   — checks Content-Type: application/json
4. CORSMiddleware                    — validates Origin against ALLOWED_ORIGINS
```

**CORS check:** If `Origin` header is not in `ALLOWED_ORIGINS` (i.e., not `https://nyai.blackholeinfiverse.com`), the browser receives no `Access-Control-Allow-Origin` header and blocks the request. The FastAPI handler is never reached.

**Content-Type check:** If `Content-Type` is not `application/json`, a 400 is returned immediately with `INVALID_CONTENT_TYPE` error code.

---

### Step 3 — Route Handler Receives Request

**File:** `nyaya/backend/router.py`, `query_legal()`

FastAPI resolves the route and injects dependencies:

```python
@router.post("/query", response_model=NyayaResponse)
async def query_legal(
    request: QueryRequest,          # Pydantic validates body — 422 on failure
    trace_id: str = Depends(get_trace_id),    # fresh UUID
    nonce: str = Depends(validate_nonce),     # anti-replay check
    background_tasks: Optional[BackgroundTasks] = None
):
```

`QueryRequest` validation happens here. If `query` is empty, missing, or `jurisdiction_hint` is not one of `India|UK|UAE`, Pydantic raises `ValidationError` → FastAPI returns 422 automatically. The handler body never executes.

---

### Step 4 — Jurisdiction Routing

**File:** `nyaya/observer_pipeline/sovereign_agents/jurisdiction_router_agent.py`

```python
routing_result = await jurisdiction_router_agent.process({
    "query": request.query,
    "jurisdiction_hint": request.jurisdiction_hint,
    "domain_hint": request.domain_hint
})
# Returns: { target_jurisdiction: "IN", target_agent: "india_legal_agent", confidence: 0.5 }
```

Internally, `JurisdictionRouterAgent._extract_jurisdiction()` reads `jurisdiction_hint` directly (if provided) or falls back to `"IN"`. The `JurisdictionRouter` regex engine (`jurisdiction_router/router.py`) is available for NLP-based routing when no hint is given.

`emit_event("jurisdiction_resolved", {...})` is called — this builds an event dict but does not yet write to the ledger (OI-02).

---

### Step 5 — Legal Agent Processing

**File:** `nyaya/observer_pipeline/sovereign_agents/legal_agent.py`

The router selects the correct agent instance from the pre-initialized dict:

```python
agents = {
    "IN":  LegalAgent(agent_id="india_legal_agent",  jurisdiction="India"),
    "UK":  LegalAgent(agent_id="uk_legal_agent",     jurisdiction="UK"),
    "UAE": LegalAgent(agent_id="uae_legal_agent",    jurisdiction="UAE")
}
agent = agents[target_jurisdiction]
agent_result = await agent.process({"query": request.query, "trace_id": trace_id})
```

`LegalAgent.process()` returns:

```python
{
    "query_type": "legal",
    "jurisdiction": "India",
    "action": "route_to_sub_agent",
    "target_agent": "constitutional_agent",
    "confidence": 0.5   # BaseAgent.generate_confidence_score() — currently hardcoded
}
```

`emit_event("agent_classified", {...})` is called.

---

### Step 6 — Observer Pipeline (Vedant's Layer)

**File:** `nyaya/observer_pipeline/observer_pipeline.py`

This is the critical integration point between Raj's backend and Vedant's pipeline:

```python
observed_result = await observer_pipeline.process_result(
    agent_result,       # raw dict from Step 5
    trace_id,           # UUID from Step 3
    target_jurisdiction # "India"
)
```

Inside `ObserverPipeline.process_result()`:

```python
# 1. Validate and clamp confidence
confidence = agent_result.get("confidence", 0.5)
if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
    confidence = 0.5  # defensive clamp

# 2. Build observation metadata block
observed_result = {
    **agent_result,                    # all original agent fields preserved
    "observation": {
        "observation_id":        self.observation_id,
        "timestamp":             observation_timestamp,
        "jurisdiction":          jurisdiction,
        "trace_id":              trace_id,
        "confidence_validated":  confidence,
        "pipeline_stage":        "observer_pipeline",
        "processed_at":          observation_timestamp
    },
    "metadata": {
        "observed": True,
        "stage": "post_decision_engine"
    }
}

# 3. Apply observation rules
# Rule 1: confidence < 0.3 → append "low_confidence_review_required" flag
# Rule 2: compute completeness_score from required fields presence
```

The returned `observed_result` now contains the full `observation` block that will appear in `reasoning_trace.observer_processing` in the final response.

---

### Step 7 — Response Assembly and Formatter Gate

**File:** `nyaya/backend/response_builder.py`, `build_nyaya_response()`

```python
# Extract validated confidence from observer output
confidence = observed_result.get("observation", {}).get("confidence_validated", 0.5)

# Build reasoning trace — this is what the frontend receives in reasoning_trace
reasoning_trace = {
    "routing_decision":    routing_result,       # Step 4 output
    "agent_processing":    agent_result,         # Step 5 output
    "observer_processing": observed_result.get("observation", {})  # Step 6 output
}

# Store confidence for enforcement status lookup
_trace_store[trace_id] = {
    "confidence": confidence,
    "jurisdiction": target_jurisdiction,
    "domain": domain
}

# Assemble NyayaResponse
response = NyayaResponse(
    domain=domain,
    jurisdiction=target_jurisdiction,
    confidence=confidence,
    legal_route=[jurisdiction_router_agent.agent_id, agent.agent_id],
    trace_id=trace_id,
    enforcement_status=EnforcementStatus(state="clear", verdict="ENFORCEABLE", trace_id=trace_id),
    reasoning_trace=reasoning_trace,
    metadata={"Formatted": True}   # ← FORMATTER GATE SENTINEL
)

# Backend-side schema validation — raises ValueError on failure
validate_decision_contract(response.dict())
```

If `validate_decision_contract()` raises, the `except Exception` block in `query_legal()` catches it and returns a structured 500. The `NyayaResponse` object is never serialized to JSON.

---

### Step 8 — Audit Log Written

**File:** `nyaya/backend/audit_logger.py`

As the response exits the middleware stack, `AuditLogMiddleware` reads the response body and writes:

```json
{
  "ts": "2025-07-14T10:23:41.123Z",
  "trace_id": "a1b2c3d4-e5f6-...",
  "method": "POST",
  "path": "/nyaya/query",
  "status": 200,
  "duration_ms": 312.4,
  "origin": "https://nyai.blackholeinfiverse.com",
  "formatted": true,
  "observer_triggered": true,
  "schema_valid": true
}
```

`formatted=false` or `schema_valid=false` in any audit record is a pipeline integrity alert.

---

### Step 9 — Frontend Response Interceptor (Second Gate)

**File:** `src/lib/nyayaApiClient.js`

The axios response interceptor fires before the `.then()` callback in any service function:

```javascript
// Gate check 1: Formatted flag
if (!response.data?.metadata?.Formatted) {
    console.error('Security Alert: Response did not pass through Formatter.')
    throw new Error('UNFORMATTED_RESPONSE: Response rejected due to missing Formatted metadata tag')
}

// Gate check 2: DecisionContract schema
try {
    validateDecisionContract(response.data)
    console.log('✅ DecisionContract: Schema validation passed')
} catch (validationError) {
    throw new Error(`INVALID_CONTRACT: ${validationError.message}`)
}

// Gate check 3: Clear any previous service outage
if (_isServiceOutage) clearServiceOutage()
```

If either gate throws, the error propagates to the calling service function's `catch` block, which returns `{ success: false, error: "..." }` to the component.

---

### Step 10 — UI Rendering Decision

**File:** `src/App.jsx`, component tree

The component receives the validated response and follows this rendering decision tree:

```
response.success === false?
  └─ ApiErrorState renders (title, message, traceId, onRetry)

response.success === true?
  └─ setLastResponse(response.data)
  └─ Component renders based on enforcement_status.state:
       "clear"        → GravitasDecisionPanel / full decision view
       "conditional"  → Decision view + caution overlay
       "escalate"     → EscalationNotice component
       "block"        → ComplianceBarrier / EnforcementGatekeeper (decision hidden)
       "soft_redirect"→ RedirectModal with alternative pathway suggestion

Unhandled exception in any component?
  └─ ErrorBoundary.componentDidCatch() fires
  └─ SystemCrash overlay renders (trace_id, "Return to Dashboard", "Try Again")
```

---

## Enforcement Status — Separate Fetch

The enforcement status is fetched as a **separate GET request** after the query completes. This is intentional — it allows the enforcement gate to be checked independently of the query result:

```javascript
// src/services/nyayaApi.js — casePresentationService
const result = await apiClient.get('/nyaya/enforcement_status', {
    params: { trace_id: traceId, jurisdiction }
})
```

The backend reads `_trace_store[trace_id]["confidence"]` (populated in Step 7) and computes the enforcement state. If the trace is not found (e.g., after a server restart), it returns 404, and the frontend fallback returns `NON_ENFORCEABLE` — the decision is blocked until enforcement can be verified.

---

## Failure Path Walkthrough

### Scenario: Backend returns 503

```
Step 9 axios interceptor: status=503 → isServerError=true
  → _emitFailure(errorDetails)
  → _emitOutage(errorDetails)
  → useResiliency.onBackendFailure fires
  → offlineStore.save(caseIntakeRef.current)
  → setIsOffline(true)
  → OfflineBanner renders: "Service unavailable. Your data has been saved."
  → pollRef starts: GET /health every 15 seconds
  → On recovery: clearServiceOutage() → OfflineBanner dismisses
  → syncToServer() replays saved intake
```

### Scenario: Response missing metadata.Formatted

```
Step 9 axios interceptor: metadata.Formatted is undefined
  → throws Error('UNFORMATTED_RESPONSE: ...')
  → legalQueryService.submitQuery() catch block:
      return { success: false, error: 'UNFORMATTED_RESPONSE: ...' }
  → Component renders ApiErrorState:
      title: "Data Unavailable"
      message: "UNFORMATTED_RESPONSE: ..."
      traceId: <from response or window.__gravitas_active_trace_id>
  → AuditLog records: formatted=false, schema_valid=false
```

### Scenario: Agent crashes mid-execution

```
LegalAgent.process() throws RuntimeError("agent exploded")
  → router.query_legal() except block catches it
  → Returns HTTP 500:
      { error_code: "INTERNAL_ERROR", message: "An internal error occurred", trace_id: "..." }
  → No Python traceback in response body
  → axios interceptor: status=500 → isServerError=true → ServiceOutage triggered
  → AuditLog records: status=500, formatted=false
```

---

## Data Shape at Each Stage

```
Stage 1 — Query Payload (Frontend → Backend)
{
  query: "...",
  jurisdiction_hint: "India",
  user_context: { role: "citizen", confidence_required: true }
}

Stage 2 — Agent Result (LegalAgent → ObserverPipeline)
{
  query_type: "legal",
  jurisdiction: "India",
  action: "route_to_sub_agent",
  target_agent: "constitutional_agent",
  confidence: 0.5
}

Stage 3 — Observed Result (ObserverPipeline → ResponseBuilder)
{
  ...agent_result,
  observation: {
    observation_id: "uuid",
    timestamp: "2025-...",
    jurisdiction: "India",
    trace_id: "uuid",
    confidence_validated: 0.5,
    pipeline_stage: "observer_pipeline",
    completeness_score: 0.67,
    flags: []
  },
  metadata: { observed: true, stage: "post_decision_engine" }
}

Stage 4 — NyayaResponse (Backend → Frontend wire format)
{
  trace_id: "uuid",
  jurisdiction: "India",
  domain: "general",
  legal_route: ["jurisdiction_router_agent_id", "india_legal_agent"],
  confidence: 0.5,
  enforcement_status: { state: "escalate", verdict: "PENDING_REVIEW", ... },
  reasoning_trace: {
    routing_decision: { ... },
    agent_processing: { ... },
    observer_processing: { observation_id: "...", pipeline_stage: "observer_pipeline", ... }
  },
  constitutional_articles: [],
  provenance_chain: [],
  metadata: { Formatted: true }
}

Stage 5 — Validated Contract (Frontend component receives)
Same as Stage 4 — schema validated, Formatted confirmed, safe to render
```
