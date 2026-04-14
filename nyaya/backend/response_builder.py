from typing import Dict, Any, List, Optional
from backend.schemas import (
    NyayaResponse, MultiJurisdictionResponse, ExplainReasoningResponse,
    FeedbackResponse, TraceResponse, RLSignalResponse, ErrorResponse
)
from packages.shared.decision_contract import validate_decision_contract, EnforcementStatus, EnforcementState, EnforcementVerdict

class ResponseBuilder:
    """Builds standardized responses for the Nyaya API Gateway."""

    @staticmethod
    def build_nyaya_response(
        domain: str,
        jurisdiction: str,
        confidence: float,
        legal_route: List[str],
        trace_id: str,
        provenance_chain: Optional[List[Dict[str, Any]]] = None,
        reasoning_trace: Optional[Dict[str, Any]] = None,
        constitutional_articles: Optional[List[str]] = None
    ) -> NyayaResponse:
        """Build a standardized Nyaya response."""
        # Create enforcement status with defaults
        enforcement_status = EnforcementStatus(
            state=EnforcementState.CLEAR,
            verdict=EnforcementVerdict.ENFORCEABLE,
            trace_id=trace_id
        )

        response = NyayaResponse(
            domain=domain,
            jurisdiction=jurisdiction,
            confidence=confidence,
            legal_route=legal_route,
            constitutional_articles=constitutional_articles or [],
            provenance_chain=provenance_chain or [],
            reasoning_trace=reasoning_trace or {},
            trace_id=trace_id,
            enforcement_status=enforcement_status,
            metadata={"Formatted": True}
        )

        # Validate against DecisionContract schema
        try:
            validate_decision_contract(response.dict())
        except Exception as validation_error:
            # If validation fails, raise error
            raise ValueError(f"DecisionContract validation failed: {str(validation_error)}")

        return response

    @staticmethod
    def build_multi_jurisdiction_response(
        comparative_analysis: Dict[str, NyayaResponse],
        confidence: float,
        trace_id: str
    ) -> MultiJurisdictionResponse:
        """Build a multi-jurisdiction response."""
        return MultiJurisdictionResponse(
            comparative_analysis=comparative_analysis,
            confidence=confidence,
            trace_id=trace_id
        )

    @staticmethod
    def build_explain_reasoning_response(
        trace_id: str,
        explanation_level: str
    ) -> ExplainReasoningResponse:
        """Build an explain reasoning response."""
        # Placeholder for trace data from provenance store
        trace_history = {"events": [], "trace_id": trace_id}  # Placeholder
        reasoning_tree = ResponseBuilder._construct_reasoning_tree(trace_history, explanation_level)

        # Extract constitutional articles if jurisdiction is India
        constitutional_articles = []
        if any(event.get("jurisdiction") == "India" for event in trace_history.get("events", [])):
            constitutional_articles = ResponseBuilder._extract_constitutional_articles(trace_history)

        return ExplainReasoningResponse(
            trace_id=trace_id,
            explanation={"level": explanation_level, "trace_data": trace_history},
            reasoning_tree=reasoning_tree,
            constitutional_articles=constitutional_articles
        )

    @staticmethod
    def build_feedback_response(
        status: str,
        trace_id: str,
        message: str
    ) -> FeedbackResponse:
        """Build a feedback response."""
        return FeedbackResponse(
            status=status,
            trace_id=trace_id,
            message=message
        )

    @staticmethod
    def build_rl_signal_response(
        status: str,
        trace_id: str,
        message: str
    ) -> RLSignalResponse:
        """Build an RL signal response."""
        return RLSignalResponse(
            status=status,
            trace_id=trace_id,
            message=message
        )

    @staticmethod
    def build_trace_response(trace_id: str) -> TraceResponse:
        """Build a full trace audit response."""
        # Placeholder for event chain from ledger
        event_chain = []  # Placeholder

        # Filter events for this trace_id
        trace_events = [
            event for event in event_chain
            if event.get("signed_event", {}).get("trace_id") == trace_id
        ]

        # Build agent routing tree
        agent_routing_tree = ResponseBuilder._build_agent_routing_tree(trace_events)

        # Get jurisdiction hops
        jurisdiction_hops = ResponseBuilder._extract_jurisdiction_hops(trace_events)

        # Placeholder for RL reward snapshot
        rl_reward_snapshot = {"placeholder": "RL data would be fetched here"}

        # Generate context fingerprint (placeholder)
        context_fingerprint = "placeholder_fingerprint"

        # Check nonce and signature verification
        nonce_verification = ResponseBuilder._verify_nonces(trace_events)
        signature_verification = ResponseBuilder._verify_signatures(trace_events)

        return TraceResponse(
            trace_id=trace_id,
            event_chain=trace_events,
            agent_routing_tree=agent_routing_tree,
            jurisdiction_hops=jurisdiction_hops,
            rl_reward_snapshot=rl_reward_snapshot,
            context_fingerprint=context_fingerprint,
            nonce_verification=nonce_verification,
            signature_verification=signature_verification
        )

    @staticmethod
    def build_error_response(
        error_code: str,
        message: str,
        trace_id: str
    ) -> ErrorResponse:
        """Build a standardized error response."""
        return ErrorResponse(
            error_code=error_code,
            message=message,
            trace_id=trace_id
        )

    @staticmethod
    def _construct_reasoning_tree(trace_history: Dict[str, Any], level: str) -> Dict[str, Any]:
        """Construct reasoning tree based on explanation level."""
        events = trace_history.get("events", [])

        if level == "brief":
            return {
                "summary": f"Query processed through {len(events)} steps",
                "key_decisions": [event.get("event_name") for event in events if event.get("event_name") in ["jurisdiction_resolved", "agent_classified"]]
            }
        elif level == "detailed":
            return {
                "full_timeline": events,
                "agent_interactions": [
                    {
                        "agent": event.get("agent_id"),
                        "action": event.get("event_name"),
                        "details": event.get("details", {})
                    } for event in events
                ]
            }
        elif level == "constitutional":
            return {
                "constitutional_focus": [
                    event for event in events
                    if event.get("jurisdiction") == "India" or "constitutional" in str(event.get("details", {}))
                ],
                "articles_referenced": ResponseBuilder._extract_constitutional_articles(trace_history)
            }
        else:
            return {"error": "Invalid explanation level"}

    @staticmethod
    def _extract_constitutional_articles(trace_history: Dict[str, Any]) -> List[str]:
        """Extract constitutional articles from trace history."""
        # Placeholder implementation - in real system would parse agent responses
        return ["Article 14", "Article 19", "Article 21"]  # Example articles

    @staticmethod
    def _build_agent_routing_tree(events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build hierarchical tree of agent routing decisions."""
        tree = {"root": "api_gateway", "children": {}}

        for event in events:
            agent_id = event.get("agent_id", "unknown")
            if agent_id not in tree["children"]:
                tree["children"][agent_id] = {
                    "jurisdiction": event.get("jurisdiction"),
                    "events": []
                }
            tree["children"][agent_id]["events"].append(event.get("event_name"))

        return tree

    @staticmethod
    def _extract_jurisdiction_hops(events: List[Dict[str, Any]]) -> List[str]:
        """Extract sequence of jurisdiction transitions."""
        hops = []
        for event in events:
            jurisdiction = event.get("jurisdiction")
            if jurisdiction and jurisdiction not in hops:
                hops.append(jurisdiction)
        return hops

    @staticmethod
    def _verify_nonces(events: List[Dict[str, Any]]) -> bool:
        """Verify nonce integrity across events."""
        # Placeholder - would check nonce chain validity
        return True

    @staticmethod
    def _verify_signatures(events: List[Dict[str, Any]]) -> bool:
        """Verify signature integrity across events."""
        # Placeholder - would verify HMAC signatures
        return True

    # ==================== Case Presentation Response Builders ====================

    @staticmethod
    def build_case_summary_response(trace_id: str, jurisdiction: str) -> Dict[str, Any]:
        """Build case summary response for frontend components."""
        # Generate sample case summary based on jurisdiction
        jurisdiction_prefix = jurisdiction.lower() if jurisdiction else "default"
        
        return {
            "caseId": f"CASE-2024-001",
            "title": f"Legal Analysis - {jurisdiction} Jurisdiction",
            "overview": f"Comprehensive legal analysis based on the provided query, applicable to {jurisdiction} legal framework.",
            "keyFacts": [
                "Legal matter analyzed based on user query",
                "Jurisdiction identified as " + jurisdiction,
                "Relevant legal provisions identified",
                "Case complexity assessed via confidence scoring"
            ],
            "jurisdiction": jurisdiction,
            "confidence": 0.87,
            "summaryAnalysis": f"This legal analysis for {jurisdiction} provides an overview of applicable laws and potential pathways. The analysis is based on general legal principles and may require jurisdiction-specific consultation for definitive advice.",
            "dateFiled": "2024-07-15",
            "status": "Analysis Complete",
            "parties": {
                "plaintiff": "Requesting Party",
                "defendant": "N/A (General Analysis)"
            },
            "trace_id": trace_id
        }

    @staticmethod
    def build_legal_routes_response(trace_id: str, jurisdiction: str, case_type: str) -> Dict[str, Any]:
        """Build legal routes response for frontend components."""
        routes_data = {
            "India": [
                {
                    "name": "Mediation",
                    "description": "Non-binding dispute resolution through a neutral third-party mediator.",
                    "recommendation": "Recommended as first step for faster resolution.",
                    "suitability": 0.95,
                    "estimatedDuration": "2-4 weeks",
                    "estimatedCost": "INR 50,000-100,000",
                    "pros": ["Confidential", "Cost-effective", "Faster resolution"],
                    "cons": ["Non-binding", "Requires mutual agreement"]
                },
                {
                    "name": "Arbitration",
                    "description": "Binding dispute resolution through private arbitration tribunal.",
                    "recommendation": "Strong alternative for commercial disputes.",
                    "suitability": 0.85,
                    "estimatedDuration": "3-6 months",
                    "estimatedCost": "INR 200,000-500,000",
                    "pros": ["Binding", "Expert arbitrators", "Enforceable"],
                    "cons": ["Limited appeal", "Can be costly"]
                },
                {
                    "name": "Civil Litigation",
                    "description": "Formal court proceedings through the judicial system.",
                    "recommendation": "Consider when other options are exhausted.",
                    "suitability": 0.60,
                    "estimatedDuration": "1-3 years",
                    "estimatedCost": "INR 300,000-1,000,000+",
                    "pros": ["Binding judgment", "Right to appeal", "Wide remedies"],
                    "cons": ["Lengthy", "Public record", "High costs"]
                }
            ],
            "UK": [
                {
                    "name": "Small Claims Court",
                    "description": "For claims under £10,000, simplified procedure.",
                    "recommendation": "Ideal for lower-value disputes.",
                    "suitability": 0.90,
                    "estimatedDuration": "1-3 months",
                    "estimatedCost": "£300-1,500",
                    "pros": ["Simpler procedure", "Lower costs", "No solicitor required"],
                    "cons": ["Limited to £10,000", "Limited appeals"]
                },
                {
                    "name": "County Court",
                    "description": "For claims up to £100,000, standard procedure.",
                    "recommendation": "Standard route for most civil disputes.",
                    "suitability": 0.80,
                    "estimatedDuration": "6-12 months",
                    "estimatedCost": "£1,000-5,000",
                    "pros": ["Comprehensive procedure", "Range of remedies"],
                    "cons": ["Costs can escalate", "Time-consuming"]
                }
            ],
            "UAE": [
                {
                    "name": "Amicable Settlement",
                    "description": "Court-mediated settlement before litigation.",
                    "recommendation": "Encouraged as first step under UAE law.",
                    "suitability": 0.92,
                    "estimatedDuration": "1-2 months",
                    "estimatedCost": "AED 5,000-15,000",
                    "pros": ["Quick", "Cost-effective", "Preserves relationships"],
                    "cons": ["Requires agreement", "Non-binding if no settlement"]
                },
                {
                    "name": "Civil Court",
                    "description": "Federal court proceedings for civil matters.",
                    "recommendation": "Standard litigation route for unresolved disputes.",
                    "suitability": 0.75,
                    "estimatedDuration": "3-6 months",
                    "estimatedCost": "AED 20,000-100,000",
                    "pros": ["Binding judgment", "Enforceable"],
                    "cons": ["Formal process", "Legal representation required"]
                }
            ]
        }
        
        routes = routes_data.get(jurisdiction, routes_data.get("India"))
        
        return {
            "routes": routes,
            "jurisdiction": jurisdiction,
            "caseType": case_type,
            "trace_id": trace_id
        }

    @staticmethod
    def build_timeline_response(trace_id: str, jurisdiction: str, case_id: str) -> Dict[str, Any]:
        """Build timeline response for frontend components."""
        return {
            "events": [
                {
                    "id": "query-received",
                    "date": "2024-07-15",
                    "title": "Query Received",
                    "description": "Legal query submitted and initial processing started.",
                    "type": "milestone",
                    "status": "completed",
                    "documents": ["Query_Submission.pdf"],
                    "parties": ["Requesting Party", "Nyaya AI System"]
                },
                {
                    "id": "jurisdiction-identified",
                    "date": "2024-07-15",
                    "title": "Jurisdiction Identified",
                    "description": f"Jurisdiction resolved to {jurisdiction} based on query analysis.",
                    "type": "milestone",
                    "status": "completed"
                },
                {
                    "id": "legal-analysis",
                    "date": "2024-07-16",
                    "title": "Legal Analysis",
                    "description": "Analysis of applicable laws and legal provisions.",
                    "type": "step",
                    "status": "completed"
                },
                {
                    "id": "route-determination",
                    "date": "2024-07-16",
                    "title": "Legal Routes Determined",
                    "description": "Available legal pathways identified and evaluated.",
                    "type": "step",
                    "status": "completed"
                },
                {
                    "id": "report-generation",
                    "date": "2024-07-17",
                    "title": "Report Generation",
                    "description": "Comprehensive legal analysis report generated.",
                    "type": "step",
                    "status": "completed"
                },
                {
                    "id": "recommendations",
                    "date": "2024-07-18",
                    "title": "Recommendations Ready",
                    "description": "Final recommendations and next steps provided.",
                    "type": "milestone",
                    "status": "pending"
                }
            ],
            "jurisdiction": jurisdiction,
            "caseId": case_id,
            "trace_id": trace_id
        }

    @staticmethod
    def build_glossary_response(trace_id: str, jurisdiction: str, case_type: str) -> Dict[str, Any]:
        """Build glossary response for frontend components."""
        # Common legal terms with jurisdiction-specific definitions
        terms = [
            {
                "term": "Jurisdiction",
                "definition": f"The authority of {jurisdiction} courts to hear and decide legal matters.",
                "context": "Determines which legal framework applies to your case.",
                "relatedTerms": ["Venue", "Forum", "Legal Authority"],
                "jurisdiction": jurisdiction,
                "confidence": 0.95
            },
            {
                "term": "Cause of Action",
                "definition": "The legal basis for a lawsuit, comprising facts giving rise to a claim.",
                "context": "The facts that establish your right to legal relief.",
                "relatedTerms": ["Claim", "Legal Claim", "Remedy"],
                "jurisdiction": jurisdiction,
                "confidence": 0.88
            },
            {
                "term": "Limitation Period",
                "definition": "The maximum time after an event within which legal proceedings may be initiated.",
                "context": "Important deadline for filing your legal claim.",
                "relatedTerms": ["Statute of Limitations", "Time Limit", "Deadline"],
                "jurisdiction": jurisdiction,
                "confidence": 0.92
            },
            {
                "term": "Remedy",
                "definition": "The means by which a right is enforced or a violation of a right is prevented or compensated.",
                "context": "The type of relief you can seek through legal action.",
                "relatedTerms": ["Damages", "Injunction", "Specific Performance"],
                "jurisdiction": jurisdiction,
                "confidence": 0.85
            },
            {
                "term": "Evidence",
                "definition": "Any type of proof legally presented at trial to persuade the court.",
                "context": "Documentation and proof to support your legal claims.",
                "relatedTerms": ["Proof", "Documentation", "Witness Testimony"],
                "jurisdiction": jurisdiction,
                "confidence": 0.90
            }
        ]
        
        return {
            "terms": terms,
            "jurisdiction": jurisdiction,
            "caseType": case_type,
            "trace_id": trace_id
        }

    @staticmethod
    def build_jurisdiction_info_response(jurisdiction: str) -> Dict[str, Any]:
        """Build jurisdiction info response for frontend components."""
        jurisdiction_info = {
            "India": {
                "country": "India",
                "courtSystem": "Indian Judicial System",
                "authorityFraming": "Formal and procedural, emphasizing due process and evidence-based decisions",
                "emergencyGuidance": "File FIR at nearest Police Station, contact local magistrate for immediate orders",
                "legalFramework": "Common Law System based on English law",
                "limitationAct": "Limitation Act, 1963",
                "constitution": "Constitution of India (1950)"
            },
            "UK": {
                "country": "United Kingdom",
                "courtSystem": "UK Courts and Tribunals",
                "authorityFraming": "Adversarial system with emphasis on precedent and judicial discretion",
                "emergencyGuidance": "Contact Police (999) or Crown Prosecution Service for urgent matters",
                "legalFramework": "Common Law System",
                "limitationAct": "Limitation Act 1980",
                "constitution": "Uncodified Constitution (Parliamentary Sovereignty)"
            },
            "UAE": {
                "country": "United Arab Emirates",
                "courtSystem": "UAE Federal Judiciary",
                "authorityFraming": "Civil law system with Islamic Sharia influences, emphasizing reconciliation",
                "emergencyGuidance": "Contact Public Prosecution or local police for immediate legal intervention",
                "legalFramework": "Civil Law System with Sharia principles",
                "limitationAct": "Federal Law No. 5 of 1985 (Civil Transactions Law)",
                "constitution": "UAE Constitution (1971)"
            }
        }
        
        info = jurisdiction_info.get(jurisdiction, jurisdiction_info.get("India", {})) or {}

        return {
            "country": info.get("country", ""),
            "courtSystem": info.get("courtSystem", ""),
            "authorityFraming": info.get("authorityFraming", ""),
            "emergencyGuidance": info.get("emergencyGuidance", ""),
            "legalFramework": info.get("legalFramework", ""),
            "limitationAct": info.get("limitationAct", ""),
            "constitution": info.get("constitution", ""),
            "jurisdiction": jurisdiction
        }

    # ==================== Enforcement Status Builders ====================

    @staticmethod
    def build_enforcement_status(
        trace_id: str,
        state: str = "clear",
        verdict: str = "ENFORCEABLE",
        reason: str = "",
        barriers: Optional[List[str]] = None,
        blocked_path: Optional[str] = None,
        escalation_required: bool = False,
        escalation_target: Optional[str] = None,
        redirect_suggestion: Optional[str] = None,
        safe_explanation: str = ""
    ) -> Dict[str, Any]:
        """Build enforcement status response for UI."""
        try:
            enforcement_state = EnforcementState(state)
        except ValueError:
            enforcement_state = EnforcementState.CLEAR

        if not safe_explanation:
            safe_explanation = ResponseBuilder._generate_safe_explanation(
                enforcement_state, reason, blocked_path, redirect_suggestion
            )

        return {
            "state": enforcement_state.value,
            "verdict": verdict,
            "reason": reason,
            "barriers": barriers or [],
            "blocked_path": blocked_path,
            "escalation_required": escalation_required,
            "escalation_target": escalation_target,
            "redirect_suggestion": redirect_suggestion,
            "safe_explanation": safe_explanation,
            "trace_id": trace_id
        }

    @staticmethod
    def _generate_safe_explanation(
        state: EnforcementState, 
        reason: str, 
        blocked_path: Optional[str] = None,
        redirect_suggestion: Optional[str] = None
    ) -> str:
        """Generate safe explanation for users based on enforcement state."""
        explanations = {
            EnforcementState.CLEAR: "This legal pathway is available for your case. You may proceed with confidence.",
            EnforcementState.BLOCK: f"This pathway is currently blocked. {reason or 'Please consult a legal professional for alternative options.'}",
            EnforcementState.ESCALATE: f"This matter requires escalation to a higher authority. {reason or 'Your case will be reviewed by senior legal counsel.'}",
            EnforcementState.SOFT_REDIRECT: f"Consider an alternative pathway. {reason or redirect_suggestion or 'This option may better suit your legal needs.'}",
            EnforcementState.CONDITIONAL: f"This pathway is available with conditions. {reason or 'Please review the specific requirements for your case.'}"
        }
        return explanations.get(state, "Please consult a legal professional for guidance.")