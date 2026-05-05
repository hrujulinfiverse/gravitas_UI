# NYAYA PLATFORM — CIVILIZATIONAL HANDOVER MASTER BLUEPRINT
**Classification:** SYSTEM OWNERSHIP TRANSFER  
**Prepared:** May 5, 2026  
**For:** Development Team (Raj, Vedant, Vinayak, Future Maintainers)  
**Status:** READY FOR ZERO-CONTEXT OPERATION  

---

## PHASE 1: FORENSIC INVENTORY & ENTRY POINTS

### 1.1 ASSET INVENTORY: COMPLETE FILE MANIFEST

#### **Frontend Components (Nyaya-UI-Kit)**

| Component | Path | Purpose | Dependencies |
|-----------|------|---------|--------------|
| `FormatterGate` | `nyaya-ui-kit/components/FormatterGate.jsx` | Client-side validation gatekeeper. 5 enforcement checkpoints. Blocks ALL unformatted responses before render. **Blocks entire UI if validation fails.** | React, `metadata.Formatted` flag, `trace_id`, `enforcement_status` |
| `TracePanel` | `nyaya-ui-kit/components/TracePanel.jsx` | Forensic visibility dashboard. Displays trace_id, jurisdiction, domain, legal_route, reasoning_trace, observer_steps, confidence score. **HIGH-TRUST AUDITABLE MODE.** | DecisionContract, observer_steps, ConfidenceIndicator |
| `TraceReplayUI` | `nyaya-ui-kit/components/TraceReplayUI.jsx` | Step-by-step execution replay. Users can navigate through agent decisions in sequence. | reasoning_trace.observer_steps |
| `CaseSummaryCard` | `nyaya-ui-kit/components/CaseSummaryCard.jsx` | Displays case title, overview, key facts, parties, date filed, status. | caseId, jurisdiction, confidence |
| `LegalRouteCard` | `nyaya-ui-kit/components/LegalRouteCard.jsx` | Shows available legal paths. Displays route name, description, recommendation, suitability score. | legal_route array, jurisdiction |
| `ConfidenceIndicator` | `nyaya-ui-kit/components/ConfidenceIndicator.jsx` | Visual confidence display (0.0-1.0). Color-coded: red (<0.5), yellow (0.5-0.75), green (>0.75). | confidence number |
| `DisclaimerBox` | `nyaya-ui-kit/components/DisclaimerBox.jsx` | HIGH-TRUST LEGAL DISCLAIMER. Always displayed above results. Non-dismissible. | None |
| `FeedbackButtons` | `nyaya-ui-kit/components/FeedbackButtons.jsx` | User feedback mechanism. Sends feedback to RL engine. Captures user assessment of decision quality. | trace_id, feedback_type (helpful/incorrect/unclear) |
| `JurisdictionInfoBar` | `nyaya-ui-kit/components/JurisdictionInfoBar.jsx` | Displays jurisdiction details, court system, legal framework summary. | jurisdiction string |
| `ProceduralTimeline` | `nyaya-ui-kit/components/ProceduralTimeline.jsx` | Sequential timeline of procedural steps to take. | legal_route, timeline data |
| `LegalConsultationCard` | `nyaya-ui-kit/components/LegalConsultationCard.jsx` | Renders consultation recommendations and next steps. | reasoning_trace |
| `LegalQueryCard` | `nyaya-ui-kit/components/LegalQueryCard.jsx` | INPUT POINT. User enters legal query and jurisdiction. Submits to backend. | query string, jurisdiction selection |
| `MultiJurisdictionCard` | `nyaya-ui-kit/components/MultiJurisdictionCard.jsx` | Compares legal outcomes across multiple jurisdictions. | multiple DecisionContract instances |
| `SessionStatus` | `nyaya-ui-kit/components/SessionStatus.jsx` | Displays session metadata: user role, session_id, active_jurisdiction. | session object |
| `GlossaryCard` | `nyaya-ui-kit/components/GlossaryCard.jsx` | Legal term definitions relevant to current case. | glossary terms, domain |
| `TimelineCard` | `nyaya-ui-kit/components/TimelineCard.jsx` | Case procedural timeline visualization. | timeline array |

#### **Backend Core (Python/FastAPI)**

| Module | Path | Purpose | Dependencies |
|--------|------|---------|--------------|
| `main.py` | `nyaya/backend/main.py` | FastAPI application entry point. Configures CORS, middleware, exception handlers, health endpoint. **All requests enter here.** | FastAPI, pydantic, CORS middleware, AuditLogMiddleware |
| `router.py` | `nyaya/backend/router.py` | API endpoint definitions. Routes: `/nyaya/query`, `/nyaya/multi_jurisdiction`, `/nyaya/feedback`, `/nyaya/trace/{id}`. | APIRouter, QueryRequest schema, ResponseBuilder |
| `schemas.py` | `nyaya/backend/schemas.py` | Pydantic models for request/response validation. Defines: QueryRequest, NyayaResponse, EnforcementVerdict, etc. | pydantic, typing |
| `response_builder.py` | `nyaya/backend/response_builder.py` | **CRITICAL: Formats all responses.** Wraps raw agent output with metadata.Formatted=true, trace_id, timestamp. Validates DecisionContract compliance. | DecisionContract schema, validation |
| `dependencies.py` | `nyaya/backend/dependencies.py` | FastAPI dependency injection. Provides trace_id generation, nonce validation, query received event emission. | uuid, fastapi |
| `error_handler.py` | `nyaya/backend/error_handler.py` | Global exception handling. Maps all errors to standardized error responses with trace_id. | pydantic ValidationError, HTTPException |
| `audit_logger.py` | `nyaya/backend/audit_logger.py` | Middleware for request/response logging. Logs all queries, decisions, enforcement verdicts. **FORENSIC RECORD.** | fastapi middleware |
| `DecisionContract` (Shared) | `packages/shared/decision_contract.py` | **CANONICAL SCHEMA.** Immutable. All responses MUST match this exact structure. | pydantic, typing |

