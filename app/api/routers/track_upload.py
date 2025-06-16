"""
Track Upload API Router
=======================

This module defines the FastAPI router for track upload endpoints.
It handles HTTP requests for uploading tracks for similarity analysis,
including metadata extraction and database storage.

Provides RESTful API endpoints for track upload functionality
in the ResomiX audio analysis system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, File, UploadFile, Security
from fastapi.responses import JSONResponse

from app.controllers.track_upload_controller import TrackUploadController
from app.api.dependencies.auth import get_api_key
from app.schemas.track_upload import (
    TrackUploadSuccessResponse,
    TrackUploadErrorResponse
)

router = APIRouter(
    tags=["track-upload"],
    responses={
        413: {"model": TrackUploadErrorResponse},
        415: {"model": TrackUploadErrorResponse},
        422: {"model": TrackUploadErrorResponse},
        500: {"model": TrackUploadErrorResponse}
    }
)

# Initialize controller
track_upload_controller = TrackUploadController()


@router.post(
    "/upload-track/",
    response_model=TrackUploadSuccessResponse,
    summary="Upload Track for Similarity Analysis",
    description="Upload an audio track, extract metadata, and store it in the database for similarity analysis.",
    responses={
        201: {
            "model": TrackUploadSuccessResponse,
            "description": "Track uploaded successfully and added to database"
        },
        413: {
            "model": TrackUploadErrorResponse,
            "description": "File size exceeds 100MB limit"
        },
        415: {
            "model": TrackUploadErrorResponse,
            "description": "Unsupported media type or invalid audio file"
        },
        422: {
            "model": TrackUploadErrorResponse,
            "description": "Empty file or validation error"
        },
        500: {
            "model": TrackUploadErrorResponse,
            "description": "Internal server error during upload"
        }
    }
)
async def upload_track_endpoint(
    file: UploadFile = File(..., description="Audio file to upload for similarity analysis"),
    _: str = Security(get_api_key)  # Authentication required but not used in controller
) -> JSONResponse:
    """
    Upload an audio track for similarity analysis.
    
    This endpoint:
    - Validates the uploaded audio file (supports MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS)
    - Extracts metadata using Mutagen
    - Generates a unique UUID for the track
    - Calculates file size
    - Creates or finds related entities (artists, albums, labels, genres)
    - Stores the track in the database with type="upload"
    - Returns the track UUID and metadata
    
    - **file**: Audio file to upload (max 100MB)
    """
    return await track_upload_controller.upload_track(file) 