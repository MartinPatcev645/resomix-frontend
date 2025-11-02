"""
Apple Music Transfer Controller
================================

This controller handles HTTP requests for Apple Music playlist transfer functionality.
It processes transfer requests, validates input data, and coordinates with the
Apple Music transfer service for business logic execution.

Manages Apple Music-related API endpoints and provides proper validation,
error handling, and response formatting.

Version: 3.0.1
Init Date: December 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import time

from app.services.apple_music_transfer_service import AppleMusicTransferService
from app.services.logging_service import LoggingService
from app.services.playlist_service import PlaylistService
from app.utils.response_utils import format_response

# Set up logger for controller
logger = logging.getLogger(__name__)


class AppleMusicTransferController:
    """Controller for handling Apple Music playlist transfer requests"""
    
    def __init__(self):
        """Initialize the Apple Music transfer controller"""
        self.apple_music_service = AppleMusicTransferService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
        logger.info("AppleMusicTransferController initialized")

    async def get_developer_token(self) -> JSONResponse:
        """
        Get or generate Apple Music developer token
        
        Returns:
            JSONResponse with token and expiration
        """
        try:
            token, exp_ms = self.apple_music_service.get_or_create_dev_token()
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"token": token, "expires_at": exp_ms}
            )
        except Exception as e:
            logger.error("Failed to generate developer token: %s", str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e))
            )

    async def transfer_playlist_to_apple_music(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        music_user_token: str,
        developer_token: str = None,
        custom_playlist_name: str = None
    ) -> JSONResponse:
        """
        Handle playlist transfer to Apple Music request
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Resomix playlist UUID
            music_user_token: Apple Music User Token
            developer_token: Optional developer token
            custom_playlist_name: Optional custom name for Apple Music playlist
            
        Returns:
            JSONResponse with transfer results
        """
        logger.info("Processing Apple Music transfer request for playlist: %s", playlist_id)
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
            message="Starting playlist transfer to Apple Music",
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
            context="Apple Music playlist transfer initiation",
            metadata={
                "playlist_uuid": playlist_id,
                "custom_name": custom_playlist_name
            },
            platform="APPLE_MUSIC",
            operation="playlist_transfer",
            transfer_status="start"
        )
        
        try:
            # Call the service to perform the transfer
            result = await self.apple_music_service.transfer_playlist_to_apple_music(
                db=db,
                playlist_id=playlist_id,
                music_user_token=music_user_token,
                developer_token=developer_token,
                custom_playlist_name=custom_playlist_name
            )
            
            # Format success response
            success_message = (
                f"Successfully transferred playlist to Apple Music. "
                f"{result['matched']} tracks matched, {result['unmatched']} tracks not found."
            )

            # Log success with comprehensive details
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=True, data=result)
            
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="TRANSFER",
                action="playlist_transfer_success",
                message="Apple Music playlist transferred successfully",
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
                context="Apple Music playlist transfer completion",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "total_tracks": result.get('total_tracks', 0),
                    "matched": result.get('matched', 0),
                    "unmatched": result.get('unmatched', 0),
                    "created_playlist_id": result.get('created_playlist_id'),
                    "created_playlist_name": result.get('created_playlist_name'),
                    "transfer_time_seconds": result.get('transfer_time_seconds', 0),
                    "success_message": success_message,
                    "response": response_content
                },
                platform="APPLE_MUSIC",
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
                message=f"Apple Music playlist transfer validation failed: {error_message}",
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
                context="Apple Music playlist transfer validation",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "error": error_message,
                    "error_type": "not_found" if is_not_found else "validation_error",
                    "validation_step": "playlist_validation",
                    "response": error_response
                },
                platform="APPLE_MUSIC",
                operation="playlist_transfer",
                transfer_status="validation_error"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )
        
        except Exception as e:
            # Handle Apple Music API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000
            
            # Determine error type and status code
            is_auth_error = any(keyword in error_message.lower() for keyword in ['token', 'auth', 'unauthorized', 'forbidden'])
            
            if is_auth_error:
                error_status_code = status.HTTP_401_UNAUTHORIZED
                final_error_message = "Invalid or expired Apple Music user token"
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
                message="Unexpected error during Apple Music playlist transfer",
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
                context="Apple Music playlist transfer processing",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "error": error_message,
                    "error_type": error_type,
                    "exception_type": type(e).__name__,
                    "is_auth_error": is_auth_error,
                    "response": error_response
                },
                platform="APPLE_MUSIC",
                operation="playlist_transfer",
                transfer_status="failed"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )

