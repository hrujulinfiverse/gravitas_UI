from typing import Dict, Any, Tuple
import json
import os
from datetime import datetime
import uuid

# Import provenance chain modules
from provenance_chain.event_signer import signer
from provenance_chain.hash_chain_ledger import ledger
from provenance_chain.nonce_manager import nonce_manager
from provenance_chain.context_fingerprint import fingerprint_generator

class RewardEngine:
    """
    Computes reward/penalty using score rules based on feedback.
    """
    
    def __init__(self, performance_memory_file: str = "performance_memory.json"):
        self.performance_memory_file = performance_memory_file
        self.reward_weights = {
            "accuracy": 0.4,
            "helpfulness": 0.3,
            "clarity": 0.2,
            "completeness": 0.1
        }
        
        # Load existing performance memory
        self.performance_memory = self._load_performance_memory()
    
    def compute_reward(self, response: Dict[str, Any], feedback: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """
        Compute reward/penalty based on response and feedback.
        
        Args:
            response: The agent's response
            feedback: Feedback containing score (1-5) and optional comment
            
        Returns:
            Tuple of (reward_score, reward_details)
        """
        # Extract feedback components
        score = feedback.get("score", 3)  # Default to neutral score of 3
        comment = feedback.get("comment", "")
        
        # Normalize score to 0-1 range (1->0.0, 5->1.0)
        normalized_score = (score - 1) / 4.0
        
        # Calculate reward components
        accuracy_reward = self._calculate_accuracy_reward(response, normalized_score)
        helpfulness_reward = self._calculate_helpfulness_reward(response, normalized_score)
        clarity_reward = self._calculate_clarity_reward(response, normalized_score)
        completeness_reward = self._calculate_completeness_reward(response, normalized_score)
        
        # Weighted reward calculation
        total_reward = (
            self.reward_weights["accuracy"] * accuracy_reward +
            self.reward_weights["helpfulness"] * helpfulness_reward +
            self.reward_weights["clarity"] * clarity_reward +
            self.reward_weights["completeness"] * completeness_reward
        )
        
        # Apply comment sentiment adjustment if comment exists
        if comment:
            sentiment_adjustment = self._analyze_comment_sentiment(comment)
            total_reward = max(-1.0, min(1.0, total_reward + sentiment_adjustment))
        
        reward_details = {
            "accuracy": accuracy_reward,
            "helpfulness": helpfulness_reward,
            "clarity": clarity_reward,
            "completeness": completeness_reward,
            "comment_adjustment": sentiment_adjustment if comment else 0.0,
            "timestamp": datetime.utcnow().isoformat(),
            "trace_id": feedback.get("trace_id", ""),
            "raw_score": score
        }

        # Emit RL_FEEDBACK_RECEIVED provenance event
        self._emit_feedback_event(total_reward, reward_details, feedback)

        return total_reward, reward_details
    
    def _calculate_accuracy_reward(self, response: Dict[str, Any], normalized_score: float) -> float:
        """
        Calculate accuracy component of reward.
        """
        # In a real implementation, this would compare against ground truth
        # For now, we'll use the normalized feedback score as a proxy
        return normalized_score
    
    def _calculate_helpfulness_reward(self, response: Dict[str, Any], normalized_score: float) -> float:
        """
        Calculate helpfulness component of reward.
        """
        # In a real implementation, this might analyze response content
        # For now, we'll use the normalized feedback score as a proxy
        return normalized_score
    
    def _calculate_clarity_reward(self, response: Dict[str, Any], normalized_score: float) -> float:
        """
        Calculate clarity component of reward.
        """
        # In a real implementation, this might analyze response structure
        # For now, we'll use the normalized feedback score as a proxy
        return normalized_score
    
    def _calculate_completeness_reward(self, response: Dict[str, Any], normalized_score: float) -> float:
        """
        Calculate completeness component of reward.
        """
        # In a real implementation, this might check if all query aspects were addressed
        # For now, we'll use the normalized feedback score as a proxy
        return normalized_score
    
    def _analyze_comment_sentiment(self, comment: str) -> float:
        """
        Analyze sentiment of feedback comment for reward adjustment.
        """
        # Simple keyword-based sentiment analysis (placeholder)
        positive_keywords = ["good", "great", "excellent", "helpful", "clear", "perfect"]
        negative_keywords = ["bad", "poor", "confusing", "wrong", "incorrect", "unclear"]
        
        comment_lower = comment.lower()
        positive_count = sum(1 for word in positive_keywords if word in comment_lower)
        negative_count = sum(1 for word in negative_keywords if word in comment_lower)
        
        # Simple sentiment score (-0.2 to +0.2)
        sentiment_score = (positive_count - negative_count) * 0.05
        return max(-0.2, min(0.2, sentiment_score))
    
    def update_performance_memory(self, trace_id: str, reward_score: float, reward_details: Dict[str, Any]):
        """
        Store reward result in performance memory.
        
        Args:
            trace_id: Trace ID linking to the response
            reward_score: Computed reward score
            reward_details: Details of reward computation
        """
        if trace_id not in self.performance_memory:
            self.performance_memory[trace_id] = []
            
        self.performance_memory[trace_id].append({
            "reward_score": reward_score,
            "details": reward_details,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Save to file
        self._save_performance_memory()
    
    def _load_performance_memory(self) -> Dict[str, Any]:
        """
        Load performance memory from file.
        """
        if os.path.exists(self.performance_memory_file):
            try:
                with open(self.performance_memory_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    def _save_performance_memory(self):
        """
        Save performance memory to file.
        """
        try:
            with open(self.performance_memory_file, 'w') as f:
                json.dump(self.performance_memory, f, indent=2)
        except IOError:
            pass  # In a real system, we'd log this error
    
    def get_agent_performance_stats(self, agent_name: str) -> Dict[str, Any]:
        """
        Get performance statistics for a specific agent.
        
        Args:
            agent_name: Name of the agent
            
        Returns:
            Performance statistics dictionary
        """
        # Filter rewards for this agent (simplified - in reality would need agent tracking)
        agent_rewards = []
        for trace_entries in self.performance_memory.values():
            for entry in trace_entries:
                # In a real implementation, we'd have agent information in the entries
                agent_rewards.append(entry["reward_score"])
        
        if not agent_rewards:
            return {"average_reward": 0.0, "total_interactions": 0}
        
        return {
            "average_reward": sum(agent_rewards) / len(agent_rewards),
            "total_interactions": len(agent_rewards),
            "min_reward": min(agent_rewards),
            "max_reward": max(agent_rewards)
        }
    
    def adjust_reward_weights(self, weight_updates: Dict[str, float]):
        """
        Adjust reward weightings.

        Args:
            weight_updates: Dictionary of weight updates
        """
        for key, value in weight_updates.items():
            if key in self.reward_weights:
                self.reward_weights[key] = max(0.0, min(1.0, value))

        # Normalize weights to sum to 1.0
        total_weight = sum(self.reward_weights.values())
        if total_weight > 0:
            for key in self.reward_weights:
                self.reward_weights[key] /= total_weight

    def _emit_feedback_event(self, reward_score: float, reward_details: Dict[str, Any], feedback: Dict[str, Any]):
        """
        Emit RL_FEEDBACK_RECEIVED provenance event after reward computation.

        Args:
            reward_score: Computed reward score
            reward_details: Details of reward computation
            feedback: Original feedback data
        """
        try:
            trace_id = feedback.get("trace_id", str(uuid.uuid4()))

            # Generate nonce for anti-replay
            nonce = nonce_manager.generate_nonce()

            # Create request hash from feedback context
            request_hash = fingerprint_generator.generate_fingerprint(
                query_text=str(feedback),
                user_id=feedback.get("user_id"),
                jurisdiction=feedback.get("jurisdiction", "global")
            )

            # Create event
            event = {
                "trace_id": trace_id,
                "timestamp": datetime.utcnow().isoformat() + 'Z',
                "agent_id": "reward_engine",
                "jurisdiction": feedback.get("jurisdiction", "global"),
                "event_name": "RL_FEEDBACK_RECEIVED",
                "request_hash": request_hash,
                "nonce": nonce,
                "details": {
                    "reward_score": reward_score,
                    "reward_components": {
                        "accuracy": reward_details["accuracy"],
                        "helpfulness": reward_details["helpfulness"],
                        "clarity": reward_details["clarity"],
                        "completeness": reward_details["completeness"]
                    },
                    "raw_feedback_score": reward_details["raw_score"],
                    "comment": feedback.get("comment", "")
                }
            }

            # Sign and append to ledger
            signed_event = signer.sign_event(event)
            ledger.append_event(signed_event)

        except Exception as e:
            # Log error but don't fail reward computation
            print(f"Failed to emit provenance event: {e}")