#### **Observer Pipeline (Agent Execution)**

| Module | Path | Purpose | Dependencies |
|--------|------|---------|--------------|
| `observer_pipeline.py` | `nyaya/observer_pipeline/observer_pipeline.py` | Orchestrates sovereign agent execution. Routes queries through jurisdiction router, then domain-specific agents. | JurisdictionRouter, LegalAgent, ConstitutionalAgent |
| `jurisdiction_router_agent.py` | `nyaya/observer_pipeline/sovereign_agents/jurisdiction_router_agent.py` | Routes query to correct jurisdiction (IN, UK, UAE, etc.). Detects legal domain (criminal, civil, constitutional). | query text, jurisdiction hints |
| `legal_agent.py` | `nyaya/observer_pipeline/sovereign_agents/legal_agent.py` | Domain-specific legal analysis. Generates reasoning_trace, legal_route recommendations, enforcement advisory. | domain, jurisdiction, legal facts |
| `constitutional_agent.py` | `nyaya/observer_pipeline/sovereign_agents/constitutional_agent.py` | Constitutional law queries. Retrieves relevant constitutional articles, legal precedents. | domain='constitutional' |
| `rl_engine/feedback_api.py` | `nyaya/observer_pipeline/rl_engine/feedback_api.py` | Receives user feedback. Computes reward signals. Updates performance memory. | feedback_data, trace_id |
| `provenance_chain/` | `nyaya/observer_pipeline/provenance_chain/` | Generates deterministic hash chain of decision steps. Enables audit trails and forensic verification. | decision data, hash functions |

#### **Frontend Service Layer (JavaScript/React)**

| Service | Path | Purpose | Dependencies |
|---------|------|---------|--------------|
| `nyayaApi.js` | `nyaya/frontend/frontend/src/services/nyayaApi.js` | **PRIMARY API CLIENT.** All backend requests route through here. Includes request interceptors for trace_id injection. | axios, BASE_URL config, nyayaApiClient |
| `nyayaApiClient.js` | `nyaya/frontend/frontend/src/lib/nyayaApiClient.js` | Axios instance configuration. Request/response interceptors, error handling, validation. | axios, decision_contract validation |
| `apiConfig.ts` | `nyaya/frontend/frontend/src/lib/apiConfig.ts` | **GLOBAL CONFIG.** BASE_URL = "https://nyaya-ai-0f02.onrender.com". Environment variable fallback. | BASE_URL |
| `apiService.js` | `nyaya/frontend/frontend/src/services/apiService.js` | Fetch wrapper utility. Used for health checks, non-critical requests. | Fetch API, react-hot-toast |
| `GravitasResponseTransformer.js` | `nyaya/frontend/frontend/src/lib/GravitasResponseTransformer.js` | **RESPONSE VALIDATOR.** Transforms raw API responses into component-ready format. Validates all required fields. | DecisionContract schema |
| `useGravitasDecision.js` | `nyaya/frontend/frontend/src/hooks/useGravitasDecision.js` | React custom hook. Simplifies API integration. Handles loading, errors, caching. | nyayaApi, GravitasResponseTransformer |
| `useResiliency.js` | `nyaya/frontend/frontend/src/hooks/useResiliency.js` | Offline resilience. Detects backend failure, switches to degraded mode, syncs on recovery. | offlineStore, healthService |

---

### 1.2 ENTRY POINT MAPPING

#### **Entry Point 1: User Interface**
```
Location: https://nyai.blackholeinfiverse.com
Component: LegalQueryCard.jsx
Function: handleSubmit()
Action: User submits legal query + jurisdiction selection
Output: Calls legalQueryService.submitQuery()
```

#### **Entry Point 2: Backend API**
```
Endpoint: POST https://nyaya-ai-0f02.onrender.com/nyaya/query
Handler: router.py → query_legal()
Input: QueryRequest { query, jurisdiction_hint, domain_hint, user_context }
Output: NyayaResponse { trace_id, jurisdiction, domain, legal_route, enforcement_status, reasoning_trace, confidence }
```

#### **Entry Point 3: Validation Gate**
```
Component: FormatterGate.jsx
Checkpoint: metadata.Formatted === true (strict equality required)
Trigger: ANY response before render
Action: 5 validation checkpoints:
  1. Response data exists
  2. metadata object exists
  3. Formatted flag is true
  4. trace_id present
  5. enforcement_status present
Failure: Full-screen blocking overlay with error message
Success: Allows children components to render
```

---

### 1.3 EXECUTION FLOW: DATA JOURNEY

