# FAQ: Nyaya AI Backend Integration

25 actionable questions for zero-context developer onboarding.

---

## 1. How to Run

**Q: What is the backend entry command?**
```bash
cd nyaya/backend
uvicorn main:app --reload --port 8000
```

**Q: How to run the frontend?**
```bash
cd nyaya-ui-kit
npm install
npm run dev
```

**Q: How to verify the system is running?**
1. Open browser to `http://localhost:5173`
2. Query: "What are bail procedures in India?"
3. Check network tab for `/query` response with `metadata.Formatted: true`

---

## 2. How to Debug

**Q: Where is the trace ID displayed?**
- `FormatterGate.jsx:170` - Shows in error state
- `TracePanel.jsx:69` - Shows in panel header
- `decisionContract.trace_id` - Always present in valid response

**Q: Which checkpoint failed in FormatterGate?**
Check console for exact message:
- Checkpoint 1: "No response data received"
- Checkpoint 2: "Missing metadata object"
- Checkpoint 3: "metadata.Formatted flag is not true"
- Checkpoint 4: "Missing trace_id"
- Checkpoint 5: "Missing enforcement_status"

**Q: How to view observer pipeline logs?**
Observer logs appear in `reasoning_trace.observer_steps` and display in TracePanel under "Observer Pipeline Steps".

---

## 3. Common Mistakes

**Q: Why is the response blocked?**
Most common: `metadata.Formatted !== true`. Backend must set this flag via ResponseBuilder.

**Q: Why does validation fail after schema update?**
- Python and TypeScript schemas differ
- `.strict()` mode rejects extra fields
- Fix: Update both `decision_contract.py` and `decision_contract.ts`

**Q: Why is trace_id missing?**
- Backend middleware not injecting UUID
- Fix: Check `api/main.py` for `add_trace_id_middleware`

**Q: Why does /query return 422?**
Invalid enum values:
- `state`: must be `clear|block|escalate|soft_redirect|conditional`
- `verdict`: must be `ENFORCEABLE|PENDING_REVIEW|NON_ENFORCEABLE`

---

## 4. How to Update Schema

**Q: How to add a new enforcement state?**
1. Update `decision_contract.ts:5-11`
2. Update `decision_contract.py:5-10`
3. Update `FormatterGate.jsx` checkpoint 5 if needed
4. Run `npm run typecheck`

**Q: How to rename enforcement to recommendation (TANTRA)?**
1. Rename `EnforcementStateSchema` → `RecommendationStateSchema`
2. Rename `EnforcementVerdictSchema` → `RationaleSchema`
3. Update all references in backend and frontend
4. Update FormatterGate validation checkpoints

**Q: How to add a field to the schema?**
1. Add to `DecisionContractSchema`
2. Add to `DecisionContract` interface
3. Update both TypeScript and Python files
4. DO NOT remove `.strict()` or `extra='forbid'`

---

## 5. How to Connect API to UI

**Q: Where is the API client configured?**
`nyaya-api.js` hardcodes `https://nyaya-ai-0f02.onrender.com`. Environment variable `VITE_API_URL` in `apiConfig.ts` is not used by this file.

**Q: How to change the backend URL?**
Update line in `nyaya-api.js`:
```javascript
const BASE_URL = "https://your-new-backend.com"
```

**Q: How to add authentication headers?**
In `nyaya-api.js`, update the Axios interceptor:
```javascript
apiClient.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${getToken()}`
  return config
})
```

---

## 6. How to Test

**Q: How to run the test suite?**
```bash
cd nyaya
python -m pytest test_pipeline.py -v
```

**Q: How to test the FormatterGate?**
```javascript
// Test unformatted response
<FormatterGate responseData={{}} children={<div/>} />
// Result: Error overlay renders

// Test formatted response
<FormatterGate responseData={{metadata:{Formatted:true}, trace_id:"abc", enforcement_status:{state:"clear"}}} children={<div/>} />
// Result: Children render
```

**Q: How to verify JSON schema compliance?**
```bash
npm run validate:contract
# Runs validateDecisionContract on sample payloads
```

**Q: How to test blocked state?**
Query: "How to hide assets in international accounts?"
Expected: `enforcement_status.state = "block"`, UI shows blocking overlay.

---

## 7. System Architecture

**Q: What is the data flow order?**
1. `FormatterGate.jsx` - 5 checkpoints
2. `router.py` - ResponseBuilder
3. `decision_contract.ts` - Validation
4. `TracePanel.jsx` - Display

**Q: Where does validation happen?**
Primary: `FormatterGate.jsx:8-46`
Secondary: `decision_contract.ts:68-73`
Backend: `decision_contract.py:69-74`

**Q: What triggers the "Blocked" state?**
`enforcement_status.state === "block"` AND `verdict === "NON_ENFORCEABLE"`

---

## 8. Files to Never Modify

**Q: Which files are critical to system integrity?**
- `decision_contract.ts` - Schema strict mode
- `decision_contract.py` - Pydantic validation
- `FormatterGate.jsx` - Checkpoint logic (lines 8-46)
- `router.py` - ResponseBuilder (lines 146-158)

**Q: What should never be removed?**
- `.strict()` in Zod schema
- `extra='forbid'` in Pydantic model
- `metadata.Formatted !== true` strict check

---

## 9. Environment Variables

**Q: What environment variables are required?**
```bash
VITE_API_URL=https://nyaya-ai-0f02.onrender.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

**Q: How to check current environment?**
```bash
cd nyaya-ui-kit
npm run env
```

---

## 10. Deployment

**Q: How to deploy the frontend?**
```bash
npm run build
# Output in /dist - deploy to Vercel or Netlify
```

**Q: How to deploy the backend?**
```bash
docker build -t nyaya-backend .
docker push registry.nyaya.ai/backend
kubectl apply -f k8s/backend.yaml
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend dev server |
| `uvicorn main:app --reload` | Start backend |
| `npm run typecheck` | Validate TypeScript |
| `python -m pytest` | Run tests |
| `npm run build` | Build for production |