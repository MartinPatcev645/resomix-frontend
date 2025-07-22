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

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import secrets
from urllib.parse import urlencode

from app.core.config import settings
from app.services.tidal_transfer_service import TidalTransferService
from app.utils.response_utils import format_response
from app.utils.playlist_transfer_utils import format_success_message, get_platform_error_message
from app.schemas.tidal_transfer import TidalAuthRequest, TidalTokenRequest

# Set up logger
logger = logging.getLogger(__name__)


class TidalTransferController:
    """Controller for handling Tidal playlist transfer requests"""
    
    def __init__(self):
        """Initialize the Tidal transfer controller"""
        self.tidal_service = TidalTransferService()
        logger.info("TidalTransferController initialized")

    async def exchange_authorization_code(self, request_data: TidalTokenRequest) -> JSONResponse:
        """
        Exchange authorization code for access token using server-side credentials
        
        Args:
            request_data: Token request containing authorization code and PKCE verifier
            
        Returns:
            JSONResponse with access token and refresh token
        """
        try:
            # Validate that we have client credentials
            if not settings.tidal_client_id or not settings.tidal_client_secret:
                logger.error("Tidal client credentials not configured")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(
                        success=False,
                        error="Tidal authentication not properly configured"
                    )
                )
            
            # Use the service to exchange the code for tokens
            token_response = await self.tidal_service.exchange_authorization_code(
                authorization_code=request_data.code,
                redirect_uri=request_data.redirect_uri,
                code_verifier=request_data.code_verifier
            )
            
            logger.info("Successfully exchanged authorization code for Tidal access token")
            
            # Log the response being sent to frontend (with truncated sensitive data)
            logger.info("Sending token response to frontend: %s", {
                "access_token": f"{token_response['access_token'][:20]}..." if token_response.get('access_token') else None,
                "token_type": token_response.get('token_type'),
                "expires_in": token_response.get('expires_in'),
                "refresh_token": f"{token_response['refresh_token'][:20]}..." if token_response.get('refresh_token') else None,
                "scope": token_response.get('scope')
            })
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=token_response
                )
            )
            
        except ValueError as e:
            # Handle validation errors (invalid code, expired, etc.)
            error_message = str(e)
            logger.warning("Token exchange validation error: %s", error_message)
            
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=format_response(
                    success=False,
                    error=error_message
                )
            )
            
        except Exception as e:
            # Handle other errors
            error_message = str(e)
            logger.error("Token exchange failed: %s", error_message)
            
            # Check if it's an authentication error
            if any(keyword in error_message.lower() for keyword in ['unauthorized', 'invalid_client', 'invalid_grant']):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=format_response(
                        success=False,
                        error="Invalid client credentials or authorization code"
                    )
                )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="Failed to exchange authorization code for access token"
                )
            )

    async def transfer_playlist_to_tidal(
        self, 
        db: AsyncSession, 
        playlist_id: str, 
        access_token: str,
        custom_playlist_name: str = None
    ) -> JSONResponse:
        """
        Handle playlist transfer to Tidal request
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: Tidal OAuth access token
            custom_playlist_name: Optional custom name for Tidal playlist
            
        Returns:
            JSONResponse with transfer results
        """
        logger.info("Processing Tidal transfer request for playlist: %s", playlist_id)
        
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
            
            logger.info("Transfer completed: %d/%d tracks added in %.1fs", 
                       result['tracks_added'], result['total_tracks'], result.get('transfer_time_seconds', 0))
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=result,
                    message=success_message
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
            # Handle Tidal API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            
            # Check if it's a Tidal authentication error
            if any(keyword in error_message.lower() for keyword in ['token', 'auth', 'unauthorized', 'forbidden']):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=format_response(
                        success=False,
                        error="Your Tidal session is invalid, expired, or missing required permissions. Please reconnect your Tidal account and try again."
                    )
                )
            
            # Check for rate limiting
            if "rate limit" in error_message.lower():
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content=format_response(
                        success=False,
                        error="Tidal API rate limit exceeded. Please wait a moment and try again."
                    )
                )
            
            # Generic server error for other cases
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An unexpected error occurred during playlist transfer. Please try again or contact support if the problem persists."
                )
            )