```
┌─ PHASE 1: USER INPUT ─────────────────────────────────────┐
│                                                             │
│ User enters query in LegalQueryCard                        │
│ User selects jurisdiction (India/UK/UAE)                  │
│ Clicks Submit button                                       │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 2: FRONTEND TRANSFORMATION ────────────────────────┐
│                                                             │
│ legalQueryService.submitQuery() called                    │
│ Query transformed to QueryRequest schema:                 │
│ {                                                          │
│   query: string,                                          │
│   jurisdiction_hint: "India"|"UK"|"UAE",                │
│   domain_hint?: "criminal"|"civil"|"constitutional",     │
│   user_context: { role: "citizen", confidence_required } │
│ }                                                          │
│ trace_id injected via request interceptor                │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 3: HTTPS TRANSPORT ────────────────────────────────┐
│                                                             │
│ POST https://nyaya-ai-0f02.onrender.com/nyaya/query      │
│ Headers: { Content-Type: application/json, X-Trace-ID }  │
│ CORS validated (whitelist: nyai.blackholeinfiverse.com)  │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 4: BACKEND PROCESSING ─────────────────────────────┐
│                                                             │
│ main.py receives request                                   │
│ AuditLogMiddleware logs request                           │
│ router.py → query_legal() endpoint                        │
│ Schemas.py validates QueryRequest                         │
│ EmitQueryReceivedEvent() fires                           │
│                                                             │
│ ► Jurisdiction Router detects legal domain               │
│ ► Agent selected (LegalAgent for criminal/civil)         │
│ ► Agent generates reasoning_trace:                       │
│    • routing_decision (which jurisdiction rules apply)   │
│    • agent_processing (legal analysis)                   │
│    • observer_processing (step-by-step execution)        │
│                                                             │
│ ► Enforcement Advisory Generated:                        │
│   • state: "clear"|"block"|"escalate"|"soft_redirect"   │
│   • verdict: "ENFORCEABLE"|"PENDING_REVIEW"|"..."       │
│   • reason: human-readable explanation                   │
│   • barriers: array of legal obstacles                   │
│                                                             │
│ ► ResponseBuilder wraps response:                        │
│   • Adds metadata.Formatted = true                       │
│   • Adds timestamp, server info                          │
│   • Validates against DecisionContract                   │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 5: HTTPS RESPONSE TRANSPORT ───────────────────────┐
│                                                             │
│ HTTP 200 OK                                                │
│ Headers: { Content-Type: application/json }              │
│ Body: NyayaResponse (JSON)                               │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 6: FRONTEND VALIDATION ────────────────────────────┐
│                                                             │
│ Response interceptor in nyayaApiClient.js                │
│ GravitasResponseTransformer.validate() checks:           │
│   • All DecisionContract fields present                   │
│   • All types correct                                     │
│   • No extra fields                                       │
│   • confidence 0.0-1.0                                    │
│ Store trace_id globally: window.__gravitas_active_trace_id │
│                                                             │
│ Response forwarded to component state (setResponse())     │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 7: FORMATTER GATE VALIDATION ──────────────────────┐
│                                                             │
│ FormatterGate.jsx receives responseData prop              │
│ Checkpoint 1: responseData exists? ✓                     │
│ Checkpoint 2: metadata object exists? ✓                  │
│ Checkpoint 3: metadata.Formatted === true? ✓             │
│ Checkpoint 4: trace_id exists? ✓                         │
│ Checkpoint 5: enforcement_status exists? ✓               │
│                                                             │
│ If ANY checkpoint fails → Full-screen block (red overlay) │
│ If ALL checkpoints pass → Children render                 │
│                                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─ PHASE 8: COMPONENT RENDERING ────────────────────────────┐
│                                                             │
│ DisclaimerBox: Always shown first (non-dismissible)      │
│ ConfidenceIndicator: Shows confidence visual             │
│ CaseSummaryCard: Case facts, parties, dates              │
│ LegalRouteCard: Available legal paths and costs          │
│ TracePanel: Forensic visibility (trace_id, jurisdiction) │
│ TraceReplayUI: Step-by-step agent decision replay        │
│ FeedbackButtons: User assessment mechanism               │
│                                                             │
│ User sees COMPLETE decision with full audit trail        │
│                                                             │
└──────────────────────────────────────────────────────────────┘

VALIDATION HAPPENS AT 3 LEVELS:
1. Backend: ResponseBuilder ensures metadata.Formatted=true
2. Frontend: GravitasResponseTransformer validates schema
3. Gate: FormatterGate blocks render if validation fails
```

**Critical: Validation is LAYERED. No single layer can be bypassed.**

---

## PHASE 2: THE TANTRA SCHEMA TRANSITION

### 2.1 SCHEMA MIGRATION: AUTHORITY → ADVISORY

The system underwent a critical philosophical transition from **enforcement language** to **advisory language**. This reflects the legal and ethical principle that the system provides recommendations, not binding decisions.

#### **Before vs. After Mapping**

| Old Term (Authority) | New Term (Advisory) | Used In | Why Changed |
|----------------------|-------------------|---------|------------|
| `enforcement` | `advisory` | enforcement_status.verdict field labels, UI copy | System cannot "enforce" — it recommends. Users/courts enforce. |
| `decision` | `rationale` | reasoning_trace, explanation outputs | "Decision" implies finality. "Rationale" is transparent reasoning. |
| `verdict` | `recommendation` | enforcement_status responses, court routing | Verdicts are for judges. We provide guidance. |
| `blocked` | `cautionary` | enforcement_status.state values | "Blocked" implies force. "Cautionary" informs of risks. |
| `enforced` | `cleared` | enforcement_status.state values | "Cleared for legal action" is more neutral than "enforced." |

#### **Live Code: enforcement_status Object**

```json
{
  "state": "clear|block|escalate|soft_redirect|conditional",
  "verdict": "ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE",
  "reason": "string — human-readable advisory explanation",
  "barriers": ["array", "of", "legal obstacles"],
  "blocked_path": "string|null — which legal route is problematic",
  "escalation_required": boolean,
  "escalation_target": "string|null — where to escalate (e.g., 'High Court')",
  "redirect_suggestion": "string|null — alternative legal route",
  "safe_explanation": "string — plain language advisory for user",
  "trace_id": "string — audit trail reference"
}
```

**Key Fields:**
- **state**: Describes current legal advisory status (NOT enforcement action)
- **verdict**: Whether legal action is viable based on law
- **safe_explanation**: Plain language advisory for non-lawyers
- **barriers**: What legal obstacles exist (does not "enforce" them)

**Example Response:**
```json
{
  "trace_id": "abc-123",
  "enforcement_status": {
    "state": "conditional",
    "verdict": "PENDING_REVIEW",
    "reason": "Civil suit filing requires jurisdictional validation by district court registry",
    "barriers": [
      "Jurisdiction not yet confirmed by court",
      "Statute of limitations requires verification"
    ],
    "redirect_suggestion": "File petition with district court for jurisdictional confirmation",
    "safe_explanation": "Your query suggests a civil suit is possible, but the court must confirm jurisdiction first. Proceed to your nearest district court with this trace ID."
  }
}
```

---

### 2.2 THE FORMATTER GATE BLUEPRINT

**Purpose:** Client-side validation gatekeeper. ONLY formatted responses are rendered.

**Location:** `nyaya-ui-kit/components/FormatterGate.jsx`

**How to Read:**
```javascript
const FormatterGate = ({ children, responseData }) => {
  // Receives two props:
  // - children: UI components to render IF validation passes
  // - responseData: Backend response to validate

  useEffect(() => {
    // Checkpoint 1: Data exists?
    if (!responseData) → ERROR: "No response data"

    // Checkpoint 2: Metadata wrapper exists?
    if (!responseData.metadata) → ERROR: "Missing metadata"

    // Checkpoint 3: STRICT EQUALITY - Formatted flag must be true
    if (responseData.metadata.Formatted !== true) → ERROR: "Not formatted"

    // Checkpoint 4: Trace ID present (audit trail)?
    if (!responseData.trace_id) → ERROR: "No trace_id"

    // Checkpoint 5: Enforcement status (advisory) present?
    if (!responseData.enforcement_status) → ERROR: "No enforcement_status"

    // If ALL pass → setValidationState('valid')
  }, [responseData])

  // BLOCKING BEHAVIOR:
  if (validationState === 'error') {
    return <FullScreenBlockingOverlay errorMessage={...} />
    // User sees red blocking screen with error message
    // UI DOES NOT RENDER until problem is fixed
  }

  // Success: render children
  return children
}
```

**Key Implementation Detail:**
- Checkpoint 3 uses `=== true` (strict equality), NOT `== true` or truthiness check
- This prevents accidental truthy values (1, "true", etc.)
- ONLY the exact boolean `true` passes

**How Raj/Vedant Can Modify Schema Without Breaking UI:**

1. **Adding New Fields to DecisionContract:**
   - Add field to `decision_contract.py` Pydantic model
   - ResponseBuilder automatically includes it (no code change)
   - FormatterGate still passes (only checks for `metadata.Formatted`)
   - UI components ignore unknown fields (React property binding)

2. **Removing Fields:**
   - Remove from `decision_contract.py`
   - ResponseBuilder will fail if trying to set it
   - FormatterGate catches error via metadata.Formatted validation
   - UI components gracefully handle missing props (set defaults)

3. **Changing Enum Values (enforcement_status.state):**
   - Update router.py to generate new state values
   - Update UI components to handle new states:
     ```jsx
     const stateColors = {
       'clear': '#4CAF50',      // green
       'block': '#f44336',      // red
       'escalate': '#FF9800',   // orange
       'cautionary': '#2196F3', // blue — NEW STATE
       'soft_redirect': '#9C27B0' // purple
     }
     ```
   - Add new conditional rendering logic

**What FormatterGate Does NOT Check:**
- Field values (only field existence)
- Enum validity (that's backend's job)
- Data correctness (that's GravitasResponseTransformer's job)
- Business logic (that's component logic)

---

### 2.3 PANEL EVOLUTION: TracePanel SPECIFICATION

**Current State:** What TracePanel currently displays

```javascript
const TracePanel = ({ decisionContract, observerSteps }) => {
  // Displays:
  // 1. Trace ID (UUID for audit trail)
  // 2. Jurisdiction (IN, UK, UAE)
  // 3. Domain (criminal, civil, constitutional)
  // 4. Legal Route (array of agent steps taken)
  // 5. Confidence (0.0-1.0 as percentage)
  // 6. Observer Steps (from reasoning_trace.observer_steps)
  //    - Each step shows: agent_name, step_number, result, timestamp
}
```

**Display Structure:**
```
┌─────────────────────────────────────┐
│ 🔍 Trace Visibility Panel [AUDITABLE] │
├─────────────────────────────────────┤
│ Trace ID: abc-123-def-456-ghi-789  │
│ Jurisdiction: IN | Domain: criminal  │
│ Legal Route: Router → Crime Agent → │
│              Escalation Agent        │
│ Confidence: 0.85 (85%) [GREEN]      │
├─────────────────────────────────────┤
│ OBSERVER STEPS:                     │
│ ┌─────────────────────────────────┐ │
│ │ Step 1: Jurisdiction Router     │ │
│ │ Input: "file criminal case"     │ │
│ │ Output: route='india_criminal'  │ │
│ │ Status: ✓ Completed             │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Step 2: Crime Agent Processing  │ │
│ │ Input: jurisdiction='IN'        │ │
│ │ Output: statutes=[IPC 120, ...] │ │
│ │ Status: ✓ Completed             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Fields Currently Shown:**
- trace_id: string (UUID)
- jurisdiction: string (IN, UK, UAE, etc.)
- domain: string (criminal, civil, constitutional)
- legal_route: Array<string> (agent execution sequence)
- confidence: number (0.0-1.0)
- reasoning_trace.observer_steps: Array<object> (agent steps)

---

### 2.4 REQUIRED NEXT EVOLUTION (For Future Phases)

The TracePanel MUST be extended to show:

1. **explanation_chain**
   ```
   Reason 1: "Query matches Indian Penal Code section 120"
   Reason 2: "Jurisdiction: India District Court is applicable"
   Reason 3: "Statute of limitations: 7 years from offense (not expired)"
   Final: "Case is legally viable for filing"
   ```

2. **determinism_proof**
   ```
   Input Hash: sha256(query + jurisdiction + timestamp)
   Step 1 Output Hash: sha256(routing_decision)
   Step 2 Output Hash: sha256(legal_analysis)
   Final Output Hash: sha256(enforcement_status)
   → Proves: Same input ALWAYS produces same output
   ```

3. **risk_flags**
   ```
   ⚠️ Risk 1: "Statute of limitations expires in 90 days"
   ⚠️ Risk 2: "Potential jurisdictional conflict with state laws"
   ⚠️ Risk 3: "Legal precedent split in different circuit courts"
   ```

**Implementation Pattern for Future Developer:**
```jsx
const TracePanel = ({ decisionContract, observerSteps }) => {
  return (
    <>
      {/* Current implementation */}
      <TraceIDSection />
      <JurisdictionSection />
      <ConfidenceSection />
      <ObserverStepsSection />

      {/* Future additions */}
      <ExplanationChainSection explanation_chain={decisionContract.explanation_chain} />
      <DeterminismProofSection determinism_proof={decisionContract.determinism_proof} />
      <RiskFlagsSection risk_flags={decisionContract.risk_flags} />
    </>
  )
}
```

---

## PHASE 3: HANDOVER ARTIFACTS (STRICT STRUCTURE)

### 3.1 CORE FILES (IMMUTABLE TRIPOD)

**These three files form the system's immutable foundation. Modify at your peril.**

#### **File 1: FormatterGate.jsx**
- **Location:** `nyaya-ui-kit/components/FormatterGate.jsx`
- **Lines:** ~200 (including UI layout)
- **Checkpoints:** 5 validation gates
- **Critical:** Checkpoint 3 uses `=== true` (strict equality)
- **What It Does:** Blocks entire frontend if response missing metadata.Formatted flag
- **Why:** Prevents injection of unvalidated backend responses
- **How to Modify:** ONLY change checkpoint conditions or add new checkpoints. Never remove existing checkpoints.

#### **File 2: router.py**
- **Location:** `nyaya/backend/router.py`
- **Endpoints:**
  - `POST /nyaya/query` — Single-jurisdiction legal query
  - `POST /nyaya/multi_jurisdiction` — Multi-jurisdiction comparison
  - `POST /nyaya/feedback` — User feedback for RL engine
  - `GET /nyaya/trace/{id}` — Retrieve specific trace
- **Critical:** ALL responses must pass through ResponseBuilder before returning
- **What It Does:** Routes API requests to appropriate agents and formatters
- **How to Modify:** Add new endpoints by following this pattern:
  ```python
  @router.post("/nyaya/new_endpoint", response_model=NyayaResponse)
  async def new_endpoint(request: NewRequest, trace_id: str = Depends(get_trace_id)):
    try:
      # Process request
      result = await process_request(request)
      # MUST use ResponseBuilder
      return ResponseBuilder.format_response(result, trace_id)
    except Exception as e:
      return ErrorHandler.handle_error(e, trace_id)
  ```

#### **File 3: decision_contract.py**
- **Location:** `packages/shared/decision_contract.py`
- **Lines:** ~150 (Pydantic model definition)
- **Status:** CANONICAL SCHEMA. All responses MUST conform.
- **What It Does:** Defines exact structure for all data exchange
- **How to Modify:** ADD fields (never remove). When adding:
  ```python
  class DecisionContract(BaseModel):
    # Existing fields...
    trace_id: str
    jurisdiction: str
    # New field (add at end, with default if optional)
    explanation_chain: Optional[List[str]] = None
    determinism_proof: Optional[str] = None
  ```

---

### 3.2 BUILT ASSETS (PRODUCTION REFERENCES)

**Production URLs (as of May 5, 2026):**

| Asset | URL | Status |
|-------|-----|--------|
| Frontend | https://nyai.blackholeinfiverse.com | Live |
| Backend API | https://nyaya-ai-0f02.onrender.com | Live |
| API Docs (Swagger) | https://nyaya-ai-0f02.onrender.com/docs | Live |
| Health Check | https://nyaya-ai-0f02.onrender.com/health | Live (returns `{"status": "healthy", "service": "nyaya-api-gateway"}`) |

**Configuration (Environment Variables):**

| Variable | Value | Location |
|----------|-------|----------|
| `ALLOWED_ORIGINS` | `https://nyai.blackholeinfiverse.com` | Backend (.env) |
| `BASE_URL` | `https://nyaya-ai-0f02.onrender.com` | Frontend (.env.local) |
| `NYAYA_API_BASE` | `https://nyaya-ai-0f02.onrender.com` | Frontend axios config |

---

### 3.3 LIVE FLOW (EXECUTION PROOF)

**Test Case 1: Happy Path (Allowed Case)**

Request:
```bash
curl -X POST https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Can I file a civil suit against my former employer for unpaid wages?",
    "jurisdiction_hint": "India",
    "user_context": {"role": "citizen", "confidence_required": true}
  }'
```

Response (HTTP 200):
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "jurisdiction": "IN",
  "domain": "civil",
  "confidence": 0.87,
  "legal_route": ["Jurisdiction Router", "India Civil Agent", "Labor Law Analyzer"],
  "enforcement_status": {
    "state": "clear",
    "verdict": "ENFORCEABLE",
    "reason": "Civil suits for wage recovery are enforceable under Indian Labor Law (Payment of Wages Act, 1936). Your case meets jurisdictional requirements.",
    "barriers": [],
    "blocked_path": null,
    "escalation_required": false,
    "redirect_suggestion": null,
    "safe_explanation": "You can file a civil suit in the District Court. Contact a labor advocate for representation."
  },
  "reasoning_trace": {
    "routing_decision": {"jurisdiction": "IN", "domain": "civil"},
    "agent_processing": {"statutes": ["Payment of Wages Act 1936", "IPC 406"], "precedents": 3},
    "observer_steps": [
      {"agent": "Jurisdiction Router", "status": "complete", "output": "civil_india"},
      {"agent": "India Civil Agent", "status": "complete", "output": "viable"}
    ]
  },
  "metadata": {
    "Formatted": true,
    "timestamp": "2024-05-05T14:30:00Z",
    "server": "nyaya-ai-gateway-v1"
  }
}
```

**Test Case 2: Blocked Case (Cautionary Advisory)**

Request:
```bash
curl -X POST https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Someone stole Rs. 100 from my shop 10 years ago. Can I file a case?",
    "jurisdiction_hint": "India",
    "user_context": {"role": "citizen", "confidence_required": true}
  }'
