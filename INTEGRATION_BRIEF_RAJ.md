# INTEGRATION_BRIEF_RAJ.md — Backend Architecture & Ownership Transfer
**Date:** May 5, 2026  
**To:** Raj (Backend Lead)  
**From:** Principal Systems Architect  
**Classification:** Confidential — Backend Architecture Manual

---

## YOUR ROLE: Backend Pipeline Guardian

You own the transformation of raw AI output into a DecisionContract-compliant response. Your responsibility is absolute: **No response leaves the backend without passing ResponseBuilder validation.**

---

## PART 1: YOUR THREE CRITICAL RESPONSIBILITIES

### Responsibility 1: RequestValidationMiddleware — The Entry Gate
**File:** `nyaya/backend/main.py`  
**Your Task:** Ensure trace_id is generated correctly and never lost.

```python
@app.middleware("http")
async def add_trace_id_middleware(request: Request, call_next):
    import uuid
    trace_id = str(uuid.uuid4())  # MUST be valid UUID format
    request.state.trace_id = trace_id  # MUST be attached to request.state
    response = await call_next(request)
    response.headers["X-Trace-ID"] = trace_id  # MUST be in response headers
    return response
```

**Verification Checklist:**
- [ ] trace_id is UUID format (not random string, not int)
- [ ] trace_id is added to request.state BEFORE calling next middleware
- [ ] trace_id is never reassigned after generation
- [ ] trace_id is in response headers for frontend correlation

---

### Responsibility 2: router.py — The Pipeline Orchestrator
**File:** `nyaya/backend/router.py`  
**Your Task:** Every route must follow this exact sequence:

```
1. Receive QueryRequest
2. Extract trace_id from request.state
3. JurisdictionRouter → identify target jurisdiction
4. Select Legal Agent based on jurisdiction
5. Legal Agent.process() → returns reasoning
6. ObserverPipeline.process_result() → logs events
7. ResponseBuilder.build_nyaya_response() ← ONLY here
8. Validate against DecisionContract
9. Return NyayaResponse
```

**Critical Code Pattern:**

```python
@router.post("/query", response_model=NyayaResponse)
async def query_legal(
    request: QueryRequest,
    trace_id: str = Depends(get_trace_id),
    background_tasks: Optional[BackgroundTasks] = None
):
    """✅ CORRECT PATTERN"""
    
    # 1. Route to correct jurisdiction
    routing_result = await jurisdiction_router_agent.process({
        "query": request.query,
        "jurisdiction_hint": request.jurisdiction_hint,
        "domain_hint": request.domain_hint
    })
    target_jurisdiction = routing_result["jurisdiction"]
    
    # 2. Get the legal agent
    agent = agents[target_jurisdiction]
    
    # 3. Agent processes the query
    agent_result = await agent.process({
        "query": request.query,
        "trace_id": trace_id
    })
    
    # 4. Observer pipeline logs everything
    observer_result = await observer_pipeline.process_result(
        agent_result,
        trace_id,
        target_jurisdiction
    )
    
    # 5. ✅ ONLY place response is built
    return ResponseBuilder.build_nyaya_response(
        domain=routing_result["domain"],
        jurisdiction=target_jurisdiction,
        confidence=agent_result["confidence"],
        legal_route=agent_result["legal_route"],
        trace_id=trace_id,
        reasoning_trace={
            "routing_decision": routing_result,
            "agent_processing": agent_result,
            "observer_processing": observer_result
        }
    )
```

**❌ WRONG PATTERNS (never do this):**

```python
# ❌ WRONG 1: Bypassing ResponseBuilder
return {"data": agent_result}

# ❌ WRONG 2: Creating response outside ResponseBuilder
return NyayaResponse(trace_id=trace_id, ...)

# ❌ WRONG 3: Skipping observer pipeline
observer_result = await observer_pipeline.process_result(...)
if observer_result.get("needs_skip"):  # ❌ No conditional skips!
    return ResponseBuilder.build_nyaya_response(...)

# ❌ WRONG 4: Multiple ResponseBuilder calls
response1 = ResponseBuilder.build_nyaya_response(...)
response2 = ResponseBuilder.build_nyaya_response(...) # ❌ Only call once
return response1
```

