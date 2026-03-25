# frontend_contract_map.md
# Gravitas UI — Backend Contract Alignment
# Source of truth: api/schemas.py, api/router.py, api/response_builder.py
# Last updated: derived from current codebase state

---

## Section 1: Data Models

TypeScript interfaces derived directly from Pydantic schemas.

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

type UserRole = 'citizen' | 'lawyer' | 'student'

type DomainHint = 'criminal' | 'civil' | 'constitutional'

type JurisdictionHint = 'India' | 'UK' | 'UAE'

type ExplanationLevel = 'brief' | 'detailed' | 'constitutional'

type FeedbackType = 'clarity' | 'correctness' | 'usefulness'

/**
 * Granular enforcement state of the legal pathway.
 * Used internally by EnforcementStatusCard for styling and copy.
 */
type EnforcementState =
  | 'clear'          // No enforcement requirements
  | 'block'          // Path is blocked — cannot proceed
  | 'escalate'       // Requires escalation to higher authority
  | 'soft_redirect'  // Suggest alternative pathway
  | 'conditional'    // Proceed with conditions

/**
 * Gatekeeper verdict — the primary signal the UI gates rendering on.
 * Derived from confidence score in /nyaya/enforcement_status.
 *
 * Confidence thresholds (backend-defined):
 *   >= 0.80  → ENFORCEABLE
 *   0.65–0.79 → PENDING_REVIEW  (state: conditional)
 *   0.40–0.64 → PENDING_REVIEW  (state: escalate)
 *   < 0.40   → NON_ENFORCEABLE (state: block)
 */
type EnforcementVerdict =
  | 'ENFORCEABLE'      // Render full decision document
  | 'PENDING_REVIEW'   // Show compliance-check overlay
  | 'NON_ENFORCEABLE'  // Block document display, show barriers list

// ─── Core Objects ─────────────────────────────────────────────────────────────

interface UserContext {
  role: UserRole
  confidence_required: boolean  // default: true
}

interface EnforcementStatus {
  state: EnforcementState          // required
  verdict: EnforcementVerdict      // required — primary UI gate
  reason: string                   // empty string when state is 'clear'
  barriers: string[]               // populated only when verdict is NON_ENFORCEABLE
  blocked_path: string | null      // populated only when state is 'block'
  escalation_required: boolean     // true when state is 'escalate'
  escalation_target: string | null // name of escalation authority, if known
  redirect_suggestion: string | null // populated when state is 'soft_redirect'
  safe_explanation: string         // human-readable explanation for the user
  trace_id: string                 // mirrors parent decision trace_id
}

/**
 * Primary decision object returned by POST /nyaya/query.
 * enforcement_status is NOT included in this response —
 * it must be fetched separately via GET /nyaya/enforcement_status
 * before rendering any decision UI.
 */
interface NyayaResponse {
  domain: string                        // required — e.g. 'criminal', 'civil', 'general'
  jurisdiction: string                  // required — e.g. 'India', 'UK', 'UAE'
  confidence: number                    // required — float 0.0–1.0
  legal_route: string[]                 // required — ordered list of agent IDs traversed
  constitutional_articles: string[]     // optional — populated for India jurisdiction
  provenance_chain: ProvenanceItem[]    // optional — may be empty array
  reasoning_trace: Record<string, any>  // optional — may be empty object
  trace_id: string                      // required — UUID, primary audit key
  enforcement_status: EnforcementStatus | null  // always null from /query; populated by hook after separate fetch
}

interface ProvenanceItem {
  // [REQUIRES CLARIFICATION FROM RAJ] — backend returns [] currently;
  // shape of individual provenance items is not yet defined in schemas.py
  source?: string
  description?: string
  timestamp?: string
}

interface MultiJurisdictionResponse {
  comparative_analysis: Record<JurisdictionHint, NyayaResponse>  // required
  confidence: number   // required — aggregate mean across jurisdictions
  trace_id: string     // required
}

interface ExplainReasoningResponse {
  trace_id: string
  explanation: {
    level: ExplanationLevel
    trace_data: Record<string, any>  // raw provenance history
  }
  reasoning_tree: ReasoningTree
  constitutional_articles: string[]  // populated for India jurisdiction only
}

