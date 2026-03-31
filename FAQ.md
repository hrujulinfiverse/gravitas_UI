# FAQ: Nyaya AI Frontend — API Integration Phase

Answers are grounded in the actual source code. File references are exact.

---

## General

**Q: Where is the backend URL configured?**

In `frontend/src/lib/apiConfig.ts`:
```ts
export const BASE_URL = import.meta.env.VITE_API_URL || "https://nyaya-ai-0f02.onrender.com"
```
Set `VITE_API_URL` in your `.env` file to override. Note: `services/nyayaBackendApi.js` hardcodes the URL directly and does not read this variable — if the backend URL changes, that file must also be updated manually.

---

**Q: What is a `trace_id` and where does it come from?**

The backend generates a UUID `trace_id` per request in `api/main.py` via `add_trace_id_middleware`. It is embedded in every `NyayaResponse` and `EnforcementStatus` object. On the frontend, after a successful query, `setActiveTraceId(traceId)` writes it to `window.__gravitas_active_trace_id`. The Axios request interceptor in `nyayaApi.js` then injects it as `X-Trace-ID` on every subsequent request, enabling end-to-end correlation.

---

**Q: Why are there two Axios clients (`apiClient` and `nyayaClient`)?**

`apiClient` in `services/nyayaApi.js` is the primary client — it has the full interceptor stack (trace ID injection, outage detection, offline resiliency). `nyayaClient` in `services/nyayaBackendApi.js` is a simpler client used exclusively by `DecisionPage.jsx`. It has only a response error logger. The two clients exist because `DecisionPage` was built as a standalone module before the full service layer was established. They can be consolidated in a future refactor.

---

**Q: What is `apiService.js` used for?**

`services/apiService.js` exports a single `apiRequest()` function using the native Fetch API. It fires `react-hot-toast` notifications on 5xx errors and request timeouts. It is a utility wrapper for components that do not need the full Axios interceptor stack. It reads `BASE_URL` from `apiConfig.ts`.

---

## Enforcement

**Q: What happens if the enforcement status endpoint returns an error?**

`casePresentationService.getEnforcementStatus()` in `nyayaApi.js` catches all errors and returns a hardcoded BLOCK payload:
```js
{
  state: 'block',
  verdict: 'NON_ENFORCEABLE',
  reason: 'Enforcement status could not be verified.',
  barriers: ['Verification endpoint unreachable or returned invalid data'],
  safe_explanation: 'This decision cannot be displayed until enforcement status is confirmed.'
}
```
The system never defaults to `'clear'` or `'ENFORCEABLE'` on failure. This is intentional — unauthorized data leaks are prevented by defaulting to the most restrictive state.

---

**Q: When does `EnforcementStatusCard` not render anything?**

When `enforcementStatus.state === 'clear'` or when `enforcementStatus` is null/missing. The component returns `null` in both cases. A `clear` state means the pathway is fully permitted — no enforcement card is needed.

---

**Q: How does the backend decide the enforcement state?**

In `api/router.py`, the `/nyaya/enforcement_status` endpoint reads the `confidence` score stored in `_trace_store` at query time and applies this logic:

| Confidence | State | Verdict |
|---|---|---|
| `< 0.40` | `block` | `NON_ENFORCEABLE` |
| `0.40–0.64` | `escalate` | `PENDING_REVIEW` |
| `0.65–0.79` | `conditional` | `PENDING_REVIEW` |
| `≥ 0.80` | `clear` | `ENFORCEABLE` |

---

**Q: Why does `/nyaya/enforcement_status` return 404 after a backend restart?**

The `_trace_store` in `api/router.py` is a Python in-memory dictionary. A backend restart clears it. Any `trace_id` issued before the restart will not be found. This is a known constraint — the fix is to persist `_trace_store` to a database or Redis cache.

---

## Offline / Resiliency

**Q: What triggers offline mode?**

The Axios response interceptor in `nyayaApi.js` detects three conditions and emits a failure event:
- HTTP status `>= 500` (server error)
- Network errors: `ECONNREFUSED`, `ERR_NETWORK`, `ERR_CONNECTION_REFUSED`, `"Network Error"`, `"Failed to fetch"`
- Timeouts: `ECONNABORTED`, `ETIMEDOUT`

`useResiliency` subscribes to these events via `onBackendFailure()` and sets `isOffline = true`.

---

**Q: What data is saved during offline mode?**

`offlineStore` in `services/offlineStore.js` saves the current `caseIntakeRef.current` snapshot to `localStorage` under the key `gravitas_case_intake`. A pending sync marker is written under `gravitas_pending_sync`. Both are plain JSON. If `localStorage` quota is exceeded, the save silently fails — data remains in memory.

---

**Q: How does the app recover from offline mode?**

`useResiliency` polls `GET /health` every 15 seconds via `healthService.checkHealth()`. On a successful response, `isOffline` is set to `false`, polling stops, and `clearServiceOutage()` notifies all outage listeners. The `OfflineBanner` disappears. If `hasPending` is true, a "Sync Case to Server" button appears in the banner — clicking it calls `syncToServer()` which replays the pending intake via the provided `submitFn`.

---

**Q: What is the `OfflineBanner` and where does it mount?**

