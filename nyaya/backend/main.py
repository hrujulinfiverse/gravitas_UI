from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from backend.router import router
from backend.audit_logger import AuditLogMiddleware
import uvicorn
import os

# Create FastAPI app
app = FastAPI(
    title="Nyaya Legal AI API Gateway",
    description="Sovereign-compliant API gateway for multi-agent legal intelligence",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Audit log — must be added before CORS so every request is captured
app.add_middleware(AuditLogMiddleware)

# Add CORS middleware — strict production whitelist
_raw_origins = os.getenv("ALLOWED_ORIGINS", "https://nyai.blackholeinfiverse.com")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Trace-ID", "X-Pipeline-Entry", "X-No-Bypass", "X-Client-Type", "X-Request-Source"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from backend.error_handler import ErrorHandler
    from pydantic import ValidationError
    from packages.shared.decision_contract import ValidationError as ContractValidationError

    trace_id = getattr(request.state, 'trace_id', 'unknown')

    # Handle specific exception types
    if isinstance(exc, ValidationError):
        return ErrorHandler.handle_validation_error(exc, trace_id)
    elif isinstance(exc, ContractValidationError):
        return ErrorHandler.handle_contract_error(exc, trace_id)
    elif isinstance(exc, HTTPException):
        return ErrorHandler.create_error_response(
            "HTTP_EXCEPTION",
            exc.detail,
            trace_id,
            exc.status_code
        )
    else:
        return ErrorHandler.handle_internal_error(exc, trace_id)

# Middleware to add trace_id to request state
@app.middleware("http")
async def add_trace_id_middleware(request: Request, call_next):
    import uuid
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    response = await call_next(request)
    return response

# Request validation middleware
@app.middleware("http")
async def request_validation_middleware(request: Request, call_next):
    # Basic validation for malformed requests
    if request.method in ["POST", "PUT", "PATCH"]:
        content_type = request.headers.get("content-type", "")
        if "application/json" not in content_type.lower():
            from fastapi.responses import JSONResponse
            from backend.response_builder import ResponseBuilder
            trace_id = getattr(request.state, 'trace_id', 'unknown')
            error_response = ResponseBuilder.build_error_response(
                "INVALID_CONTENT_TYPE",
                "Content-Type must be application/json",
                trace_id
            )
            return JSONResponse(
                status_code=400,
                content=error_response.dict()
            )

    response = await call_next(request)
    return response



# Include routers
app.include_router(router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "nyaya-api-gateway"}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Nyaya Legal AI API Gateway",
        "version": "1.0.0",
        "description": "Sovereign-compliant multi-agent legal intelligence platform",
        "endpoints": {
            "query": "POST /nyaya/query",
            "multi_jurisdiction": "POST /nyaya/multi_jurisdiction",
            "explain_reasoning": "POST /nyaya/explain_reasoning",
            "feedback": "POST /nyaya/feedback",
            "trace": "GET /nyaya/trace/{trace_id}",
            "health": "GET /health",
            "docs": "GET /docs"
        }
    }

if __name__ == "__main__":
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )