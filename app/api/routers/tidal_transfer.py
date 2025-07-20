"""
Tidal Transfer API Router
=========================

This module defines the FastAPI router for Tidal playlist transfer endpoints.
It handles HTTP requests for transferring ResomiX playlists to Tidal
with OAuth authentication and comprehensive validation.

Provides RESTful API endpoints for Tidal integration functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.tidal_transfer_controller import TidalTransferController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.tidal_transfer import (
    TidalTransferRequest,
    TidalTransferResponse,
    TidalTransferErrorResponse
)

router = APIRouter(
    prefix="/tidal",
    tags=["tidal-transfer"],
    responses={
        401: {"model": TidalTransferErrorResponse},
        404: {"model": TidalTransferErrorResponse},
        422: {"model": TidalTransferErrorResponse},
        429: {"model": TidalTransferErrorResponse},
        500: {"model": TidalTransferErrorResponse}
    }
)

# Initialize controller
tidal_transfer_controller = TidalTransferController()


@router.post(
    "/transfer-playlist/",
    response_model=TidalTransferResponse,
    summary="Transfer Playlist to Tidal",
    description="Transfer a ResomiX playlist to user's Tidal account. Requires OAuth access token from frontend.",
    responses={
        200: {
            "model": TidalTransferResponse,
            "description": "Playlist transferred successfully to Tidal"
        },
        401: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid or expired Tidal access token"
        },
        404: {
            "model": TidalTransferErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid request data or playlist has no tracks"
        },
        429: {
            "model": TidalTransferErrorResponse,
            "description": "Tidal API rate limit exceeded"
        },
        500: {
            "model": TidalTransferErrorResponse,
            "description": "Internal server error during transfer"
        }
    }
)
async def transfer_playlist_to_tidal_endpoint(
    request_data: TidalTransferRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Transfer a ResomiX playlist to user's Tidal account.
    
    This endpoint takes a ResomiX playlist and creates an equivalent playlist
    in the user's Tidal account. It searches for each track on Tidal
    and adds the best matches to the new playlist.
    
    **Process:**
    1. Validates the playlist exists and has tracks
    2. Authenticates with Tidal using the provided access token
    3. Creates a new playlist in user's Tidal account
    4. Searches for each track on Tidal using title and artist
    5. Adds found tracks to the Tidal playlist
    6. Returns summary of transfer results
    
    **OAuth Flow:**
    The frontend should handle Tidal OAuth PKCE flow and provide the access token.
    Required Tidal scopes: `playlists.read` and `playlists.write`
    
    **Parameters:**
    - **playlist_id**: The UUID of the ResomiX playlist to transfer
    - **access_token**: Valid Tidal OAuth access token from user
    - **playlist_name**: Optional custom name for the Tidal playlist
    
    **Returns:**
    - Success: Tidal playlist details and transfer statistics
    - Error: Detailed error message and context
    
    **Note:**
    This integration uses both official Tidal API v2 for search operations
    and unofficial endpoints for playlist creation, as the official playlist
    write operations are not yet publicly available.
    """
    return await tidal_transfer_controller.transfer_playlist_to_tidal(
        db, 
        request_data.playlist_id, 
        request_data.access_token,
        custom_playlist_name=request_data.playlist_name
    ) 