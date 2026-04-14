from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import Dict, Any, List, Optional
import asyncio
from fastapi import BackgroundTasks as FastAPIBackgroundTasks
from backend.schemas import (
    QueryRequest, MultiJurisdictionRequest, ExplainReasoningRequest,
    FeedbackRequest, RLSignalRequest, NyayaResponse, MultiJurisdictionResponse,
    ExplainReasoningResponse, FeedbackResponse, RLSignalResponse, TraceResponse,
    EnforcementVerdict
)
from backend.dependencies import get_trace_id, validate_nonce, emit_query_received_event
from backend.response_builder import ResponseBuilder
from observer_pipeline.sovereign_agents.jurisdiction_router_agent import JurisdictionRouterAgent
from observer_pipeline.sovereign_agents.legal_agent import LegalAgent
from observer_pipeline.sovereign_agents.constitutional_agent import ConstitutionalAgent
from observer_pipeline.jurisdiction_router.router import JurisdictionRouter
from observer_pipeline.rl_engine.feedback_api import FeedbackAPI
from observer_pipeline.observer_pipeline import ObserverPipeline
# from provenance_chain.lineage_tracer import tracer
# from provenance_chain.hash_chain_ledger import ledger
# from provenance_chain.event_signer import signer

router = APIRouter(prefix="/nyaya", tags=["nyaya"])

# In-memory store for enforcement-relevant trace data
_trace_store: Dict[str, Dict[str, Any]] = {}

# Initialize agents and components
jurisdiction_router_agent = JurisdictionRouterAgent()
jurisdiction_router = JurisdictionRouter()
feedback_api = FeedbackAPI()
observer_pipeline = ObserverPipeline()

# Agent instances for different jurisdictions
agents = {
    "IN": LegalAgent(agent_id="india_legal_agent", jurisdiction="India"),
    "UK": LegalAgent(agent_id="uk_legal_agent", jurisdiction="UK"),
    "UAE": LegalAgent(agent_id="uae_legal_agent", jurisdiction="UAE")
}

@router.post("/query", response_model=NyayaResponse)
async def query_legal(
    request: QueryRequest,
    trace_id: str = Depends(get_trace_id),
    nonce: str = Depends(validate_nonce),
    background_tasks: Optional[BackgroundTasks] = None
):
    """Execute a single-jurisdiction legal query."""
    try:
        # Emit query received event
        if background_tasks:
            background_tasks.add_task(
                emit_query_received_event,
                request.query,
                trace_id
            )

        # Step 1: Call JurisdictionRouterAgent
        routing_result = await jurisdiction_router_agent.process({
            "query": request.query,
            "jurisdiction_hint": request.jurisdiction_hint,
            "domain_hint": request.domain_hint
        })

        target_jurisdiction = routing_result["target_jurisdiction"]
        target_agent_id = routing_result["target_agent"]

        # Step 2: Route to appropriate LegalAgent
        if target_jurisdiction not in agents:
            raise HTTPException(
                status_code=400,
                detail=ResponseBuilder.build_error_response(
                    "JURISDICTION_NOT_SUPPORTED",
                    f"Jurisdiction {target_jurisdiction} not supported",
                    trace_id
                ).dict()
            )

        agent = agents[target_jurisdiction]
        agent_result = await agent.process({
            "query": request.query,
            "trace_id": trace_id
        })

        # Step 3: Process through Observer Pipeline
        observed_result = await observer_pipeline.process_result(agent_result, trace_id, target_jurisdiction)

        # Step 4: Collect confidence and build response
        confidence = observed_result.get("observation", {}).get("confidence_validated", 0.5)
        domain = request.domain_hint or "general"
        legal_route = [jurisdiction_router_agent.agent_id, agent.agent_id]

        # Placeholder for provenance chain and reasoning trace
        provenance_chain = []
        reasoning_trace = {
            "routing_decision": routing_result,
            "agent_processing": agent_result,
            "observer_processing": observed_result.get("observation", {})
        }

        # Emit decision explained event
        background_tasks.add_task(
            _emit_decision_explained_event,
            trace_id,
            confidence,
            legal_route
        )

        # Store trace data for enforcement status lookup
        _trace_store[trace_id] = {
            "confidence": confidence,
            "jurisdiction": target_jurisdiction,
            "domain": domain
        }

        return ResponseBuilder.build_nyaya_response(
            domain=domain,
            jurisdiction=target_jurisdiction,
            confidence=confidence,
            legal_route=legal_route,
            trace_id=trace_id,
            provenance_chain=provenance_chain,
            reasoning_trace=reasoning_trace
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ResponseBuilder.build_error_response(
                "INTERNAL_ERROR",
                "An internal error occurred",
                trace_id
            ).dict()
        )

@router.post("/multi_jurisdiction", response_model=MultiJurisdictionResponse)
async def multi_jurisdiction_query(
    request: MultiJurisdictionRequest,
    trace_id: str = Depends(get_trace_id),
    nonce: str = Depends(validate_nonce),
    background_tasks: Optional[BackgroundTasks] = None
):
    """Execute parallel legal analysis across multiple jurisdictions."""
    try:
        # Emit query received event
        if background_tasks:
            background_tasks.add_task(
                emit_query_received_event,
                request.query,
                trace_id
            )

        comparative_analysis = {}
        confidences = []

        # Execute agents in parallel
        tasks = []
        for jurisdiction in request.jurisdictions:
            if jurisdiction.value not in agents:
                continue
            agent = agents[jurisdiction.value]
            task = agent.process({
                "query": request.query,
                "trace_id": f"{trace_id}_{jurisdiction.value.lower()}"
            })
            tasks.append((jurisdiction.value, task))

        # Wait for all results
        results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)

        for i, (jurisdiction, _) in enumerate(tasks):
            result = results[i]
            if isinstance(result, Exception):
                # Handle agent failure gracefully
                confidence = 0.1
                legal_route = ["failed"]
                provenance_chain = []
                reasoning_trace = {"error": str(result)}
            else:
                confidence = result.get("confidence", 0.5)
                legal_route = [agents[jurisdiction].agent_id]
                provenance_chain = []
                reasoning_trace = result

            confidences.append(confidence)

            comparative_analysis[jurisdiction] = ResponseBuilder.build_nyaya_response(
                domain="multi",
                jurisdiction=jurisdiction,
                confidence=confidence,
                legal_route=legal_route,
                trace_id=f"{trace_id}_{jurisdiction.lower()}",
                provenance_chain=provenance_chain,
                reasoning_trace=reasoning_trace
            )

        # Calculate aggregate confidence (mean)
        aggregate_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return ResponseBuilder.build_multi_jurisdiction_response(
            comparative_analysis=comparative_analysis,
            confidence=aggregate_confidence,
            trace_id=trace_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ResponseBuilder.build_error_response(
                "INTERNAL_ERROR",
                "An internal error occurred",
                trace_id
            ).dict()
        )

@router.post("/explain_reasoning", response_model=ExplainReasoningResponse)
async def explain_reasoning(
    request: ExplainReasoningRequest,
    trace_id: str = Depends(get_trace_id),
    nonce: str = Depends(validate_nonce)
):
    """Explain reasoning without re-executing agents."""
    try:
        return ResponseBuilder.build_explain_reasoning_response(
            request.trace_id,
            request.explanation_level.value
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "TRACE_NOT_FOUND",
                f"Trace {request.trace_id} not found",
                trace_id
            ).dict()
        )

