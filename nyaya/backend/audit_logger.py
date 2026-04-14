"""
audit_logger.py — Structured JSON audit log for every transaction.
Attaches to FastAPI as middleware. Writes one log line per request.
"""
import json
import time
import logging
from datetime import datetime, timezone
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

_audit_logger = logging.getLogger("nyaya.audit")
_audit_logger.setLevel(logging.INFO)

if not _audit_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _audit_logger.addHandler(_handler)


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Emits one structured JSON audit record per HTTP transaction.
    Fields: trace_id, method, path, status, duration_ms, formatted_flag,
            observer_triggered, schema_valid, origin, timestamp.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - t0) * 1000, 2)

        trace_id = getattr(request.state, "trace_id", "unknown")

        # Read response body to inspect pipeline flags (non-destructive)
        body_bytes = b""
        async for chunk in response.body_iterator:
            body_bytes += chunk

        formatted_flag = False
        observer_triggered = False
        schema_valid = False

        try:
            body = json.loads(body_bytes)
            formatted_flag = bool(body.get("metadata", {}).get("Formatted", False))
            observer_triggered = "observation" in body or "observer_pipeline" in str(
                body.get("reasoning_trace", {})
            )
            # Schema valid if Formatted is True and trace_id present
            schema_valid = formatted_flag and bool(body.get("trace_id"))
        except Exception:
            pass

        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "trace_id": trace_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "origin": request.headers.get("origin", ""),
            "formatted": formatted_flag,
            "observer_triggered": observer_triggered,
            "schema_valid": schema_valid,
        }
        _audit_logger.info(json.dumps(record))

        # Rebuild response with consumed body
        from starlette.responses import Response as StarletteResponse
        return StarletteResponse(
            content=body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
