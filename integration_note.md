# integration_note.md
# Nyaya Platform — Unified Pipeline Integration Specification

**Version:** 1.0  
**Authors:** Raj (Backend), Vedant (Observer Pipeline)  
**Audience:** Future developers, QA engineers, system integrators

---

## 1. System Boundary Map

The Nyaya platform is a monorepo split across three ownership boundaries:

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Vedant's UI layer)                                  │
│  nyaya/frontend/frontend/src/                                   │
│  React 18 + Vite + Axios                                        │
│  Deployed: Vercel → nyai.blackholeinfiverse.com                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS POST /nyaya/query
                     │ Origin: https://nyai.blackholeinfiverse.com
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND API GATEWAY  (Raj's layer)                             │
│  nyaya/backend/                                                 │
│  FastAPI + Uvicorn + Pydantic v2                                │
│  Deployed: Render → nyaya-ai-0f02.onrender.com                  │
│                                                                 │
│  Entry: main.py → router.py → ResponseBuilder                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ in-process function call
                     │ observer_pipeline.process_result(...)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  OBSERVER PIPELINE  (Vedant's pipeline layer)                   │
│  nyaya/observer_pipeline/                                       │
│  Pure Python — no HTTP boundary                                 │
│                                                                 │
│  ObserverPipeline → JurisdictionRouter → LegalAgent             │
│  → RewardEngine → HashChainLedger                               │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  SHARED CONTRACT  (owned jointly)                               │
│  nyaya/packages/shared/decision_contract.py                     │
│  nyaya/packages/shared/decision_contract.ts                     │
│  Single source of truth for both Python and TypeScript          │
└─────────────────────────────────────────────────────────────────┘
```

**Critical rule:** The Observer Pipeline is NOT a separate service. It is called in-process by `router.py`. There is no HTTP hop between Raj's backend and Vedant's pipeline. Any future refactor that introduces a network boundary here must replicate the formatter gate and schema validation at the new boundary.

---

## 2. The DecisionContract — Canonical Schema

**File:** `nyaya/packages/shared/decision_contract.py`

This is the single immutable schema that governs every data exchange point in the system. It is enforced at three independent layers:

### 2.1 Python Schema (Backend + Pipeline)

```python
class DecisionContract(BaseModel):
    trace_id:           str                # UUID, non-empty
    jurisdiction:       str                # "India" | "UK" | "UAE"
    domain:             str                # "criminal" | "civil" | "constitutional"
    legal_route:        List[str]          # min 1 element, agent chain
    reasoning_trace:    Dict[str, Any]     # routing + agent + observer data
    enforcement_status: EnforcementStatus  # nested model (see §2.2)
    confidence:         float              # 0.0 – 1.0 inclusive

    class Config:
        extra = 'forbid'                   # NO extra fields — ever
```

### 2.2 EnforcementStatus Sub-Schema

```python
class EnforcementStatus(BaseModel):
    state:                EnforcementState    # clear|block|escalate|soft_redirect|conditional
    verdict:              EnforcementVerdict  # ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE
    reason:               str = ""
    barriers:             List[str] = []
    blocked_path:         str = None
    escalation_required:  bool = False
    escalation_target:    str = None
    redirect_suggestion:  str = None
    safe_explanation:     str = ""
    trace_id:             str               # must match parent trace_id
```

### 2.3 NyayaResponse Extension (Backend Wire Format)

`NyayaResponse` in `backend/schemas.py` extends `DecisionContract` with two additional fields:

```python
class NyayaResponse(DecisionContract):
    constitutional_articles: List[str] = []
    provenance_chain:        List[Dict[str, Any]] = []
    metadata:                Dict[str, Any] = {}   # MUST contain {"Formatted": True}
```

The `metadata.Formatted` flag is the formatter gate sentinel. Its absence on any 200 response is a pipeline bypass and must be treated as a critical security event.

### 2.4 TypeScript Mirror (Frontend)

`nyaya/packages/shared/decision_contract.ts` mirrors the Python schema for frontend type safety. Any change to the Python schema **must** be reflected here simultaneously.

---

## 3. Raj ↔ Vedant Integration Points

### 3.1 Point 1 — Router calls ObserverPipeline (Primary Integration)

**File:** `nyaya/backend/router.py`, line ~83

```python
# Raj's router calls Vedant's pipeline — unconditional, no bypass possible
observed_result = await observer_pipeline.process_result(
    agent_result,       # raw output from LegalAgent
    trace_id,           # UUID generated by get_trace_id() dependency
    target_jurisdiction # "India" | "UK" | "UAE"
)
```

**Contract at this boundary:**
- Input: raw `Dict[str, Any]` from `LegalAgent.process()`
- Output: enriched dict with `observation` key containing `pipeline_stage`, `confidence_validated`, `completeness_score`, `observation_id`, `timestamp`
- The router reads `observed_result["observation"]["confidence_validated"]` to build the final response
- If `ObserverPipeline.process_result()` raises, the router's `except` block returns a structured 500 — the exception is never propagated raw to the client

### 3.2 Point 2 — ResponseBuilder validates against DecisionContract

**File:** `nyaya/backend/response_builder.py`, `build_nyaya_response()`

```python
# After building NyayaResponse, Raj's ResponseBuilder validates against Vedant's contract
try:
    validate_decision_contract(response.dict())
except Exception as validation_error:
    raise ValueError(f"DecisionContract validation failed: {str(validation_error)}")
```

This is the backend-side formatter gate. If the assembled response fails schema validation, it is rejected before being sent to the client. The frontend never receives an invalid contract.

### 3.3 Point 3 — Frontend nyayaApiClient validates Formatted flag

**File:** `nyaya/frontend/frontend/src/lib/nyayaApiClient.js`

```javascript
// Vedant's frontend interceptor — second formatter gate
if (!response.data?.metadata?.Formatted) {
    throw new Error('UNFORMATTED_RESPONSE: Response rejected due to missing Formatted metadata tag')
}
validateDecisionContract(response.data)  // TypeScript schema validation
```

This is the client-side formatter gate. Even if a response somehow bypassed the backend gate, the frontend interceptor would reject it before any component renders.

### 3.4 Point 4 — Enforcement Status Gatekeeper

**File:** `nyaya/backend/router.py`, `get_enforcement_status()` endpoint

The enforcement status is computed from `_trace_store[trace_id]["confidence"]` which is populated during `/nyaya/query`. The confidence thresholds map directly to Vedant's `EnforcementState` enum:

| Confidence Range | State | Verdict | UI Behavior |
|---|---|---|---|
| ≥ 0.80 | `clear` | `ENFORCEABLE` | Full decision rendered |
| 0.65 – 0.79 | `conditional` | `PENDING_REVIEW` | Caution overlay shown |
| 0.40 – 0.64 | `escalate` | `PENDING_REVIEW` | Escalation notice shown |
| < 0.40 | `block` | `NON_ENFORCEABLE` | Decision blocked, barriers listed |

---

## 4. The No-Bypass Architecture

The "no-bypass" guarantee is enforced by three independent gates that must all pass for data to reach the UI:

```
Backend Gate 1: ResponseBuilder.build_nyaya_response()
  └─ validate_decision_contract(response.dict())
  └─ Sets metadata={"Formatted": True}
  └─ Raises ValueError on schema violation → 500 returned, no data sent

Backend Gate 2: AuditLogMiddleware
  └─ Reads response body, checks metadata.Formatted
  └─ Logs formatted=false if gate was bypassed (detection layer)

Frontend Gate 3: nyayaApiClient response interceptor
  └─ Checks response.data.metadata.Formatted === true
  └─ Calls validateDecisionContract(response.data)
  └─ Throws UNFORMATTED_RESPONSE or INVALID_CONTRACT
  └─ Error propagates to ErrorBoundary → SystemCrash overlay
```

A response must pass all three gates. Gates 1 and 3 are blocking (they prevent data from proceeding). Gate 2 is detective (it logs bypasses for audit).

---

## 5. Agent Chain Architecture

```
JurisdictionRouterAgent (GLOBAL_ROUTER)
  ├─ _extract_jurisdiction(query) → "IN" | "UK" | "UAE"
  ├─ _map_to_agent(jurisdiction) → agent_id string
  └─ emit_event("jurisdiction_resolved", {...})
        │
        ▼
LegalAgent (jurisdiction-specific instance)
  ├─ process(query) → {query_type, jurisdiction, confidence, target_agent}
  ├─ _determine_target_agent(query) → "constitutional_agent"
  └─ emit_event("agent_classified", {...})
        │
        ▼
ObserverPipeline.process_result(agent_result, trace_id, jurisdiction)
  ├─ Validates confidence (clamps to 0.5 if invalid)
  ├─ Adds observation metadata block
  ├─ _apply_observation_rules() → flags low confidence, scores completeness
  └─ Returns enriched result dict
        │
        ▼
ResponseBuilder.build_nyaya_response()
  ├─ Constructs NyayaResponse (extends DecisionContract)
  ├─ Sets metadata={"Formatted": True}
  ├─ Calls validate_decision_contract() — raises on failure
  └─ Returns validated NyayaResponse
```

---

## 6. Provenance Chain

**Files:** `nyaya/observer_pipeline/provenance_chain/`

Every significant event is signed and appended to a SHA-256 hash chain ledger:

```
HashChainLedger (provenance_ledger.json)
  ├─ Genesis block: prev_hash = "0" * 64
  ├─ Each entry: {index, timestamp, event_hash, prev_hash, signed_event}
  ├─ event_hash = SHA256(canonical_json(signed_event))
  └─ verify_chain_integrity() checks prev_hash linkage across all entries
```

The `RewardEngine` is the primary writer — it calls `ledger.append_event(signed_event)` after every RL feedback computation. The `router.py` background tasks are wired to emit events but currently write to local dicts (not the ledger) — this is a known open item.

---

## 7. Environment Variable Contract

All environment variables are documented here as the authoritative reference. No hardcoded values are permitted in production code.

### Backend (`nyaya/backend/.env.production`)

| Variable | Required | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | YES | Comma-separated CORS whitelist. Must include `https://nyai.blackholeinfiverse.com` |
| `HMAC_SECRET_KEY` | YES | Min 32 chars. Generate: `openssl rand -hex 32` |
| `SIGNING_METHOD` | YES | `HMAC_SHA256` |
| `SIGNING_KEY_ID` | YES | Key identifier for rotation tracking |
| `HOST` | YES | `0.0.0.0` |
| `PORT` | YES | `8000` |
| `LOG_LEVEL` | NO | `info` (default) |

### Frontend (`nyaya/frontend/frontend/.env.production`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | YES | Backend base URL. `https://nyaya-ai-0f02.onrender.com` |

**Note:** `VITE_` prefix is mandatory for Vite to expose variables to the browser bundle. Variables without this prefix are invisible to client-side code.

### Observer Pipeline (`nyaya/observer_pipeline/.env.production`)

| Variable | Required | Description |
|---|---|---|
| `PIPELINE_ENV` | NO | `production` |
| `ALLOWED_ORIGINS` | YES | Must match backend value |
| `HMAC_SECRET_KEY` | YES | Must match backend value (shared secret) |

---

## 8. Failure Handling Protocols

### 8.1 Backend Timeout / Unavailability

```
Frontend detects: status >= 500 OR ECONNREFUSED OR ETIMEDOUT
  └─ nyayaApi.js global interceptor fires _emitFailure() + _emitOutage()
  └─ useResiliency hook receives onBackendFailure event
  └─ Saves current case intake to offlineStore (localStorage)
  └─ Sets isOffline=true → OfflineBanner renders globally
  └─ Polls GET /health every 15 seconds
  └─ On recovery: clearServiceOutage() → OfflineBanner dismisses
  └─ syncToServer() replays pending intake data
```

### 8.2 Schema Mismatch (INVALID_CONTRACT)

```
nyayaApiClient interceptor throws INVALID_CONTRACT
  └─ Error propagates up the call stack
  └─ Component's catch block receives error
  └─ ApiErrorState renders with trace_id and "Report Issue" button
  └─ If uncaught: ErrorBoundary.componentDidCatch() fires
  └─ SystemCrash overlay renders with trace_id and "Return to Dashboard"
  └─ _reportError() logs payload (trace_id, stack, componentStack, timestamp)
```

### 8.3 Enforcement Fetch Failure

```
casePresentationService.getEnforcementStatus() fails
  └─ Returns hardcoded fallback — NEVER silently clears:
     { state: "block", verdict: "NON_ENFORCEABLE",
       barriers: ["Verification endpoint unreachable"] }
  └─ EnforcementGatekeeper/ComplianceBarrier renders blocked state
  └─ User cannot proceed to decision view
```

### 8.4 Agent RuntimeError (Chaos Path)

```
LegalAgent.process() raises RuntimeError
  └─ router.py except block catches it
  └─ Returns HTTP 500 with ErrorResponse schema:
     { error_code: "INTERNAL_ERROR", message: "...", trace_id: "..." }
  └─ Raw Python traceback is NEVER included in response body
  └─ AuditLogMiddleware logs: formatted=false, schema_valid=false
```

---

## 9. Multi-Jurisdiction Parallel Execution

`POST /nyaya/multi_jurisdiction` runs agents concurrently via `asyncio.gather()`:

```python
results = await asyncio.gather(
    *[agent.process({...}) for _, agent in tasks],
    return_exceptions=True   # ← critical: one agent failure does not kill others
)
```

Each failed agent result is caught individually and assigned `confidence=0.1` with `legal_route=["failed"]`. The aggregate response is still returned with partial results. The frontend `MultiJurisdictionCard` must handle per-jurisdiction error states independently.

---

## 10. Known Limitations and Open Items

| ID | Component | Description | Priority |
|---|---|---|---|
| OI-01 | `router.py` | `_trace_store` is in-memory — lost on restart. Replace with Redis | HIGH |
| OI-02 | `router.py` | Background task event dicts are built but not written to `HashChainLedger` | MEDIUM |
| OI-03 | `dependencies.py` | `validate_nonce()` is a placeholder — real anti-replay logic not implemented | HIGH |
| OI-04 | `ErrorBoundary` | `_reportError()` logs to console only — no external error tracking | MEDIUM |
| OI-05 | `LegalAgent` | `generate_confidence_score()` returns hardcoded `0.5` — no real scoring | HIGH |
| OI-06 | `decision_contract.ts` | TypeScript mirror must be kept in sync manually — no codegen | LOW |