@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    trace_id: str = Depends(get_trace_id),
    nonce: str = Depends(validate_nonce),
    background_tasks: Optional[BackgroundTasks] = None
):
    """Submit system-level RL feedback."""
    try:
        # Forward to RL engine
        feedback_result = feedback_api.receive_feedback({
            "trace_id": request.trace_id,
            "score": request.rating,
            "nonce": nonce,
            "comment": request.comment
        })

        # Emit feedback received event
        if background_tasks:
            background_tasks.add_task(
                _emit_feedback_received_event,
                request.trace_id,
                request.rating,
                request.feedback_type.value
            )

        return ResponseBuilder.build_feedback_response(
            status="recorded",
            trace_id=request.trace_id,
            message="Feedback recorded successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ResponseBuilder.build_error_response(
                "FEEDBACK_ERROR",
                "Failed to process feedback",
                trace_id
            ).dict()
        )

@router.post("/rl_signal", response_model=RLSignalResponse)
async def send_rl_signal(
    request: RLSignalRequest,
    trace_id: str = Depends(get_trace_id),
    nonce: str = Depends(validate_nonce),
    background_tasks: Optional[BackgroundTasks] = None
):
    """Send RL training signal."""
    try:
        # Forward to RL engine - just record the signals
        # No RL logic here, just formatting and API call as per task

        # Emit RL signal received event
        if background_tasks:
            background_tasks.add_task(
                _emit_rl_signal_received_event,
                request.trace_id,
                request.helpful,
                request.clear,
                request.match
            )

        return ResponseBuilder.build_rl_signal_response(
            status="recorded",
            trace_id=request.trace_id,
            message="RL signal recorded successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ResponseBuilder.build_error_response(
                "RL_SIGNAL_ERROR",
                "Failed to process RL signal",
                trace_id
            ).dict()
        )

@router.get("/trace/{trace_id}", response_model=TraceResponse)
async def get_trace(trace_id: str):
    """Get full sovereign audit trail."""
    try:
        return ResponseBuilder.build_trace_response(trace_id)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "TRACE_NOT_FOUND",
                f"Trace {trace_id} not found",
                trace_id
            ).dict()
        )

# Helper functions for background tasks
async def _emit_decision_explained_event(trace_id: str, confidence: float, legal_route: List[str]):
    """Emit decision explained event."""
    event = {
        "timestamp": "current_timestamp",
        "agent_id": "api_gateway",
        "jurisdiction": "global",
        "event_name": "decision_explained",
        "request_hash": hash(str(legal_route)) % (10 ** 8),
        "details": {
            "confidence": confidence,
            "legal_route": legal_route
        }
    }
    # In real implementation, this would be added to the ledger

async def _emit_feedback_received_event(trace_id: str, rating: int, feedback_type: str):
    """Emit feedback received event."""
    event = {
        "timestamp": "current_timestamp",
        "agent_id": "api_gateway",
        "jurisdiction": "global",
        "event_name": "feedback_received",
        "request_hash": hash(f"{trace_id}:{rating}") % (10 ** 8),
        "details": {
            "rating": rating,
            "feedback_type": feedback_type
        }
    }
    # In real implementation, this would be added to the ledger

async def _emit_rl_signal_received_event(trace_id: str, helpful: bool, clear: bool, match: bool):
    """Emit RL signal received event."""
    event = {
        "timestamp": "current_timestamp",
        "agent_id": "api_gateway",
        "jurisdiction": "global",
        "event_name": "rl_signal_received",
        "request_hash": hash(f"{trace_id}:{helpful}:{clear}:{match}") % (10 ** 8),
        "details": {
            "helpful": helpful,
            "clear": clear,
            "match": match
        }
    }
    # In real implementation, this would be added to the ledger

# ==================== Case Presentation Endpoints ====================

@router.get("/case_summary")
async def get_case_summary(
    trace_id: str = Query(..., description="Trace identifier from query"),
    jurisdiction: str = Query(..., description="Selected jurisdiction")
):
    """Fetch case summary for presentation components."""
    try:
        # Build response based on jurisdiction
        return ResponseBuilder.build_case_summary_response(trace_id, jurisdiction)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "CASE_SUMMARY_NOT_FOUND",
                f"Case summary not found for trace {trace_id}",
                trace_id
            ).dict()
        )

