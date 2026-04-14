from pydantic import BaseModel, Field, validator
from typing import Dict, Any, List
from enum import Enum

class EnforcementState(str, Enum):
    CLEAR = "clear"
    BLOCK = "block"
    ESCALATE = "escalate"
    SOFT_REDIRECT = "soft_redirect"
    CONDITIONAL = "conditional"

class EnforcementVerdict(str, Enum):
    ENFORCEABLE = "ENFORCEABLE"
    PENDING_REVIEW = "PENDING_REVIEW"
    NON_ENFORCEABLE = "NON_ENFORCEABLE"

class EnforcementStatus(BaseModel):
    state: EnforcementState
    verdict: EnforcementVerdict
    reason: str = ""
    barriers: List[str] = []
    blocked_path: str = None
    escalation_required: bool = False
    escalation_target: str = None
    redirect_suggestion: str = None
    safe_explanation: str = ""
    trace_id: str

    @validator('trace_id')
    def trace_id_must_be_present(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('trace_id must be a non-empty string')
        return v

class DecisionContract(BaseModel):
    """
    Canonical Decision Contract - Single source of truth for Nyaya ecosystem.

    This immutable schema MUST be used across:
    - Backend response models
    - Frontend state management
    - Observer pipeline JSON output
    - All data exchange points
    """
    trace_id: str = Field(..., description="UUID trace identifier")
    jurisdiction: str = Field(..., description="Legal jurisdiction code")
    domain: str = Field(..., description="Legal domain")
    legal_route: List[str] = Field(..., description="Sequence of agents/legal steps")
    reasoning_trace: Dict[str, Any] = Field(..., description="Detailed reasoning process")
    enforcement_status: EnforcementStatus = Field(..., description="Enforcement state and verdict")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")

    @validator('trace_id', 'jurisdiction', 'domain')
    def non_empty_strings(cls, v):
        if not v or not isinstance(v, str) or len(v.strip()) == 0:
            raise ValueError('Field must be a non-empty string')
        return v.strip()

    @validator('legal_route')
    def legal_route_non_empty(cls, v):
        if not v or len(v) == 0:
            raise ValueError('legal_route must be a non-empty list')
        return v

    class Config:
        extra = 'forbid'  # No extra fields allowed

# Validation function for programmatic gatekeeper
def validate_decision_contract(data: Dict[str, Any]) -> DecisionContract:
    """
    Validates data against DecisionContract schema.
    Raises ValidationError if invalid.
    """
    return DecisionContract(**data)