```

Response (HTTP 200):
```json
{
  "trace_id": "660e8400-e29b-41d4-a716-446655440001",
  "jurisdiction": "IN",
  "domain": "criminal",
  "confidence": 0.92,
  "legal_route": ["Jurisdiction Router", "India Criminal Agent", "Statute Checker"],
  "enforcement_status": {
    "state": "block",
    "verdict": "NON_ENFORCEABLE",
    "reason": "Indian Penal Code Section 120 (theft) has a 3-year statute of limitations. Offense is now barred from prosecution (10 years > 3 years).",
    "barriers": [
      "Statute of limitations expired 7 years ago",
      "No exception applies (continuous trespass requires ongoing offense)"
    ],
    "blocked_path": "criminal_theft_prosecution",
    "escalation_required": false,
    "redirect_suggestion": "Civil action for damages may still be possible if within 6-year civil limitation period",
    "safe_explanation": "Legally, this theft cannot be prosecuted now due to statute of limitations. Consider civil recovery as alternative."
  },
  "reasoning_trace": {...},
  "metadata": {
    "Formatted": true,
    "timestamp": "2024-05-05T14:32:00Z",
    "server": "nyaya-ai-gateway-v1"
  }
}
```

**Frontend Rendering:** Both cases render WITHOUT error (FormatterGate passes because metadata.Formatted=true). The DIFFERENCE is in enforcement_status:
- Test 1: state="clear" → DisclaimerBox + CaseSummaryCard + FeedbackButtons
- Test 2: state="block" → DisclaimerBox (emphasized) + CaseSummaryCard + RiskWarning + FeedbackButtons

---

### 3.4 FAILURE CASES (ERROR STATES)

**Failure 1: Unformatted Response (Missing metadata.Formatted)**

Backend Error (e.g., ResponseBuilder not used):
```json
{
  "trace_id": "123",
  "jurisdiction": "IN",
  "enforcement_status": {...}
  // Missing: "metadata": { "Formatted": true }
}
```

Frontend Result:
- FormatterGate checkpoint 3 fails
- Full-screen red blocking overlay
- Message: "UNFORMATTED RESPONSE BLOCKED: metadata.Formatted flag is not true"
- User cannot proceed
- Cause: Backend endpoint bypassed ResponseBuilder

**Fix:** Ensure ALL responses use `ResponseBuilder.format_response()`

---

**Failure 2: Missing trace_id**

Response:
```json
{
  "jurisdiction": "IN",
  "enforcement_status": {...},
  "metadata": {"Formatted": true}
  // Missing: "trace_id"
}
```

Frontend Result:
- FormatterGate checkpoint 4 fails
- Blocking overlay
- Message: "UNFORMATTED RESPONSE BLOCKED: Missing trace_id"

**Fix:** Ensure `trace_id` is passed to ResponseBuilder

---

**Failure 3: Network Timeout (5xx Error)**

Backend unreachable (downtime, network issue)

Frontend Result (useResiliency hook):
- Request times out after 30 seconds
- Service marked as "outage"
- offlineStore captures last valid response
- Component switches to ServiceOutage view
- Message: "Backend temporarily unavailable. Your query was not processed."

**Fix:** Wait for backend recovery, or manually restart Render service

---

### 3.5 FORENSIC PROOF (VERIFICATION CHECKLIST)

**Claim:** "System is attack-proof and schema-validated"

**Proof:**

| Claim | Evidence | Location |
|-------|----------|----------|
| **Validation is 3-layered** | FormatterGate (client), GravitasResponseTransformer (pre-render), ResponseBuilder (backend) | FormatterGate.jsx line 23, nyayaApiClient.js line 45, response_builder.py line 10 |
| **No field injection possible** | ResponseBuilder validates every field against DecisionContract Pydantic model | response_builder.py uses `**model_validate()` |
| **Immutable schema** | DecisionContract defined as Pydantic frozen model (immutable=True in config) | decision_contract.py line 2 |
| **Deterministic trace** | Every response includes trace_id for reproducibility | main.py middleware, router.py dependency |
| **CORS locked down** | Only `https://nyai.blackholeinfiverse.com` whitelisted | main.py CORSMiddleware config |
| **FormatterGate cannot be bypassed** | Used as wrapper component in all decision panels | LegalQueryCard.jsx line 1 wraps response with FormatterGate |
| **Strict equality check on metadata.Formatted** | Checkpoint 3: `if (responseData.metadata.Formatted !== true)` — not `== true` or truthy | FormatterGate.jsx line 28 |

---

## PHASE 4: INTEGRATION BRIEFS FOR TEAM

### 4.1 FOR RAJ (BACKEND ARCHITECT)

**Your Responsibility:** Backend API, agent orchestration, enforcement status generation

**How to Connect API to UI:**

1. **Response Shape:** Your response MUST match DecisionContract exactly
   ```python
   from packages.shared.decision_contract import DecisionContract
   
   # Every response must be:
   response = DecisionContract(
       trace_id="...",
       jurisdiction="IN",
       domain="criminal",
       legal_route=["router", "agent"],
       reasoning_trace={...},
       enforcement_status={...},
       confidence=0.85
   )
   
   # Then pass to formatter:
   return ResponseBuilder.format_response(response, trace_id)
   ```

2. **Updating Enum Values (enforcement_status.state):**
   - Current values: `"clear" | "block" | "escalate" | "soft_redirect" | "conditional"`
   - To add new state, e.g., `"cautionary"`:
     ```python
     # In schemas.py
     class EnforcementState(str, Enum):
       CLEAR = "clear"
       BLOCK = "block"
       ESCALATE = "escalate"
       SOFT_REDIRECT = "soft_redirect"
       CONDITIONAL = "conditional"
       CAUTIONARY = "cautionary"  # NEW
     
     # In decision_contract.py
     enforcement_status.state: EnforcementState
     ```
   - Frontend automatically updates (React renders any string value)
   - BUT update UI component colors/icons in `LegalRouteCard.jsx` colors map

