"""
Metadata API Router
===================

This module defines the FastAPI router for audio metadata extraction endpoints.
It handles HTTP requests for extracting metadata from uploaded audio files
including artist, album, genre, and technical information.

Provides RESTful API endpoints for metadata extraction functionality
in the ResomiX audio analysis system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Metadata endpoints 
from fastapi import APIRouter, File, UploadFile, Security, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.controllers.metadata_controller import MetadataController
from app.api.dependencies.auth import get_api_key
from app.schemas.metadata import (
    MetadataSuccessResponse,
    MetadataErrorResponse
)
from app.database.session import get_database_session

router = APIRouter(
    tags=["metadata"],
    responses={
        415: {"model": MetadataErrorResponse},
        422: {"model": MetadataErrorResponse},
        500: {"model": MetadataErrorResponse}
    }
)

# Initialize controller
metadata_controller = MetadataController()


@router.post(
    "/metadata/",
    response_model=MetadataSuccessResponse,
    summary="Extract Audio Metadata",
    description="Extract metadata from uploaded audio files including artist, album, genre, and technical information.",
    responses={
        200: {
            "model": MetadataSuccessResponse,
            "description": "Metadata extracted successfully"
        },
        415: {
            "model": MetadataErrorResponse,
            "description": "Unsupported media type or invalid audio file"
        },
        422: {
            "model": MetadataErrorResponse,
            "description": "Empty file or validation error"
        },
        500: {
            "model": MetadataErrorResponse,
            "description": "Internal server error during metadata extraction"
        }
    }
)
async def get_metadata_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Audio file to extract metadata from"),
    db: Session = Depends(get_database_session),
    _: str = Security(get_api_key)  # Authentication required but not used in controller
) -> JSONResponse:
    """
    Extracts and returns metadata from an uploaded audio file using Mutagen.
    
    - **file**: Audio file to analyze (supports MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS)
    """
    return await metadata_controller.get_metadata(db, request, file)
