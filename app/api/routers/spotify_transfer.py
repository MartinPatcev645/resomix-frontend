"""
Spotify Transfer API Router
============================

This module defines the FastAPI router for Spotify playlist transfer endpoints.
It handles HTTP requests for transferring ResomiX playlists to Spotify
with OAuth authentication and comprehensive validation.

Provides RESTful API endpoints for Spotify integration functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.spotify_transfer_controller import SpotifyTransferController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.spotify_transfer import (
    SpotifyTransferRequest,
    SpotifyTransferResponse,
    SpotifyTransferErrorResponse
)

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

# Initialize controller
spotify_transfer_controller = SpotifyTransferController()


@router.post(
    "/transfer-playlist/",
    response_model=SpotifyTransferResponse,
    summary="Transfer Playlist to Spotify",
    description="Transfer a ResomiX playlist to user's Spotify account. Requires OAuth access token from frontend.",
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
    request_data: SpotifyTransferRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Transfer a ResomiX playlist to user's Spotify account.
    
    This endpoint takes a ResomiX playlist and creates an equivalent playlist
    in the user's Spotify account. It searches for each track on Spotify
    and adds the best matches to the new playlist.
    
    **Process:**
    1. Validates the playlist exists and has tracks
    2. Authenticates with Spotify using the provided access token
    3. Creates a new playlist in user's Spotify account
    4. Searches for each track on Spotify using title and artist
    5. Adds found tracks to the Spotify playlist
    6. Returns summary of transfer results
    
    **OAuth Flow:**
    The frontend should handle Spotify OAuth and provide the access token.
    Required Spotify scopes: `playlist-modify-public` or `playlist-modify-private`
    
    **Parameters:**
    - **playlist_id**: The UUID of the ResomiX playlist to transfer
    - **access_token**: Valid Spotify OAuth access token from user
    - **playlist_name**: Optional custom name for the Spotify playlist
    
    **Returns:**
    - Success: Spotify playlist details and transfer statistics
    - Error: Detailed error message and context
    """
    return await spotify_transfer_controller.transfer_playlist_to_spotify(
        db, 
        request_data.playlist_id, 
        request_data.access_token,
        custom_playlist_name=request_data.playlist_name
    )
