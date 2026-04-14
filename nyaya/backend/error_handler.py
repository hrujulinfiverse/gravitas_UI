from typing import Dict, Any
from fastapi.responses import JSONResponse
from backend.response_builder import ResponseBuilder

class ErrorHandler:
    """Centralized error handling utility for Nyaya API."""

    @staticmethod
    def create_error_response(error_code: str, message: str, trace_id: str, status_code: int = 500) -> JSONResponse:
        """Create standardized JSON error response."""
        error_response = ResponseBuilder.build_error_response(
            error_code,
            message,
            trace_id
        )
        return JSONResponse(
            status_code=status_code,
            content=error_response.dict()
        )

    @staticmethod
    def handle_validation_error(exc, trace_id: str) -> JSONResponse:
        """Handle Pydantic validation errors."""
        return ErrorHandler.create_error_response(
            "VALIDATION_ERROR",
            f"Request validation failed: {str(exc)}",
            trace_id,
            400
        )

    @staticmethod
    def handle_contract_error(exc, trace_id: str) -> JSONResponse:
        """Handle DecisionContract validation errors."""
        return ErrorHandler.create_error_response(
            "INVALID_CONTRACT",
            f"DecisionContract validation failed: {str(exc)}",
            trace_id,
            500
        )

    @staticmethod
    def handle_not_found(resource: str, trace_id: str) -> JSONResponse:
        """Handle resource not found errors."""
        return ErrorHandler.create_error_response(
            "NOT_FOUND",
            f"{resource} not found",
            trace_id,
            404
        )

    @staticmethod
    def handle_internal_error(exc, trace_id: str) -> JSONResponse:
        """Handle unexpected internal errors."""
        return ErrorHandler.create_error_response(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            trace_id,
            500
        )