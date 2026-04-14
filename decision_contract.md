# Decision Contract Specification

## Overview
The Decision Contract is the canonical, immutable schema for all data exchange in the Nyaya ecosystem. It serves as the single source of truth across frontend, backend, and observer pipeline components, ensuring type safety, runtime consistency, and preventing logic fragmentation.

## Mandatory Fields

All Decision Contract instances MUST contain exactly these fields:

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `trace_id` | `string` | UUID trace identifier for request tracking | Required, non-empty string |
| `jurisdiction` | `string` | Legal jurisdiction (e.g., "IN", "UK", "UAE") | Required, non-empty string |
| `domain` | `string` | Legal domain (e.g., "criminal", "civil", "constitutional") | Required, non-empty string |
| `legal_route` | `Array<string>` | Sequence of agents/legal steps | Required, non-empty array |
| `reasoning_trace` | `Object` | Detailed reasoning and decision process | Required, object |
| `enforcement_status` | `Object` | Enforcement state and verdict | Required, object with state/verdict |
| `confidence` | `number` | Confidence score (0.0 to 1.0) | Required, float between 0.0 and 1.0 |

## Enforcement Status Structure

```json
{
  "state": "clear|block|escalate|soft_redirect|conditional",
  "verdict": "ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE",
  "reason": "string",
  "barriers": ["array", "of", "strings"],
  "blocked_path": "string|null",
  "escalation_required": boolean,
  "escalation_target": "string|null",
  "redirect_suggestion": "string|null",
  "safe_explanation": "string",
  "trace_id": "string"
}
```

## Reasoning Trace Structure

```json
{
  "routing_decision": { /* jurisdiction router output */ },
  "agent_processing": { /* legal agent result */ },
  "observer_processing": { /* observer pipeline metadata */ }
}
```

## Implementation Requirements

### Backend (Python/Pydantic)
- All response models MUST inherit from or validate against DecisionContract
- Any data not matching schema is rejected with ValidationError

### Frontend (TypeScript/Zod)
- All API responses validated against DecisionContract schema
- State management uses DecisionContract interface
- Invalid data triggers error boundary

### Observer Pipeline (Python/JSON)
- All AI outputs formatted as DecisionContract JSON
- Validation before sending to backend

## Validation Rules

1. **No Extra Fields**: Only specified fields allowed
2. **Type Strictness**: Exact types enforced
3. **Required Fields**: All mandatory fields must be present
4. **Immutable**: Contract changes require ecosystem-wide migration

## Gatekeeper Implementation

- **Programmatic Rejection**: Any packet failing validation is dropped
- **Error Codes**: `INVALID_CONTRACT`, `MISSING_FIELD`, `INVALID_TYPE`
- **Logging**: All validation failures logged for audit

## Migration Path

1. Audit existing schemas for conflicts
2. Replace with DecisionContract
3. Update all components simultaneously
4. Test validation in all environments