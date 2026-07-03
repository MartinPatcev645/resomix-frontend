"""
Track API Router (User Library)
===============================

This module defines the FastAPI router for the user "library" page. It exposes the
authenticated user's own uploaded tracks: a paginated list, a single-track metadata
view, and a delete action.

All endpoints are behind the user auth gate (JWT required) and are scoped to the
authenticated user's own uploaded tracks and the partner tenant. Deletion is a soft
delete (the track is hidden, not physically purged).

Version: 3.0.1
Init Date: July 3, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_database_session
from app.api.dependencies.partner import get_current_partner
from app.controllers.track_controller import TrackController
from app.models.partner import Partner
from app.models.user import User
from app.schemas.track import (
    TrackDeleteResponse,
    TrackErrorResponse,
    UserTrackDetailResponse,
    UserTracksListResponse,
)

# Max page size for library listings — the library page never needs more than this.
MAX_PAGE_SIZE = 20

router = APIRouter(
    prefix="/tracks",
    tags=["tracks"],
    responses={
        401: {"model": TrackErrorResponse},
        404: {"model": TrackErrorResponse},
        422: {"model": TrackErrorResponse},
        500: {"model": TrackErrorResponse},
    },
)

# Initialize controller
track_controller = TrackController()


@router.get(
    "/my-tracks/",
    response_model=UserTracksListResponse,
    summary="List My Uploaded Tracks",
    description="Get a paginated list of the authenticated user's own uploaded tracks.",
    responses={
        200: {
            "model": UserTracksListResponse,
            "description": "User's uploaded tracks retrieved successfully",
        },
        401: {"model": TrackErrorResponse, "description": "Authentication required"},
        500: {"model": TrackErrorResponse, "description": "Internal server error"},
    },
)
async def get_my_tracks_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        MAX_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})",
    ),
) -> JSONResponse:
    """
    Get the authenticated user's own uploaded tracks, newest first.

    Returns a lightweight summary per track (title, artist, duration, BPM, key, genre,
    etc.) suitable for the library list. Only tracks the user uploaded are returned;
    soft-deleted tracks are excluded.

    **Requirements**: user must be authenticated (JWT token required).

    **Pagination**: `page` (1-based) and `page_size` (max 20). The response includes
    `total`, `page`, `page_size`, and `total_pages`.
    """
    return await track_controller.get_user_tracks(
        db, request, current_user, page, page_size
    )


@router.get(
    "/my-tracks/{track_uuid}",
    response_model=UserTrackDetailResponse,
    summary="View My Uploaded Track",
    description="Get full metadata for one of the authenticated user's own uploaded tracks.",
    responses={
        200: {
            "model": UserTrackDetailResponse,
            "description": "Track metadata retrieved successfully",
        },
        401: {"model": TrackErrorResponse, "description": "Authentication required"},
        404: {
            "model": TrackErrorResponse,
            "description": "Track not found or not owned by the user",
        },
        500: {"model": TrackErrorResponse, "description": "Internal server error"},
    },
)
async def get_my_track_endpoint(
    request: Request,
    track_uuid: str = Path(..., description="UUID of the track to view"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Get full metadata for a single owned track, including audio-file details and
    contributor credits. Returns 404 if the track does not exist or is not owned by
    the authenticated user.
    """
    return await track_controller.get_user_track(db, request, current_user, track_uuid)


@router.delete(
    "/my-tracks/{track_uuid}",
    response_model=TrackDeleteResponse,
    summary="Delete My Uploaded Track",
    description="Soft-delete one of the authenticated user's own uploaded tracks.",
    responses={
        200: {
            "model": TrackDeleteResponse,
            "description": "Track deleted (soft delete) successfully",
        },
        401: {"model": TrackErrorResponse, "description": "Authentication required"},
        404: {
            "model": TrackErrorResponse,
            "description": "Track not found or not owned by the user",
        },
        500: {"model": TrackErrorResponse, "description": "Internal server error"},
    },
)
async def delete_my_track_endpoint(
    request: Request,
    track_uuid: str = Path(..., description="UUID of the track to delete"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Soft-delete an owned track (sets `is_active=False`), removing it from the library
    and catalog. The row and storage assets are retained; physical purge is handled
    separately by the cleanup worker. Returns 404 if the track is not owned by the user
    or is already deleted.
    """
    return await track_controller.delete_user_track(
        db, request, current_user, track_uuid
    )
