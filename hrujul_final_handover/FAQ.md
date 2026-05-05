# NYAYA PLATFORM — COMPREHENSIVE FAQ FOR DEVELOPERS
**Updated:** May 5, 2026  
**For:** Development Team & Future Maintainers  
**Format:** Evidence-Based Q&A with Direct Answers  

---

## SECTION 1: RUNNING THE SYSTEM

### Q1: What is the absolute minimum I need to run the Nyaya system locally?
**A:** 
1. Frontend: Node.js + npm + React dev server
2. Backend: Python 3.10+ + FastAPI + Pydantic
3. Backend API URL configured in frontend: `BASE_URL = "https://nyaya-ai-0f02.onrender.com"` (no localhost needed for frontend)

**Proof:**
```bash
# Frontend only
cd nyaya/frontend/frontend
npm install
npm run dev  # Connects to deployed backend

# Backend only (separate team)
cd nyaya/backend
pip install -r requirements.txt
uvicorn main:app --reload  # Local backend
```

---

### Q2: Where exactly is BASE_URL configured, and how do I change it?
**A:** 
**File:** `nyaya/frontend/frontend/src/lib/apiConfig.ts`
```typescript
export const BASE_URL = 
  process.env.REACT_APP_API_BASE_URL || 
  "https://nyaya-ai-0f02.onrender.com"
```

**To change it:**
1. Create `.env.local` in frontend root:
   ```
   REACT_APP_API_BASE_URL=http://localhost:8000
   ```
2. Restart dev server: `npm run dev`
3. Verify in browser console: `console.log(BASE_URL)`

---

### Q3: How do I know if the backend is actually running?
**A:** 
Make a health check request:
```bash
curl https://nyaya-ai-0f02.onrender.com/health
# Response: {"status": "healthy", "service": "nyaya-api-gateway"}

# If backend is down (5xx error):
# Frontend's useResiliency hook triggers degraded mode
# ServiceOutage view displayed to user
```

---

### Q4: What happens when the backend is down?
**A:** 
1. useResiliency hook detects 5xx error
2. onBackendFailure listeners fire
3. offlineStore saves last valid response to localStorage
4. User sees ServiceOutage message instead of results
5. System probes every 15 seconds for recovery
6. When backend recovers, normal operation resumes

**Code location:** `nyaya/frontend/frontend/src/hooks/useResiliency.js`

---

### Q5: I'm getting "CORS error" when fetching from frontend. What does that mean?
**A:** 
Your frontend origin is NOT whitelisted on backend.

**Check:**
```bash
# What origins are allowed?
# File: nyaya/backend/main.py
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://nyai.blackholeinfiverse.com")
```

**To fix:**
1. Add your frontend origin to backend `.env`:
   ```
   ALLOWED_ORIGINS=https://nyai.blackholeinfiverse.com,http://localhost:3000
   ```
2. Restart backend
3. Verify: Make OPTIONS request
   ```bash
   curl -X OPTIONS https://your-backend.com/nyaya/query \
     -H "Origin: http://localhost:3000"
   # Should return with Access-Control-Allow-Origin header
   ```

---

## SECTION 2: DEBUGGING ISSUES

### Q6: FormatterGate is showing "UNFORMATTED RESPONSE BLOCKED" error. How do I fix it?
**A:** 
Check that ResponseBuilder is being used on backend.

**Diagnosis:**
1. Open browser Network tab
2. Find the `/nyaya/query` response
3. Look for `"metadata": { "Formatted": true }`
4. If missing: Backend is returning raw response (bypassed ResponseBuilder)

**Fix:**
In `router.py`, wrap response with ResponseBuilder:
```python
# WRONG ❌
@router.post("/nyaya/query")
async def query_legal(request: QueryRequest, trace_id: str = Depends(get_trace_id)):
    result = await observer_pipeline.process(request)
    return result  # Missing ResponseBuilder

# RIGHT ✅
@router.post("/nyaya/query")
async def query_legal(request: QueryRequest, trace_id: str = Depends(get_trace_id)):
    result = await observer_pipeline.process(request)
    return ResponseBuilder.format_response(result, trace_id)  # Adds metadata.Formatted
```

