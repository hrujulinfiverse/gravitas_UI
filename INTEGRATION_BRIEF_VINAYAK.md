# INTEGRATION_BRIEF_VINAYAK.md — Frontend Validation & UI Architecture
**Date:** May 5, 2026  
**To:** Vinayak (Frontend Lead)  
**From:** Principal Systems Architect  
**Classification:** Confidential — Frontend Validation Manual

---

## YOUR ROLE: Last Defense Guardian — FormatterGate

You own the final validation gate that prevents unformatted or malicious responses from reaching users. Your responsibility is absolute: **FormatterGate has 5 checkpoints. All must pass.**

---

## PART 1: THE FIVE CHECKPOINTS (NON-NEGOTIABLE)

### Checkpoint 1: Response Exists
```javascript
if (!responseData) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: No response data received');
  return;
}
```
**Tests:** 
- Response is not null
- Response is not undefined
- Response is an object (not array, not string)

---

### Checkpoint 2: Metadata Object Exists
```javascript
if (!responseData.metadata) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing metadata object');
  return;
}
```
**Tests:**
- metadata field exists
- metadata is an object (not null, not array)
- metadata is not empty object

---

### Checkpoint 3: Formatted Flag is Strictly True
```javascript
if (responseData.metadata.Formatted !== true) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: metadata.Formatted flag is not true');
  return;
}
```
**Tests:**
- Formatted field exists
- **Formatted === true** (strict equality, boolean true, not string "true")
- NOT `==` (loose comparison)
- NOT `Formatted === 1` (not number)
- NOT `Formatted === "true"` (not string)

**Why strict equality?**  
Prevents bypass attacks where response sends `Formatted: "true"` (string) or `Formatted: 1` (number).

---

### Checkpoint 4: Trace ID Exists and is Non-Empty
```javascript
if (!responseData.trace_id || responseData.trace_id.length === 0) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing trace_id');
  return;
}
```
**Tests:**
- trace_id field exists
- trace_id is a string (not null, not object)
- trace_id.length > 0 (non-empty)

---

### Checkpoint 5: Advisory Status Exists (Post-Migration) OR Enforcement Status Exists (Current)
**Current (Authority-based):**
```javascript
if (!responseData.enforcement_status) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing enforcement_status');
  return;
}
```

**Post-Migration (Advisory-based):**
```javascript
if (!responseData.advisory_status) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing advisory_status');
  return;
}

// New Checkpoint 6: Determinism Proof Exists
if (!responseData.advisory_status.determinism_proof) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing determinism_proof');
  return;
}
```

**Tests (Current Schema):**
- enforcement_status object exists
- enforcement_status has state field
- enforcement_status has verdict field
- enforcement_status has trace_id field

**Tests (New Schema - Advisory):**
- advisory_status object exists
- advisory_status has recommendation field
- advisory_status has rationale field
- advisory_status has determinism_proof field (NEW)
- advisory_status has confidence_adjusted field (NEW)

---

## PART 2: FORMATTERGATE IMPLEMENTATION CHECKLIST

### ✅ Current Implementation (Authority-based)
**File:** `nyaya-ui-kit/components/FormatterGate.jsx`

```javascript
import React, { useState, useEffect } from 'react';

const FormatterGate = ({ children, responseData }) => {
  const [validationState, setValidationState] = useState('validating');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Checkpoint 1
    if (!responseData) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: No response data received');
      return;
    }

    // Checkpoint 2
    if (!responseData.metadata) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing metadata object');
      return;
    }

    // Checkpoint 3 - STRICT EQUALITY
    if (responseData.metadata.Formatted !== true) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: metadata.Formatted flag is not true');
      return;
    }

    // Checkpoint 4
    if (!responseData.trace_id || responseData.trace_id.length === 0) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing trace_id');
      return;
    }

    // Checkpoint 5
    if (!responseData.enforcement_status) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing enforcement_status');
      return;
    }

    // All checkpoints passed
    setValidationState('valid');
  }, [responseData]);

  if (validationState === 'error') {
    return (
      <div style={{...error overlay styles...}}>
        <h1>Security Breach Detected</h1>
        <p>{errorMessage}</p>
        {responseData?.trace_id && (
          <div>
            <div>Trace ID (for debugging):</div>
            <div>{responseData.trace_id}</div>
          </div>
        )}
        <button onClick={() => window.location.reload()}>🔄 Retry Request</button>
      </div>
    );
  }

  // Only render children if all checkpoints pass
  return children;
};

export default FormatterGate;
```

