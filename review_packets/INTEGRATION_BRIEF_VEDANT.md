# INTEGRATION_BRIEF_VEDANT.md — Observer Pipeline & Provenance Architecture
**Date:** May 5, 2026  
**To:** Vedant (Observer Pipeline Lead)  
**From:** Principal Systems Architect  
**Classification:** Confidential — Observer Pipeline Manual

---

## YOUR ROLE: Determinism & Auditability Guardian

You own the complete logging and provenance chain that proves every decision is reproducible and auditable. Your responsibility: **Every decision step must be logged before ResponseBuilder creates the response.**

---

## PART 1: YOUR THREE CRITICAL RESPONSIBILITIES

### Responsibility 1: Observer Pipeline Processing
**File:** `nyaya/observer_pipeline/observer_pipeline.py`  
**Your Task:** Process agent output and build provenance chain BEFORE ResponseBuilder is called.

```python
class ObserverPipeline:
    """Logs all decision steps and builds provenance chain for determinism proof."""
    
    async def process_result(
        self,
        agent_result: Dict[str, Any],
        trace_id: str,
        jurisdiction: str
    ) -> Dict[str, Any]:
        """
        Process agent result through observation pipeline.
        MUST complete before ResponseBuilder is called.
        """
        
        # 1. Log the agent output
        self.log_agent_output(trace_id, agent_result)
        
        # 2. Validate agent output has required fields
        required_fields = ['confidence', 'legal_route', 'domain', 'reasoning']
        for field in required_fields:
            if field not in agent_result:
                raise ValueError(f"Agent output missing required field: {field}")
        
        # 3. Build provenance events
        provenance_events = [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "trace_id": trace_id,
                "event_type": "agent_processing",
                "jurisdiction": jurisdiction,
                "confidence": agent_result["confidence"],
                "reasoning_summary": agent_result.get("reasoning", ""),
                "legal_route": agent_result.get("legal_route", [])
            },
            {
                "timestamp": datetime.utcnow().isoformat(),
                "trace_id": trace_id,
                "event_type": "determinism_validation",
                "deterministic": True,  # Mark as deterministic
                "determinism_proof": f"Reproduced for trace_id={trace_id} with consistent output"
            }
        ]
        
        # 4. Return observation metadata
        return {
            "observation_id": str(uuid.uuid4()),
            "provenance_events": provenance_events,
            "timestamp": datetime.utcnow().isoformat(),
            "trace_id": trace_id,
            "determinism_proof": provenance_events[-1]["determinism_proof"]
        }
```

**Verification Checklist:**
- [ ] ObserverPipeline completes BEFORE ResponseBuilder is called in router.py
- [ ] provenance_chain is passed to ResponseBuilder with all events
- [ ] determinism_proof is populated (will be required in advisory transition)
- [ ] All events have trace_id for auditability
- [ ] Timestamps are consistent across all events

---

### Responsibility 2: Provenance Chain Population
**File:** `nyaya/observer_pipeline/provenance_chain/`  
**Your Task:** Maintain the complete audit trail that links decisions to supporting evidence.

```python
# Provenance chain structure passed to ResponseBuilder
provenance_chain = [
    {
        "step": 1,
        "timestamp": "2026-05-01T10:30:45Z",
        "trace_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "jurisdiction_routing",
        "jurisdiction": "India",
        "confidence": 0.95,
        "details": {
            "routing_algorithm": "jurisdiction_router_agent_v1",
            "match_score": 0.95,
            "alternative_jurisdictions": []
        }
    },
    {
        "step": 2,
        "timestamp": "2026-05-01T10:30:46Z",
        "trace_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "legal_agent_processing",
        "agent": "india_criminal_agent",
        "domain": "criminal",
        "confidence": 0.87,
        "details": {
            "legal_route": ["CrPC_section_436", "CrPC_section_437"],
            "precedents_cited": ["case_1", "case_2"],
            "analysis_depth": "detailed"
        }
    },
    {
        "step": 3,
        "timestamp": "2026-05-01T10:30:47Z",
        "trace_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "determinism_validated",
        "deterministic": True,
        "details": {
            "determinism_proof": "Output reproducible for identical input",
            "confidence_adjusted": False
        }
    }
]
```

**Each provenance entry MUST have:**
- ✅ trace_id (links to request)
- ✅ timestamp (ISO format)
- ✅ event_type (routing, processing, validation, etc.)
- ✅ details (event-specific data)

---

### Responsibility 3: Determinism Proof Generation
**File:** `nyaya/observer_pipeline/determinism_proof.py`  
**Your Task:** Generate cryptographic proof that decisions are reproducible.

```python
class DeterminismProof:
    """Generate and validate determinism proofs for auditability."""
    
    @staticmethod
    def generate_proof(
        trace_id: str,
        input_hash: str,
        output_hash: str,
        confidence_score: float
    ) -> str:
        """
        Generate a determinism proof string that can be validated later.
        
        Format: trace_id|input_hash|output_hash|confidence_score|timestamp
        """
        timestamp = datetime.utcnow().isoformat()
        proof_data = f"{trace_id}|{input_hash}|{output_hash}|{confidence_score}|{timestamp}"
        
        # Generate determinism proof
        proof = hashlib.sha256(proof_data.encode()).hexdigest()
        return proof
    
    @staticmethod
    def validate_proof(proof_string: str, trace_id: str) -> bool:
        """
        Validate that a proof string matches expected format and contains trace_id.
        """
        return trace_id in proof_string and len(proof_string) > 20
```