---

### Q7: I'm getting "Missing metadata object" or "Missing trace_id". What's happening?
**A:** 
ResponseBuilder is not wrapping the response correctly.

**Check the flow:**
```
Backend Agent → ResponseBuilder.format_response() → HTTP Response → Frontend
```

If any step is missing:
- Agent returns dict, not serialized to response
- ResponseBuilder not called
- trace_id not passed to ResponseBuilder

**Solution:** Verify:
```python
# In router.py
return ResponseBuilder.format_response(result, trace_id)
                      ^^^^^^^^^^^^^^^^            ^^^^^^^
                      Must exist                  Must be UUID
```

---

### Q8: My FormatterGate checkpoint 3 fails: "metadata.Formatted is not true". Why?
**A:** 
The boolean value is not exactly `true`. Check for:
- `metadata.Formatted = 1` (number) → FAILS
- `metadata.Formatted = "true"` (string) → FAILS
- `metadata.Formatted = True` (Python capital T, converted to JSON true) → PASSES

**In ResponseBuilder:**
```python
# In response_builder.py
response = {
    "metadata": {
        "Formatted": True,  # Python boolean, converts to JSON true
        "timestamp": datetime.now().isoformat(),
        "server": "nyaya-ai-gateway-v1"
    }
}
```

Python `True` converts to JSON `true` → `=== true` passes in JavaScript ✓

---

### Q9: Confidence score is null in UI but backend returned 0.85. Why?
**A:** 
GravitasResponseTransformer is filtering it out.

**Check:**
```javascript
// In GravitasResponseTransformer.js
transform: (apiResponse) => {
  // confidence must be number 0.0-1.0
  if (typeof apiResponse.confidence !== 'number') {
    setError('confidence must be number');
    return null;  // Drops entire response
  }
  if (apiResponse.confidence < 0 || apiResponse.confidence > 1.0) {
    setError('confidence must be 0.0-1.0');
    return null;  // Drops entire response
  }
  return apiResponse;
}
```

**Fix:** Ensure backend returns:
```json
{
  "confidence": 0.85  // number, not string, not >1.0
}
```

---

### Q10: API call hangs for 30+ seconds then fails. What's happening?
**A:** 
Backend is slow or doesn't respond. Request timeout triggered.

**Timeout configuration:**
```javascript
// In nyayaApiClient.js
const nyayaApiClient = axios.create({
  baseURL: NYAYA_API_BASE,
  timeout: 30000,  // 30 seconds
  headers: {...}
})
```

**What happens after timeout:**
```javascript
// In nyayaApi.js response interceptor
.catch((error) => {
  if (error.code === 'ECONNABORTED') {
    _emitFailure(error);  // Triggers degraded mode
    return { success: false, error: 'Request timeout' };
  }
})
```

**To fix:**
1. Check backend logs: `heroku logs -t` (if on Heroku)
2. Check Render dashboard if deployed there
3. Increase timeout (only if necessary):
   ```javascript
   timeout: 60000  // 60 seconds
   ```
4. Optimize backend query speed

---

## SECTION 3: COMMON MISTAKES

### Q11: I added a new field to DecisionContract but UI shows "Unknown property". How do I fix it?
**A:** 
React doesn't error on unknown properties. They just get ignored. **This is not an error.**

But if you want to DISPLAY the new field:
1. Update DecisionContract in backend:
   ```python
   class DecisionContract(BaseModel):
       # Existing fields
       trace_id: str
       # New field
       new_field: str
   ```
2. Update ResponseBuilder to include it:
   ```python
   return ResponseBuilder.format_response(result, trace_id)
   # ResponseBuilder automatically includes all DecisionContract fields
   ```
3. Update UI component to display it:
   ```jsx
   <div>New Field: {decisionContract.new_field}</div>
   ```

---

### Q12: I removed a field from DecisionContract but frontend still crashes. Why?
**A:** 
Frontend expects the field. Check component props:
```jsx
const { trace_id, enforcement_status, NEW_FIELD } = decisionContract;
// If NEW_FIELD doesn't exist, undefined ← use default
const { NEW_FIELD = 'fallback' } = decisionContract;
```