---

## PART 3: MIGRATION PATH — ADVISORY SCHEMA

When Vedant and Raj deploy the advisory transition:

### Step 1: Update Checkpoint 5 in FormatterGate
```javascript
// OLD
if (!responseData.enforcement_status) {
  setValidationState('error');
  return;
}

// NEW
if (!responseData.advisory_status) {
  setValidationState('error');
  return;
}
```

### Step 2: Add Checkpoint 6
```javascript
// NEW Checkpoint 6
if (!responseData.advisory_status.determinism_proof) {
  setValidationState('error');
  setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing determinism_proof');
  return;
}
```

### Step 3: Update TracePanel to Display advisory_status
```javascript
// OLD
const { enforcement_status } = decisionContract;
return <div>{enforcement_status.state}</div>;

// NEW
const { advisory_status } = decisionContract;
return (
  <div>
    <div>Recommendation: {advisory_status.recommendation}</div>
    <div>Rationale: {advisory_status.rationale}</div>
    <div>Confidence Adjusted: {advisory_status.confidence_adjusted ? 'Yes' : 'No'}</div>
    <div>Proof: {advisory_status.determinism_proof}</div>
  </div>
);
```

---

## PART 4: TRACEPANEL — WHAT MUST BE DISPLAYED

### Current Display (TracePanel.jsx)
**File:** `nyaya-ui-kit/components/TracePanel.jsx`

Your TracePanel MUST display:

1. **Trace ID** (non-empty string)
2. **Jurisdiction** (e.g., "India", "UK")
3. **Domain** (e.g., "criminal", "civil", "constitutional")
4. **Confidence** (0.0–1.0 with percentage)
5. **Legal Route** (array of steps taken)
6. **Enforcement Status** (state, verdict, reasoning)
   - state: "clear" | "block" | "escalate" | "soft_redirect" | "conditional"
   - verdict: "ENFORCEABLE" | "PENDING_REVIEW" | "NON_ENFORCEABLE"
   - reason: Explanation of the decision
7. **Reasoning Trace** (if available, show nested details)
8. **Constitutional Articles** (if applicable, list articles)

### Post-Migration Display (TracePanel.jsx - Advisory Schema)
Add these fields:

1. **Advisory Status** (instead of enforcement_status)
   - recommendation: "clear" | "block" | "escalate" | "soft_redirect" | "conditional"
   - rationale: "ADVISABLE" | "PENDING_REVIEW" | "NON_ADVISABLE"
   - explanation: Full text explanation
   - **determinism_proof:** Display the proof string (NEW)
   - **confidence_adjusted:** Show true/false (NEW)

2. **Determinism Proof Section** (NEW)
   - Display the hash/proof value
   - Show "Proof verified" indicator
   - Link to `/trace/{trace_id}` for full audit trail

---

## PART 5: ERROR OVERLAY — WHAT TO SHOW

When FormatterGate blocks a response:

```javascript
return (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  }}>
    <div style={{...card styling...}}>
      {/* Icon */}
      <div style={{fontSize: '4rem', marginBottom: '20px', color: '#dc3545'}}>
        🚫
      </div>

      {/* Title */}
      <h1 style={{color: '#dc3545', fontSize: '2rem', fontWeight: '700'}}>
        Security Breach Detected
      </h1>

      {/* Error Message */}
      <div style={{background: '#fff5f5', padding: '20px', marginBottom: '30px'}}>
        <h3 style={{color: '#c53030'}}>UNFORMATTED RESPONSE BLOCKED</h3>
        <p style={{color: '#742a2a', fontFamily: 'monospace'}}>
          {errorMessage}
        </p>
      </div>

      {/* Security Info */}
      <div style={{background: '#f7fafc', padding: '20px', marginBottom: '30px'}}>
        <h4>🔒 Security Protocol Activated</h4>
        <ul>
          <li>All responses must pass FormatterGate validation</li>
          <li>metadata.Formatted: true flag is required</li>
          <li>This prevents tampering and injection attacks</li>
        </ul>
      </div>

      {/* Trace ID (for debugging) */}
      {responseData?.trace_id && (
        <div style={{background: '#e6fffa', padding: '15px', marginBottom: '20px'}}>
          <div>Trace ID (for debugging):</div>
          <div style={{fontFamily: 'monospace', wordBreak: 'break-all'}}>
            {responseData.trace_id}
          </div>
        </div>
      )}

      {/* Action Button */}
      <button onClick={() => window.location.reload()}>
        🔄 Retry Request
      </button>
    </div>
  </div>
);
```

