# NYAYA TRANSFER NOTES

**System Status:** Advisory Architecture Pending | TANTRA Directive Required

---

## System Philosophy

The Nyaya system implements a **Zero-Trust Frontend Architecture**:

1. **All responses are guilty until proven formatted**
2. **No raw backend data reaches the UI**
3. **Every field has a canonical source of truth**
4. **Determinism is proven through identical inputs producing identical outputs**

---

## Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| `_trace_store` is in-memory | Backend restart loses all trace history | Persist to Redis/database (TODO) |
| `RESTRICT` enum not canonical | 422 error on certain states | Use only canonical enums |
| `ALLOW_INFORMATIONAL` not canonical | 422 error on certain verdicts | Use only canonical verdicts |
| CORS fixed to production domain | Local dev requires proxy | Use `proxy` in vite.config.ts |
| No TypeScript strictNullChecks | Some fields may be undefined | Always use optional chaining |

---

## Hidden Pitfalls (What NOT to Change)

### 1. NEVER Remove `.strict()` from Zod Schema
**File:** `decision_contract.ts:40`
```typescript
}).strict()  // CRITICAL: Reject any unknown fields
```
**Reason:** Removing this allows schema injection attacks.

### 2. NEVER Remove `extra='forbid'` from Pydantic Model
**File:** `decision_contract.py:66`
```python
class Config:
    extra = 'forbid'  # No extra fields allowed
```
**Reason:** Allows malicious field injection.

### 3. NEVER Change `=== true` to `== true` in FormatterGate
**File:** `FormatterGate.jsx:25`
```javascript
if (responseData.metadata.Formatted !== true) {
```
**Reason:** Loose comparison would allow `1`, `"true"`, etc. to pass.

### 4. NEVER Bypass ResponseBuilder in router.py
**File:** `router.py:146-158`
```python
return ResponseBuilder.build_nyaya_response(...)
```
**Reason:** Direct returns bypass schema validation and Formatted flag.

### 5. NEVER Add New Fields Without Schema Update
**All schemas:** Both TypeScript and Python must match exactly.
**Reason:** `.strict()` and `extra='forbid'` will reject extra fields.

---

## TANTRA Migration Checklist

### Authority → Advisory Term Mapping

| Current (Authority) | Target (Advisory) | Status |
|---------------------|-------------------|--------|
| `enforcement_status` | `recommendation_status` | PENDING |
| `state` | `state` (unchanged) | PENDING |
| `verdict` | `rationale` | PENDING |
| `ENFORCEABLE` | `RECOMMENDED` | PENDING |
| `PENDING_REVIEW` | `REVIEW_NEEDED` | PENDING |
| `NON_ENFORCEABLE` | `NOT_RECOMMENDED` | PENDING |

### Migration Steps
1. [ ] Update `decision_contract.ts` enums
2. [ ] Update `decision_contract.py` enums
3. [ ] Update `FormatterGate.jsx` checkpoint messages
4. [ ] Update `TracePanel.jsx` display labels
5. [ ] Run `npm run typecheck && python -m py_compile`
6. [ ] Update all API consumers

---

## Critical Paths

| Path | Line | Purpose |
|------|------|---------|
| `FormatterGate.jsx:8-46` | All validation logic |
| `router.py:146-158` | ResponseBuilder only output |
| `decision_contract.ts:32-40` | Canonical schema |
| `decision_contract.py:35-51` | Pydantic model |

---

## Verification Commands

```bash
# TypeScript validation
npx tsc --noEmit

# Python validation
python -c "from decision_contract import DecisionContract; print('OK')"

# Schema match check
diff <(cat decision_contract.ts | grep -A5 "EnforcementState") \
     <(cat decision_contract.py | grep -A5 "EnforcementState")

# Full test suite
npm run test:ci
```

---

## Emergency Rollback

If system fails after changes:

```bash
git tag rollback-point
git reset --hard HEAD~1
npm run build
uvicorn main:app --reload
```

---

**Handover Status:** COMPLETE
**Next Action:** TANTRA Schema Migration
**Owner:** Raj/Vedant must execute migration script