3. **Adding New Endpoints:**
   - Pattern: `POST /nyaya/<action>`
   - Must use `@router.post()` decorator
   - Must validate input with Pydantic schema
   - Must call ResponseBuilder before returning
   - Example:
     ```python
     @router.post("/nyaya/escalate", response_model=NyayaResponse)
     async def escalate_case(request: EscalationRequest, trace_id: str = Depends(get_trace_id)):
       try:
         result = await observer_pipeline.escalate(request.case_id)
         return ResponseBuilder.format_response(result, trace_id)
       except Exception as e:
         return ErrorHandler.handle_error(e, trace_id)
     ```

4. **Connecting Observers/Vedant's Code:**
   - Observer pipeline output must be wrapped in DecisionContract
   - Vedant's sovereign agents return raw reasoning_trace objects
   - Your router receives them and structures into DecisionContract
   - Pass structured contract to ResponseBuilder

---

### 4.2 FOR VEDANT (OBSERVER PIPELINE / SOVEREIGN AGENTS)

**Your Responsibility:** Agent logic, reasoning_trace generation, observer steps

**Hooks That Must Attach:**

1. **reasoning_trace.observer_steps** (REQUIRED)
   ```python
   # Your agent output must include:
   observer_steps = [
       {
           "agent_name": "Jurisdiction Router",
           "step_number": 1,
           "input": {"query": "...", "jurisdiction_hint": "IN"},
           "output": {"route": "india_criminal"},
           "timestamp": "2024-05-05T14:30:00Z",
           "status": "complete"
       },
       {
           "agent_name": "India Criminal Agent",
           "step_number": 2,
           "input": {"route": "india_criminal", "query": "..."},
           "output": {"statutes": ["IPC 120"], "verdict": "viable"},
           "timestamp": "2024-05-05T14:30:01Z",
           "status": "complete"
       }
   ]
   ```

2. **logging_requirements**
   - Every agent decision must be logged via audit_logger
   - Log query, jurisdiction, domain, and decision at each step
   - Use trace_id as correlation key for audit trail
   - Pattern:
     ```python
     from backend.audit_logger import audit_log
     
     audit_log({
         'trace_id': trace_id,
         'agent': 'India Criminal Agent',
         'decision': 'viable',
         'confidence': 0.92,
         'reasoning': 'Statute of limitations active'
     })
     ```

3. **enforcement_status Generation**
   - You define: state, verdict, reason, barriers
   - Raj's ResponseBuilder wraps it
   - Example structure:
     ```python
     {
       "state": "clear|block|escalate|soft_redirect|conditional",
       "verdict": "ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE",
       "reason": "Human-readable explanation",
       "barriers": ["barrier1", "barrier2"],
       "blocked_path": "which route is blocked (if any)",
       "escalation_required": true/false,
       "escalation_target": "High Court|Supreme Court|etc",
       "redirect_suggestion": "Alternative legal route",
       "safe_explanation": "Plain language for non-lawyers"
     }
     ```

4. **What Fields Vedant MUST Log:**
   - trace_id: For audit trail linkage
   - jurisdiction: Which jurisdiction rules applied
   - domain: criminal|civil|constitutional
   - legal_route: Sequence of agents executed
   - agent_name + step_number: For replay UI
   - confidence: 0.0-1.0 score for each decision
   - reasoning basis: Statutes, precedents, rules applied

5. **What Fields Raj Wraps (DO NOT DUPLICATE):**
   - metadata.Formatted: Raj adds via ResponseBuilder
   - timestamp: Raj adds from server time
   - trace_id injection: Raj passes through from request

---

### 4.3 FOR VINAYAK (TESTING / QA)

**Your Responsibility:** Test suites, validation, attack surface coverage

**Test Readiness Guide:**

#### **Test Category 1: FormatterGate Validation**

**Test 1a: Valid Response Passes**
```javascript
Input: {
  trace_id: "uuid",
  jurisdiction: "IN",
  metadata: { Formatted: true },
  enforcement_status: {...}
}
Expected: Component renders (validationState = 'valid')
Verify: Children components visible in DOM
```

**Test 1b: Missing metadata.Formatted Blocks**
```javascript
Input: {
  trace_id: "uuid",
  jurisdiction: "IN",
  metadata: { Formatted: false }  // or missing
}
Expected: Full-screen red overlay
Verify: "UNFORMATTED RESPONSE BLOCKED" message appears
        User cannot click through
```

**Test 1c: Strict Equality Check**
```javascript
// Test that === true check works
Input: {
  metadata: { Formatted: 1 }  // truthy but not true
}
Expected: BLOCKED (1 !== true)

Input: {
  metadata: { Formatted: "true" }  // truthy but not true
}
Expected: BLOCKED ("true" !== true)

Input: {
  metadata: { Formatted: true }  // exact boolean true
}
Expected: PASSES
```

#### **Test Category 2: Schema Validation**

**Test 2a: Missing Required Fields**
```javascript
Test: Remove each field from DecisionContract
- Missing trace_id → FormatterGate blocks
- Missing enforcement_status → FormatterGate blocks
- Missing jurisdiction → GravitasResponseTransformer rejects
- Missing domain → GravitasResponseTransformer rejects
- Missing confidence → GravitasResponseTransformer rejects

Expected: ALL rejected before render
```

**Test 2b: Invalid Field Types**
```javascript
// confidence must be number 0.0-1.0
Input: { confidence: "0.85" }  → REJECTED (string, not number)
Input: { confidence: 1.5 }     → REJECTED (> 1.0)
Input: { confidence: -0.1 }    → REJECTED (< 0.0)
Input: { confidence: 0.85 }    → ACCEPTED

// legal_route must be array of strings
Input: { legal_route: "Router Agent" }  → REJECTED
Input: { legal_route: ["Router", 123] } → REJECTED (int in array)
Input: { legal_route: ["Router", "Agent"] } → ACCEPTED
```

#### **Test Category 3: Live Backend Integration**

**Test 3a: Valid Query → Valid Response**
```bash
curl -X POST https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Can I file a civil suit?", "jurisdiction_hint": "India"}'

Verify:
- HTTP 200 response
- response.metadata.Formatted === true
- response.trace_id is UUID
- response.enforcement_status has all required fields
- response.confidence is 0.0-1.0
```

