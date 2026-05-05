# TRANSFER_NOTES.md — Nyaya System Architecture Handover
**Date:** May 5, 2026  
**Status:** Principal Systems Architect Sign-Off  
**Audience:** Development Team (Raj, Vedant, Vinayak)  
**Classification:** System Architecture Reference

---

## PART 1: SYSTEM PHILOSOPHY

### Core Principle: Decoupled Determinism
The Nyaya system is built on three immutable principles:
1. **Single Source of Truth:** DecisionContract is the canonical schema. All validation happens at exactly one point: the ResponseBuilder.
2. **No Bypass Paths:** Every response must pass FormatterGate. There is no "emergency" path that skips validation.
3. **Forensic Auditability:** Every trace_id links to a deterministic decision. If you see the same trace_id, you must get the same output.

### Why This Matters
- **For Raj (Backend):** Your job is to ensure ResponseBuilder is called and ONLY called. Any agent output that doesn't go through ResponseBuilder is a breach.
- **For Vedant (Observer):** Your job is to ensure every decision step is logged. If an enforcement_status.state changes, there must be a provenance_chain entry explaining why.
- **For Vinayak (Testing):** Your job is to verify that no trace_id produces two different enforcement_status states.

---

## PART 2: THE TANTRA DIRECTIVE — Authority to Advisory Transition

### Current Schema (Authority-Based)
```json
{
  "enforcement_status": {
    "state": "clear|block|escalate|soft_redirect|conditional",
    "verdict": "ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE",
    "reason": "string"
  }
}
```

### Post-Migration Schema (Advisory-Based)
```json
{
  "advisory_status": {
    "recommendation": "clear|block|escalate|soft_redirect|conditional",
    "rationale": "ADVISABLE|PENDING_REVIEW|NON_ADVISABLE",
    "explanation": "string",
    "confidence_adjusted": true,
    "determinism_proof": "string|null"
  }
}
```

### Migration Mapping Table
| Authority Term | Advisory Term | Semantic Change | Implementation Impact |
|---|---|---|---|
| `enforcement_status` | `advisory_status` | Shifts from binding to guidance-based | FormatterGate checks `advisory_status`, not `enforcement_status` |
| `state: "block"` | `recommendation: "block"` | Output cannot force block; only advise block | UI still respects block, but message changes to "system advises blocking" |
| `verdict: "ENFORCEABLE"` | `rationale: "ADVISABLE"` | Output is recommendation, not verdict | Same render behavior, different semantic framing |
| (new field) | `determinism_proof` | New field to trace why recommendation is deterministic | Observer pipeline adds this; backend validates it exists |
| (new field) | `confidence_adjusted` | Boolean flag showing if recommendation changed based on confidence score | Transparency field; must be true or false |

### Critical: FormatterGate Checkpoint Updates
**Current Checkpoint 5:**
```javascript
if (!responseData.enforcement_status) {
  setValidationState('error');
  return;
}
```

**Post-Migration Checkpoint 5:**
```javascript
if (!responseData.advisory_status) {
  setValidationState('error');
  return;
}
```

**New Checkpoint 6 (Required):**
```javascript
if (!responseData.advisory_status.determinism_proof) {
  setValidationState('error');
  return;
}
```

### Why This Matters for the System
- **No Breaking Changes to UI:** The FormatterGate still blocks unformatted responses. The only difference is which field it checks.
- **Semantics Preserved:** A `recommendation: "block"` still prevents render. But legally and ethically, it's now "advised blocking" not "enforced blocking."
- **Auditability Enhanced:** The `determinism_proof` field creates an explicit audit trail explaining *why* a recommendation is reproducible.

---

## PART 3: KNOWN LIMITATIONS (What NOT to Change)

### Limitation 1: FormatterGate is a Hard Gate
**What it is:** FormatterGate blocks rendering if metadata.Formatted !== true.  
**Why it exists:** Without this, unformatted raw backend output could leak to users.  
**What you cannot do:** Remove or bypass this check. Even for "debugging."  
**What you can do:** Add logging before the gate so you can see what failed validation.

### Limitation 2: ResponseBuilder is Singleton
**What it is:** All responses go through ResponseBuilder.build_nyaya_response().  
**Why it exists:** Ensures all responses have metadata.Formatted: true and pass DecisionContract validation.  
**What you cannot do:** Create responses directly without ResponseBuilder.  
**What you can do:** Extend ResponseBuilder with new build methods (e.g., build_advisory_response()) but they must call validate_decision_contract() internally.

