# Frontend Contract Map

Maps every frontend data field to its backend schema source, validator, and consuming UI component. This is the authoritative reference for the frontend ↔ backend data contract.

---

## Primary Query Contract

**Endpoint:** `POST /nyaya/query`  
**Frontend Caller:** `legalQueryService.submitQuery()` in `services/nyayaApi.js`  
**Backend Schema:** `QueryRequest` in `api/schemas.py`

### Request Shape

| Frontend Field | Backend Field | Type | Required | Notes |
|---|---|---|---|---|
| `queryData.query` | `query` | `string` | Yes | Min 1 char |
| `queryData.jurisdiction_hint` | `jurisdiction_hint` | `JurisdictionHint` enum | No | `"India"` \| `"UK"` \| `"UAE"` |
| `queryData.domain_hint` | `domain_hint` | `DomainHint` enum | No | `"criminal"` \| `"civil"` \| `"constitutional"` |
| `user_context.role` | `user_context.role` | `UserRole` enum | Yes | Hardcoded `"citizen"` |
| `user_context.confidence_required` | `user_context.confidence_required` | `boolean` | Yes | Hardcoded `true` |

### Response Shape — `NyayaResponse`

| Backend Field | Frontend Access | Type | Validator | Consuming Component |
|---|---|---|---|---|
| `trace_id` | `decision.trace_id` | `string` | `sanitizeString()` in `GravitasResponseTransformer` | `DecisionPage` info grid, `EnforcementStatusCard`, `ErrorBoundary` |
| `domain` | `decision.domain` | `string` | `sanitizeString()` | `DecisionPage` info grid |
| `jurisdiction` | `decision.jurisdiction` | `string` | `sanitizeString()` | `DecisionPage` info grid |
| `confidence` | `decision.confidence` | `float [0,1]` | `normalizeConfidence()` — clamps to `[0,1]` | `DecisionPage` confidence bar, `ConfidenceIndicator` |
| `legal_route` | `decision.legal_route` | `string[]` | `sanitizeArray()` | `DecisionPage` legal route section |
| `constitutional_articles` | `decision.constitutional_articles` | `string[]` | `sanitizeArray()` | `GravitasDecisionPanel` |
| `provenance_chain` | `decision.provenance_chain` | `object[]` | `sanitizeProvenanceChain()` | `DecisionPage` provenance section |
| `reasoning_trace` | `decision.reasoning_trace` | `object` | `sanitizeObject()` | `DecisionPage` legal analysis, procedural steps, remedies |
| `reasoning_trace.legal_analysis` | `decision.reasoning_trace.legal_analysis` | `string` | None (optional chaining) | `DecisionPage` Legal Analysis section |
| `reasoning_trace.procedural_steps` | `decision.reasoning_trace.procedural_steps` | `string[]` | `parseProceduralSteps()` splits on `\|` | `DecisionPage` Procedural Steps section |
| `reasoning_trace.remedies` | `decision.reasoning_trace.remedies` | `string[]` | Array check | `DecisionPage` Available Remedies section |
| `enforcement_status` | `decision.enforcement_status` | `EnforcementStatus` | `normalizeEnforcementStatus()` | `EnforcementStatusCard`, `CasePresentation` |
| `enforcement_decision` | `decision.enforcement_decision` | `string` | `getEnforcementColor/Label()` | `DecisionPage` enforcement banner |

---

## Enforcement Status Contract

**Endpoint:** `GET /nyaya/enforcement_status`  
**Frontend Caller:** `casePresentationService.getEnforcementStatus()` in `services/nyayaApi.js`  
**Backend Schema:** `EnforcementStatus` in `api/schemas.py`  
**Frontend Validator:** `_validateEnforcementStatus()` in `services/nyayaApi.js`  
**Type Definitions:** `gravitas.types.js`

| Backend Field | Frontend Field | Type | Valid Values | Failure Default |
|---|---|---|---|---|
| `state` | `enforcementStatus.state` | `EnforcementState` enum | `clear` \| `block` \| `escalate` \| `soft_redirect` \| `conditional` | `'block'` |
| `verdict` | `enforcementStatus.verdict` | `EnforcementVerdict` enum | `ENFORCEABLE` \| `PENDING_REVIEW` \| `NON_ENFORCEABLE` | `'NON_ENFORCEABLE'` |
| `reason` | `enforcementStatus.reason` | `string` | Any | `''` |
| `barriers` | `enforcementStatus.barriers` | `string[]` | Any | `['Verification endpoint unreachable...']` |
| `blocked_path` | `enforcementStatus.blocked_path` | `string \| null` | Any | `null` |
| `escalation_required` | `enforcementStatus.escalation_required` | `boolean` | `true` \| `false` | `false` |
| `escalation_target` | `enforcementStatus.escalation_target` | `string \| null` | Any | `null` |
| `redirect_suggestion` | `enforcementStatus.redirect_suggestion` | `string \| null` | Any | `null` |
| `safe_explanation` | `enforcementStatus.safe_explanation` | `string` | Any | `'This decision cannot be displayed...'` |
| `trace_id` | `enforcementStatus.trace_id` | `string` | UUID | `traceId` (passed in) |

