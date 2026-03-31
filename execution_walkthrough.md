# Execution Walkthrough: Full Request Lifecycle

This document traces a single legal query from user input to rendered UI, step by step, referencing the exact files and functions involved at each stage.

---

## Scenario

User navigates to the Decision module and submits:
> "What are the procedures for filing a civil suit in India?"

---

## Step 1 — View Mount

**File:** `frontend/src/App.jsx`

User clicks "Decision Draft" in the `StaggeredMenu`. `onItemClick` fires with `item.value = 'decision-draft'`, calling `setActiveView('decision-draft')`. `renderView()` evaluates the switch and mounts `<LegalDecisionDocument />` inside `<ErrorBoundary>`.

For the standalone Decision module, the user navigates to `activeView = 'decision'`, which mounts `<DecisionPage />` inside `<ErrorBoundary>`.

```
StaggeredMenu.onItemClick('decision')
  → setActiveView('decision')
  → renderView() → case 'decision'
  → <ErrorBoundary><DecisionPage /></ErrorBoundary>
```

---

## Step 2 — Query Submission

**File:** `frontend/src/components/DecisionPage.jsx`

User types the query and clicks "Get Legal Decision". `handleSubmitQuery(e)` fires:

```js
e.preventDefault()
setLoading(true)
setError(null)
setDecision(null)

const result = await queryNyayaDecision(query.trim())
```

---

## Step 3 — API Call

**File:** `frontend/src/services/nyayaBackendApi.js` → `queryNyayaDecision()`

```js
const response = await nyayaClient.post('/nyaya/query', {
  query: query.trim(),
  jurisdiction_hint: 'IN'
})
```

The Axios request interceptor in `nyayaApi.js` (on `apiClient`) would inject `X-Trace-ID` here if `window.__gravitas_active_trace_id` is set. `nyayaClient` does not have this interceptor — it sends the request without the header on the first call.

**Network:** `POST https://nyaya-ai-0f02.onrender.com/nyaya/query`

---

## Step 4 — Backend Processing

**File:** `api/main.py` → `add_trace_id_middleware`

A UUID `trace_id` is generated and attached to `request.state`. The request is routed to `api/router.py` → `query_legal()`.

**File:** `api/router.py` → `query_legal()`

```
1. emit_query_received_event (background task)
2. JurisdictionRouterAgent.process({ query, jurisdiction_hint, domain_hint })
   → returns { target_jurisdiction: "IN", target_agent: "india_legal_agent" }
3. agents["IN"].process({ query, trace_id })
   → LegalAgent returns { confidence: 0.91, ... }
4. ResponseBuilder.build_nyaya_response(...)
5. _trace_store[trace_id] = { confidence, jurisdiction, domain }
   ← stored for enforcement_status lookup
6. Return NyayaResponse
```

---

## Step 5 — Response Receipt

**File:** `frontend/src/services/nyayaBackendApi.js`

```js
return {
  success: true,
  data: response.data,   // NyayaResponse object
  timestamp: new Date().toISOString()
}
```

**File:** `frontend/src/components/DecisionPage.jsx`

```js
if (!result.success) throw new Error(result.error)
setDecision(result.data)
console.log('Decision received:', result.data.trace_id)
```

`window.__gravitas_active_trace_id` is now set via `setActiveTraceId(result.data.trace_id)` if called — subsequent `apiClient` requests will carry `X-Trace-ID`.

---

## Step 6 — UI Render: Enforcement Banner

`DecisionPage.jsx` evaluates `decision.enforcement_decision`:

```js
getEnforcementColor('ALLOW')  → '#28a745'
getEnforcementLabel('ALLOW')  → '✅ ALLOWED'
```

The enforcement banner renders with a left border in the enforcement color. All downstream sections (Legal Analysis, Procedural Steps, Timeline, Evidence, Remedies, Legal Route, Provenance, Confidence) are conditionally rendered only because `decision` is now non-null.

---

## Step 7 — Parallel Case Presentation Fetch

**File:** `frontend/src/App.jsx` → `CasePresentation` component

If `CasePresentation` is mounted (e.g., from `LegalQueryCard` flow), it fires `fetchCaseData()` on mount:

```js
const [caseResult, enforcementResult] = await Promise.all([
  casePresentationService.getAllCaseData(traceId, currentJurisdiction, caseType, caseId),
  casePresentationService.getEnforcementStatus(traceId, currentJurisdiction)
])
```

`getAllCaseData()` internally fires five parallel requests:

```
Promise.all([
  GET /nyaya/case_summary?trace_id=...&jurisdiction=India
  GET /nyaya/legal_routes?trace_id=...&jurisdiction=India&case_type=...
  GET /nyaya/timeline?trace_id=...&jurisdiction=India&case_id=...
  GET /nyaya/glossary?trace_id=...&jurisdiction=India&case_type=...
  GET /nyaya/jurisdiction_info?jurisdiction=India
])
```

