# Integration Note: Nyaya AI Frontend ↔ Backend

**Status:** Live  
**Backend:** `https://nyaya-ai-0f02.onrender.com`  
**Env Variable:** `VITE_API_URL` (falls back to hardcoded URL if unset)  
**API Prefix:** `/nyaya`  
**Auth:** None (session identity via `trace_id` only)

---

## Transport Layer

Two HTTP clients coexist in the frontend:

| Client | File | Library | Purpose |
|---|---|---|---|
| `apiClient` | `services/nyayaApi.js` | Axios | Primary — all case presentation + query services |
| `nyayaClient` | `services/nyayaBackendApi.js` | Axios | Secondary — used exclusively by `DecisionPage.jsx` |
| `apiRequest` | `services/apiService.js` | Fetch API | Utility wrapper — toast notifications on 5xx |

Both Axios instances share the same `baseURL` and 30-second timeout. `apiClient` has the full interceptor stack; `nyayaClient` has a response-only error logger.

---

## Request Interceptor — Trace ID Injection

Every request sent through `apiClient` automatically receives an `X-Trace-ID` header:

```js
// nyayaApi.js
apiClient.interceptors.request.use((config) => {
  const traceId = window.__gravitas_active_trace_id
  if (traceId) config.headers['X-Trace-ID'] = traceId
  return config
})
```

`window.__gravitas_active_trace_id` is written by `setActiveTraceId(traceId)` after every successful `/nyaya/query` response. This propagates the active trace into all subsequent case presentation calls, enabling end-to-end correlation on the backend.

---

## Response Interceptor — Outage Detection

```js
// nyayaApi.js — simplified
apiClient.interceptors.response.use(
  (response) => { clearServiceOutage(); return response },
  (error) => {
    const isServerError  = error.response?.status >= 500
    const isNetworkError = !error.response && ['ECONNREFUSED','ERR_NETWORK','ERR_CONNECTION_REFUSED'].includes(error.code)
    const isTimeout      = ['ECONNABORTED','ETIMEDOUT'].includes(error.code)

    if (isServerError || isNetworkError || isTimeout) {
      _emitFailure(errorDetails)   // → useResiliency
      _emitOutage(errorDetails)    // → ServiceOutage UI
    }
    return Promise.reject(error)
  }
)
```

On recovery (any successful response), `clearServiceOutage()` resets the outage flag and notifies all listeners.

---

## Backend Middleware — Trace ID Generation

The FastAPI backend generates a UUID `trace_id` per request in `api/main.py`:

```python
@app.middleware("http")
async def add_trace_id_middleware(request: Request, call_next):
    import uuid
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    response = await call_next(request)
    return response
```

This `trace_id` is embedded in every `NyayaResponse` and `EnforcementStatus` object returned to the frontend.

---

## Endpoint Inventory

| Method | Path | Frontend Caller | Description |
|---|---|---|---|
| `POST` | `/nyaya/query` | `legalQueryService.submitQuery()` | Single-jurisdiction legal decision |
| `POST` | `/nyaya/multi_jurisdiction` | `legalQueryService.submitMultiJurisdictionQuery()` | Parallel multi-jurisdiction analysis |
| `POST` | `/nyaya/explain_reasoning` | `legalQueryService.explainReasoning()` | Reasoning explanation by trace_id |
| `POST` | `/nyaya/feedback` | `legalQueryService.submitFeedback()` | RL engine feedback (rating 1–5) |
| `POST` | `/nyaya/rl_signal` | `legalQueryService.sendRLSignal()` | Boolean RL training signal |
| `GET` | `/nyaya/trace/{trace_id}` | `legalQueryService.getTrace()` | Full sovereign audit trail |
| `GET` | `/nyaya/case_summary` | `casePresentationService.getCaseSummary()` | Case summary for presentation |
| `GET` | `/nyaya/legal_routes` | `casePresentationService.getLegalRoutes()` | Legal pathways for the case |
| `GET` | `/nyaya/timeline` | `casePresentationService.getTimeline()` | Chronological case events |
| `GET` | `/nyaya/glossary` | `casePresentationService.getGlossary()` | Jurisdiction-specific legal terms |
| `GET` | `/nyaya/jurisdiction_info` | `casePresentationService.getJurisdictionInfo()` | Court system metadata |
| `GET` | `/nyaya/enforcement_status` | `casePresentationService.getEnforcementStatus()` | Enforcement gatekeeper verdict |
| `GET` | `/health` | `healthService.checkHealth()` | Backend liveness probe |

---

## Enforcement Status Logic (Backend)

The `/nyaya/enforcement_status` endpoint derives its verdict from the `confidence` score stored in `_trace_store` at query time:

| Confidence Range | State | Verdict |
|---|---|---|
| `< 0.40` | `block` | `NON_ENFORCEABLE` |
| `0.40 – 0.64` | `escalate` | `PENDING_REVIEW` |
| `0.65 – 0.79` | `conditional` | `PENDING_REVIEW` |
| `≥ 0.80` | `clear` | `ENFORCEABLE` |

The frontend `_validateEnforcementStatus()` in `nyayaApi.js` enforces these exact enum values before any data reaches component state. On any fetch failure, the frontend defaults to `state: 'block'` / `verdict: 'NON_ENFORCEABLE'` — never silently passing as clear.

---

## Offline Resiliency

`useResiliency` subscribes to `onBackendFailure` events from the Axios interceptor. On failure:

1. `isOffline` → `true`
2. Current `caseIntakeRef.current` snapshot is written to `localStorage` under key `gravitas_case_intake`
3. A pending sync marker is written under `gravitas_pending_sync`
4. `OfflineBanner` renders globally (fixed bottom, z-index 2000)
5. `/health` is polled every 15 seconds via `healthService.checkHealth()`
6. On recovery, `isOffline` → `false`, polling stops, "Sync Case to Server" button becomes active

---

## CORS

Backend is configured with `allow_origins=["*"]` in `api/main.py`. This is acceptable for the current development/staging phase. Restrict to the Vercel deployment domain before production hardening.

---

## Known Integration Constraints

- `nyayaClient` in `nyayaBackendApi.js` hardcodes the base URL directly — it does not read from `VITE_API_URL`. If the backend URL changes, both files must be updated.
- The `_trace_store` in `api/router.py` is in-memory. A backend restart clears all stored trace data, causing `/nyaya/enforcement_status` to return 404 for any previously issued `trace_id`.
- `casePresentationService.getAllCaseData()` requires a valid `traceId` prop. Without it, `CasePresentation` surfaces an error state immediately rather than fetching.
