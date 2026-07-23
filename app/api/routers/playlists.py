"""
Playlist API Router
===================

This module defines the FastAPI router for playlist management endpoints.
It handles HTTP requests for playlist operations including rename, visibility changes,
and similarity data retrieval with authentication and validation.

Provides RESTful API endpoints for playlist management functionality
of the Resomix audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Depends, File, Request, status, Query, Path, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.utils.response_utils import format_response
from app.controllers.playlist_controller import PlaylistController
from app.api.dependencies.auth import get_current_user_optional, get_current_user
from app.api.dependencies.partner import get_current_partner, get_public_partner
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.models.partner import Partner
from app.schemas.playlist import (
    PlaylistRenameRequest,
    PlaylistVisibilityRequest,
    PlaylistOperationResponse,
    PlaylistErrorResponse,
    PlaylistSimilarityResponse,
    PlaylistForkResponse,
    UserPlaylistsResponse,
    UserPlaylistsFilters
)

router = APIRouter(
    prefix="/playlists",
    tags=["playlists"],
    responses={
        404: {"model": PlaylistErrorResponse},
        422: {"model": PlaylistErrorResponse},
        500: {"model": PlaylistErrorResponse}
    }
)



# Initialize controller
playlist_controller = PlaylistController()


@router.put(
    "/rename/",
    response_model=PlaylistOperationResponse,
    summary="Rename Playlist",
    description="Rename one of your own playlists by its UUID. Requires login.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist renamed successfully"
        },
        401: {
            "model": PlaylistErrorResponse,
            "description": "Authentication required"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found or not owned by the user"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID or name"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def rename_playlist_endpoint(
    request: Request,
    request_data: PlaylistRenameRequest,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Rename a playlist by its UUID.

    - **playlist_id**: The UUID of the playlist to rename
    - **new_name**: The new name for the playlist (1-150 characters)

    Requires a logged-in user (JWT). Only the playlist's owner may rename it — another
    user's (or a nonexistent) playlist returns 404.
    """
    return await playlist_controller.rename_playlist(db, request, request_data.playlist_id, request_data.new_name, current_user)


