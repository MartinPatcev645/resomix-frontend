"""
Telemetry API Router
====================

This module defines the FastAPI router for the stream telemetry sync endpoint.
It handles batched playback event ingestion from the frontend's heartbeat
and sendBeacon mechanisms.

Provides the POST /api/telemetry/sync endpoint for high-volume
stream telemetry batch synchronization.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.telemetry_controller import TelemetryController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.telemetry import (
    TelemetryBatch,
    TelemetrySyncResponse,
    TelemetryErrorResponse,
)

router = APIRouter(
    prefix="/api/telemetry",
    tags=["telemetry"],
    responses={
        422: {"model": TelemetryErrorResponse},
        500: {"model": TelemetryErrorResponse},
    },
)

# Initialize controller
telemetry_controller = TelemetryController()


@router.post(
    "/sync",
    response_model=TelemetrySyncResponse,
    summary="Sync Telemetry Events",
    description=(
        "Accept a batch of stream telemetry events from the frontend. "
        "Events are enqueued into Redis for async processing and persisted "
        "to the consumption_events table by a background worker. "
        "Returns 200 OK immediately to avoid blocking the frontend."
    ),
    responses={
        200: {
            "model": TelemetrySyncResponse,
            "description": "Events accepted for processing",
        },
        422: {
            "model": TelemetryErrorResponse,
            "description": "Invalid payload (validation error)",
        },
    },
)
async def sync_telemetry_endpoint(
    request: Request,
    payload: TelemetryBatch,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    """
    Sync stream telemetry events from the frontend audio player.

    The frontend batches playback events (stream_start, stream_complete,
    stream_skip, download_success) and sends them via:
    - **30-second heartbeat**: Regular Axios POST with JSON body
    - **Tab close**: navigator.sendBeacon with JSON body

    This endpoint accepts the batch, enqueues to Redis, and returns
    200 OK as fast as possible. A background worker processes the
    queue every 2 minutes and bulk-inserts into consumption_events.

    - **events**: Array of 1-500 telemetry event objects
    - **Authentication**: API key required. User identity comes from event payload.

    No JWT required — anonymous users generate telemetry events too.
    """
    return await telemetry_controller.sync_telemetry(db, request, payload)