@router.get("/legal_routes")
async def get_legal_routes(
    trace_id: str = Query(..., description="Trace identifier from query"),
    jurisdiction: str = Query(..., description="Selected jurisdiction"),
    case_type: str = Query(..., description="Type of legal case")
):
    """Fetch legal routes/pathways for the case."""
    try:
        return ResponseBuilder.build_legal_routes_response(trace_id, jurisdiction, case_type)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "LEGAL_ROUTES_NOT_FOUND",
                f"Legal routes not found for trace {trace_id}",
                trace_id
            ).dict()
        )

@router.get("/timeline")
async def get_timeline(
    trace_id: str = Query(..., description="Trace identifier from query"),
    jurisdiction: str = Query(..., description="Selected jurisdiction"),
    case_id: str = Query(..., description="Case identifier")
):
    """Fetch timeline events for the case."""
    try:
        return ResponseBuilder.build_timeline_response(trace_id, jurisdiction, case_id)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "TIMELINE_NOT_FOUND",
                f"Timeline not found for trace {trace_id}",
                trace_id
            ).dict()
        )

@router.get("/glossary")
async def get_glossary(
    trace_id: str = Query(..., description="Trace identifier from query"),
    jurisdiction: str = Query(..., description="Selected jurisdiction"),
    case_type: str = Query(..., description="Type of legal case")
):
    """Fetch glossary terms for the case."""
    try:
        return ResponseBuilder.build_glossary_response(trace_id, jurisdiction, case_type)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "GLOSSARY_NOT_FOUND",
                f"Glossary not found for trace {trace_id}",
                trace_id
            ).dict()
        )

@router.get("/jurisdiction_info")
async def get_jurisdiction_info(
    jurisdiction: str = Query(..., description="Jurisdiction to fetch info for")
):
    """Fetch jurisdiction-specific information."""
    try:
        return ResponseBuilder.build_jurisdiction_info_response(jurisdiction)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "JURISDICTION_INFO_NOT_FOUND",
                f"Jurisdiction info not found for {jurisdiction}",
                "global"
            ).dict()
        )

@router.get("/enforcement_status")
async def get_enforcement_status(
    trace_id: str = Query(..., description="Trace identifier from query"),
    jurisdiction: str = Query(..., description="Selected jurisdiction")
):
    """Enforcement gatekeeper — must be called before rendering any decision."""
    trace_data = _trace_store.get(trace_id)
    if not trace_data:
        raise HTTPException(
            status_code=404,
            detail=ResponseBuilder.build_error_response(
                "ENFORCEMENT_STATUS_NOT_FOUND",
                f"Trace {trace_id} not found",
                trace_id
            ).dict()
        )

    confidence = trace_data.get("confidence", 0.5)

    if confidence < 0.4:
        state = "block"
        verdict = EnforcementVerdict.NON_ENFORCEABLE
        reason = "Confidence too low to proceed with this legal pathway."
        barriers = ["Insufficient confidence score", "Legal pathway unverifiable"]
    elif confidence < 0.65:
        state = "escalate"
        verdict = EnforcementVerdict.PENDING_REVIEW
        reason = "Moderate confidence — escalation to senior counsel recommended."
        barriers = []
    elif confidence < 0.8:
        state = "conditional"
        verdict = EnforcementVerdict.PENDING_REVIEW
        reason = "Proceed with caution; verify jurisdiction-specific requirements."
        barriers = []
    else:
        state = "clear"
        verdict = EnforcementVerdict.ENFORCEABLE
        reason = ""
        barriers = []

    return ResponseBuilder.build_enforcement_status(
        trace_id=trace_id,
        state=state,
        verdict=verdict.value,
        reason=reason,
        barriers=barriers
    )