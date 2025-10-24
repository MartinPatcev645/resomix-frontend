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

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import time

from app.services.spotify_transfer_service import SpotifyTransferService
from app.services.logging_service import LoggingService
from app.services.playlist_service import PlaylistService
from app.utils.response_utils import format_response

# Set up logger for controller
logger = logging.getLogger(__name__)


class SpotifyTransferController:
    """Controller for handling Spotify playlist transfer requests"""
    
    def __init__(self):
        """Initialize the Spotify transfer controller"""
        self.spotify_service = SpotifyTransferService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
        logger.info("SpotifyTransferController initialized")

    async def transfer_playlist_to_spotify(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        access_token: str,
        custom_playlist_name: str = None
    ) -> JSONResponse:
        """
        Handle playlist transfer to Spotify request
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Resomix playlist UUID
            access_token: Spotify OAuth access token
            custom_playlist_name: Optional custom name for Spotify playlist
            
        Returns:
            JSONResponse with transfer results
        """
        logger.info("Processing Spotify transfer request for playlist: %s", playlist_id)
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Resolve playlist int ID early for logging
        playlist_obj = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
        playlist_int_id = playlist_obj.id if playlist_obj else None

        # Initial start log
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="TRANSFER",
            action="playlist_transfer_start",
            message="Starting playlist transfer to Spotify",
            correlation_id=correlation_id,
            request=request,
            method=request.method,
            endpoint=str(request.url.path),
            path=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
            duration_ms=(time.time() - start_time) * 1000,
            playlist_id=playlist_int_id,
            context="Spotify playlist transfer initiation",
            metadata={
                "playlist_uuid": playlist_id,
                "custom_name": custom_playlist_name,
                "platform": "SPOTIFY",
                "operation": "playlist_transfer"
            },
            platform="SPOTIFY",
            operation="playlist_transfer",
            transfer_status="start"
        )
        
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

            # Log success with comprehensive details
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=True, data=result)
            
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="TRANSFER",
                action="playlist_transfer_success",
                message="Spotify playlist transferred successfully",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=200,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                context="Spotify playlist transfer completion",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "SPOTIFY",
                    "operation": "playlist_transfer",
                    "total_tracks": result.get('total_tracks', 0),
                    "tracks_added": result.get('tracks_added', 0),
                    "tracks_not_found": result.get('tracks_not_found', 0),
                    "spotify_playlist_id": result.get('spotify_playlist_id'),
                    "spotify_playlist_url": result.get('spotify_playlist_url'),
                    "spotify_playlist_name": result.get('spotify_playlist_name'),
                    "transfer_time_seconds": result.get('transfer_time_seconds', 0),
                    "not_found_tracks_sample": result.get('not_found_tracks', [])[:5],
                    "success_message": success_message,
                    "response": response_content
                },
                platform="SPOTIFY",
                operation="playlist_transfer",
                transfer_status="success",
                transfer_details=result
            )
            
            logger.info("Transfer completed: %d/%d tracks added in %.1fs", 
                       result['tracks_added'], result['total_tracks'], result.get('transfer_time_seconds', 0))
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=response_content
            )
            
        except ValueError as e:
            # Handle validation errors (playlist not found, no tracks, etc.)
            error_message = str(e)
            logger.warning("Validation error: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000
            
            # Determine status code
            is_not_found = "not found" in error_message.lower()
            error_status_code = status.HTTP_404_NOT_FOUND if is_not_found else status.HTTP_422_UNPROCESSABLE_ENTITY
            error_response = format_response(success=False, error=error_message)
            
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="TRANSFER",
                action="playlist_transfer_validation_error",
                message=f"Spotify playlist transfer validation failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=error_status_code,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                context="Spotify playlist transfer validation",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "SPOTIFY",
                    "operation": "playlist_transfer",
                    "error": error_message,
                    "error_type": "not_found" if is_not_found else "validation_error",
                    "validation_step": "playlist_validation",
                    "response": error_response
                },
                platform="SPOTIFY",
                operation="playlist_transfer",
                transfer_status="validation_error"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )
        
        except Exception as e:
            # Handle Spotify API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000
            
            # Determine error type and status code
            is_auth_error = any(keyword in error_message.lower() for keyword in ['token', 'auth', 'unauthorized', 'forbidden'])
            
            if is_auth_error:
                error_status_code = status.HTTP_401_UNAUTHORIZED
                final_error_message = "Invalid or expired Spotify access token"
                error_type = "authentication_error"
            else:
                error_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                final_error_message = "An internal error occurred during playlist transfer"
                error_type = "server_error"
            
            error_response = format_response(success=False, error=final_error_message)
            
            import traceback
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="TRANSFER",
                action="playlist_transfer_exception",
                message="Unexpected error during Spotify playlist transfer",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=error_status_code,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Spotify playlist transfer processing",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "SPOTIFY",
                    "operation": "playlist_transfer",
                    "error": error_message,
                    "error_type": error_type,
                    "exception_type": type(e).__name__,
                    "is_auth_error": is_auth_error,
                    "response": error_response
                },
                platform="SPOTIFY",
                operation="playlist_transfer",
                transfer_status="failed"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )
