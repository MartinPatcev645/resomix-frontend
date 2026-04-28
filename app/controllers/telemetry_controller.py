"""
Telemetry Controller
====================

This controller handles HTTP requests for the stream telemetry sync endpoint.
It processes batched playback events from the frontend, enqueues them into
Redis for async processing, and returns a fast 200 OK response.

Follows the existing controller pattern: timing, correlation_id,
structured logging via LoggingService.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import time
import traceback

from app.services.telemetry_service import TelemetryService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.schemas.telemetry import TelemetryBatch


class TelemetryController:
    """Controller for stream telemetry sync HTTP requests."""

    def __init__(self):
        """Initialize telemetry controller with service dependencies."""
        self.telemetry_service = TelemetryService()
        self.logging_service = LoggingService()

    async def sync_telemetry(
        self,
        db: AsyncSession,
        request: Request,
        payload: TelemetryBatch,
    ) -> JSONResponse:
        """
        Accept a batch of telemetry events, enqueue to Redis, return 200 immediately.

        This is the hot path — no database access occurs here. Events are serialized
        and pushed to Redis for the background worker to process.

        If Redis is unavailable, falls back to a synchronous DB insert so that
        telemetry data is never silently dropped.

        Args:
            db: Database session (used only for fallback and logging)
            request: FastAPI request object
            payload: Validated TelemetryBatch from Pydantic

        Returns:
            JSONResponse with 200 OK and accepted event count
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            # Extract client IP for fraud analysis
            client_ip = request.client.host if request.client else None

            # Convert Pydantic models to dicts for serialization
            events_data = [event.model_dump() for event in payload.events]
            event_count = len(events_data)

            # Phase 1: Enqueue to Redis (fast path, no DB)
            result = await self.telemetry_service.enqueue_events(
                events=events_data,
                client_ip=client_ip,
            )

            if result["success"]:
                # Happy path: events queued to Redis
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="TELEMETRY",
                    action="sync_telemetry_success",
                    message=f"Accepted {result['accepted']} telemetry events into queue",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=client_ip,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=None,
                    duration_ms=duration_ms,
                    context="Telemetry batch enqueue",
                    metadata={
                        "accepted": result["accepted"],
                        "event_count": event_count,
                    },
                    operation="telemetry_sync",
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"accepted": result["accepted"]},
                    ),
                )
            else:
                # Redis unavailable — attempt synchronous fallback
                logger_msg = (
                    f"Redis enqueue failed: {result.get('error')}. "
                    f"Attempting synchronous DB fallback for {event_count} events."
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="TELEMETRY",
                    action="sync_telemetry_redis_fallback",
                    message=logger_msg,
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=client_ip,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    duration_ms=(time.time() - start_time) * 1000,
                    context="Telemetry Redis fallback",
                    metadata={
                        "error": result.get("error"),
                        "event_count": event_count,
                    },
                    operation="telemetry_sync",
                )

                # Fallback: Write directly to DB (slower but ensures no data loss)
                enriched_events = []
                for event in events_data:
                    enriched = {
                        **event,
                        "client_ip": client_ip,
                        "source_device": "web",
                    }
                    enriched_events.append(enriched)

                fallback_result = (
                    await self.telemetry_service.telemetry_repository.async_bulk_insert_events(
                        db, enriched_events
                    )
                )

                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO" if fallback_result["success"] else "ERROR",
                    category="TELEMETRY",
                    action="sync_telemetry_fallback_complete",
                    message=(
                        f"Fallback insert: inserted={fallback_result.get('inserted', 0)}, "
                        f"skipped={fallback_result.get('skipped', 0)}"
                    ),
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=client_ip,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    duration_ms=duration_ms,
                    context="Telemetry fallback insert",
                    metadata={
                        "inserted": fallback_result.get("inserted", 0),
                        "skipped": fallback_result.get("skipped", 0),
                        "errors": fallback_result.get("errors", []),
                    },
                    operation="telemetry_sync",
                )

                # Still return 200 — the frontend should never be blocked
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"accepted": fallback_result.get("inserted", 0)},
                    ),
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="TELEMETRY",
                action="sync_telemetry_exception",
                message=f"Unexpected error during telemetry sync: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Telemetry sync processing",
                metadata={
                    "exception_type": type(e).__name__,
                },
                operation="telemetry_sync",
            )

            # Even on internal error, return 200 to the frontend so it clears its queue.
            # The events are lost, but the alternative (returning 500) causes the
            # frontend to retry indefinitely and potentially DDOS the server.
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data={"accepted": 0},
                ),
            )
