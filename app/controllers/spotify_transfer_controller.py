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
import logging

from app.services.spotify_transfer_service import SpotifyTransferService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request

# Set up logger for controller
logger = logging.getLogger(__name__)


class SpotifyTransferController:
    """Controller for handling Spotify playlist transfer requests"""
    
    def __init__(self):
        """Initialize the Spotify transfer controller"""
        self.spotify_service = SpotifyTransferService()
        logger.info("SpotifyTransferController initialized")

    async def transfer_playlist_to_spotify(
        self, 
        db: AsyncSession, 
        playlist_id: str, 
        access_token: str,
        custom_playlist_name: str = None
    ) -> JSONResponse:
        """
        Handle playlist transfer to Spotify request
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: Spotify OAuth access token
            custom_playlist_name: Optional custom name for Spotify playlist
            
        Returns:
            JSONResponse with transfer results
        """
        logger.info("Processing Spotify transfer request for playlist: %s", playlist_id)
        
        try:
            # Call the service to perform the transfer
            result = await self.spotify_service.transfer_playlist_to_spotify(
                db=db,
                playlist_id=playlist_id,
                access_token=access_token,
                custom_playlist_name=custom_playlist_name
            )
            
            # Format success response
            success_message = (
                f"Successfully transferred playlist to Spotify. "
                f"{result['tracks_added']} tracks added, {result['tracks_not_found']} tracks not found."
            )
            
            logger.info("Transfer completed: %d/%d tracks added in %.1fs", 
                       result['tracks_added'], result['total_tracks'], result.get('transfer_time_seconds', 0))
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=result
                )
            )
            
        except ValueError as e:
            # Handle validation errors (playlist not found, no tracks, etc.)
            error_message = str(e)
            logger.warning("Validation error: %s", error_message)
            
            if "not found" in error_message.lower():
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=error_message
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error=error_message
                    )
                )
        
        except Exception as e:
            # Handle Spotify API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            
            # Check if it's a Spotify authentication error
            if any(keyword in error_message.lower() for keyword in ['token', 'auth', 'unauthorized', 'forbidden']):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=format_response(
                        success=False,
                        error="Invalid or expired Spotify access token"
                    )
                )
            
            # Generic server error for other cases
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal error occurred during playlist transfer"
                )
            ) 