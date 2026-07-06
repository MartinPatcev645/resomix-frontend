"""
Spotify Transfer API Router
============================

This module defines the FastAPI router for Spotify playlist transfer endpoints.
It handles HTTP requests for transferring Resomix playlists to Spotify
with OAuth authentication and comprehensive validation.

Provides RESTful API endpoints for Spotify integration functionality
of the Resomix audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.spotify_transfer_controller import SpotifyTransferController
from app.controllers.spotify_app_controller import SpotifyAppController
from app.api.dependencies.auth import get_current_user
from app.api.dependencies.partner import get_public_partner
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.spotify_transfer import (
    SpotifyTransferRequest,
    SpotifyTransferResponse,
    SpotifyTransferErrorResponse
)
from app.schemas.spotify_app import UserSpotifyAppClientIdResponse

router = APIRouter(
    prefix="/spotify",
    tags=["spotify-transfer"],
    responses={
        401: {"model": SpotifyTransferErrorResponse},
        404: {"model": SpotifyTransferErrorResponse},
        422: {"model": SpotifyTransferErrorResponse},
        500: {"model": SpotifyTransferErrorResponse}
    }
)

# Initialize controllers
spotify_transfer_controller = SpotifyTransferController()
spotify_app_controller = SpotifyAppController()


@router.post(
    "/transfer-playlist/",
    response_model=SpotifyTransferResponse,
    summary="Transfer Playlist to Spotify",
    description="Transfer a Resomix playlist to user's Spotify account. Requires OAuth access token from frontend.",
    responses={
        200: {
            "model": SpotifyTransferResponse,
            "description": "Playlist transferred successfully to Spotify"
        },
        401: {
            "model": SpotifyTransferErrorResponse,
            "description": "Invalid or expired Spotify access token"
        },
        404: {
            "model": SpotifyTransferErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": SpotifyTransferErrorResponse,
            "description": "Invalid request data or playlist has no tracks"
        },
        500: {
            "model": SpotifyTransferErrorResponse,
            "description": "Internal server error during transfer"
        }
    }
)
async def transfer_playlist_to_spotify_endpoint(
    request: Request,
    request_data: SpotifyTransferRequest,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Transfer a Resomix playlist to user's Spotify account.
    
    This endpoint takes a Resomix playlist and creates an equivalent playlist
    in the user's Spotify account. It searches for each track on Spotify
    and adds the best matches to the new playlist.
    
    **Requirements:**
    - User must be authenticated (JWT token required)
    - User must be associated with a Spotify app (admin setup required)
    
    **Process:**
    1. Validates the playlist exists and has tracks
    2. Checks user's Spotify app association
    3. Authenticates with Spotify using the provided access token
    4. Creates a new playlist in user's Spotify account
    5. Searches for each track on Spotify using title and artist
    6. Adds found tracks to the Spotify playlist
    7. Returns summary of transfer results
    
    **OAuth Flow:**
    The frontend should:
    1. Call GET /spotify/app-client-id (authenticated) to get client_id
    2. Use that client_id for Spotify OAuth PKCE flow
    3. Provide the access token in this request
    
    Required Spotify scopes: `playlist-modify-public` or `playlist-modify-private`
    
    **Parameters:**
    - **playlist_id**: The UUID of the Resomix playlist to transfer
    - **access_token**: Valid Spotify OAuth access token from user
    - **playlist_name**: Optional custom name for the Spotify playlist
    
    **Returns:**
    - Success: Spotify playlist details and transfer statistics
    - Error: Detailed error message and context
    """
    return await spotify_transfer_controller.transfer_playlist_to_spotify(
        db,
        request,
        request_data.playlist_id, 
        request_data.access_token,
        custom_playlist_name=request_data.playlist_name,
        current_user=current_user
    )


@router.get(
    "/app-client-id",
    response_model=UserSpotifyAppClientIdResponse,
    summary="Get User's Spotify App Client ID",
    description="Get the Spotify app client_id associated with a user for OAuth flow. Returns None if user has no association.",
    responses={
        200: {
            "model": UserSpotifyAppClientIdResponse,
            "description": "Client ID retrieved (may be None if no association)"
        },
        404: {
            "model": UserSpotifyAppClientIdResponse,
            "description": "User not found or no association"
        }
    }
)
async def get_user_spotify_app_client_id(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Get the Spotify app client_id for the authenticated user's associated app.
    
    This endpoint is used by the frontend to determine which Spotify app
    client_id to use for the OAuth flow. Users must be associated with
    a Spotify app by an admin before they can use Spotify transfer.
    
    **Requirements:**
    - User must be authenticated (JWT token required)
    
    **Returns:**
    - If user has association: client_id and app_name
    - If no association: None values with helpful message
    
    **Note:** Users can only check their own association status.
    """
    return await spotify_app_controller.get_user_spotify_app_client_id(
        db=db,
        request=request,
        user_identifier=current_user.uuid,
    )
