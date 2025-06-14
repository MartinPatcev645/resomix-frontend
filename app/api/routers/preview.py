"""
Preview Router
==============

This module defines FastAPI routes for preview-related operations.
It handles preview download URL generation requests with proper validation,
authentication, and response formatting.

Provides endpoints for secure preview file access through ResomiX server integration
with comprehensive error handling and API documentation.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Depends, Security
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.preview import (
    PreviewDownloadRequest,
    PreviewDownloadSuccessResponse,
    PreviewErrorResponse
)
from app.controllers.preview_controller import PreviewController
from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_api_key

# Create router instance
router = APIRouter(prefix="/preview", tags=["Preview"])

# Initialize controller
preview_controller = PreviewController()


@router.post(
    "/get_preview/",
    response_model=PreviewDownloadSuccessResponse,
    summary="Generate Preview Download URL",
    description="Generate a secure download URL for a track preview by its ID.",
    responses={
        200: {
            "model": PreviewDownloadSuccessResponse,
            "description": "Preview URL generated successfully"
        },
        404: {
            "model": PreviewErrorResponse,
            "description": "Track not found"
        },
        422: {
            "model": PreviewErrorResponse,
            "description": "Invalid track ID or validation error"
        },
        503: {
            "model": PreviewErrorResponse,
            "description": "ResomiX service unavailable"
        }
    }
)
async def get_preview_endpoint(
    request_data: PreviewDownloadRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Generate a secure download URL for a track preview.
    
    - **track_id**: The database ID of the track to generate preview URL for
    """
    return await preview_controller.get_preview_download_url(db, request_data.track_id) 