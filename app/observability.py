import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.utils.file_logger import FileLogger
from app.utils.system_metrics import snapshot

# Initialize single file logger instance
file_logger = FileLogger("timing.txt")

SLOW_REQUEST_THRESHOLD = 0.5  # seconds


class TimingMiddleware(BaseHTTPMiddleware):
    """Middleware that measures processing time for each request.

    * Adds an ``X-Process-Time`` response header formatted in seconds (``0.123s``)
    * Logs every request with method, path, status and duration at ``INFO`` level
    * Logs *slow* requests (duration > ``SLOW_REQUEST_THRESHOLD``) at ``WARNING`` level
    * Logs *failed* requests (status >= 500) at ``ERROR`` level
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:  # type: ignore[override]
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            # If an unhandled exception bubbles up, log it and re-raise so existing exception
            # handlers can take over.
            dur = time.perf_counter() - start
            file_logger.error(f"{request.method} {request.url.path} ERROR {dur:.3f}s {exc}")
            raise

        dur = time.perf_counter() - start
        # Add header for clients / upstream services
        response.headers["X-Process-Time"] = f"{dur:.3f}s"

        # Decide log level based on duration and status
        metrics = snapshot()
        line = (
            f"{request.method} {request.url.path} {response.status_code} {dur:.3f}s "
            f"CPU={metrics['cpu_percent']}% MEM={metrics['mem_percent']}% "
            f"NET_sent={metrics['net_bytes_sent']} NET_recv={metrics['net_bytes_recv']} "
            f"PROC_CPU={metrics['proc_cpu_percent']}% PROC_RSS={metrics['proc_rss']}"
        )

        if response.status_code >= 500:
            file_logger.error(line)
            # Safety net: persist every 5xx to the DB system logs so no server error is ever
            # missing from the admin Logs page. This catches the common pattern where a
            # controller CATCHES the exception and RETURNS a 500 itself — those bypass the
            # global exception handlers and would otherwise vanish. Unhandled exceptions never
            # reach here (they are re-raised above and logged by general_exception_handler).
            # Skip if the request was already error-logged upstream to avoid duplicate entries.
            if not getattr(request.state, "_db_error_logged", False):
                try:
                    from app.services.logging_service import LoggingService

                    LoggingService().log(
                        level="ERROR",
                        category="ERROR",
                        action="http_5xx_response",
                        message=(
                            f"{request.method} {request.url.path} returned "
                            f"{response.status_code}"
                        ),
                        request=request,
                        status_code=response.status_code,
                        duration_ms=dur * 1000,
                    )
                except Exception as exc:  # never let logging break the response
                    file_logger.error(f"Failed to persist 5xx to system logs: {exc}")
        elif dur > SLOW_REQUEST_THRESHOLD:
            file_logger.warning(line)
        else:
            file_logger.info(line)
        return response
