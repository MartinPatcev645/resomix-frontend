"""
Admin Playlist API Router
==========================

This module defines the FastAPI router for admin playlist management endpoints.
It handles playlist CRUD, visibility, and export with RBAC.

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.playlist_controller import PlaylistController
from app.controllers.rating_controller import RatingController
from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.playlist import (
    AdminPlaylistListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminDeleteResponse,
    AdminPlaylistExportRequest,
    AdminPlaylistExportResponse,
    PlaylistErrorResponse,
    AdminPlaylistDetailResponse,
    AdminPlaylistVisibilityRequest,
    AdminPlaylistVisibilityResponse,
    AdminBatchVisibilityRequest,
    AdminBatchVisibilityResponse,
)

# Create router instance
router = APIRouter(
    prefix="/admin/playlist",
    tags=["admin-playlist"],
    responses={
        400: {"model": PlaylistErrorResponse},
        401: {"model": PlaylistErrorResponse},
        403: {"model": PlaylistErrorResponse},
        404: {"model": PlaylistErrorResponse},
        500: {"model": PlaylistErrorResponse},
    },
)

# Initialize controllers
playlist_controller = PlaylistController()
rating_controller = RatingController()


@router.get(
    "/",
    response_model=AdminPlaylistListResponse,
    status_code=200,
    summary="Get Paginated Playlist List",
    description="Get paginated playlist list with advanced filtering, searching, and sorting capabilities.",
)
async def get_playlist_list(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    search_column: Optional[str] = Query(None, description="Column to search in: id, uuid, name"),
    is_public: Optional[str] = Query(None, description="Filter by visibility: 0 (private), 1 (public)"),
    type: Optional[str] = Query(None, description="Filter by type: custom, similarity, waiting_segments"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("id", description="Column to sort by: id, created_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    """Get paginated playlist list with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ["id", "uuid", "name"]
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })

    # Validate is_public
    if is_public and is_public not in ["0", "1"]:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid is_public value. Must be '0' or '1'."
        })

    # Validate type
    if type and type not in ["custom", "similarity", "waiting_segments"]:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid type. Must be 'custom', 'similarity', or 'waiting_segments'."
        })

    filters = {
        "page": page,
        "page_size": page_size,
        "search": search,
        "search_column": search_column,
        "is_public": is_public,
        "type": type,
        "date_from": date_from,
        "date_to": date_to,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }
    return await playlist_controller.get_playlist_list_admin(db, request, filters, current_admin=current_admin)


@router.get(
    "/{uuid}",
    response_model=AdminPlaylistDetailResponse,
    status_code=200,
    summary="Get Playlist Details by UUID",
)
async def get_playlist_detail(
    request: Request,
    uuid: str = Path(..., description="Playlist UUID", regex="^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    """Get detailed playlist information by UUID."""
    return await playlist_controller.get_playlist_detail_by_uuid_admin(db, request, uuid, current_admin=current_admin)


@router.get(
    "/{uuid}/ratings",
    status_code=200,
    summary="Get Playlist Ratings (admin)",
    description="Full ratings breakdown for a playlist: playlist-level ratings (creator "
    "highlighted) + per-track thumb aggregates (plus/minus + the creator's own thumb).",
)
async def get_playlist_ratings(
    request: Request,
    uuid: str = Path(..., description="Playlist UUID", regex="^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    """Admin ratings view for a single playlist."""
    return await rating_controller.get_playlist_ratings_detail(db, request, uuid, current_admin=current_admin)


@router.delete(
    "/{playlist_id}",
    response_model=AdminDeleteResponse,
    status_code=200,
    summary="Delete Single Playlist",
)
async def delete_playlist(
    request: Request,
    playlist_id: int = Path(..., description="The ID of the playlist to delete", ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("playlist:manage"))
) -> JSONResponse:
    """Delete a single playlist entry."""
    return await playlist_controller.delete_playlist_admin(db, request, playlist_id, current_admin=current_admin)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    status_code=200,
    summary="Batch Delete Playlists",
)
async def batch_delete_playlist(
    request: Request,
    delete_request: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("playlist:manage"))
) -> JSONResponse:
    """Delete multiple playlist entries."""
    return await playlist_controller.batch_delete_playlist_admin(db, request, delete_request.ids, current_admin=current_admin)


@router.post(
    "/export",
    response_model=AdminPlaylistExportResponse,
    status_code=200,
    summary="Export Playlists to CSV",
)
async def export_playlist(
    request: Request,
    export_request: AdminPlaylistExportRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("reports:view"))
) -> JSONResponse:
    """Export playlists to CSV."""
    if export_request.format != "csv":
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid format. Only 'csv' is supported."})
    
    filters = export_request.dict(exclude_none=True)
    return await playlist_controller.export_playlist_csv_admin(db, request, filters, current_admin=current_admin)


@router.patch(
    "/{playlist_id}/visibility",
    response_model=AdminPlaylistVisibilityResponse,
    status_code=200,
    summary="Change Single Playlist Visibility",
)
async def change_playlist_visibility(
    request: Request,
    visibility_request: AdminPlaylistVisibilityRequest,
    playlist_id: int = Path(..., description="Playlist ID", ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("playlist:manage"))
) -> JSONResponse:
    """Change playlist visibility by ID."""
    return await playlist_controller.change_playlist_visibility_admin(
        db, request, playlist_id, visibility_request.is_public, current_admin=current_admin
    )


@router.post(
    "/batch-visibility",
    response_model=AdminBatchVisibilityResponse,
    status_code=200,
    summary="Batch Change Playlist Visibility",
)
async def batch_change_playlist_visibility(
    request: Request,
    visibility_request: AdminBatchVisibilityRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("playlist:manage"))
) -> JSONResponse:
    """Change visibility for multiple playlists."""
    return await playlist_controller.batch_change_playlist_visibility_admin(
        db, request, visibility_request.ids, visibility_request.is_public, current_admin=current_admin
    )