@router.put(
    "/visibility/",
    response_model=PlaylistOperationResponse,
    summary="Change Playlist Visibility (Share / Make Public)",
    description="Make one of your own playlists public (shared) or private by its UUID. Requires login.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist visibility changed successfully"
        },
        401: {
            "model": PlaylistErrorResponse,
            "description": "Authentication required"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found or not owned by the user"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def change_playlist_visibility_endpoint(
    request: Request,
    request_data: PlaylistVisibilityRequest,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Change playlist visibility (public/private) by its UUID — used to share a playlist
    (make it public) or make it private again.

    - **playlist_id**: The UUID of the playlist to modify
    - **is_public**: Whether the playlist should be public (true) or private (false)

    Requires a logged-in user (JWT). Only the playlist's owner may change its visibility —
    another user's (or a nonexistent) playlist returns 404. Logged-out sessions cannot
    call this (their playlists are public by default).
    """
    return await playlist_controller.change_playlist_visibility(db, request, request_data.playlist_id, request_data.is_public, current_user)


@router.delete(
    "/{playlist_id}",
    response_model=PlaylistOperationResponse,
    summary="Delete Playlist",
    description="Soft-delete one of your own playlists by its UUID. Requires login.",
    responses={
        200: {"model": PlaylistOperationResponse, "description": "Playlist deleted successfully"},
        401: {"model": PlaylistErrorResponse, "description": "Authentication required"},
        404: {"model": PlaylistErrorResponse, "description": "Playlist not found or not owned by the user"},
        500: {"model": PlaylistErrorResponse, "description": "Internal server error"},
    },
)
async def delete_playlist_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="UUID of the playlist to delete"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Soft-delete a playlist by its UUID.

    Requires a logged-in user (JWT). Only the playlist's owner may delete it — another
    user's (or a nonexistent / already-deleted) playlist returns 404. The playlist is
    hidden from all user-facing lists and frees a slot against the playlist quota; the row
    is retained server-side. Deletion is idempotent (a second delete returns 404).
    """
    return await playlist_controller.delete_playlist(db, request, playlist_id, current_user)


# Max cover upload size (bytes) — kept in sync with the frontend's 3 MB limit. The frontend crops to
# a square before sending, so the received file is typically much smaller; this is the hard ceiling.
_MAX_COVER_BYTES = 3 * 1024 * 1024


def _sniff_image_type(data: bytes) -> Optional[str]:
    """Magic-byte content-type sniff (don't trust the client-declared type). JPEG or PNG only —
    the media server does the deeper image validation (square / resolution) with Pillow."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return None


@router.post(
    "/{playlist_uuid}/cover",
    summary="Upload a custom playlist cover",
    description="Owner-only. Upload a square JPEG/PNG (≤ 3 MB) to use as the playlist's cover.",
)
async def upload_playlist_cover_endpoint(
    playlist_uuid: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),  # establishes the partner context (tenancy failsafe)
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """Basic gate here (size + magic-byte type + optional ClamAV, and the owner check in the
    service); the media server enforces the image dimensions and stores it by playlist uuid."""
    # Size guard — read at most one byte past the limit so an oversized file is rejected without
    # buffering the whole thing.
    data = await file.read(_MAX_COVER_BYTES + 1)
    if not data:
        return JSONResponse(status_code=400, content=format_response(success=False, error="The uploaded file is empty."))
    if len(data) > _MAX_COVER_BYTES:
        return JSONResponse(status_code=413, content=format_response(success=False, error="Image must be 3 MB or smaller."))

    content_type = _sniff_image_type(data)
    if content_type is None:
        return JSONResponse(status_code=400, content=format_response(success=False, error="Only JPEG or PNG images are allowed."))

    result = await playlist_controller.playlist_service.upload_custom_cover(
        db, playlist_uuid, current_user.id, data, content_type
    )
    if result.get("success"):
        return JSONResponse(status_code=200, content=format_response(success=True, data={"has_custom_cover": True}))
    return JSONResponse(
        status_code=result.get("status", 400),
        content=format_response(success=False, error=result.get("error", "Failed to upload cover.")),
    )


@router.get(
    "/similarity/{playlist_id}",
    response_model=PlaylistSimilarityResponse,
    summary="Get Playlist Similarity Data",
    description="Get playlist with similarity data formatted like similarity endpoints. Only public playlists can be accessed.",
    responses={
        200: {
            "model": PlaylistSimilarityResponse,
            "description": "Playlist similarity data retrieved successfully"
        },
        403: {
            "model": PlaylistErrorResponse,
            "description": "Playlist is not public"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_playlist_similarity_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Get playlist with similarity data formatted like similarity endpoints.
    
    Returns the same format as similarity endpoints including queried track,
    similar tracks with scores, and playlist information.
    
    - **playlist_id**: The UUID of the playlist to retrieve
    
    Note: JWT authenticated users can access their own private playlists.
    """
    return await playlist_controller.get_playlist_similarity_data(db, request, playlist_id, current_user)


@router.post(
    "/fork/{playlist_id}",
    response_model=PlaylistForkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Fork a Public Playlist",
    description="Create a copy of a public playlist. Requires authentication.",
    responses={
        201: {
            "model": PlaylistForkResponse,
            "description": "Playlist forked successfully"
        },
        400: {
            "model": PlaylistErrorResponse,
            "description": "User already owns this playlist"
        },
        401: {
            "model": PlaylistErrorResponse,
            "description": "Authentication required"
        },
        403: {
            "model": PlaylistErrorResponse,
            "description": "Playlist is private and cannot be forked"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def fork_playlist_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Fork (copy) a public playlist to your account.
    
    Creates a new playlist with:
    - Same name, tracks, and seed track as original
    - Owned by the authenticated user
    - Private visibility by default
    - Reset track positions (1.0, 2.0, 3.0, etc.)
    - Links back to original via fork_id
    
    **Requirements**:
    - User must be authenticated (JWT token required)
    - Original playlist must be public
    - User cannot fork their own playlists
    
    **Notes**:
    - Forked playlists maintain same track order but reset decimal positions
    - Original playlist's fork_count is incremented
    - created_at timestamp preserved from original
    
    - **playlist_id**: The UUID of the public playlist to fork
    
    Returns the forked playlist in the same format as the similarity endpoint.
    """
    return await playlist_controller.fork_playlist(db, request, playlist_id, current_user)


@router.get(
    "/similarity-hls/{playlist_id}.m3u8",
    summary="Get Playlist as HLS M3U8",
    description="Get playlist as HLS M3U8 format for audio streaming. Only public playlists can be accessed.",
    responses={
        200: {
            "description": "M3U8 playlist generated successfully",
            "content": {
                "application/vnd.apple.mpegurl": {
                    "example": "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-TARGETDURATION:556\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:420.000,Artist - Track Title\nhttps://media.resomix.com/signed-audio/?uuid=track-uuid&exp=1234567890&sig=signature\n#EXT-X-DISCONTINUITY\n..."
                }
            }
        },
        403: {
            "model": PlaylistErrorResponse,
            "description": "Playlist is not public"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_playlist_hls_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),  # sets request.state.partner_id
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get playlist as HLS M3U8 format for audio streaming.
    
    Returns an M3U8 playlist file with signed URLs for each track in the playlist.
    Each track is treated as a single segment with EXT-X-DISCONTINUITY between tracks.
    
    **Features:**
    - EXT-X-TARGETDURATION set to ceiling of longest track duration
    - Signed URLs with expiration for secure access
    - CORS headers for web player compatibility
    - Track metadata in EXTINF tags
    
    **Security:**
    - Only public playlists can be accessed (unless JWT authenticated for own playlists)
    - All media URLs are signed with expiration
    - API key authentication required
    
    - **playlist_id**: The UUID of the playlist to convert to M3U8
    
    Note: JWT authenticated users can access their own private playlists.
    """
    return await playlist_controller.get_playlist_hls_data(db, request, playlist_id, current_user)


@router.get(
    "/get-all-playlists/",
    response_model=UserPlaylistsResponse,
    summary="Get All User Playlists",
    description="Get a list of all playlists owned by the authenticated user.",
    responses={
        200: {
            "model": UserPlaylistsResponse,
            "description": "User playlists retrieved successfully"
        },
        401: {
            "model": PlaylistErrorResponse,
            "description": "Authentication required"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_all_user_playlists_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search over playlist name OR uuid (case-insensitive, partial)"),
    play_time: Optional[str] = Query(None, description="Play time filter: 'lt1h', '1-3h', '3-6h', '6-9h', 'gt9h'"),
    num_tracks: Optional[int] = Query(None, description="Minimum number of tracks (>=): 10, 20, 50, or 100"),
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    is_public: Optional[bool] = Query(None, description="Visibility filter: true for public, false for private"),
    own_favorites: Optional[bool] = Query(None, description="Show only favorites owned by user"),
    all_favorites: Optional[bool] = Query(None, description="Show all favorited playlists including ones user doesn't own")
) -> JSONResponse:
    """
    Get a list of all playlists owned by the authenticated user with optional filters.
    
    Returns all playlists (both public and private) that belong to the authenticated user.
    Each playlist includes basic information and engagement status.
    
    **Requirements**:
    - User must be authenticated (JWT token required)
    
    **Filters** (all optional, can be stacked):
    - **search**: Match playlist name OR uuid (case-insensitive, partial)
    - **play_time**: Filter by total play time ('lt1h', '1-3h', '3-6h', '6-9h', 'gt9h')
    - **num_tracks**: Minimum number of tracks (>=): 10, 20, 50, 100
    - **start_date**: Filter playlists created on or after this date (YYYY-MM-DD)
    - **end_date**: Filter playlists created on or before this date (YYYY-MM-DD)
    - **is_public**: Filter by visibility (true for public, false for private)
    - **own_favorites**: If true, only return playlists user owns AND has favorited
    - **all_favorites**: If true, return all playlists user has favorited (including ones they don't own)
    
    **Returns**:
    - List of playlists with:
      - Playlist UUID, name, and visibility status
      - Fork information (if user owns a forked playlist)
      - Favorite and following status
    """
    filters = UserPlaylistsFilters(
        search=search,
        play_time=play_time,
        num_tracks=num_tracks,
        start_date=start_date,
        end_date=end_date,
        is_public=is_public,
        own_favorites=own_favorites,
        all_favorites=all_favorites
    )
    return await playlist_controller.get_all_user_playlists(db, request, current_user, page, page_size, filters)


@router.post(
    "/{playlist_id}/play-session",
    summary="Get Edge Authorization Playback Session",
    description="Evaluate territory restrictions and generate a signed JWT session token for gapless HLS playback.",
    responses={
        200: {
            "description": "Session generated successfully",
            "content": {
                "application/json": {
                    "example": {"playback_url": "https://media.resomix.com/playlists/similarity-hls/1234.m3u8?token=eyJ..."}
                }
            }
        },
        400: {
            "description": "Failed to generate session"
        },
        401: {
            "description": "Login required (frontend partner with no authenticated user)"
        }
    }
)
async def get_playlist_playback_session_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    """
    Generate an Edge Authorization JWT session token.

    This endpoint acts as the "Pre-Flight Check". It evaluates DDEX territory
    restrictions and takedowns for the playlist. If allowed, it mints a
    cryptographic JWT token that grants the client direct access to the
    Hetzner Edge Node for gapless HLS streaming without hitting the database again.

    For the frontend partner (partner_id=1), authentication is required.
    Returns 401 if the caller is not authenticated.
    Returns 404 if the playlist does not exist (e.g. stale link or wrong UUID).
    """
    return await playlist_controller.get_playlist_playback_session(
        request, db, playlist_id, partner_id=partner.id, current_user=current_user
    )