### Limitation 3: Trace ID is Immutable Per Request
**What it is:** Once a trace_id is generated, all downstream events use the same trace_id.  
**Why it exists:** Audit trails depend on this. If trace_id changes mid-request, the chain breaks.  
**What you cannot do:** Reassign or regenerate trace_id after RequestValidationMiddleware creates it.  
**What you can do:** Log the trace_id at every step, but never modify it.

### Limitation 4: Observer Pipeline Must Complete Before ResponseBuilder
**What it is:** The observer pipeline processes agent output BEFORE ResponseBuilder creates the final response.  
**Why it exists:** This ensures provenance_chain is populated before networking.  
**What you cannot do:** Skip observer pipeline to "speed up" responses.  
**What you can do:** Optimize observer pipeline, but the order must remain: Agent → Observer → ResponseBuilder → NetworkResponse.

### Limitation 5: DecisionContract Validation is Non-Negotiable
**What it is:** Every response must validate against DecisionContract schema.  
**Why it exists:** Type safety and audit compliance.  
**What you cannot do:** Add extra fields to responses that aren't in DecisionContract.  
**What you can do:** Update DecisionContract, but all downstream components must update simultaneously.

---

## PART 4: HIDDEN PITFALLS (Debugging Traps)

### Pitfall 1: "FormatterGate is Passing But UI Still Looks Wrong"
**Root Cause:** metadata.Formatted is true, but other fields in the response are malformed.  
**Debug Path:**
1. Open Browser Console (F12 → Network tab)
2. Find the API response in Network tab
3. Click response → view JSON
4. Check if enforcement_status (or advisory_status) has all required fields:
   - state|recommendation (string)
   - verdict|rationale (string)
   - reason|explanation (string)
   - trace_id (string)
5. If any field is missing, ResponseBuilder failed validation (check backend logs).

### Pitfall 2: "Same trace_id, Different Response"
**Root Cause:** Observer pipeline added events after first response was sent.  
**Debug Path:**
1. Get the trace_id from first response
2. Query `/trace/{trace_id}` endpoint (if available)
3. Check provenance_chain for duplicate entries with same jurisdiction/domain
4. If duplicate exists, observer pipeline is running twice (check observer_pipeline.py for async race condition)

### Pitfall 3: "FormatterGate Blocking, But Response Looks Valid"
**Root Cause:** metadata object doesn't exist, or metadata.Formatted is not exactly `true` (could be string "true" or 1).  
**Debug Path:**
```javascript
// In browser console:
const response = await fetch('https://nyaya-ai-0f02.onrender.com/query', {method: 'POST', ...})
const data = await response.json()
console.log(typeof data.metadata.Formatted) // Should print "boolean"
console.log(data.metadata.Formatted === true) // Should print "true", not "true" (string)
```