`OfflineBanner` is a fixed-position component (bottom center, z-index 2000) that renders only when `isOffline === true`. It is mounted globally in `App.jsx` outside the `renderView()` switch, so it appears across all views regardless of which module is active.

---

## Validation

**Q: What is `casePayloadValidator.js` and when is it used?**

`frontend/src/lib/casePayloadValidator.js` exports `validateCasePayload(payload, strict)`. It validates the 9-field formatter contract (`trace_id`, `enforcement_status`, `jurisdiction`, `case_summary`, `legal_route`, `procedural_steps`, `timeline`, `decision`, `reasoning`) before data reaches `GravitasDocumentView`. In strict mode, any missing required field returns `{ valid: false }` and halts rendering. It also exports a Zod schema (`casePayloadZodSchema`) as a secondary validation layer when Zod is available in the project.

---

**Q: What happens when a validator throws inside a service method?**

All service methods in `casePresentationService` wrap their validators in try/catch. A thrown error is caught and returned as `{ success: false, error: "..." }`. The `CasePresentation` component checks `caseResult.success` — on `false`, it calls `setError(caseResult.error)` and renders an error banner with a retry counter. No partial or malformed data reaches the card components.

---

**Q: What does `GravitasResponseTransformer` do that the validators don't?**

`GravitasResponseTransformer` in `frontend/src/lib/GravitasResponseTransformer.js` transforms and enriches the raw `NyayaResponse` for display — it normalizes `confidence` to `[0,1]`, sanitizes strings/arrays/objects with safe defaults, maps `enforcement_status` state to display labels and severity levels, and provides utility methods like `formatConfidence()`, `getConfidenceColor()`, `getSummary()`, and `toDebugString()`. The validators in `nyayaApi.js` are strict gatekeepers that throw on missing required fields. The transformer is a display-layer utility that provides safe defaults for optional fields.

---

## Error Handling

**Q: What is `ErrorBoundary` and what does it catch?**

`ErrorBoundary` in `components/ErrorBoundary.jsx` is a React class component that catches unhandled JavaScript exceptions in its child component tree via `componentDidCatch`. It renders a `SystemCrash` overlay (full-screen, z-index 9999) with the error message, `trace_id` from `window.__gravitas_active_trace_id`, and "Return to Dashboard" / "Try Again" buttons. Every major view in `App.jsx` is wrapped in `<ErrorBoundary>`. It does not catch async errors or errors in event handlers — those are handled by the service layer try/catch blocks.

---

**Q: What is `ServiceOutage.jsx` and how is it triggered?**

`ServiceOutage` is a standalone UI component that renders a "Service Temporarily Unavailable" screen. It is triggered by components that subscribe to `onServiceOutage()` from `nyayaApi.js`. The global Axios interceptor calls `_emitOutage()` on 5xx/network/timeout errors, which notifies all registered listeners. It displays the `traceId` as a "Session ID" and provides "Return to Dashboard" and "Refresh Page" buttons. It also informs the user that automatic reconnection is enabled (via the `useResiliency` polling loop).

---

**Q: What is the `useServiceOutage` hook?**

`hooks/useServiceOutage.js` is a convenience hook that subscribes a component to the `onServiceOutage` event stream from `nyayaApi.js`. Components that need to conditionally render the `ServiceOutage` screen use this hook to receive `{ isOutage, error }` state updates without directly importing the event emitter.

---

## Development

**Q: How do I enable debug mode in `DecisionPage`?**

Press `Ctrl+Shift+D` while on the Decision page. A debug overlay appears at the bottom of the decision display showing:
- Enforcement State
- Trace ID
- Confidence percentage
- Field count (`Object.keys(decision).length / 12`)
- Current timestamp

This is controlled by `debugMode` state in `DecisionPage.jsx` and is toggled by a `keydown` event listener registered in a `useEffect`.

---

**Q: How do I run the E2E tests?**

Tests are in `frontend/e2e/gravitas.spec.ts` and use Playwright. Configuration is in `frontend/playwright.config.ts`. Run from the `frontend/` directory:
```
npx playwright test
```
See `frontend/E2E_SETUP.md` for environment setup instructions.

---

**Q: How do I add a new jurisdiction?**

Backend: Add a new `LegalAgent` instance to the `agents` dict in `api/router.py` and add the jurisdiction value to the `JurisdictionHint` enum in `api/schemas.py`.

Frontend: Add the jurisdiction string to the switcher buttons array in `CasePresentation` in `App.jsx`:
```jsx
{['India', 'UK', 'UAE', 'NewJurisdiction'].map((j) => ( ... ))}
```
No changes are needed to the service layer — `casePresentationService` passes `jurisdiction` as a query parameter dynamically.

---

**Q: What Storybook stories exist for the UI components?**

Stories are in `frontend/src/stories/` and cover:
- `CaseSummaryCard.stories.js`
- `ConfidenceIndicator.stories.js`
- `DisclaimerBox.stories.js`
- `JurisdictionInfoBar.stories.js`
- `ProceduralTimeline.stories.js`
- `SessionStatus.stories.js`

Run Storybook from the `frontend/` directory:
```
npm run storybook
```