All five carry `X-Trace-ID` via the request interceptor.

---

## Step 8 — Schema Validation

**File:** `frontend/src/services/nyayaApi.js`

Each response passes through a strict validator before being stored in state:

| Validator | Required Fields |
|---|---|
| `_validateCaseSummary()` | `title`, `overview`, `jurisdiction`, `confidence`, `summaryAnalysis` |
| `_validateLegalRoutes()` | `routes[]` (non-empty), `jurisdiction` |
| `_validateTimeline()` | `events[]` (non-empty), `jurisdiction`, valid `type` and `status` enums |
| `_validateGlossary()` | `terms[]` (non-empty), `jurisdiction` |
| `_validateEnforcementStatus()` | `state` ∈ valid enum, `verdict` ∈ valid enum |

Any validator that throws causes the service method to return `{ success: false, error: "..." }`. The `CasePresentation` component renders an error banner with a retry counter — no partial data reaches the card components.

**File:** `frontend/src/lib/casePayloadValidator.js`

For the document view flow, `validateCasePayload(payload, strict)` validates all 9 fields of the formatter contract. The Zod schema (`casePayloadZodSchema`) provides a secondary layer when Zod is available.

---

## Step 9 — Component Render

**File:** `frontend/src/App.jsx` → `CasePresentation`

Validated data is spread into card components:

```jsx
<EnforcementStatusCard enforcementStatus={caseData.enforcementStatus} traceId={traceId} />
<JurisdictionInfoBar jurisdiction={caseData.jurisdictionInfo} />
<CaseSummaryCard {...caseData.caseSummary} traceId={traceId} />
<LegalRouteCard {...caseData.legalRoutes} traceId={traceId} />
<TimelineCard {...caseData.timeline} traceId={traceId} />
<GlossaryCard {...caseData.glossary} traceId={traceId} />
```

`EnforcementStatusCard` renders nothing if `state === 'clear'`. For all other states (`block`, `escalate`, `soft_redirect`, `conditional`), it renders a color-coded card with `safe_explanation`, `reason`, `blocked_path`, `escalation_target`, and `redirect_suggestion` as applicable.

---

## Step 10 — Error Path (Backend Down)

If any request in Steps 3–7 fails with a network error or 5xx:

```
Axios response interceptor
  → _emitFailure(errorDetails)     → useResiliency → isOffline = true
  → _emitOutage(errorDetails)      → ServiceOutage listeners notified
  → offlineStore.save(snapshot)    → localStorage['gravitas_case_intake']
  → offlineStore.markPendingSync() → localStorage['gravitas_pending_sync']
  → OfflineBanner renders globally
  → setInterval(probeHealth, 15000) starts
```

`apiService.js` additionally fires `toast.error("Backend waking up... please wait.")` for any 5xx or fetch failure.

---

## Step 11 — Feedback / RL Signal

After the decision renders, the user can submit feedback via `FeedbackButtons`:

```
legalQueryService.submitFeedback({ trace_id, rating, feedback_type, comment })
  → POST /nyaya/feedback
  → FeedbackAPI.receive_feedback() in rl_engine/feedback_api.py
  → background task: _emit_feedback_received_event()

legalQueryService.sendRLSignal({ trace_id, helpful, clear, match })
  → POST /nyaya/rl_signal
  → background task: _emit_rl_signal_received_event()
```

`sendRLSignal()` validates that `trace_id` is a non-empty string and all three signal fields are booleans before making the request — invalid inputs return `{ success: false }` without hitting the network.

---

## Step 12 — Export

User clicks "Export Decision" in `DecisionPage.jsx`:

```js
const dataBlob = new Blob([JSON.stringify(decision, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(dataBlob)
const link = document.createElement('a')
link.href = url
link.download = `decision-${decision.trace_id}.json`
link.click()
```

The full `NyayaResponse` object is exported as a JSON file named with the `trace_id`.

---

## Execution Summary

```
User Input
  └─ DecisionPage.handleSubmitQuery()
       └─ nyayaBackendApi.queryNyayaDecision()
            └─ POST /nyaya/query
                 └─ FastAPI: add_trace_id_middleware → query_legal()
                      └─ JurisdictionRouterAgent → LegalAgent["IN"]
                           └─ NyayaResponse { trace_id, enforcement_decision, confidence, ... }
                                └─ DecisionPage.setDecision()
                                     └─ UI renders enforcement banner + all decision sections
                                          └─ CasePresentation (parallel)
                                               └─ Promise.all(5 GET endpoints)
                                                    └─ Validators → Card components
```
