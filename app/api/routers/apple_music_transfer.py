"""
Apple Music Transfer API Router
===============================

This module defines the FastAPI router for Apple Music playlist transfer endpoints.
It handles HTTP requests for transferring Resomix playlists to Apple Music
with developer token generation and comprehensive validation.

Provides RESTful API endpoints for Apple Music integration functionality
of the Resomix audio similarity system.

Version: 3.0.1
Init Date: December 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.apple_music_transfer_controller import AppleMusicTransferController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.apple_music_transfer import (
    AppleMusicTransferRequest,
    AppleMusicTransferResponse,
    AppleMusicTransferErrorResponse,
    AppleMusicDeveloperTokenResponse
)

router = APIRouter(
    prefix="/apple-music",
    tags=["apple-music-transfer"],
    responses={
        401: {"model": AppleMusicTransferErrorResponse},
        404: {"model": AppleMusicTransferErrorResponse},
        422: {"model": AppleMusicTransferErrorResponse},
        500: {"model": AppleMusicTransferErrorResponse}
    }
)

# Initialize controller
apple_music_transfer_controller = AppleMusicTransferController()


@router.get(
    "/developer-token/",
    response_model=AppleMusicDeveloperTokenResponse,
    summary="Get Apple Music Developer Token",
    description="Generate or retrieve cached Apple Music developer token (JWT ES256)."
)
async def get_developer_token_endpoint(
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get or generate Apple Music developer token.
    
    This endpoint generates a JWT token for Apple Music API access.
    The token is cached and regenerated if expiring within 5 minutes.
    
    **Returns:**
    - token: JWT developer token
    - expires_at: Expiration timestamp in milliseconds
    """
    return await apple_music_transfer_controller.get_developer_token()


@router.post(
    "/transfer-playlist/",
    response_model=AppleMusicTransferResponse,
    summary="Transfer Playlist to Apple Music",
    description="Transfer a Resomix playlist to user's Apple Music library. Requires user token from MusicKit.",
    responses={
        200: {
            "model": AppleMusicTransferResponse,
            "description": "Playlist transferred successfully to Apple Music"
        },
        401: {
            "model": AppleMusicTransferErrorResponse,
            "description": "Invalid or expired Apple Music user token"
        },
        404: {
            "model": AppleMusicTransferErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": AppleMusicTransferErrorResponse,
            "description": "Invalid request data or playlist has no tracks"
        },
        500: {
            "model": AppleMusicTransferErrorResponse,
            "description": "Internal server error during transfer"
        }
    }
)
async def transfer_playlist_to_apple_music_endpoint(
    request: Request,
    request_data: AppleMusicTransferRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Transfer a Resomix playlist to user's Apple Music library.
    
    This endpoint takes a Resomix playlist and creates an equivalent playlist
    in the user's Apple Music library. It searches for each track on Apple Music
    (by ISRC if available, or by title+artist) and adds the best matches.
    
    **Process:**
    1. Validates the playlist exists and has tracks
    2. Generates or uses provided developer token
    3. Creates a new playlist in user's Apple Music library
    4. Searches for each track on Apple Music (ISRC first, then title+artist)
    5. Adds found tracks to the Apple Music playlist
    6. Returns summary of transfer results
    
    **Authentication:**
    - Developer token: Generated automatically if not provided
    - User token: Required from frontend (MusicKit.authorize())
    
    **Parameters:**
    - **playlist_id**: The UUID of the Resomix playlist to transfer
    - **music_user_token**: Apple Music User Token from MusicKit
    - **developer_token**: Optional (backend will generate if missing)
    - **playlist_name**: Optional custom name for the Apple Music playlist
    
    **Returns:**
    - Success: Apple Music playlist details and transfer statistics
    - Error: Detailed error message and context
    """
    return await apple_music_transfer_controller.transfer_playlist_to_apple_music(
        db,
        request,
        request_data.playlist_id, 
        request_data.music_user_token,
        developer_token=request_data.developer_token,
        custom_playlist_name=request_data.playlist_name
    )