### Pitfall 4: "Response Leaves Backend Unformatted"
**Root Cause:** A route doesn't call ResponseBuilder.  
**Debug Path:**
1. In [router.py](router.py#L1), search for `return` statements
2. Every `return` must be `return ResponseBuilder.build_*()` 
3. If you find `return {...}` directly, that's the breach

### Pitfall 5: "Trace ID Changes Mid-Request"
**Root Cause:** RequestValidationMiddleware or another middleware is modifying request.state.trace_id.  
**Debug Path:**
1. Add logging at middleware entry and exit
2. Compare trace_id values at each step
3. If they differ, that middleware is the culprit

### Pitfall 6: "DecisionContract Validation Fails But I Don't Know Why"
**Root Cause:** An enum field has an invalid value (e.g., state: "block2" instead of "block").  
**Debug Path:**
```python
from packages.shared.decision_contract import validate_decision_contract
try:
    validate_decision_contract(response_dict)
except Exception as e:
    print(f"Validation error: {e}")
    # Error message will show which field failed and why
```

---

## PART 5: SYSTEM ARCHITECTURE MAP

### Request → Response Journey
```
1. Browser POST /query
   ↓
2. RequestValidationMiddleware (checks Content-Type, generates trace_id)
   ↓
3. router.query_legal() endpoint
   ↓
4. JurisdictionRouter.process() (routes to correct agent)
   ↓
5. Legal Agent (returns raw reasoning)
   ↓
6. ObserverPipeline.process_result() (adds provenance, logs events)
   ↓
7. ResponseBuilder.build_nyaya_response() ← ONLY place response is created
   ↓
8. Validation: validate_decision_contract() (DecisionContract check)
   ↓
9. CORSMiddleware (adds CORS headers)
   ↓
10. Network response: {"metadata": {"Formatted": true}, ...}
   ↓
11. Browser receives response
   ↓
12. FormatterGate checkpoint 1-5 validation
   ↓
13. If all pass: render child component
   If any fail: show FullScreenBlockingOverlay
```

### Who Owns What
| Component | Owner | Responsibility |
|---|---|---|
| RequestValidationMiddleware | Raj | Ensure trace_id generation doesn't fail |
| JurisdictionRouter | Raj | Ensure routing logic always returns a legal agent |
| Legal Agents | Raj | Ensure agent output includes required fields (reasoning, jurisdiction, domain) |
| ObserverPipeline | Vedant | Ensure all events are logged and provenance_chain is populated |
| ResponseBuilder | Raj | Ensure ALL responses pass through this and only this |
| FormatterGate | Frontend (Vinayak) | Ensure all checkpoints enforce validation |
| TracePanel | Frontend (Vinayak) | Ensure trace_id/reasoning_trace/enforcement_status are displayed accurately |

---

## PART 6: MIGRATION CHECKLIST FOR ADVISORY TRANSITION

**Step 1:** Update DecisionContract schema in [packages/shared/decision_contract.md](packages/shared/decision_contract.md)
- [ ] Rename `enforcement_status` to `advisory_status`
- [ ] Update `verdict` enum values to `ADVISABLE|PENDING_REVIEW|NON_ADVISABLE`
- [ ] Add `determinism_proof` field (string|null)
- [ ] Add `confidence_adjusted` field (boolean)

**Step 2:** Update Backend ResponseBuilder ([nyaya/backend/response_builder.py](nyaya/backend/response_builder.py))
- [ ] Update build_nyaya_response() to create advisory_status instead of enforcement_status
- [ ] Ensure determinism_proof is populated from ObserverPipeline output

**Step 3:** Update Frontend FormatterGate ([nyaya-ui-kit/components/FormatterGate.jsx](nyaya-ui-kit/components/FormatterGate.jsx))
- [ ] Update Checkpoint 5 to check advisory_status instead of enforcement_status
- [ ] Add Checkpoint 6 to verify determinism_proof exists
- [ ] Update error messages from "enforcement" to "advisory"

**Step 4:** Update Frontend TracePanel ([nyaya-ui-kit/components/TracePanel.jsx](nyaya-ui-kit/components/TracePanel.jsx))
- [ ] Update to display advisory_status fields instead of enforcement_status
- [ ] Add determinism_proof section

**Step 5:** Update ObserverPipeline ([nyaya/observer_pipeline/observer_pipeline.py](nyaya/observer_pipeline/observer_pipeline.py))
- [ ] Ensure provenance_chain entries include determinism_proof reasoning

**Step 6:** Testing
- [ ] Run full test suite
- [ ] Verify FormatterGate blocks non-advisory responses
- [ ] Verify TracePanel displays advisory_status correctly
- [ ] Verify backward compatibility (if needed)

---

## PART 7: SUPPORT MATRIX

| Issue | Check First | Escalate To |
|---|---|---|
| Response not rendering | Browser console Network tab for response JSON | Raj (backend) |
| FormatterGate blocking valid response | Verify advisory_status exists in network response | Raj (backend) |
| Trace ID missing | Check RequestValidationMiddleware logs | Raj (backend) |
| Observer pipeline not logging | Check observer_pipeline.py execution | Vedant (observer) |
| UI component layout issues | Check CSS in TracePanel/FormatterGate | Vinayak (frontend) |
| Determinism proof missing | Check ObserverPipeline output | Vedant (observer) |

---

## PART 8: DECOUPLING VERIFICATION CHECKLIST

**For Raj (Backend Team):**
- [ ] All routes return ResponseBuilder.build_*() responses
- [ ] RequestValidationMiddleware is middleware, not a route handler
- [ ] ObserverPipeline is called in router.query_legal(), not in ResponseBuilder
- [ ] No hardcoded trace_ids (trace_id is generated by middleware)
- [ ] All enums in schemas.py match DecisionContract

**For Vedant (Observer Team):**
- [ ] ObserverPipeline.process_result() populates provenance_chain
- [ ] Every decision step has a corresponding provenance_chain entry
- [ ] determinism_proof field is always populated (for advisory transition)
- [ ] Trace events are immutable after creation

**For Vinayak (Frontend Team):**
- [ ] FormatterGate checkpoints 1-5 are non-negotiable
- [ ] TracePanel displays trace_id, legal_route, confidence, advisory_status
- [ ] No direct API calls bypass FormatterGate
- [ ] Browser console shows response structure in Network tab

---

## END TRANSFER_NOTES
