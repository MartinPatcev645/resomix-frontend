"""
Admin Playlist API Router
==========================

This module defines the FastAPI router for admin playlist management endpoints.
It handles HTTP requests for playlist list, filtering, deletion, and export
with authentication for administrative operations.

Provides comprehensive admin panel endpoints for managing playlists
in the Resomix application.

Version: 1.0.0
Init Date: October 2, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.playlist_controller import PlaylistController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.playlist import (
    AdminPlaylistListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminDeleteResponse,
    AdminPlaylistExportRequest,
    AdminPlaylistExportResponse,
    PlaylistErrorResponse,
    AdminPlaylistDetailResponse
)

# Create router instance
router = APIRouter(
    prefix="/admin/playlist",
    tags=["admin-playlist"],
    responses={
        400: {"model": PlaylistErrorResponse},
        401: {"model": PlaylistErrorResponse},
        404: {"model": PlaylistErrorResponse},
        500: {"model": PlaylistErrorResponse}
    }
)

# Initialize controller
playlist_controller = PlaylistController()


@router.get(
    "/",
    response_model=AdminPlaylistListResponse,
    status_code=200,
    summary="Get Paginated Playlist List",
    description="Get paginated playlist list with advanced filtering, searching, and sorting capabilities."
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
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Get paginated playlist list with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'uuid', 'name']
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    # Validate sort_by
    ALLOWED_SORT_COLUMNS = ['id', 'created_at']
    if sort_by and sort_by not in ALLOWED_SORT_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid sort_by. Allowed values: {', '.join(ALLOWED_SORT_COLUMNS)}"
        })
    
    # Validate is_public
    if is_public and is_public not in ['0', '1']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid is_public value. Must be '0' or '1'."
        })
    
    # Validate type
    if type and type not in ['custom', 'similarity', 'waiting_segments']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid type. Must be 'custom', 'similarity', or 'waiting_segments'."
        })
    
    filters = {
        "page": page, "page_size": page_size, "search": search,
        "search_column": search_column, "is_public": is_public, "type": type,
        "date_from": date_from, "date_to": date_to,
        "sort_by": sort_by, "sort_order": sort_order
    }
    return await playlist_controller.get_playlist_list_admin(db, request, filters)


@router.get(
    "/{uuid}",
    response_model=AdminPlaylistDetailResponse,
    status_code=200,
    summary="Get Playlist Details by UUID",
    description="Get detailed playlist information including all tracks and metadata by UUID.",
    responses={
        400: {
            "model": PlaylistErrorResponse,
            "description": "Invalid UUID format"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        }
    }
)
async def get_playlist_detail(
    request: Request,
    uuid: str = Path(..., description="Playlist UUID", regex="^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get detailed playlist information by UUID.
    
    This endpoint retrieves complete playlist details including:
    - Playlist basic information (name, type, visibility, etc.)
    - Track count
    - Seed track details (if similarity playlist)
    - All tracks with complete metadata (artists, genre, label, album, etc.)
    - Track positions and similarity scores
    
    Returns detailed playlist data with all associated tracks ordered by position.
    """
    return await playlist_controller.get_playlist_detail_by_uuid_admin(db, request, uuid)


@router.delete(
    "/delete/{playlist_id}",
    response_model=AdminDeleteResponse,
    status_code=200,
    summary="Delete Single Playlist",
    description="Delete a single playlist by ID."
)
async def delete_playlist(
    request: Request,
    playlist_id: int = Path(..., description="The ID of the playlist to delete", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Delete a single playlist entry."""
    return await playlist_controller.delete_playlist_admin(db, request, playlist_id)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    status_code=200,
    summary="Batch Delete Playlists",
    description="Delete multiple playlists in a single request."
)
async def batch_delete_playlist(
    request: Request,
    delete_request: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Delete multiple playlist entries."""
    return await playlist_controller.batch_delete_playlist_admin(db, request, delete_request.ids)


@router.post(
    "/export",
    response_model=AdminPlaylistExportResponse,
    status_code=200,
    summary="Export Playlists to CSV",
    description="Export playlist data to CSV file with current filters and return download URL."
)
async def export_playlist(
    request: Request,
    export_request: AdminPlaylistExportRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Export playlists to CSV."""
    # Validate format
    if export_request.format != "csv":
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid format. Only 'csv' is supported."
        })
    
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'uuid', 'name']
    if export_request.search_column and export_request.search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    # Validate is_public
    if export_request.is_public and export_request.is_public not in ['0', '1']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid is_public value. Must be '0' or '1'."
        })
    
    # Validate type
    if export_request.type and export_request.type not in ['custom', 'similarity', 'waiting_segments']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid type. Must be 'custom', 'similarity', or 'waiting_segments'."
        })
    
    filters = export_request.dict()
    return await playlist_controller.export_playlist_csv_admin(db, request, filters) 