**UI Mapping in `EnforcementStatusCard.jsx`:**

| `state` | Color | Icon | Label |
|---|---|---|---|
| `clear` | `#28a745` | ✅ | Component returns `null` — not rendered |
| `block` | `#dc3545` | 🚫 | BLOCKED |
| `escalate` | `#fd7e14` | 📈 | ESCALATION REQUIRED |
| `soft_redirect` | `#6f42c1` | ↩️ | RECOMMENDED REDIRECT |
| `conditional` | `#ffc107` | ⚠️ | CONDITIONAL ACCESS |

---

## Case Presentation Contract

### Case Summary — `GET /nyaya/case_summary`

**Frontend Validator:** `_validateCaseSummary()` in `services/nyayaApi.js`  
**Consuming Component:** `CaseSummaryCard`

| Backend Field | Type | Required | Validator Behavior |
|---|---|---|---|
| `title` | `string` | Yes — throws if missing | — |
| `overview` | `string` | Yes — throws if missing | — |
| `jurisdiction` | `string` | Yes — throws if missing | — |
| `confidence` | `number [0,1]` | Yes — throws if out of range | Range check `[0,1]` |
| `summaryAnalysis` | `string` | Yes — throws if missing | — |
| `caseId` | `string \| null` | No | Defaults to `null` |
| `keyFacts` | `string[]` | No | Defaults to `[]` |
| `dateFiled` | `string \| null` | No | Defaults to `null` |
| `status` | `string \| null` | No | Defaults to `null` |
| `parties` | `object \| null` | No | Defaults to `null` |

### Legal Routes — `GET /nyaya/legal_routes`

**Frontend Validator:** `_validateLegalRoutes()` in `services/nyayaApi.js`  
**Consuming Component:** `LegalRouteCard`

| Backend Field | Type | Required | Validator Behavior |
|---|---|---|---|
| `routes` | `Route[]` | Yes — throws if empty | Non-empty array check |
| `routes[].name` | `string` | Yes — throws per route | — |
| `routes[].suitability` | `number` | Yes — throws per route | Type check |
| `routes[].description` | `string` | No | Defaults to `''` |
| `routes[].recommendation` | `string` | No | Defaults to `''` |
| `routes[].estimatedDuration` | `string \| null` | No | Defaults to `null` |
| `routes[].estimatedCost` | `string \| null` | No | Defaults to `null` |
| `routes[].pros` | `string[]` | No | Defaults to `[]` |
| `routes[].cons` | `string[]` | No | Defaults to `[]` |
| `jurisdiction` | `string` | Yes — throws if missing | — |
| `caseType` | `string \| null` | No | Defaults to `null` |

### Timeline — `GET /nyaya/timeline`

**Frontend Validator:** `_validateTimeline()` in `services/nyayaApi.js`  
**Consuming Component:** `TimelineCard`

| Backend Field | Type | Required | Valid Values |
|---|---|---|---|
| `events` | `TimelineEvent[]` | Yes — throws if empty | — |
| `events[].title` | `string` | Yes — throws per event | — |
| `events[].date` | `string` | Yes — throws per event | ISO date string |
| `events[].type` | `string` | Yes — throws per event | `event` \| `deadline` \| `milestone` \| `step` |
| `events[].status` | `string` | Yes — throws per event | `completed` \| `pending` \| `overdue` |
| `events[].id` | `string` | No | Defaults to `event_{i}` |
| `events[].description` | `string` | No | Defaults to `''` |
| `events[].documents` | `string[]` | No | Defaults to `[]` |
| `events[].parties` | `string[]` | No | Defaults to `[]` |
| `jurisdiction` | `string` | Yes — throws if missing | — |
| `caseId` | `string \| null` | No | Defaults to `null` |

### Glossary — `GET /nyaya/glossary`

**Frontend Validator:** `_validateGlossary()` in `services/nyayaApi.js`  
**Consuming Component:** `GlossaryCard`

