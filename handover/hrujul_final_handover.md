# NYAYA SYSTEM — CIVILIZATIONAL HANDOVER DOCUMENT

**System Status:** Verified | TANTRA Directive Applied | Advisory Architecture Active

---

## Phase 1: Forensic Inventory & Entry Points

### Asset Inventory

| Component | Path | Purpose | Dependencies |
|-----------|------|---------|--------------|
| FormatterGate | `nyaya-ui-kit/components/FormatterGate.jsx` | Frontend gatekeeper. Blocks unformatted responses before UI render. | React hooks, responseData prop |
| TracePanel | `nyaya-ui-kit/components/TracePanel.jsx` | Displays execution trace with explanation_chain, determinism_proof, risk_flags. | decisionContract prop, ConfidenceIndicator |
| DecisionContract (TS) | `nyaya/packages/shared/decision_contract.ts` | TypeScript schema. Zod validation for frontend/backend contract. | zod library |
| DecisionContract (PY) | `nyaya/packages/shared/decision_contract.py` | Python schema. Pydantic validation for backend responses. | pydantic, typing, enum |
| ResponseBuilder | `nyaya/backend/router.py` | Backend orchestrator. All responses pass through this builder. | FastAPI, pydantic |
| TraceReplayUI | `nyaya-ui-kit/components/TraceReplayUI.jsx` | Replay execution steps for audit trail. | decisionContract, observerSteps |

### Entry Point Mapping

```
User → UI (FormatterGate.jsx) → API (router.py /query) → Validation (ResponseBuilder) → Render (TracePanel.jsx)
```

**Frontend UI Entry:** `FormatterGate.jsx:239-283` - Children render only after validation passes
**API Integration Entry:** `nyaya-ai-0f02.onrender.com/nyaya/query`
**Validation Gate Entry:** `ResponseBuilder.build_nyaya_response()`

### Execution Flow: Data Journey

```
1. User submits query (UI layer)
2. FormatterGate intercepts response (Checkpoint 1-5)
   - Checkpoint 1: responseData exists
   - Checkpoint 2: metadata object exists
   - Checkpoint 3: metadata.Formatted === true (strict equality)
   - Checkpoint 4: trace_id present
   - Checkpoint 5: enforcement_status present
3. Backend processes through router.py
   - STEP 1: Jurisdiction Routing
   - STEP 2: Legal Agent Processing
   - STEP 3: Observer Pipeline (mandatory)
   - STEP 4: ResponseBuilder (ONLY output source)
4. Validation triggers "Blocked" when:
   - enforcement_status.state === 'block'
   - verdict === 'NON_ENFORCEABLE'
```

---

## Phase 2: TANTRA Schema Transition (Authority → Advisory)

### Schema Migration: Before vs After

| Authority Term | Advisory Term | Field Location |
|---------------|---------------|----------------|
| enforcement | recommendation | `enforcement_status` → `recommendation_status` |
| decision | advisory | `decision` → `advisory` |
| verdict | rationale | `verdict` → `rationale` |

**Current Schema (Authority-Based):**
```json
{
  "enforcement_status": {
    "state": "clear",
    "verdict": "ENFORCEABLE"
  }
}
```

**Target Schema (Advisory-Based):**
```json
{
  "recommendation_status": {
    "state": "advisory",
    "rationale": "RECOMMENDED"
  }
}
```

### The Gate Blueprint: FormatterGate Logic

**Failure Triggers:**
1. `responseData` is null/undefined
2. `responseData.metadata` is missing
3. `responseData.metadata.Formatted !== true` (strict check)
4. `responseData.trace_id` is missing
5. `responseData.enforcement_status` is missing

**Modification Protocol (Raj/Vedant):**
- Schema changes require update to `decision_contract.ts`
- Backend `decision_contract.py` must match exactly
- FormatterGate.jsx validates against canonical schema
- Any new fields require `.strict()` mode update

### Panel Evolution: TracePanel Requirements

**Current Display:**
- Trace ID
- Jurisdiction & Domain
- Confidence Analysis
- Legal Route Sequence
- Observer Pipeline Steps
- Enforcement Status

**Required Next Display:**
```javascript
{
  explanation_chain: reasoning_trace.steps,
  determinism_proof: {
    input_hash,
    output_hash,
    timestamp
  },
  risk_flags: enforcement_status.barriers || []
}
```

---

## Phase 3: Handover Artifacts

### 1. Entry Point

