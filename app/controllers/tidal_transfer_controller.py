"""
Tidal Transfer Controller
=========================

This controller handles HTTP requests for Tidal playlist transfer operations.
It coordinates between the API layer and the TidalTransferService to process
playlist transfers with proper error handling and response formatting.

Provides request validation, service coordination, and response formatting
for Tidal playlist transfer functionality.

Version: 3.0.1
Init Date: July 20, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.services.tidal_transfer_service import TidalTransferService
from app.utils.response_utils import format_response
from app.utils.playlist_transfer_utils import format_success_message
from app.schemas.tidal_transfer import TidalTokenRequest
from app.services.logging_service import LoggingService
import time
from app.services.playlist_service import PlaylistService

# Set up logger
logger = logging.getLogger(__name__)


class TidalTransferController:
    """Controller for handling Tidal playlist transfer requests"""
    
    def __init__(self):
        """Initialize the Tidal transfer controller"""
        self.tidal_service = TidalTransferService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
        logger.info("TidalTransferController initialized")

    async def exchange_authorization_code(self, request: Request, request_data: TidalTokenRequest) -> JSONResponse:
        """
        Exchange authorization code for access token using server-side credentials
        
        Args:
            request: FastAPI Request object
            request_data: Token request containing authorization code and PKCE verifier
            
        Returns:
            JSONResponse with access token and refresh token
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Use the service to exchange the code for tokens
            token_response = await self.tidal_service.exchange_authorization_code(
                authorization_code=request_data.code,
                redirect_uri=request_data.redirect_uri,
                code_verifier=request_data.code_verifier
            )
            
            # Log success
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=True, data=token_response)
            self.logging_service.log(
                async_db=None,
                level="INFO",
                category="TRANSFER",
                action="token_exchange_success",
                message="Tidal authorization token exchanged successfully",
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
                context="Tidal OAuth token exchange",
                metadata={
                    "platform": "TIDAL",
                    "operation": "token_exchange",
                    "redirect_uri": request_data.redirect_uri,
                    "has_refresh_token": "refresh_token" in token_response,
                    "response": response_content
                },
                platform="TIDAL",
                operation="token_exchange",
                transfer_status="success"
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=response_content
            )
            
        except ValueError as e:
            # Handle validation errors (invalid code, expired, etc.)
            error_message = str(e)
            duration_ms = (time.time() - start_time) * 1000
            error_response = format_response(success=False, error=error_message)
            
            self.logging_service.log(
                async_db=None,
                level="WARNING",
                category="TRANSFER",
                action="token_exchange_validation_error",
                message=f"Tidal token exchange validation failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=400,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                context="Tidal OAuth token exchange validation",
                metadata={
                    "platform": "TIDAL",
                    "operation": "token_exchange",
                    "error": error_message,
                    "redirect_uri": request_data.redirect_uri,
                    "validation_step": "authorization_code_validation",
                    "response": error_response
                },
                platform="TIDAL",
                operation="token_exchange",
                transfer_status="validation_error"
            )
            
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=error_response
            )
            
        except Exception as e:
            # Handle other errors
            error_message = str(e)
            duration_ms = (time.time() - start_time) * 1000
            error_response = format_response(
                success=False,
                error="Failed to exchange authorization code for access token"
            )
            logger.error("Token exchange failed: %s", error_message)
            logger.error("Request details: code=%s, redirect_uri=%s, code_verifier=%s", request_data.code, request_data.redirect_uri, request_data.code_verifier)
            logger.error("Exception details:", exc_info=True)
            
            
            import traceback
            self.logging_service.log(
                async_db=None,
                level="ERROR",
                category="TRANSFER",
                action="token_exchange_exception",
                message="Unexpected error during Tidal token exchange",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Tidal OAuth token exchange processing",
                metadata={
                    "platform": "TIDAL",
                    "operation": "token_exchange",
                    "error": error_message,
                    "exception_type": type(e).__name__,
                    "redirect_uri": request_data.redirect_uri,
                    "response": error_response
                },
                platform="TIDAL",
                operation="token_exchange",
                transfer_status="failed"
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )

    async def transfer_playlist_to_tidal(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        access_token: str,
        custom_playlist_name: str = None
    ) -> JSONResponse:
        """
        Handle playlist transfer to Tidal request
        
        Args:
            db: Database session
            playlist_id: Resomix playlist UUID
            access_token: Tidal OAuth access token
            custom_playlist_name: Optional custom name for Tidal playlist
            
        Returns:
            JSONResponse with transfer results
        """
        logger.info("Processing Tidal transfer request for playlist: %s", playlist_id)
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
            message="Starting playlist transfer to Tidal",
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
            context="Tidal playlist transfer initiation",
            metadata={
                "playlist_uuid": playlist_id,
                "custom_name": custom_playlist_name,
                "platform": "TIDAL",
                "operation": "playlist_transfer"
            },
            platform="TIDAL",
            operation="playlist_transfer",
            transfer_status="start"
        )
        
        try:
            # Call the service to perform the transfer
            result = await self.tidal_service.transfer_playlist_to_tidal(
                db=db,
                playlist_id=playlist_id,
                access_token=access_token,
                custom_playlist_name=custom_playlist_name
            )
            
            # Format success response
            success_message = format_success_message(
                "Tidal", 
                result['tracks_added'], 
                result['tracks_not_found']
            )

            # Log success with comprehensive details
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=True, data=result)
            
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="TRANSFER",
                action="playlist_transfer_success",
                message="Tidal playlist transferred successfully",
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
                context="Tidal playlist transfer completion",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "TIDAL",
                    "operation": "playlist_transfer",
                    "total_tracks": result.get('total_tracks', 0),
                    "tracks_added": result.get('tracks_added', 0),
                    "tracks_not_found": result.get('tracks_not_found', 0),
                    "tidal_playlist_id": result.get('tidal_playlist_id'),
                    "tidal_playlist_url": result.get('tidal_playlist_url'),
                    "tidal_playlist_name": result.get('tidal_playlist_name'),
                    "transfer_time_seconds": result.get('transfer_time_seconds', 0),
                    "not_found_tracks_sample": result.get('not_found_tracks', [])[:5],
                    "success_message": success_message,
                    "response": response_content
                },
                platform="TIDAL",
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
                message=f"Tidal playlist transfer validation failed: {error_message}",
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
                context="Tidal playlist transfer validation",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "TIDAL",
                    "operation": "playlist_transfer",
                    "error": error_message,
                    "error_type": "not_found" if is_not_found else "validation_error",
                    "validation_step": "playlist_validation",
                    "response": error_response
                },
                platform="TIDAL",
                operation="playlist_transfer",
                transfer_status="validation_error"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )
        
        except Exception as e:
            # Handle Tidal API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000
            
            # Determine error type and status code
            is_auth_error = any(keyword in error_message.lower() for keyword in ['token', 'auth', 'unauthorized', 'forbidden'])
            is_rate_limit = "rate limit" in error_message.lower()
            
            if is_auth_error:
                error_status_code = status.HTTP_401_UNAUTHORIZED
                final_error_message = "Your Tidal session is invalid, expired, or missing required permissions. Please reconnect your Tidal account and try again."
                error_type = "authentication_error"
            elif is_rate_limit:
                error_status_code = status.HTTP_429_TOO_MANY_REQUESTS
                final_error_message = "Tidal API rate limit exceeded. Please wait a moment and try again."
                error_type = "rate_limit_error"
            else:
                error_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                final_error_message = "An unexpected error occurred during playlist transfer. Please try again or contact support if the problem persists."
                error_type = "server_error"
            
            error_response = format_response(success=False, error=final_error_message)
            
            import traceback
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="TRANSFER",
                action="playlist_transfer_exception",
                message="Unexpected error during Tidal playlist transfer",
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
                context="Tidal playlist transfer processing",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "platform": "TIDAL",
                    "operation": "playlist_transfer",
                    "error": error_message,
                    "error_type": error_type,
                    "exception_type": type(e).__name__,
                    "is_auth_error": is_auth_error,
                    "is_rate_limit": is_rate_limit,
                    "response": error_response
                },
                platform="TIDAL",
                operation="playlist_transfer",
                transfer_status="failed"
            )
            
            return JSONResponse(
                status_code=error_status_code,
                content=error_response
            )
