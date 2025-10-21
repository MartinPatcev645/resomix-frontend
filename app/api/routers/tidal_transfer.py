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

from fastapi import APIRouter, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.controllers.tidal_transfer_controller import TidalTransferController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.tidal_transfer import (
    TidalTransferRequest,
    TidalTransferResponse,
    TidalTransferErrorResponse,
    TidalAuthRequest,
    TidalTokenRequest,
    TidalTokenResponse,
)
from app.core.exceptions import PublicHttpError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tidal",
    tags=["tidal-transfer"],
    responses={
        401: {"model": TidalTransferErrorResponse},
        404: {"model": TidalTransferErrorResponse},
        422: {"model": TidalTransferErrorResponse},
        429: {"model": TidalTransferErrorResponse},
        500: {"model": TidalTransferErrorResponse},
    },
)

# Initialize controller
tidal_transfer_controller = TidalTransferController()


@router.post(
    "/auth/token",
    response_model=TidalTokenResponse,
    summary="Exchange Authorization Code for Access Token",
    description="Exchange authorization code for Tidal access token. Handles token exchange server-side.",
    responses={
        200: {"model": TidalTokenResponse, "description": "Token exchange successful"},
        400: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid authorization code or parameters",
        },
        401: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid client credentials",
        },
    },
)
async def exchange_token(
    request: Request,
    request_data: TidalTokenRequest,
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    """
    Exchange authorization code for Tidal access token.

    This endpoint handles the server-side token exchange using the authorization
    code received from Tidal's OAuth callback. Client credentials are managed
    server-side for security.

    **Process:**
    1. Validates the authorization code and parameters
    2. Uses server-side client credentials for token exchange
    3. Exchanges code for access and refresh tokens
    4. Returns tokens to frontend (securely)

    **Security:**
    - Client secret used server-side only
    - PKCE code verifier validation
    - Secure token handling
    """
    debug = request.query_params.get("debug") == "1"
    try:
        result = await tidal_transfer_controller.exchange_authorization_code(
            request,
            request_data
        )
        return result
    except PublicHttpError as e:
        payload = {
            "success": False,
            "error": str(e),
            "code": e.code,
        }
        if debug and getattr(e, "details", None):
            payload["details"] = e.details
        return JSONResponse(status_code=e.status, content=payload)
    except Exception as e:
        logger.exception("Unhandled error in /tidal/auth/token")
        payload = {
            "success": False,
            "error": "Unexpected server error",
            "code": "UNHANDLED",
        }
        if debug:
            payload["details"] = {"cause": str(e)}
        return JSONResponse(status_code=500, content=payload)


@router.post(
    "/transfer-playlist/",
    response_model=TidalTransferResponse,
    summary="Transfer Playlist to Tidal",
    description="Transfer a ResomiX playlist to user's Tidal account. Requires OAuth access token from frontend.",
    responses={
        200: {
            "model": TidalTransferResponse,
            "description": "Playlist transferred successfully to Tidal",
        },
        401: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid or expired Tidal access token or insufficient permissions",
        },
        404: {"model": TidalTransferErrorResponse, "description": "Playlist not found"},
        422: {
            "model": TidalTransferErrorResponse,
            "description": "Invalid request data or playlist has no tracks",
        },
        429: {
            "model": TidalTransferErrorResponse,
            "description": "Tidal API rate limit exceeded",
        },
        500: {
            "model": TidalTransferErrorResponse,
            "description": "Internal server error during transfer",
        },
    },
)
async def transfer_playlist_to_tidal_endpoint(
    request: Request,
    request_data: TidalTransferRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    """
    Transfer a ResomiX playlist to user's Tidal account using official Tidal API v2 endpoints.

    This endpoint takes a ResomiX playlist and creates an equivalent playlist
    in the user's Tidal account. It searches for each track on Tidal
    and adds the best matches to the new playlist using only official endpoints.

    **Process:**
    1. Validates the playlist exists and has tracks
    2. Authenticates with Tidal using the provided access token
    3. Creates a new playlist in user's Tidal account (official API v2)
    4. Searches for each track on Tidal using title and artist
    5. Adds found tracks to the Tidal playlist (official API v2)
    6. Returns summary of transfer results

    **OAuth Flow:**
    The frontend should handle Tidal OAuth PKCE flow and provide the access token.
    Required Tidal scopes: `user.read playlists.read playlists.write`

    **Parameters:**
    - **playlist_id**: The UUID of the ResomiX playlist to transfer
    - **access_token**: Valid Tidal OAuth access token from user
    - **playlist_name**: Optional custom name for the Tidal playlist

    **Returns:**
    - Success: Tidal playlist details and transfer statistics
    - Error: Detailed error message and context

    **Note:**
    This integration uses only official Tidal API v2 endpoints for all playlist operations.
    """
    debug = request.query_params.get("debug") == "1"
    try:
        result = await tidal_transfer_controller.transfer_playlist_to_tidal(
            db,
            request,
            request_data.playlist_id,
            request_data.access_token,
            custom_playlist_name=request_data.playlist_name,
        )
        return result
    except PublicHttpError as e:
        payload = {
            "success": False,
            "error": str(e),
            "code": e.code,
        }
        if debug and getattr(e, "details", None):
            payload["details"] = e.details
        return JSONResponse(status_code=e.status, content=payload)
    except Exception as e:
        logger.exception("Unhandled error in /tidal/transfer-playlist")
        payload = {
            "success": False,
            "error": "Unexpected server error",
            "code": "UNHANDLED",
        }
        if debug:
            payload["details"] = {"cause": str(e)}
        return JSONResponse(status_code=500, content=payload)
