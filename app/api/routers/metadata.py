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
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.controllers.metadata_controller import MetadataController

router = APIRouter(tags=["metadata"])

# Initialize controller
metadata_controller = MetadataController()


@router.post("/metadata/")
async def get_metadata_endpoint(
    file: UploadFile = File(...)
) -> JSONResponse:
    """
    Extracts and returns metadata from an uploaded audio file using Mutagen.
    """
    return await metadata_controller.get_metadata(file) 