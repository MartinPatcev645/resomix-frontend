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

from fastapi import APIRouter, Security, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.playlist_controller import PlaylistController
from app.api.dependencies.auth import get_api_key, get_current_user_optional, get_current_user
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.playlist import (
    PlaylistRenameRequest,
    PlaylistVisibilityRequest,
    PlaylistOperationResponse,
    PlaylistErrorResponse,
    PlaylistSimilarityResponse,
    PlaylistForkResponse
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
    description="Rename a playlist by its UUID.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist renamed successfully"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
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
    api_key: str = Security(get_api_key),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Rename a playlist by its UUID.
    
    - **playlist_id**: The UUID of the playlist to rename
    - **new_name**: The new name for the playlist (1-150 characters)
    
    Note: JWT authenticated users are automatically associated with their playlists.
    """
    return await playlist_controller.rename_playlist(db, request, request_data.playlist_id, request_data.new_name, current_user)


@router.put(
    "/visibility/",
    response_model=PlaylistOperationResponse,
    summary="Change Playlist Visibility",
    description="Make a playlist public or private by its UUID.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist visibility changed successfully"
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
async def change_playlist_visibility_endpoint(
    request: Request,
    request_data: PlaylistVisibilityRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Change playlist visibility (public/private) by its UUID.
    
    - **playlist_id**: The UUID of the playlist to modify
    - **is_public**: Whether the playlist should be public (true) or private (false)
    
    Note: JWT authenticated users are automatically associated with their playlists.
    """
    return await playlist_controller.change_playlist_visibility(db, request, request_data.playlist_id, request_data.is_public, current_user)


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
    api_key: str = Security(get_api_key),
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
    api_key: str = Security(get_api_key),
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
    api_key: str = Security(get_api_key),
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

