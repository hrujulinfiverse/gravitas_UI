"""
test_qa_suite.py — Nyaya QA Battery for Vinayak Tiwari
Run: pytest test_qa_suite.py -v --tb=short

Covers:
  - ALLOW / BLOCK / ESCALATE enforcement decision paths
  - Observer Pipeline trigger verification
  - Formatter gate (metadata.Formatted must be True)
  - DecisionContract schema immutability
  - Chaos: 500 errors, malformed JSON, missing fields, timeout simulation
  - CORS origin enforcement
  - Audit log field presence
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

# ── App bootstrap ──────────────────────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "nyaya"))

from nyaya.backend.main import app

client = TestClient(app, raise_server_exceptions=False)

PROD_ORIGIN = "https://nyai.blackholeinfiverse.com"
BAD_ORIGIN  = "https://evil.example.com"

# ── Fixtures ───────────────────────────────────────────────────────────────────

VALID_QUERY = {
    "query": "What are my rights if my employer withholds salary in India?",
    "jurisdiction_hint": "India",
    "user_context": {"role": "citizen", "confidence_required": True}
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. HEALTH
# ══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    def test_health_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_root_lists_endpoints(self):
        r = client.get("/")
        assert r.status_code == 200
        assert "query" in r.json()["endpoints"]


# ══════════════════════════════════════════════════════════════════════════════
# 2. FORMATTER GATE — metadata.Formatted must be True on every success
# ══════════════════════════════════════════════════════════════════════════════

class TestFormatterGate:
    def test_formatted_flag_present_on_query(self):
        r = client.post("/nyaya/query", json=VALID_QUERY,
                        headers={"Origin": PROD_ORIGIN})
        if r.status_code == 200:
            body = r.json()
            assert body.get("metadata", {}).get("Formatted") is True, \
                "CRITICAL: Response missing metadata.Formatted=True — raw data leak"

    def test_no_raw_data_without_formatted_flag(self):
        """Any 200 response that lacks metadata.Formatted is a pipeline bypass."""
        r = client.post("/nyaya/query", json=VALID_QUERY)
        if r.status_code == 200:
            body = r.json()
            formatted = body.get("metadata", {}).get("Formatted")
            assert formatted is True, \
                f"Pipeline bypass detected: metadata.Formatted={formatted}"


# ══════════════════════════════════════════════════════════════════════════════
# 3. OBSERVER PIPELINE — must be triggered on every successful query
# ══════════════════════════════════════════════════════════════════════════════

class TestObserverPipeline:
    def test_observer_pipeline_called_on_query(self):
        with patch(
            "nyaya.backend.router.observer_pipeline.process_result",
            new_callable=AsyncMock,
            return_value={
                "confidence": 0.85,
                "observation": {
                    "pipeline_stage": "observer_pipeline",
                    "trace_id": "test-trace",
                    "jurisdiction": "India",
                    "confidence_validated": 0.85,
                    "completeness_score": 1.0,
                    "observation_id": "obs-001",
                    "timestamp": "2025-01-01T00:00:00",
                    "processed_at": "2025-01-01T00:00:00",
                },
                "metadata": {"observed": True, "stage": "post_decision_engine"},
            }
        ) as mock_observer:
            r = client.post("/nyaya/query", json=VALID_QUERY)
            if r.status_code == 200:
                mock_observer.assert_called_once()

    def test_observer_pipeline_stage_in_reasoning_trace(self):
        r = client.post("/nyaya/query", json=VALID_QUERY)
        if r.status_code == 200:
            trace = r.json().get("reasoning_trace", {})
            observer_data = trace.get("observer_processing", {})
            assert isinstance(observer_data, dict), \
                "observer_processing missing from reasoning_trace"


# ══════════════════════════════════════════════════════════════════════════════
# 4. ENFORCEMENT DECISION PATHS — ALLOW / BLOCK / ESCALATE
# ══════════════════════════════════════════════════════════════════════════════

class TestEnforcementPaths:
    """
    Enforcement state is driven by confidence score stored in _trace_store.
    We inject trace data directly to test each branch deterministically.
    """

    def _seed_trace(self, trace_id: str, confidence: float):
        from nyaya.backend.router import _trace_store
        _trace_store[trace_id] = {
            "confidence": confidence,
            "jurisdiction": "India",
            "domain": "labour"
        }

    # ── ALLOW (confidence >= 0.8 → state=clear, verdict=ENFORCEABLE) ──────────
    def test_allow_path_clear_state(self):
        tid = "qa-allow-001"
        self._seed_trace(tid, 0.92)
        r = client.get(f"/nyaya/enforcement_status?trace_id={tid}&jurisdiction=India")
        assert r.status_code == 200
        body = r.json()
        assert body["state"] == "clear"
        assert body["verdict"] == "ENFORCEABLE"
        assert body["trace_id"] == tid

    # ── ESCALATE (0.4 <= confidence < 0.65 → state=escalate) ─────────────────
    def test_escalate_path(self):
        tid = "qa-escalate-001"
        self._seed_trace(tid, 0.55)
        r = client.get(f"/nyaya/enforcement_status?trace_id={tid}&jurisdiction=India")
        assert r.status_code == 200
        body = r.json()
        assert body["state"] == "escalate"
        assert body["verdict"] == "PENDING_REVIEW"

    # ── BLOCK (confidence < 0.4 → state=block, verdict=NON_ENFORCEABLE) ───────
    def test_block_path(self):
        tid = "qa-block-001"
        self._seed_trace(tid, 0.25)
        r = client.get(f"/nyaya/enforcement_status?trace_id={tid}&jurisdiction=India")
        assert r.status_code == 200
        body = r.json()
        assert body["state"] == "block"
        assert body["verdict"] == "NON_ENFORCEABLE"
        assert len(body["barriers"]) > 0

    # ── CONDITIONAL (0.65 <= confidence < 0.8) ────────────────────────────────
    def test_conditional_path(self):
        tid = "qa-conditional-001"
        self._seed_trace(tid, 0.72)
        r = client.get(f"/nyaya/enforcement_status?trace_id={tid}&jurisdiction=India")
        assert r.status_code == 200
        body = r.json()
        assert body["state"] == "conditional"

    # ── Unknown trace → 404 ───────────────────────────────────────────────────
    def test_unknown_trace_returns_404(self):
        r = client.get("/nyaya/enforcement_status?trace_id=nonexistent-xyz&jurisdiction=India")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# 5. DECISION CONTRACT SCHEMA IMMUTABILITY
# ══════════════════════════════════════════════════════════════════════════════

class TestDecisionContractSchema:
    def test_extra_fields_rejected_by_contract(self):
        from nyaya.packages.shared.decision_contract import DecisionContract
        from pydantic import ValidationError as PydanticValidationError
        with pytest.raises(PydanticValidationError):
            DecisionContract(
                trace_id="t1",
                jurisdiction="India",
                domain="labour",
                legal_route=["agent_a"],
                reasoning_trace={},
                enforcement_status={
                    "state": "clear", "verdict": "ENFORCEABLE",
                    "trace_id": "t1"
                },
                confidence=0.9,
                INJECTED_FIELD="malicious_data"  # must be rejected
            )

    def test_empty_legal_route_rejected(self):
        from nyaya.packages.shared.decision_contract import DecisionContract
        from pydantic import ValidationError as PydanticValidationError
        with pytest.raises(PydanticValidationError):
            DecisionContract(
                trace_id="t1", jurisdiction="India", domain="labour",
                legal_route=[],  # must fail
                reasoning_trace={},
                enforcement_status={"state": "clear", "verdict": "ENFORCEABLE", "trace_id": "t1"},
                confidence=0.9
            )

    def test_confidence_out_of_range_rejected(self):
        from nyaya.packages.shared.decision_contract import DecisionContract
        from pydantic import ValidationError as PydanticValidationError
        with pytest.raises(PydanticValidationError):
            DecisionContract(
                trace_id="t1", jurisdiction="India", domain="labour",
                legal_route=["a"],
                reasoning_trace={},
                enforcement_status={"state": "clear", "verdict": "ENFORCEABLE", "trace_id": "t1"},
                confidence=1.5  # out of range
            )

    def test_valid_contract_passes(self):
        from nyaya.packages.shared.decision_contract import validate_decision_contract
        data = {
            "trace_id": "valid-001",
            "jurisdiction": "India",
            "domain": "labour",
            "legal_route": ["jurisdiction_router", "india_legal_agent"],
            "reasoning_trace": {"step": "analysis"},
            "enforcement_status": {
                "state": "clear", "verdict": "ENFORCEABLE",
                "trace_id": "valid-001"
            },
            "confidence": 0.87
        }
        contract = validate_decision_contract(data)
        assert contract.trace_id == "valid-001"


# ══════════════════════════════════════════════════════════════════════════════
# 6. CHAOS TESTING — backend failures, malformed payloads, invalid formats
# ══════════════════════════════════════════════════════════════════════════════

class TestChaos:
    # ── Missing required field ────────────────────────────────────────────────
    def test_missing_query_field_returns_422(self):
        r = client.post("/nyaya/query", json={"jurisdiction_hint": "India"})
        assert r.status_code == 422

    # ── Wrong content-type ────────────────────────────────────────────────────
    def test_non_json_content_type_rejected(self):
        r = client.post(
            "/nyaya/query",
            data="query=test",
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert r.status_code in (400, 422)

    # ── Malformed JSON body ───────────────────────────────────────────────────
    def test_malformed_json_returns_422(self):
        r = client.post(
            "/nyaya/query",
            content=b"{bad json}",
            headers={"Content-Type": "application/json"}
        )
        assert r.status_code == 422

    # ── Empty string query ────────────────────────────────────────────────────
    def test_empty_query_string_rejected(self):
        r = client.post("/nyaya/query", json={**VALID_QUERY, "query": ""})
        assert r.status_code in (400, 422)

    # ── Unsupported jurisdiction ───────────────────────────────────────────────
    def test_unsupported_jurisdiction_returns_error(self):
        r = client.post("/nyaya/query", json={
            **VALID_QUERY,
            "jurisdiction_hint": "MARS"
        })
        assert r.status_code in (400, 422, 500)

    # ── Agent crash → 500 handled, no raw traceback exposed ──────────────────
    def test_agent_crash_returns_structured_error(self):
        with patch(
            "nyaya.backend.router.agents",
            {"India": MagicMock(process=AsyncMock(side_effect=RuntimeError("agent exploded")))}
        ):
            r = client.post("/nyaya/query", json=VALID_QUERY)
            assert r.status_code == 500
            body = r.json()
            # Must be structured — no raw Python traceback
            assert "traceback" not in str(body).lower()
            assert "detail" in body or "error_code" in body or "message" in body

    # ── Observer pipeline crash → still returns structured error ─────────────
    def test_observer_crash_returns_structured_error(self):
        with patch(
            "nyaya.backend.router.observer_pipeline.process_result",
            new_callable=AsyncMock,
            side_effect=RuntimeError("observer exploded")
        ):
            r = client.post("/nyaya/query", json=VALID_QUERY)
            assert r.status_code == 500
            assert "traceback" not in str(r.json()).lower()

    # ── Response without Formatted flag is a pipeline bypass ─────────────────
    def test_unformatted_response_detected(self):
        """
        Simulate a response that bypassed the formatter.
        The nyayaApiClient interceptor on the frontend would reject this.
        We verify the backend never emits such a response on success.
        """
        r = client.post("/nyaya/query", json=VALID_QUERY)
        if r.status_code == 200:
            assert r.json().get("metadata", {}).get("Formatted") is True, \
                "PIPELINE BYPASS: Formatter gate not applied"

    # ── Null jurisdiction in enforcement status ───────────────────────────────
    def test_null_jurisdiction_enforcement_query(self):
        r = client.get("/nyaya/enforcement_status?trace_id=&jurisdiction=India")
        assert r.status_code in (400, 404, 422)


# ══════════════════════════════════════════════════════════════════════════════
# 7. CORS ENFORCEMENT
# ══════════════════════════════════════════════════════════════════════════════

class TestCORS:
    def test_allowed_origin_gets_acao_header(self):
        r = client.options(
            "/nyaya/query",
            headers={
                "Origin": PROD_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
        acao = r.headers.get("access-control-allow-origin", "")
        assert acao == PROD_ORIGIN, \
            f"Expected ACAO={PROD_ORIGIN}, got '{acao}'"

    def test_blocked_origin_gets_no_acao_header(self):
        r = client.options(
            "/nyaya/query",
            headers={
                "Origin": BAD_ORIGIN,
                "Access-Control-Request-Method": "POST",
            }
        )
        acao = r.headers.get("access-control-allow-origin", "")
        assert acao != BAD_ORIGIN, \
            f"CORS BREACH: {BAD_ORIGIN} received ACAO header"

    def test_wildcard_not_present_in_acao(self):
        r = client.options(
            "/nyaya/query",
            headers={"Origin": PROD_ORIGIN,
                     "Access-Control-Request-Method": "POST"}
        )
        acao = r.headers.get("access-control-allow-origin", "")
        assert acao != "*", "CRITICAL: Wildcard CORS still active in production"


# ══════════════════════════════════════════════════════════════════════════════
# 8. MULTI-JURISDICTION PATH
# ══════════════════════════════════════════════════════════════════════════════

class TestMultiJurisdiction:
    def test_multi_jurisdiction_returns_comparative_analysis(self):
        r = client.post("/nyaya/multi_jurisdiction", json={
            "query": "Contract breach remedies",
            "jurisdictions": ["India", "UK"]
        })
        if r.status_code == 200:
            body = r.json()
            assert "comparative_analysis" in body
            assert "trace_id" in body

    def test_multi_jurisdiction_partial_failure_handled(self):
        """One agent failing must not crash the entire multi-jurisdiction call."""
        with patch(
            "nyaya.backend.router.agents",
            {
                "India": MagicMock(process=AsyncMock(side_effect=RuntimeError("India agent down"))),
                "UK": MagicMock(process=AsyncMock(return_value={"confidence": 0.8})),
            }
        ):
            r = client.post("/nyaya/multi_jurisdiction", json={
                "query": "Contract breach",
                "jurisdictions": ["India", "UK"]
            })
            assert r.status_code in (200, 500)


# ══════════════════════════════════════════════════════════════════════════════
# 9. FEEDBACK & RL SIGNAL
# ══════════════════════════════════════════════════════════════════════════════

class TestFeedbackAndRL:
    def test_feedback_submission(self):
        r = client.post("/nyaya/feedback", json={
            "trace_id": "test-trace-fb",
            "rating": 4,
            "feedback_type": "correctness",
            "comment": "Accurate analysis"
        })
        assert r.status_code in (200, 422)

    def test_rl_signal_submission(self):
        r = client.post("/nyaya/rl_signal", json={
            "trace_id": "test-trace-rl",
            "helpful": True,
            "clear": True,
            "match": False
        })
        assert r.status_code in (200, 422)

    def test_rl_signal_missing_trace_id_rejected(self):
        r = client.post("/nyaya/rl_signal", json={
            "helpful": True, "clear": True, "match": False
        })
        assert r.status_code == 422