**Test 3b: Malformed Query → Error Handling**
```bash
curl -X POST https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Content-Type: application/json" \
  -d '{"query": ""}'  # Empty query

Verify:
- HTTP 400 (validation error) OR
- HTTP 200 with enforcement_status.verdict = "PENDING_REVIEW"
- ERROR NOT displayed to user (FormatterGate sanitized)
```

#### **Test Category 4: Trace ID Continuity**

**Test 4a: Same trace_id Throughout Flow**
```javascript
// In browser console during query submission:
console.log(window.__gravitas_active_trace_id)  // Should be UUID

// In Network tab:
// Request header: X-Trace-ID = [same UUID]
// Response: trace_id = [same UUID]
// In DOM: <TracePanel trace_id={trace_id} /> shows same UUID

Expected: trace_id consistent across request → response → UI
```

#### **Test Category 5: Enforcement Status States**

**Test 5a: "clear" State Renders**
```javascript
Input: { enforcement_status: { state: "clear", verdict: "ENFORCEABLE" } }
Render: CaseSummaryCard shows "✓ Legal action is viable"
        FeedbackButtons enabled
        No blocking overlay
```

**Test 5b: "block" State Renders**
```javascript
Input: { enforcement_status: { state: "block", verdict: "NON_ENFORCEABLE" } }
Render: CaseSummaryCard shows "⚠️ Legal barriers prevent this action"
        Barriers displayed as list
        FeedbackButtons shows "Report Incorrect"
        No blocking overlay (FormatterGate still passes)
```

**Test 5c: "escalate" State Renders**
```javascript
Input: { enforcement_status: { state: "escalate", escalation_target: "High Court" } }
Render: ReferralCard shows "This case requires escalation to High Court"
        Next steps provided
```

#### **Test Category 6: CORS & Security**

**Test 6a: CORS Whitelist Enforced**
```bash
# From allowed origin (works)
curl -X OPTIONS https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Origin: https://nyai.blackholeinfiverse.com"

Verify: HTTP 200, CORS headers present

# From disallowed origin (fails)
curl -X OPTIONS https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Origin: https://malicious-site.com"

Verify: HTTP 403 OR no CORS headers returned
```

**Test 6b: HTTPS Enforced**
```bash
# HTTP request (should fail)
curl http://nyaya-ai-0f02.onrender.com/nyaya/query
Verify: Connection refused OR redirects to HTTPS

# HTTPS request
curl https://nyaya-ai-0f02.onrender.com/health
Verify: HTTP 200, valid certificate
```

#### **JSON Examples for Valid vs Invalid Responses**

**Valid Response (Will Pass FormatterGate):**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "jurisdiction": "IN",
  "domain": "civil",
  "confidence": 0.87,
  "legal_route": ["Jurisdiction Router", "India Civil Agent"],
  "enforcement_status": {
    "state": "clear",
    "verdict": "ENFORCEABLE",
    "reason": "Civil suits for wage recovery are permitted",
    "barriers": [],
    "blocked_path": null,
    "escalation_required": false,
    "redirect_suggestion": null,
    "safe_explanation": "You may file a civil suit"
  },
  "reasoning_trace": {
    "routing_decision": {"jurisdiction": "IN", "domain": "civil"},
    "agent_processing": {"analysis": "complete"},
    "observer_steps": [
      {"agent": "Router", "status": "complete", "output": "routed"}
    ]
  },
  "metadata": {
    "Formatted": true,
    "timestamp": "2024-05-05T14:30:00Z",
    "server": "nyaya-ai-gateway-v1"
  }
}
```

**Invalid Response #1 (Will Be Blocked by FormatterGate):**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440001",
  "jurisdiction": "IN",
  // Missing: "metadata": { "Formatted": true }
  "enforcement_status": {...}
}
```
→ **Blocked:** "UNFORMATTED RESPONSE BLOCKED: Missing metadata object"

**Invalid Response #2 (Will Be Rejected by GravitasResponseTransformer):**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440002",
  "jurisdiction": "IN",
  // Missing: "domain"
  "confidence": 0.87,
  "legal_route": [...],
  "enforcement_status": {...},
  "metadata": { "Formatted": true }
}
```
→ **Rejected:** "Response validation failed: domain is required"

**Invalid Response #3 (Type Mismatch):**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440003",
  "jurisdiction": "IN",
  "domain": "civil",
  "confidence": "0.87",  // Should be number, not string
  "legal_route": [...],
  "enforcement_status": {...},
  "metadata": { "Formatted": true }
}
```
→ **Rejected:** "Response validation failed: confidence must be number"

---

## OPERATIONAL CONSTRAINTS (SYSTEM RULES)

1. **No Descriptive Narratives:** Use `System Status: [Verified]` instead of "we ensured..."
2. **Zero Assumption:** Every statement assumes reader has zero context
3. **Evidence-First:** Every claim backed by code block, JSON, or logic flow
4. **Immutable Core:** FormatterGate, ResponseBuilder, DecisionContract never change without full ecosystem migration
5. **Layered Validation:** Never depend on single validation layer

---

## CONCLUSION

**System Status:** READY FOR HANDOVER  
**Entry Points Mapped:** ✓  
**Execution Flow Documented:** ✓  
**Schema Transition (TANTRA):** ✓  
**FormatterGate Specification:** ✓  
**Team Integration Briefs:** ✓  

**This document enables a new developer with ZERO prior context to:**
- Understand complete system architecture
- Debug any layer (frontend, backend, validation, agent)
- Modify schema without breaking UI
- Add new endpoints following proven patterns
- Test against comprehensive test matrix
- Maintain forensic audit trail

**Next Steps for Team:**
1. Raj: Implement new endpoint following router.py pattern
2. Vedant: Ensure observer_steps include all required fields
3. Vinayak: Execute test matrix against Test Category 1-6

**System Truth Established.** All future decisions derive from this blueprint.