| Backend Field | Type | Required | Validator Behavior |
|---|---|---|---|
| `terms` | `Term[]` | Yes — throws if empty | — |
| `terms[].term` | `string` | Yes — throws per term | — |
| `terms[].definition` | `string` | Yes — throws per term | — |
| `terms[].context` | `string \| null` | No | Defaults to `null` |
| `terms[].relatedTerms` | `string[]` | No | Defaults to `[]` |
| `terms[].jurisdiction` | `string \| null` | No | Defaults to `null` |
| `terms[].confidence` | `number \| null` | No | Type check, defaults to `null` |
| `jurisdiction` | `string` | Yes — throws if missing | — |
| `caseType` | `string \| null` | No | Defaults to `null` |

### Jurisdiction Info — `GET /nyaya/jurisdiction_info`

**Frontend Validator:** Inline check in `casePresentationService.getJurisdictionInfo()`  
**Consuming Component:** `JurisdictionInfoBar`

| Backend Field | Type | Required | Notes |
|---|---|---|---|
| `courtSystem` | `string` | Yes — throws if missing | — |
| `country` | `string` | Yes — throws if missing | — |

---

## Formatter Contract (Document View)

**File:** `frontend/src/lib/gravitas.types.js`  
**Validator:** `frontend/src/lib/casePayloadValidator.js` → `validateCasePayload()`

The `CasePayload` object ingested by `GravitasDocumentView` has exactly 9 required fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `trace_id` | `string` | Yes | UUID audit identifier |
| `enforcement_status` | `EnforcementStatus` | Yes | Full gatekeeper object |
| `jurisdiction` | `string` | Yes | e.g. `'India'`, `'UK'`, `'UAE'` |
| `case_summary` | `string` | Yes | Findings of fact narrative |
| `legal_route` | `string[]` | Yes | Statutory framework applied |
| `procedural_steps` | `ProceduralStep[]` | Yes (may be `[]`) | Ordered execution steps |
| `timeline` | `TimelineEvent[]` | Yes (may be `[]`) | Chronological deadlines |
| `decision` | `string` | Yes | The ultimate ruling text |
| `reasoning` | `string` | Yes | Logical justification |

---

## Feedback / RL Signal Contract

**Endpoint:** `POST /nyaya/feedback`  
**Backend Schema:** `FeedbackRequest` in `api/schemas.py`

| Frontend Field | Backend Field | Type | Constraint |
|---|---|---|---|
| `feedbackData.trace_id` | `trace_id` | `string` | Required |
| `feedbackData.rating` | `rating` | `integer` | `1 ≤ rating ≤ 5` |
| `feedbackData.feedback_type` | `feedback_type` | `FeedbackType` enum | `clarity` \| `correctness` \| `usefulness` |
| `feedbackData.comment` | `comment` | `string \| null` | Max 1000 chars |

**Endpoint:** `POST /nyaya/rl_signal`  
**Backend Schema:** `RLSignalRequest` in `api/schemas.py`

| Frontend Field | Backend Field | Type | Frontend Pre-validation |
|---|---|---|---|
| `trace_id` | `trace_id` | `string` | Non-empty string check before request |
| `helpful` | `helpful` | `boolean` | `typeof === 'boolean'` check |
| `clear` | `clear` | `boolean` | `typeof === 'boolean'` check |
| `match` | `match` | `boolean` | `typeof === 'boolean'` check |

---

## GravitasResponseTransformer Field Map

**File:** `frontend/src/lib/GravitasResponseTransformer.js`

Transforms raw `NyayaResponse` into the shape consumed by `GravitasDecisionPanel`:

| Raw API Field | Transformer Output | Transform Applied |
|---|---|---|
| `domain` | `domain` | `sanitizeString(value, 'general')` |
| `jurisdiction` | `jurisdiction` | `sanitizeString(value, 'Unknown')` |
| `trace_id` | `trace_id` | `sanitizeString(value, generateTraceId())` |
| `confidence` | `confidence` | `normalizeConfidence()` — clamps NaN/out-of-range to `[0,1]` |
| `legal_route` | `legal_route` | `sanitizeArray()` — filters null/undefined |
| `constitutional_articles` | `constitutional_articles` | `sanitizeArray()` |
| `provenance_chain` | `provenance_chain` | `sanitizeProvenanceChain()` — maps to `{ source, description, timestamp, data }` |
| `reasoning_trace` | `reasoning_trace` | `sanitizeObject()` |
| `enforcement_status` | `enforcement_status` | `normalizeEnforcementStatus()` — validates state enum, defaults to `'clear'` |

**Confidence Color Scale:**

| Range | Color | Label |
|---|---|---|
| `≥ 85%` | `#28a745` | Very High |
| `65–84%` | `#20c997` | High |
| `45–64%` | `#ffc107` | Moderate |
| `25–44%` | `#fd7e14` | Low |
| `< 25%` | `#dc3545` | Very Low |