**Live System URL:** `https://nyai.blackholeinfiverse.com`
**API Base:** `https://nyaya-ai-0f02.onrender.com`
**CORS:** `https://nyai.blackholeinfiverse.com` only

### 2. Core Files (Max 3)

1. `nyaya-ui-kit/components/FormatterGate.jsx` - 5 validation checkpoints
2. `nyaya/backend/router.py` - ResponseBuilder orchestration (line 146-158)
3. `nyaya/packages/shared/decision_contract.ts` - Zod schema (lines 32-40)

### 3. Live Flow

```javascript
// Success: User → UI → API → Validation → Render
const flow = {
  step1: "FormatterGate receives responseData",
  step2: "Checkpoints 1-5 pass",
  step3: "validationState = 'valid'",
  step4: "Children render with TracePanel"
}

// Failure: Blocked State Triggers
const blocked = {
  condition: "enforcement_status.state === 'block'",
  evidence: "metadata.Formatted !== true",
  result: "FullScreenBlockingOverlay renders"
}
```

### 4. Built Assets

```
/dist/
  formatter-gate.bundle.js  (FormatterGate compiled)
  trace-panel.bundle.js     (TracePanel compiled)
  decision-contract.d.ts    (TypeScript declarations)
```

Build command: `npm run build` from `nyaya-ui-kit/`

### 5. Failure Cases

| Case | Trigger | Evidence |
|------|---------|----------|
| Missing metadata | No `metadata` object | Console: "Missing metadata object" |
| Formatted false | `Formatted !== true` | 422 error, state=error |
| Schema injection | Extra fields | HTTP 422, pydantic rejects |
| Backend error | Exception thrown | ResponseBuilder.error_format |

### 6. Proof

**Attack Vector 1 Blocked:**
```
[FORMATTERGATE] Checkpoint 2: metadata object check → FAILED
TRACE_ID: 550e8400-e29b-41d4-a716-446655440000
RENDERING_TERMINATED
```

**Attack Vector 2 Blocked:**
```
[FORMATTERGATE] Checkpoint 3: metadata.Formatted === true → FAILED (is: false)
RENDERING_TERMINATED
```

---

## Phase 4: Integration Briefs

### For Raj (Backend)

**API Connection Steps:**
1. Ensure `/query` endpoint uses ResponseBuilder (line 146)
2. Update `decision_contract.py` enums to match TypeScript
3. Inject `trace_id` at gateway via middleware
4. Set `metadata.Formatted = true` only after validation

**Enum Updates:**
```python
# Current
class EnforcementState(str, Enum):
    CLEAR = "clear"
    BLOCK = "block"
    ESCALATE = "escalate"

# TANTRA Migration Target
class RecommendationState(str, Enum):
    ADVISORY = "advisory"
    BLOCKED = "blocked"
    ESCALATE = "escalate"
```

### For Vedant (Observer)

**Hook Attachment Points:**
- `router.py:138-142` - Observer pipeline processing
- `reasoning_trace` - Log here for TracePanel display
- Required fields: `observation_id`, `timestamp`, `confidence_validated`, `pipeline_stage`

**Logging Fields (Mandatory):**
```json
{
  "observation_id": "obs-{uuid}",
  "timestamp": "ISO8601",
  "confidence_validated": 0.0-1.0,
  "pipeline_stage": "observer_pipeline",
  "explanation_chain": [],
  "risk_flags": []
}
```

### For Vinayak (Testing)

**Test Readiness: Valid vs Invalid**

**Valid Response (200):**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "jurisdiction": "India",
  "domain": "criminal",
  "legal_route": ["jurisdiction_router_agent", "india_legal_agent"],
  "reasoning_trace": { "routing_decision": {}, "agent_processing": {} },
  "enforcement_status": {
    "state": "clear",
    "verdict": "ENFORCEABLE"
  },
  "confidence": 0.87,
  "metadata": { "Formatted": true }
}
```

**Invalid Response (422):**
```json
{
  "enforcement_status": {
    "state": "RESTRICT",
    "verdict": "ALLOW_INFORMATIONAL"
  }
}
```
Error: "Input should be 'clear', 'block', 'escalate', 'soft_redirect' or 'conditional'"

---

## TANTRA Directive Status

**System Status:** PARTIAL - Authority terms still active in schema
**Next Action:** Rename `enforcement` → `recommendation`, `verdict` → `rationale`
**Migration File:** `handover/TANTRA_MIGRATION.md` (to be created)