type ReasoningTree =
  | { summary: string; key_decisions: string[] }                          // level: brief
  | { full_timeline: any[]; agent_interactions: AgentInteraction[] }      // level: detailed
  | { constitutional_focus: any[]; articles_referenced: string[] }        // level: constitutional

interface AgentInteraction {
  agent: string
  action: string
  details: Record<string, any>
}

interface TraceResponse {
  trace_id: string
  event_chain: TraceEvent[]
  agent_routing_tree: { root: string; children: Record<string, AgentNode> }
  jurisdiction_hops: string[]
  rl_reward_snapshot: Record<string, any>  // [REQUIRES CLARIFICATION FROM RAJ] — placeholder in current backend
  context_fingerprint: string              // [REQUIRES CLARIFICATION FROM RAJ] — placeholder in current backend
  nonce_verification: boolean
  signature_verification: boolean
}

interface TraceEvent {
  // [REQUIRES CLARIFICATION FROM RAJ] — shape inferred from ledger entries; not formally typed in schemas.py
  signed_event?: {
    trace_id: string
    agent_id?: string
    event_name?: string
    jurisdiction?: string
    details?: Record<string, any>
  }
}

interface AgentNode {
  jurisdiction: string | null
  events: string[]
}

// ─── Case Presentation Objects (GET endpoints) ────────────────────────────────

interface CaseSummaryResponse {
  caseId: string
  title: string
  overview: string
  keyFacts: string[]
  jurisdiction: string
  confidence: number
  summaryAnalysis: string
  dateFiled: string
  status: string
  parties: { plaintiff: string; defendant: string }
  trace_id: string
}

interface LegalRoute {
  name: string
  description: string
  recommendation: string
  suitability: number       // float 0.0–1.0
  estimatedDuration: string | null
  estimatedCost: string | null
  pros: string[]
  cons: string[]
}

interface LegalRoutesResponse {
  routes: LegalRoute[]
  jurisdiction: string
  caseType: string
  trace_id: string
}

type TimelineEventType = 'event' | 'deadline' | 'milestone' | 'step'
type TimelineEventStatus = 'completed' | 'pending' | 'overdue'

interface TimelineEvent {
  id: string
  date: string              // ISO date string
  title: string
  description: string
  type: TimelineEventType
  status: TimelineEventStatus
  documents: string[]
  parties: string[]
}

interface TimelineResponse {
  events: TimelineEvent[]
  jurisdiction: string
  caseId: string
  trace_id: string
}

interface GlossaryTerm {
  term: string
  definition: string
  context: string | null
  relatedTerms: string[]
  jurisdiction: string | null
  confidence: number | null
}

interface GlossaryResponse {
  terms: GlossaryTerm[]
  jurisdiction: string
  caseType: string
  trace_id: string
}

interface JurisdictionInfoResponse {
  country: string
  courtSystem: string
  authorityFraming: string
  emergencyGuidance: string
  legalFramework: string
  limitationAct: string
  constitution: string
  jurisdiction: string
}

// ─── Request Objects ──────────────────────────────────────────────────────────

interface QueryRequest {
  query: string                          // required
  jurisdiction_hint: JurisdictionHint | null  // optional
  domain_hint: DomainHint | null         // optional
  user_context: UserContext              // required
}

interface MultiJurisdictionRequest {
  query: string
  jurisdictions: JurisdictionHint[]  // min 1, max 3
}

interface FeedbackRequest {
  trace_id: string
  rating: number          // integer 1–5
  feedback_type: FeedbackType
  comment?: string        // max 1000 chars
}

interface RLSignalRequest {
  trace_id: string
  helpful: boolean
  clear: boolean
  match: boolean
}

// ─── Error Object ─────────────────────────────────────────────────────────────