---

## PART 6: WHAT YOU CANNOT DO

### ❌ Cannot Bypass Checkpoints
```javascript
// WRONG: Skipping checkpoint 3
if (!responseData) return;
// Missing checkpoints 2, 3, 4, 5!
return children;
```

### ❌ Cannot Use Loose Equality
```javascript
// WRONG: Using == instead of ===
if (responseData.metadata.Formatted == true) {  // ❌ Allows string "true"!
  return children;
}
```

### ❌ Cannot Skip FormatterGate for "Debugging"
```javascript
// WRONG: Conditional bypass
if (process.env.DEBUG === 'true') {
  return children;  // ❌ Direct render without validation!
}
```

### ❌ Cannot Render Unformatted Data
```javascript
// WRONG: Direct use without FormatterGate
export const QueryResult = ({ rawData }) => {
  return <div>{rawData.analysis}</div>;  // ❌ No FormatterGate!
};
```

### ❌ Cannot Modify Response After FormatterGate
```javascript
// WRONG: Adding data after validation
const validatedData = formatterGateValidate(response);
validatedData.custom_field = "something";  // ❌ Modifying after validation!
return <TracePanel data={validatedData} />;
```

---

## PART 7: BROWSER TESTING CHECKLIST

When testing FormatterGate locally:

### Test 1: Valid Response (Should Pass)
```bash
# In browser console, send query and check response
const response = await fetch('http://localhost:8000/query', {...})
const data = await response.json()

// Should print: true, true, true, true, true
console.log(!!data.metadata.Formatted)
console.log(data.metadata.Formatted === true)
console.log(!!data.trace_id)
console.log(!!data.enforcement_status)
```

### Test 2: Missing metadata.Formatted (Should Block)
```javascript
// Mock FormatterGate with tampered response
const tamperedResponse = {
  trace_id: "...",
  enforcement_status: {...},
  // metadata.Formatted intentionally missing
}
// FormatterGate should block and show error overlay
```

### Test 3: Formatted = "true" String (Should Block)
```javascript
// Mock FormatterGate with string instead of boolean
const tamperedResponse = {
  metadata: { Formatted: "true" },  // String, not boolean
  trace_id: "...",
  enforcement_status: {...}
}
// FormatterGate should block (strict equality check)
```

### Test 4: Missing enforcement_status (Should Block)
```javascript
const tamperedResponse = {
  metadata: { Formatted: true },
  trace_id: "...",
  // enforcement_status missing
}
// FormatterGate should block
```

---

## PART 8: DEBUGGING FORMATTERGATE

When FormatterGate blocks unexpectedly:

1. **Open Browser DevTools** (F12)
2. **Go to Network tab**
3. **Send a query**
4. **Find the API response request**
5. **Click Response → view JSON**
6. **Verify each checkpoint:**
   ```
   ✓ metadata object exists?
   ✓ metadata.Formatted === true (boolean)?
   ✓ trace_id exists and is string?
   ✓ enforcement_status (or advisory_status) exists?
   ```
7. **If any checkpoint fails:** Report the issue with the JSON to Raj (backend)
8. **If all pass but FormatterGate still blocks:** Check browser console for JavaScript errors

---

## PART 9: YOUR ACCOUNTABILITY

**You are accountable for:**
- ✅ FormatterGate has all 5 checkpoints (6 post-migration)
- ✅ Checkpoint 3 uses strict equality (===)
- ✅ Error message shows which checkpoint failed
- ✅ Trace ID is visible in error overlay
- ✅ No bypass paths exist
- ✅ TracePanel displays all required fields
- ✅ TracePanel updates for advisory transition

**If any checkpoint is missing or bypassed, the system fails.**

---

## END VINAYAK'S BRIEF
