"""
Preview Controller
==================

This controller handles HTTP requests for preview-related functionality.
It processes preview download URL requests and coordinates with preview service
to communicate with the ResomiX server for secure preview file access.

Manages request validation, preview service coordination, and response formatting
for preview-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.preview_service import PreviewService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class PreviewController:
    def __init__(self):
        self.preview_service = PreviewService()

    async def get_preview_download_url(
        self,
        db: AsyncSession,
        track_id: str
    ) -> JSONResponse:
        """
        Generate download URL for a track preview by its ID.
        
        Args:
            db: Database session
            track_id: The track UUID to generate preview URL for
            
        Returns:
            JSON response with preview URL or error
        """
        log_request("get_preview", "POST", {"track_id": track_id})
        
        try:
            # Validate track_id
            if not track_id or not track_id.strip():
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="track_id cannot be empty"
                    )
                )
            
            # Call preview service to generate download URL
            preview_result = await self.preview_service.generate_download_url(db, track_id)
            
            # Check if the result contains an error
            if preview_result.get("success") is False:
                error_message = preview_result.get("error", "Unknown error occurred")
                
                # Determine appropriate status code based on error type
                if "not found" in error_message.lower():
                    status_code = status.HTTP_404_NOT_FOUND
                elif "empty" in error_message.lower():
                    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
                else:
                    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
                
                return JSONResponse(
                    status_code=status_code,
                    content=format_response(success=False, error=error_message)
                )
            
            # Success response
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=preview_result)
            )
            
        except Exception as e:
            # Log the exception for debugging
            print(f"An error occurred in get_preview_download_url: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            ) 