**Better approach:** Always add optional fields with defaults:
```python
# In decision_contract.py
class DecisionContract(BaseModel):
    trace_id: str
    new_field: Optional[str] = None  # Optional with default
```

---

### Q13: I modified FormatterGate checkpoints but validation still passes invalid responses. What went wrong?
**A:** 
FormatterGate only validates presence of fields, NOT their values.

**What FormatterGate checks:**
- `metadata` object exists
- `metadata.Formatted === true`
- `trace_id` exists (non-empty)
- `enforcement_status` exists

**What FormatterGate DOES NOT check:**
- `enforcement_status.state` is valid enum value
- `confidence` is 0.0-1.0
- `legal_route` is non-empty array
- Field values are correct types

**That's GravitasResponseTransformer's job:**
```javascript
// In GravitasResponseTransformer.js
if (apiResponse.confidence < 0 || apiResponse.confidence > 1.0) {
  throw new Error('Invalid confidence');
}
```

---

### Q14: I want to add a new validation checkpoint to FormatterGate. What's the pattern?
**A:** 
Follow existing checkpoint pattern:
```jsx
// Existing checkpoints
if (!responseData) { setValidationState('error'); return; }
if (!responseData.metadata) { setValidationState('error'); return; }

// NEW checkpoint (example: validate jurisdiction enum)
if (!['IN', 'UK', 'UAE'].includes(responseData.jurisdiction)) {
  setValidationState('error');
  setErrorMessage('INVALID JURISDICTION: ' + responseData.jurisdiction);
  return;
}

// Only after ALL checkpoints pass:
setValidationState('valid');
```

**Important:** Add ALL new checkpoints in one `useEffect` block. Don't add multiple effects.

---

### Q15: The trace_id is not being injected into API requests. How do I verify and fix?
**A:** 
Check that window variable is set:

**Step 1: Verify window variable:**
```javascript
// In browser console
console.log(window.__gravitas_active_trace_id)
// Should print UUID, not undefined
```

**Step 2: If undefined, find where it's supposed to be set:**
```javascript
// In nyayaApi.js response interceptor
const response = await apiClient.post('/nyaya/query', payload);
window.__gravitas_active_trace_id = response.data.trace_id;  // This line sets it
```

**Step 3: Verify it's injected into headers:**
```javascript
// Request interceptor in nyayaApiClient.js
nyayaApiClient.interceptors.request.use((config) => {
  const traceId = window.__gravitas_active_trace_id;
  if (traceId) {
    config.headers['X-Trace-ID'] = traceId;  // Injected into header
  }
  return config;
})
```

**Step 4: Verify in Network tab:**
1. Open browser DevTools → Network tab
2. Make a query request
3. Click on request
4. Check Request Headers → `X-Trace-ID: [should be UUID]`

---

## SECTION 4: SCHEMA & DATA STRUCTURE

### Q16: What is the exact structure of enforcement_status? Can I add custom fields?
**A:** 
**Canonical structure:**
```json
{
  "state": "clear|block|escalate|soft_redirect|conditional",
  "verdict": "ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE",
  "reason": "string — advisory explanation",
  "barriers": ["array", "of", "legal obstacles"],
  "blocked_path": "string|null — which legal route blocked",
  "escalation_required": boolean,
  "escalation_target": "string|null — where to escalate",
  "redirect_suggestion": "string|null — alternative route",
  "safe_explanation": "string — plain language advisory",
  "trace_id": "string"
}
```