---

### Responsibility 3: ResponseBuilder — The Validation Enforcer
**File:** `nyaya/backend/response_builder.py`  
**Your Task:** Ensure ALL responses validate against DecisionContract.

```python
@staticmethod
def build_nyaya_response(
    domain: str,
    jurisdiction: str,
    confidence: float,
    legal_route: List[str],
    trace_id: str,
    reasoning_trace: Dict[str, Any] = None,
    provenance_chain: List[Dict[str, Any]] = None,
    constitutional_articles: List[str] = None
) -> NyayaResponse:
    """CANONICAL response builder - only use this to create responses"""
    
    # 1. Create enforcement status with canonical values ONLY
    enforcement_status = EnforcementStatus(
        state=EnforcementState.CLEAR,  # Only canonical enums
        verdict=EnforcementVerdict.ENFORCEABLE,
        reason="Analysis complete",
        barriers=[],
        blocked_path=None,
        escalation_required=False,
        escalation_target=None,
        redirect_suggestion=None,
        safe_explanation="Your query has been analyzed",
        trace_id=trace_id
    )
    
    # 2. Create response
    response = NyayaResponse(
        domain=domain,
        jurisdiction=jurisdiction,
        confidence=confidence,
        legal_route=legal_route,
        reasoning_trace=reasoning_trace or {},
        trace_id=trace_id,
        enforcement_status=enforcement_status,
        provenance_chain=provenance_chain or [],
        constitutional_articles=constitutional_articles or [],
        metadata={"Formatted": True}  # MUST be exactly this
    )
    
    # 3. ✅ VALIDATE AGAINST DECISION CONTRACT
    try:
        validate_decision_contract(response.dict())
    except Exception as e:
        logger.error(f"DecisionContract validation failed: {e}")
        raise ValueError(f"Response validation failed: {str(e)}")
    
    return response
```

**Validation Checklist:**
- [ ] `validate_decision_contract()` is called before returning
- [ ] `metadata.Formatted` is exactly `{"Formatted": True}` (boolean, not string)
- [ ] `enforcement_status.state` is one of: clear, block, escalate, soft_redirect, conditional
- [ ] `enforcement_status.verdict` is one of: ENFORCEABLE, PENDING_REVIEW, NON_ENFORCEABLE
- [ ] `confidence` is float between 0.0 and 1.0 (inclusive)
- [ ] `trace_id` is non-empty string
- [ ] No extra fields in response (Pydantic extra='forbid')

---

## PART 2: ENUMS YOU CONTROL (DO NOT CHANGE WITHOUT APPROVAL)

### EnforcementState (5 canonical values)
```python
class EnforcementState(str, Enum):
    CLEAR = "clear"                    # Path is clear, no legal barriers
    BLOCK = "block"                    # Legal barrier exists, cannot proceed
    ESCALATE = "escalate"              # Needs expert review or higher authority
    SOFT_REDIRECT = "soft_redirect"    # Alternative pathway exists
    CONDITIONAL = "conditional"        # Can proceed with conditions
```

**Migration Note:** These names will change to advisory-based terms after TANTRA transition. See TRANSFER_NOTES.md for mapping.

### EnforcementVerdict (3 canonical values)
```python
class EnforcementVerdict(str, Enum):
    ENFORCEABLE = "ENFORCEABLE"            # System recommends proceeding
    PENDING_REVIEW = "PENDING_REVIEW"      # Needs human review before display
    NON_ENFORCEABLE = "NON_ENFORCEABLE"    # System recommends not proceeding
```

**Do NOT add:** RESTRICT, ALLOW_INFORMATIONAL, or any other values.

---

## PART 3: SCHEMA MIGRATION (ADVISORY TRANSITION)

When Raj receives the directive to migrate from enforcement_status to advisory_status:

### Step 1: Update Pydantic Schema
```python
# OLD (current)
enforcement_status: EnforcementStatus

# NEW (post-transition)
advisory_status: AdvisoryStatus
```

