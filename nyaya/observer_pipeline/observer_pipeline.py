from typing import Dict, Any
from datetime import datetime
import uuid
from packages.shared.decision_contract import validate_decision_contract

class ObserverPipeline:
    """
    Observer Pipeline component that processes agent results before formatting.
    Ensures sequential flow: Decision Engine -> Observer Pipeline -> Formatter -> Response
    Outputs validated DecisionContract JSON.
    """

    def __init__(self):
        self.observation_id = str(uuid.uuid4())

    async def process_result(self, agent_result: Dict[str, Any], trace_id: str, jurisdiction: str) -> Dict[str, Any]:
        """
        Process agent result through observation pipeline.

        Args:
            agent_result: Raw result from Decision Engine (LegalAgent)
            trace_id: Trace identifier for the request
            jurisdiction: Jurisdiction for the analysis

        Returns:
            Processed result with observation metadata
        """
        # Add observation timestamp
        observation_timestamp = datetime.utcnow().isoformat()

        # Extract confidence and validate
        confidence = agent_result.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
            confidence = 0.5  # Default fallback

        # Add observation metadata
        observed_result = {
            **agent_result,
            "observation": {
                "observation_id": self.observation_id,
                "timestamp": observation_timestamp,
                "jurisdiction": jurisdiction,
                "trace_id": trace_id,
                "confidence_validated": confidence,
                "pipeline_stage": "observer_pipeline",
                "processed_at": observation_timestamp
            },
            "metadata": {
                "observed": True,
                "stage": "post_decision_engine"
            }
        }

        # Apply basic observation rules
        observed_result = self._apply_observation_rules(observed_result)

        return observed_result

    def _apply_observation_rules(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply observation rules to the result.
        This can be extended for more complex observation logic.
        """
        confidence = result.get("observation", {}).get("confidence_validated", 0.5)

        # Rule 1: Flag low confidence results for review
        if confidence < 0.3:
            result["observation"]["flags"] = result["observation"].get("flags", [])
            result["observation"]["flags"].append("low_confidence_review_required")

        # Rule 2: Add observation completeness score
        required_fields = ["confidence", "jurisdiction", "analysis"]
        completeness = sum(1 for field in required_fields if field in result) / len(required_fields)
        result["observation"]["completeness_score"] = completeness

        return result