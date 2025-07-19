"""
Spotify Transfer Controller
===========================

This controller handles HTTP requests for Spotify playlist transfer functionality.
It processes transfer requests, validates input data, and coordinates with the
Spotify transfer service for business logic execution.

Manages Spotify-related API endpoints and provides proper validation,
error handling, and response formatting.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.spotify_transfer_service import SpotifyTransferService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class SpotifyTransferController:
    """Controller for Spotify transfer-related HTTP requests."""
    
    def __init__(self):
        """Initialize Spotify transfer controller."""
        self.spotify_transfer_service = SpotifyTransferService()
    
    async def transfer_playlist_to_spotify(
        self, 
        db: AsyncSession, 
        playlist_id: str, 
        access_token: str,
        playlist_name: str = None
    ) -> JSONResponse:
        """
        Transfer a ResomiX playlist to Spotify.
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: User's Spotify OAuth access token
            playlist_name: Optional custom name for the Spotify playlist
            
        Returns:
            JSON response with transfer result
        """
        log_request("transfer_playlist_to_spotify", "POST", {
            "playlist_id": playlist_id, 
            "has_access_token": bool(access_token),
            "playlist_name": playlist_name
        })
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        if not access_token or not access_token.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="access_token cannot be empty"
                )
            )
        
        try:
            result = await self.spotify_transfer_service.transfer_playlist_to_spotify(
                db, 
                playlist_id.strip(), 
                access_token.strip(),
                playlist_name.strip() if playlist_name else None
            )
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                # Determine appropriate status code based on error type
                error_message = result.get("error", "").lower()
                
                if "not found" in error_message:
                    status_code = status.HTTP_404_NOT_FOUND
                elif "invalid" in error_message or "expired" in error_message:
                    status_code = status.HTTP_401_UNAUTHORIZED
                elif "no tracks" in error_message or "empty" in error_message:
                    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
                else:
                    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                
                return JSONResponse(
                    status_code=status_code,
                    content=result
                )
                
        except Exception as e:
            print(f"Error in Spotify transfer controller: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while transferring the playlist to Spotify"
                )
            ) 