from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ValidationError as PydanticValidationError


def validate_nonce(nonce: str) -> bool:
    """Validate nonce format for security."""
    if not nonce or len(nonce) < 8:
        return False
    return nonce.isalnum()


def format_timestamp(dt: Optional[datetime] = None) -> str:
    """Format datetime to ISO 8601 string."""
    if dt is None:
        dt = datetime.utcnow()
    return dt.isoformat()


def validate_required_fields(data: Dict[str, Any], required: List[str]) -> List[str]:
    """Validate required fields exist in data."""
    missing = []
    for field in required:
        if field not in data or data[field] is None:
            missing.append(field)
    return missing


class Validator:
    """Shared validation utilities."""
    
    @staticmethod
    def validate_section(section_data: Dict[str, Any]) -> bool:
        required = ["section_number", "description"]
        return len(validate_required_fields(section_data, required)) == 0
    
    @staticmethod
    def validate_act(act_data: Dict[str, Any]) -> bool:
        required = ["act_name", "year"]
        return len(validate_required_fields(act_data, required)) == 0
    
    @staticmethod
    def validate_case(case_data: Dict[str, Any]) -> bool:
        required = ["case_number", "title"]
        return len(validate_required_fields(case_data, required)) == 0