### Step 2: Update EnforcementState → Recommendation
```python
# Map old values to new:
CLEAR → recommendation: "clear"
BLOCK → recommendation: "block"
ESCALATE → recommendation: "escalate"
SOFT_REDIRECT → recommendation: "soft_redirect"
CONDITIONAL → recommendation: "conditional"
```

### Step 3: Update EnforcementVerdict → Rationale
```python
# Map old values to new:
ENFORCEABLE → rationale: "ADVISABLE"
PENDING_REVIEW → rationale: "PENDING_REVIEW"
NON_ENFORCEABLE → rationale: "NON_ADVISABLE"
```

### Step 4: Add New Fields
```python
class AdvisoryStatus(BaseModel):
    recommendation: str  # clear|block|escalate|soft_redirect|conditional
    rationale: str      # ADVISABLE|PENDING_REVIEW|NON_ADVISABLE
    explanation: str    # Replaces "reason"
    determinism_proof: Optional[str]  # NEW: From ObserverPipeline
    confidence_adjusted: bool         # NEW: Indicates if confidence affected recommendation
```

**Deployment Order:**
1. Backend deploys first (with advisory_status)
2. Frontend updates FormatterGate to check advisory_status
3. ObserverPipeline ensures determinism_proof is populated
4. All three deployed simultaneously for consistency

---

## PART 4: COMMON BACKEND ERRORS & FIXES

### Error 1: "ValidationError: extra fields not permitted"
**Cause:** Extra field added to response.  
**Fix:** Remove the field, or add it to DecisionContract schema (requires ecosystem update).

### Error 2: "enforcement_status.state must be one of: clear, block, escalate, soft_redirect, conditional"
**Cause:** Typo in enum value (e.g., "CLEAR" instead of "clear").  
**Fix:** Use lowercase, canonical enum values ONLY.

### Error 3: "confidence must be between 0.0 and 1.0"
**Cause:** Confidence value outside valid range (e.g., 1.5, -0.1, 101).  
**Fix:** Normalize to 0.0–1.0 range before building response.

### Error 4: "trace_id cannot be None"
**Cause:** trace_id not passed to ResponseBuilder.  
**Fix:** Extract trace_id from request.state and pass it explicitly.

### Error 5: "metadata.Formatted is not True"
**Cause:** Metadata set to something other than `{"Formatted": True}`.  
**Fix:** ResponseBuilder always sets this. If not present, response bypassed ResponseBuilder.

---

## PART 5: DEBUGGING CHECKLIST FOR RAJ

When a response fails FormatterGate or shows wrong data:

- [ ] Check trace_id is in response headers
- [ ] Verify RequestValidationMiddleware ran (check logs for "trace_id generated")
- [ ] Confirm ResponseBuilder was called (check logs for "DecisionContract validated")
- [ ] Check enforcement_status has all required fields (state, verdict, reason, trace_id)
- [ ] Verify metadata.Formatted is exactly `true` (boolean)
- [ ] Search logs for "ValidationError" or "validation failed"
- [ ] If observer_pipeline error: check Vedant's logs
- [ ] If agent error: check that agent returns required fields (confidence, legal_route, jurisdiction)

---

## PART 6: YOUR DEPLOYMENT RESPONSIBILITY

When deploying backend:

1. **Pre-deployment:** Run `pytest nyaya/backend/test_*.py` to verify all routes pass validation
2. **Deployment:** Push to main, Render auto-builds Docker
3. **Post-deployment:** 
   - Verify `/docs` endpoint loads
   - Send test query via browser Network tab
   - Verify response has metadata.Formatted: true
   - Check Render logs for any 500 errors

---

## YOUR ACCOUNTABILITY

**You are accountable for:**
- ✅ Every response passes ResponseBuilder
- ✅ No response bypasses DecisionContract validation
- ✅ trace_id is immutable and traceable
- ✅ All enum values are canonical
- ✅ confidence is always 0.0–1.0
- ✅ metadata.Formatted is exactly true

**If any of these fails, the system fails.**

---

## END RAJ'S BRIEF