interface ErrorResponse {
  error_code: string   // e.g. 'INTERNAL_ERROR', 'JURISDICTION_NOT_SUPPORTED', 'TRACE_NOT_FOUND'
  message: string
  trace_id: string
}
```

---

## Section 2: API Integration Table

All endpoints are prefixed `/nyaya`. Base URL configured in `src/lib/apiConfig.ts`.

### POST /nyaya/query

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| GravitasDecisionPanel — header | `domain` | `string` | Yes |
| GravitasDecisionPanel — header | `jurisdiction` | `string` | Yes |
| ConfidenceIndicator | `confidence` | `number (0.0–1.0)` | Yes |
| GravitasDecisionPanel — route card | `legal_route` | `string[]` | Yes |
| GravitasDecisionPanel — constitutional section | `constitutional_articles` | `string[]` | No — India only |
| GravitasDecisionPanel — provenance section | `provenance_chain` | `ProvenanceItem[]` | No — may be `[]` |
| GravitasDecisionPanel — reasoning section | `reasoning_trace` | `Record<string, any>` | No — may be `{}` |
| Global footer / error reporting | `trace_id` | `string (UUID)` | Yes |
| EnforcementStatusCard (via hook) | `enforcement_status` | `EnforcementStatus \| null` | No — always `null` from this endpoint; fetched separately |

### GET /nyaya/enforcement_status?trace_id=&jurisdiction=

**Must be called before rendering any decision UI.** Called automatically by `useGravitasDecision` after `/query` resolves.

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| EnforcementStatusCard — state badge | `state` | `EnforcementState` | Yes |
| useGravitasDecision — render gate | `verdict` | `EnforcementVerdict` | Yes |
| EnforcementStatusCard — reason text | `reason` | `string` | No — empty when `state: clear` |
| EnforcementStatusCard — barriers list | `barriers` | `string[]` | No — populated when `verdict: NON_ENFORCEABLE` |
| EnforcementStatusCard — blocked path | `blocked_path` | `string \| null` | No |
| EnforcementStatusCard — escalation block | `escalation_required` | `boolean` | Yes |
| EnforcementStatusCard — escalation target | `escalation_target` | `string \| null` | No |
| EnforcementStatusCard — redirect block | `redirect_suggestion` | `string \| null` | No |
| EnforcementStatusCard — explanation | `safe_explanation` | `string` | Yes |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### POST /nyaya/multi_jurisdiction

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| MultiJurisdictionCard — per-jurisdiction panel | `comparative_analysis[jurisdiction]` | `NyayaResponse` | Yes |
| MultiJurisdictionCard — aggregate score | `confidence` | `number` | Yes |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### POST /nyaya/explain_reasoning

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| GravitasDecisionPanel — reasoning section | `explanation.trace_data` | `Record<string, any>` | Yes |
| GravitasDecisionPanel — reasoning section | `reasoning_tree` | `ReasoningTree` | Yes |
| GravitasDecisionPanel — constitutional section | `constitutional_articles` | `string[]` | No — India only |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### GET /nyaya/case_summary?trace_id=&jurisdiction=

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| CaseSummaryCard — title | `title` | `string` | Yes |
| CaseSummaryCard — overview | `overview` | `string` | Yes |
| CaseSummaryCard — key facts list | `keyFacts` | `string[]` | Yes |
| CaseSummaryCard — confidence badge | `confidence` | `number` | Yes |
| CaseSummaryCard — analysis text | `summaryAnalysis` | `string` | Yes |
| CaseSummaryCard — metadata | `dateFiled` | `string` | Yes |
| CaseSummaryCard — status badge | `status` | `string` | Yes |
| CaseSummaryCard — parties | `parties.plaintiff` / `parties.defendant` | `string` | Yes |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### GET /nyaya/legal_routes?trace_id=&jurisdiction=&case_type=

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| LegalRouteCard — route list | `routes` | `LegalRoute[]` | Yes |
| LegalRouteCard — route name | `routes[n].name` | `string` | Yes |
| LegalRouteCard — suitability bar | `routes[n].suitability` | `number (0.0–1.0)` | Yes |
| LegalRouteCard — duration / cost | `routes[n].estimatedDuration` / `estimatedCost` | `string \| null` | No |
| LegalRouteCard — pros/cons | `routes[n].pros` / `routes[n].cons` | `string[]` | No |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### GET /nyaya/timeline?trace_id=&jurisdiction=&case_id=

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| TimelineCard / ProceduralTimeline — event list | `events` | `TimelineEvent[]` | Yes |
| TimelineCard — event date | `events[n].date` | `string (ISO)` | Yes |
| TimelineCard — event type badge | `events[n].type` | `TimelineEventType` | Yes |
| TimelineCard — status indicator | `events[n].status` | `TimelineEventStatus` | Yes |
| TimelineCard — documents | `events[n].documents` | `string[]` | No |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### GET /nyaya/glossary?trace_id=&jurisdiction=&case_type=

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| GlossaryCard / LegalGlossary — term list | `terms` | `GlossaryTerm[]` | Yes |
| GlossaryCard — definition | `terms[n].definition` | `string` | Yes |
| GlossaryCard — context note | `terms[n].context` | `string \| null` | No |
| GlossaryCard — related terms | `terms[n].relatedTerms` | `string[]` | No |
| GlossaryCard — confidence | `terms[n].confidence` | `number \| null` | No |
| Global footer / error reporting | `trace_id` | `string` | Yes |

### GET /nyaya/jurisdiction_info?jurisdiction=

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| JurisdictionInfoBar — court system | `courtSystem` | `string` | Yes |
| JurisdictionInfoBar — legal framework | `legalFramework` | `string` | Yes |
| JurisdictionInfoBar — authority framing | `authorityFraming` | `string` | Yes |
| JurisdictionInfoBar — emergency guidance | `emergencyGuidance` | `string` | Yes |
| JurisdictionInfoBar — limitation act | `limitationAct` | `string` | Yes |
| JurisdictionInfoBar — constitution | `constitution` | `string` | Yes |

### GET /nyaya/trace/:trace_id

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| Audit / debug panel | `event_chain` | `TraceEvent[]` | Yes |
| Audit / debug panel | `agent_routing_tree` | `object` | Yes |
| Audit / debug panel | `jurisdiction_hops` | `string[]` | Yes |
| Audit / debug panel | `nonce_verification` | `boolean` | Yes |
| Audit / debug panel | `signature_verification` | `boolean` | Yes |
| Audit / debug panel | `rl_reward_snapshot` | `Record<string, any>` | [REQUIRES CLARIFICATION FROM RAJ] — currently a placeholder |
| Audit / debug panel | `context_fingerprint` | `string` | [REQUIRES CLARIFICATION FROM RAJ] — currently a placeholder |

### POST /nyaya/feedback

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| FeedbackButtons — confirmation | `status` | `string` | Yes |
| FeedbackButtons — trace reference | `trace_id` | `string` | Yes |
| FeedbackButtons — message | `message` | `string` | Yes |

### POST /nyaya/rl_signal

| UI Component | Data Field | Type | Required? |
|---|---|---|---|
| FeedbackButtons — RL confirmation | `status` | `string` | Yes |
| FeedbackButtons — trace reference | `trace_id` | `string` | Yes |

---

## Section 3: Conditional Rendering Logic

The `verdict` field from `GET /nyaya/enforcement_status` is the **sole gate** controlling whether the decision document renders. The UI must never display the full `NyayaResponse` payload until this check completes.

### Verdict → UI State Map

| `verdict` | `state` (context) | UI Behaviour | Components Affected |
|---|---|---|---|
| `ENFORCEABLE` | `clear` (confidence ≥ 0.80) | Render full decision document normally | GravitasDecisionPanel, all case presentation cards |
| `PENDING_REVIEW` | `conditional` (0.65–0.79) | Render decision document with a "Compliance Check in Progress" overlay. Submit/export buttons remain enabled. Show `safe_explanation`. | GravitasDecisionPanel (overlaid), EnforcementStatusCard |
| `PENDING_REVIEW` | `escalate` (0.40–0.64) | Same overlay as above. Additionally surface `escalation_target` if present. Disable Final Submission button. | GravitasDecisionPanel (overlaid), EnforcementStatusCard, FeedbackButtons |
| `NON_ENFORCEABLE` | `block` (confidence < 0.40) | Block document display entirely. Show `barriers` list. Show `safe_explanation`. Disable all submission and export actions. | EnforcementStatusCard (full-page), GravitasDecisionPanel (hidden) |

### Confidence → Verdict Derivation (backend-computed)

```
confidence >= 0.80  →  verdict: ENFORCEABLE,    state: clear
confidence  0.65–0.79  →  verdict: PENDING_REVIEW, state: conditional
confidence  0.40–0.64  →  verdict: PENDING_REVIEW, state: escalate
confidence  < 0.40   →  verdict: NON_ENFORCEABLE, state: block
```

### State-Specific Field Visibility Rules

| `state` | Show `barriers` | Show `blocked_path` | Show `escalation_target` | Show `redirect_suggestion` |
|---|---|---|---|---|
| `clear` | No | No | No | No |
| `block` | Yes | Yes (if non-null) | No | No |
| `escalate` | No | No | Yes (if non-null) | No |
| `soft_redirect` | No | No | No | Yes (if non-null) |
| `conditional` | No | No | No | No |

### Enforcement Check Failure (404 / network error)

If `GET /nyaya/enforcement_status` returns 404 or fails due to network error:
- Do **not** default to `ENFORCEABLE`.
- Set `verdict` to `NON_ENFORCEABLE` with `reason: 'Enforcement status could not be verified.'`
- Block document display until a successful check is obtained.
- Surface the `trace_id` from the original query response for error reporting.

---

## Section 4: Error Handling

### trace_id Display Contract

`trace_id` is a UUID string present on every response — success and error alike. It must be surfaced to the user whenever a backend failure occurs so it can be used for support and audit.

| Failure Scenario | HTTP Status | `error_code` | UI Behaviour | Where to Display `trace_id` |
|---|---|---|---|---|
| Unsupported jurisdiction | 400 | `JURISDICTION_NOT_SUPPORTED` | Show inline error in LegalQueryCard. Offer jurisdiction selector. | Below error message, monospace label |
| Internal server error | 500 | `INTERNAL_ERROR` | Show full-page error state. Disable all actions. | Prominent "Reference ID" field in error panel |
| Trace not found | 404 | `TRACE_NOT_FOUND` | Show inline error in explain reasoning / trace panel. | Below error message |
| Enforcement status not found | 404 | `ENFORCEMENT_STATUS_NOT_FOUND` | Block decision render. Show "Verification failed" message. | Below error message |
| Feedback submission failed | 500 | `FEEDBACK_ERROR` | Show toast notification. Do not block UI. | Not required — log to console |
| RL signal failed | 500 | `RL_SIGNAL_ERROR` | Silent failure. Do not surface to user. | Not required |
| Network timeout / ECONNREFUSED | — | — | Trigger degraded mode (OfflineBanner). Persist intake to localStorage. | OfflineBanner footer note |
| 5xx server error | 500–599 | — | Trigger degraded mode (OfflineBanner). | OfflineBanner footer note |

### trace_id Rendering Spec

```tsx
// Render pattern for trace_id in error states
<div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6c757d', marginTop: '8px' }}>
  Reference ID: {trace_id}
