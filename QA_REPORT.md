# Nyaya Platform — QA Report
**Prepared for:** Vinayak Tiwari  
**Environment:** Production (`nyai.blackholeinfiverse.com` → `nyaya-ai-0f02.onrender.com`)  
**Date:** 2025-07-14

---

## Executive Summary

All critical execution paths have been instrumented and validated. The formatter gate is enforced at both the backend (ResponseBuilder) and frontend (nyayaApiClient interceptor). The Observer Pipeline is triggered on every successful query. No raw backend data can reach the UI without passing through the formatter. The DecisionContract schema is immutable — extra fields are rejected by Pydantic's `extra='forbid'` config.

**Overall Status: READY FOR HIGH-STAKES TESTING**

---

## 1. Test Suites Delivered

| Suite | File | Runner |
|---|---|---|
| Backend functional + chaos | `test_qa_suite.py` | `pytest -v` |
| Frontend chaos + defensive UI | `src/tests/chaos.test.js` | `npx vitest run` |
| Audit log middleware | `nyaya/backend/audit_logger.py` | auto-attached to FastAPI |

### How to Run

```bash
# Backend (from repo root)
pip install pytest pytest-asyncio httpx
pytest test_qa_suite.py -v --tb=short

# Frontend (from nyaya/frontend/frontend/)
npm install
npm test
```

---

## 2. Decision Path Coverage

| Path | Trigger Condition | Expected State | Expected Verdict | Test Class |
|---|---|---|---|---|
| ALLOW | confidence ≥ 0.80 | `clear` | `ENFORCEABLE` | `TestEnforcementPaths::test_allow_path_clear_state` |
| CONDITIONAL | 0.65 ≤ confidence < 0.80 | `conditional` | `PENDING_REVIEW` | `TestEnforcementPaths::test_conditional_path` |
| ESCALATE | 0.40 ≤ confidence < 0.65 | `escalate` | `PENDING_REVIEW` | `TestEnforcementPaths::test_escalate_path` |
| BLOCK | confidence < 0.40 | `block` | `NON_ENFORCEABLE` | `TestEnforcementPaths::test_block_path` |
| UNKNOWN TRACE | trace_id not in store | 404 | — | `TestEnforcementPaths::test_unknown_trace_returns_404` |

All paths verified to produce correct `state`, `verdict`, and `barriers` fields.

---

## 3. Formatter Gate Verification

**Finding: PASS**

- `ResponseBuilder.build_nyaya_response()` always sets `metadata={"Formatted": True}`
- `ResponseBuilder` calls `validate_decision_contract()` before returning — any schema violation raises `ValueError` and the response is never sent
- `nyayaApiClient` response interceptor checks `response.data?.metadata?.Formatted` — throws `UNFORMATTED_RESPONSE` error if absent or false
- Frontend chaos tests confirm: null response, empty object, HTML error page, and `Formatted=false` all throw before any UI render

**Conclusion: No raw backend data can bypass the formatter on any successful or failed request path.**

---

## 4. Observer Pipeline Trigger Verification

**Finding: PASS**

- `router.py` line: `observed_result = await observer_pipeline.process_result(agent_result, trace_id, target_jurisdiction)` — called unconditionally before `ResponseBuilder`
- `reasoning_trace.observer_processing` is populated in every `NyayaResponse`
- Mock-patch test `TestObserverPipeline::test_observer_pipeline_called_on_query` asserts `mock_observer.assert_called_once()`
- Observer crash test confirms structured 500 is returned — no raw traceback exposed

---

## 5. Chaos Test Results

| Scenario | Expected Behavior | Status |
|---|---|---|
| Missing `query` field | 422 Unprocessable Entity | ✅ |
| Wrong Content-Type | 400 / 422 | ✅ |
| Malformed JSON body | 422 | ✅ |
| Empty string query | 400 / 422 | ✅ |
| Unsupported jurisdiction | Structured error, no crash | ✅ |
| Agent RuntimeError | 500 with structured body, no traceback | ✅ |
| Observer RuntimeError | 500 with structured body, no traceback | ✅ |
| Response with `Formatted=false` | Interceptor throws `UNFORMATTED_RESPONSE` | ✅ |
| Null API response | Frontend throws `NULL_RESPONSE` | ✅ |
| HTML 502 page as response | Frontend throws before render | ✅ |
| Enforcement fetch failure | Returns `NON_ENFORCEABLE` — never silently clears | ✅ |
| 5xx from backend | `useResiliency` → `ServiceOutage` component | ✅ |
| ECONNREFUSED | `onBackendFailure` emitted → offline store saves intake | ✅ |

---

## 6. Defensive UI State Coverage

| State | Component | Trigger |
|---|---|---|
| Loading | `SkeletonLoader` | `isLoading=true` during API call |
| Backend down | `ServiceOutage` | 5xx / ECONNREFUSED via global interceptor |
| Unhandled React exception | `ErrorBoundary` → `SystemCrash` overlay | `componentDidCatch` |
| API validation failure | `ApiErrorState` | Missing required fields in response |
| Enforcement blocked | `EnforcementGatekeeper` / `ComplianceBarrier` | `state=block` or `state=escalate` |

All components verified to render trace_id and provide "Return to Dashboard" / "Retry" actions.

---

## 7. Schema Immutability Confirmation

**DecisionContract (`packages/shared/decision_contract.py`)**

```python
class Config:
    extra = 'forbid'  # Pydantic rejects any field not in the schema
```

- Extra fields → `ValidationError` (tested: `TestDecisionContractSchema::test_extra_fields_rejected_by_contract`)
- Empty `legal_route` → `ValidationError`
- `confidence > 1.0` → `ValidationError`
- Empty `trace_id` → `ValidationError`
- Valid contract → passes cleanly

**Schema is immutable across all successful and failed requests.**

---

## 8. Audit Log

Every HTTP transaction emits a structured JSON record via `AuditLogMiddleware`:

```json
{
  "ts": "2025-07-14T10:23:41.123Z",
  "trace_id": "a1b2c3d4-...",
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

Fields `formatted`, `observer_triggered`, and `schema_valid` are set to `false` on any failure path, enabling instant detection of pipeline bypasses in log aggregation (CloudWatch, Datadog, etc.).

---

## 9. CORS Hardening Confirmation

- `allow_origins=["*"]` removed — replaced with env-driven whitelist
- `ALLOWED_ORIGINS=https://nyai.blackholeinfiverse.com` set in Render
- `http://` variant of the domain is blocked (TLS required)
- Wildcard `*` is never present in `Access-Control-Allow-Origin` header
- Test `TestCORS::test_wildcard_not_present_in_acao` asserts this

---

## 10. Open Items / Recommendations

| Priority | Item |
|---|---|
| HIGH | Replace `HMAC_SECRET_KEY=your-secret-key-here` in `.env` with `openssl rand -hex 32` before go-live |
| HIGH | `_trace_store` in `router.py` is in-memory — data lost on restart. Replace with Redis for production |
| MEDIUM | `_emit_decision_explained_event` background tasks build event dicts but never write to ledger — wire to `hash_chain_ledger` |
| MEDIUM | `ErrorBoundary._reportError` logs to console only — integrate Sentry or equivalent for production error tracking |
| LOW | `build_explain_reasoning_response` returns placeholder trace history — wire to actual provenance store |
