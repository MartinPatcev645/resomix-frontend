import time
import uuid
import asyncio
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class PartnerAuditMiddleware(BaseHTTPMiddleware):
    """
    Writes one PartnerUsageLog row per authenticated partner request.
    Only fires when request.state.partner_id AND request.state.api_key_id
    are set (i.e., only after get_current_partner() succeeds).
    Consumer-facing requests are silently skipped.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()

        # Assign a correlation_id early so it can be read by route handlers
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        response = await call_next(request)

        latency_ms = round((time.perf_counter() - start) * 1000, 3)

        # Only log if this was a partner-authenticated request
        partner_id = getattr(request.state, "partner_id", None)
        api_key_id = getattr(request.state, "api_key_id", None)

        if partner_id and api_key_id:
            from fastapi import BackgroundTasks
            if response.background is None:
                response.background = BackgroundTasks()
            
            response.background.add_task(
                _write_audit_log,
                partner_id=partner_id,
                api_key_id=api_key_id,
                correlation_id=correlation_id,
                endpoint=request.url.path,
                method=request.method,
                status_code=response.status_code,
                latency_ms=latency_ms,
                client_ip=_get_ip(request),
                user_agent=request.headers.get("user-agent", "")[:500],
                error_code=response.headers.get("X-Error-Code"),
            )

        # Expose correlation_id to the client for support tracing
        response.headers["X-Correlation-ID"] = correlation_id
        return response


def _get_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _write_audit_log(**kwargs):
    """Fire-and-forget DB write using a fresh session."""
    try:
        from database.connection import AsyncSessionLocal
        from app.models.partner import PartnerUsageLog
        from app.core.context import set_current_partner_id
        from sqlalchemy import insert

        # Set the partner context for this background task so the SQL failsafe is satisfied
        set_current_partner_id(kwargs.get("partner_id"))

        async with AsyncSessionLocal() as session:
            await session.execute(insert(PartnerUsageLog).values(**kwargs))
            await session.commit()
    except Exception as e:
        logger.error(f"[PartnerAuditMiddleware] Failed to write audit log: {e}")