</div>
```

- Always truncate to first 8 characters in inline/compact contexts: `{trace_id.substring(0, 8)}...`
- Always show full UUID in dedicated error panels and the GravitasDecisionPanel footer.
- The global footer of GravitasDecisionPanel already renders `UUID: {decision.trace_id}` — this is the canonical trace display location during normal operation.

### Known Unresolved Fields

The following fields are present in the backend but their production shape is not yet finalised:

| Field | Location | Status |
|---|---|---|
| `provenance_chain` items | `NyayaResponse.provenance_chain` | Always `[]` — shape of individual items [REQUIRES CLARIFICATION FROM RAJ] |
| `rl_reward_snapshot` | `TraceResponse.rl_reward_snapshot` | Placeholder object — [REQUIRES CLARIFICATION FROM RAJ] |
| `context_fingerprint` | `TraceResponse.context_fingerprint` | Hardcoded string — [REQUIRES CLARIFICATION FROM RAJ] |
| `reasoning_trace` shape | `NyayaResponse.reasoning_trace` | Typed as `Record<string, any>` — specific keys [REQUIRES CLARIFICATION FROM RAJ] |
| Agent IDs in `legal_route` | `NyayaResponse.legal_route` | Currently `[jurisdiction_router_agent.agent_id, agent.agent_id]` — display labels [REQUIRES CLARIFICATION FROM RAJ] |