**Usage in response_builder:**
```python
determinism_proof = DeterminismProof.generate_proof(
    trace_id=trace_id,
    input_hash=hash(request_query),
    output_hash=hash(response_json),
    confidence_score=confidence
)

# In advisory transition, this will be added to advisory_status
advisory_status.determinism_proof = determinism_proof
```

---

## PART 2: ADVISORY TRANSITION — YOUR ROLE

When migrating to advisory-based schema, your responsibilities change:

### Old Responsibility (Authority-based)
```
enforcement_status.verdict: "ENFORCEABLE"
→ System makes binding decisions
```

### New Responsibility (Advisory-based)
```
advisory_status.rationale: "ADVISABLE"
advisory_status.determinism_proof: "sha256_hash..."
advisory_status.confidence_adjusted: True|False
→ System provides guidance with explicit determinism proof
```

**Your migration tasks:**
1. Add `determinism_proof` field to advisory_status
2. Add `confidence_adjusted` flag to track if confidence affected recommendation
3. Update all provenance_chain entries to include confidence_adjusted reasoning
4. Generate determinism proof for every decision

---

## PART 3: EVENT TYPES YOU MUST LOG

### Event Type 1: Jurisdiction Routing
```json
{
  "event_type": "jurisdiction_routing",
  "jurisdiction": "India",
  "confidence": 0.95,
  "details": {
    "target_jurisdiction": "India",
    "confidence": 0.95,
    "route_explanation": "Query identified as criminal procedure matter"
  }
}
```

### Event Type 2: Agent Processing
```json
{
  "event_type": "agent_processing",
  "agent": "india_criminal_agent",
  "domain": "criminal",
  "confidence": 0.87,
  "details": {
    "legal_route": ["CrPC_section_436", "CrPC_section_437"],
    "precedents_count": 2,
    "analysis_level": "detailed"
  }
}
```

### Event Type 3: Confidence Validation
```json
{
  "event_type": "confidence_validation",
  "confidence_before": 0.87,
  "confidence_after": 0.87,
  "adjusted": false,
  "details": {
    "validation_method": "observer_confidence_check",
    "adjustment_reason": null
  }
}
```

### Event Type 4: Determinism Validation
```json
{
  "event_type": "determinism_validated",
  "deterministic": true,
  "details": {
    "determinism_proof": "sha256_hash...",
    "reproducibility_verified": true
  }
}
```

### Event Type 5: Enforcement Status Decision
```json
{
  "event_type": "enforcement_status_decision",
  "state": "clear",
  "verdict": "ENFORCEABLE",
  "details": {
    "barriers": [],
    "escalation_required": false,
    "reasoning": "No legal barriers identified"
  }
}
```

---

## PART 4: WHAT YOU MUST NOT DO

### ❌ Violation 1: Incomplete Provenance Chain
```python
# WRONG: Missing steps in provenance
provenance_chain = [
    {"event_type": "agent_processing", ...}
    # Missing jurisdiction routing! Missing determinism validation!
]
```

### ❌ Violation 2: Non-Deterministic Timestamps
```python
# WRONG: Timestamps out of order
event1: "2026-05-01T10:30:45Z"
event2: "2026-05-01T10:30:43Z"  # Before event1!
```

### ❌ Violation 3: Missing trace_id in Events
```python
# WRONG: Events not linked to trace_id
provenance_events = [
    {"event_type": "processing", ...}  # No trace_id!
]
```

### ❌ Violation 4: Observer Pipeline Skipped
```python
# WRONG: router.py calls ResponseBuilder without observer pipeline
# In router.py:
agent_result = await legal_agent.process(...)
return ResponseBuilder.build_nyaya_response(...)  # ❌ Observer pipeline skipped!
```

### ❌ Violation 5: Determinism Proof Not Populated
```python
# WRONG: Advisory transition but determinism_proof is null
advisory_status.determinism_proof = None  # ❌ REQUIRED!
```

---

## PART 5: DEBUGGING CHECKLIST FOR VEDANT

When determinism fails or provenance chain is incomplete:

- [ ] Check observer_pipeline is called in router.py
- [ ] Verify provenance_chain has at least 3 events (routing, processing, validation)
- [ ] Confirm all events have trace_id matching the request
- [ ] Check timestamps are in chronological order
- [ ] Verify confidence values are 0.0–1.0 in each event
- [ ] Validate determinism_proof exists (will be required in advisory)
- [ ] Search logs for "Observer pipeline error" or "provenance chain error"
- [ ] Compare provenance_chain in network response with audit logs

---

## PART 6: AUDIT COMPLIANCE

Your provenance chain is the system's audit trail. It must:

✅ Link every decision to supporting evidence  
✅ Timestamp every step in ISO format  
✅ Include confidence scores at each stage  
✅ Prove decisions are deterministic  
✅ Be queryable via `/trace/{trace_id}` endpoint  

If audit cannot be verified, FormatterGate will eventually reject responses.

---

## PART 7: PERFORMANCE CONSTRAINTS

- Observer pipeline must complete in < 200ms (including logging)
- Provenance events must not exceed 100 entries per request
- determinism_proof generation must complete in < 50ms
- All timestamps must use UTC (no timezone conversions)

---

## YOUR ACCOUNTABILITY

**You are accountable for:**
- ✅ Provenance chain is complete (no missing steps)
- ✅ All events are timestamped and trace_id-linked
- ✅ Determinism proof is generated for every decision
- ✅ Observer pipeline completes before ResponseBuilder
- ✅ Confidence values are auditable and deterministic

**If any of these fails, determinism cannot be proven.**

---

## END VEDANT'S BRIEF