**Can you add custom fields?**
- **Backend:** Yes, add to DecisionContract Pydantic model
- **Frontend:** Yes, components will ignore unknown fields (React behavior)
- **FormatterGate:** No impact (doesn't validate field values)

**Example: Adding custom field**
```python
# In decision_contract.py
class EnforcementStatus(BaseModel):
    # Existing fields
    state: str
    verdict: str
    # NEW field
    custom_metadata: Optional[Dict[str, Any]] = None
```

Frontend automatically receives it, components ignore if not used.

---

### Q17: What happens if I return a malformed legal_route array (e.g., contains numbers)?
**A:** 
**Backend:** Pydantic validation catches it
```python
# In decision_contract.py
legal_route: List[str]  # MUST be array of strings

# If backend tries:
legal_route: [1, 2, "Router"]  # Pydantic raises ValidationError
```

**Frontend:** GravitasResponseTransformer catches it
```javascript
// In GravitasResponseTransformer.js
if (!Array.isArray(apiResponse.legal_route) || 
    !apiResponse.legal_route.every(r => typeof r === 'string')) {
  throw new Error('legal_route must be array of strings');
}
```

**FormatterGate:** No impact (doesn't check field types)

---

### Q18: Can I nest objects inside enforcement_status or are all values flat?
**A:** 
**Yes, you can nest.** DecisionContract accepts any structure you define in Pydantic.

**Example: Nested structure**
```python
class EnforcementStatus(BaseModel):
    state: str
    verdict: str
    # Nested object (new)
    risk_assessment: Optional[Dict[str, Any]] = None  # Can be any structure
    # Nested array (new)
    procedural_steps: Optional[List[Dict[str, str]]] = None
```

**Frontend automatically deserializes:**
```jsx
<div>{decisionContract.enforcement_status.risk_assessment.severity}</div>
<div>{decisionContract.enforcement_status.procedural_steps[0].name}</div>
```

---

### Q19: What's the difference between confidence and verdict? When do I use each?
**A:** 
| Field | Type | Meaning | Example |
|-------|------|---------|---------|
| `confidence` | number 0.0-1.0 | How sure the system is about analysis | 0.87 = 87% confident |
| `verdict` | enum | Legal viability based on law | "ENFORCEABLE" = action is legal |

**When to use each:**
- **confidence:** "I'm 92% sure this is a civil case" (system uncertainty)
- **verdict:** "This civil case is ENFORCEABLE" (legal outcome)

**Example:**
```json
{
  "confidence": 0.92,
  "enforcement_status": {
    "verdict": "ENFORCEABLE",
    "reason": "Despite 8% uncertainty, law clearly permits this"
  }
}
```

---

### Q20: If confidence is 0.5 (low) but verdict is ENFORCEABLE, what should UI show?
**A:** 
Show BOTH signals:
```jsx
<ConfidenceIndicator confidence={0.5} color="yellow" />
<span>Low confidence (50%)</span>

<EnforcementBadge verdict="ENFORCEABLE" />
<span>But legal action is viable</span>

<DisclaimerBox>
  This analysis has 50% confidence. Consult a lawyer before proceeding.
</DisclaimerBox>
```

**Pattern:** Don't hide information. Let user decide based on both confidence and verdict.

---

## SECTION 5: UPDATING THE SCHEMA

### Q21: I need to rename `enforcement_status` to `legal_advisory`. What's the safest way?
**A:** 
**Multi-step migration (not atomic):**

**Step 1: Backend - Add new field, keep old**
```python
# In decision_contract.py
class DecisionContract(BaseModel):
    enforcement_status: EnforcementStatus  # Keep for now
    legal_advisory: Optional[EnforcementStatus] = None  # New field
```

**Step 2: Backend - ResponseBuilder writes both**
```python
# In response_builder.py
response = {
    "enforcement_status": original_status,  # Old name
    "legal_advisory": original_status,      # New name (same data)
}
```

**Step 3: Frontend - Update components to use `legal_advisory`**
```jsx
// Old: decisionContract.enforcement_status
// New: decisionContract.legal_advisory
<EnforcementBadge verdict={decisionContract.legal_advisory?.verdict} />
```

**Step 4: Frontend - Remove references to `enforcement_status`**

**Step 5: Backend - Remove old field**
```python
# Remove: enforcement_status: EnforcementStatus
# Only keep: legal_advisory: EnforcementStatus
```

**Important:** Test at every step. Old field keeps working during transition.

---

### Q22: Can I add a new enum value to enforcement_status.state without breaking the system?
**A:** 
**Yes.** 

**How:**
1. Backend enum adds new value:
   ```python
   class EnforcementState(str, Enum):
       CLEAR = "clear"
       BLOCK = "block"
       ESCALATE = "escalate"
       SOFT_REDIRECT = "soft_redirect"
       CONDITIONAL = "conditional"
       CAUTIONARY = "cautionary"  # NEW
   ```

2. ResponseBuilder generates new state value:
   ```python
   if reason == "legal_risk_high":
       state = EnforcementState.CAUTIONARY
   ```

3. Frontend components handle gracefully:
   ```jsx
   const stateColors = {
       'clear': '#4CAF50',
       'block': '#f44336',
       'escalate': '#FF9800',
       'cautionary': '#2196F3',  // NEW color
   }
   ```

4. FormatterGate: No change needed (only checks field existence)

5. If needed, update UI copy:
   ```jsx
   const stateDescriptions = {
       'cautionary': 'Proceed with caution — legal risks present'
   }
   ```

---

### Q23: How do I add a new optional field without breaking existing responses?
**A:** 
**Use Optional with default:**

**Backend:**
```python
class DecisionContract(BaseModel):
    # Existing required fields
    trace_id: str
    jurisdiction: str
    # New optional field with default
    explanation_chain: Optional[List[str]] = None
```

**Frontend:** Component handles gracefully
```jsx
const { explanation_chain = [] } = decisionContract;
explanation_chain.forEach(exp => console.log(exp));  // Works even if undefined
```

**No breaking changes:**
- Old responses (without `explanation_chain`) still work
- New responses include it
- Frontend handles both transparently

---

## SECTION 6: TESTING

### Q24: What's the quickest way to test if my changes broke the system?
**A:** 
**1-minute smoke test:**
```bash
# 1. Start frontend (if modified)
cd nyaya/frontend/frontend
npm run dev  # Should build without errors

# 2. Run backend integration test
curl -X POST https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Can I file a case?", "jurisdiction_hint": "India"}'

# 3. Verify response has metadata.Formatted
# Open browser console, check for "UNFORMATTED RESPONSE BLOCKED" message

# 4. If no error: ✓ Changes didn't break core flow
```

**What to check:**
- Browser shows error OR shows results
- Network tab shows `metadata: { "Formatted": true }`
- No "UNFORMATTED RESPONSE BLOCKED" message

---

### Q25: How do I write a test that verifies FormatterGate blocks invalid responses?
**A:** 
**Jest test pattern:**
```javascript
import FormatterGate from './FormatterGate'
import { render, screen } from '@testing-library/react'

test('FormatterGate blocks response without metadata.Formatted', () => {
  const invalidResponse = {
    trace_id: 'abc-123',
    jurisdiction: 'IN',
    enforcement_status: {},
    // Missing: metadata.Formatted
  }

  render(
    <FormatterGate responseData={invalidResponse}>
      <div>Should not render</div>
    </FormatterGate>
  )

  // Verify blocking overlay appears
  expect(screen.getByText(/UNFORMATTED RESPONSE BLOCKED/i)).toBeInTheDocument()
  expect(screen.queryByText('Should not render')).not.toBeInTheDocument()
})

test('FormatterGate passes valid response', () => {
  const validResponse = {
    trace_id: 'abc-123',
    jurisdiction: 'IN',
    enforcement_status: {},
    metadata: { Formatted: true }
  }

  render(
    <FormatterGate responseData={validResponse}>
      <div>Should render</div>
    </FormatterGate>
  )

  expect(screen.getByText('Should render')).toBeInTheDocument()
  expect(screen.queryByText(/UNFORMATTED RESPONSE BLOCKED/i)).not.toBeInTheDocument()
})
```

---

## FINAL CHECKLIST

Before deploying changes, verify:
- [ ] FormatterGate still blocks invalid responses
- [ ] Health check endpoint returns `{"status": "healthy"}`
- [ ] At least one successful query returns with `metadata.Formatted = true`
- [ ] trace_id is injected in request headers (check Network tab)
- [ ] Confidence score is number 0.0-1.0, not null
- [ ] No console errors (except expected warnings)
- [ ] CORS headers present in OPTIONS response
- [ ] No hardcoded localhost URLs remain

**If any check fails:** Don't deploy. Debug using Q1-Q25.

---

**FAQ Status:** COMPLETE  
**25 Questions Covered:** ✓  
**Evidence Provided:** ✓  
**Actionable Solutions:** ✓
