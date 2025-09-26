"""
Similarity API Router
=====================

This module defines the FastAPI router for audio similarity endpoints.
It handles HTTP requests for similarity calculations including file uploads
and track ID-based similarity queries with authentication and validation.

Provides RESTful API endpoints for the core similarity functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Similarity endpoints 
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Query, Body, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.similarity_controller import SimilarityController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.repositories.playlist_repository import PlaylistRepository
from fastapi import HTTPException
from app.schemas.similarity import (
    SimilarityByIdRequest,
    SimilarityUploadSuccessResponse,
    SimilarityByIdSuccessResponse,
    SimilarityErrorResponse
)

router = APIRouter(
    tags=["similarity"],
    responses={
        403: {"model": SimilarityErrorResponse},
        415: {"model": SimilarityErrorResponse},
        422: {"model": SimilarityErrorResponse},
        500: {"model": SimilarityErrorResponse},
        503: {"model": SimilarityErrorResponse}
    }
)

# Initialize controller
similarity_controller = SimilarityController()
playlist_repository = PlaylistRepository()


@router.post(
    "/get_similarity/",
    response_model=SimilarityUploadSuccessResponse,
    summary="Upload Track and Calculate Similarity",
    description="Upload an audio file, store it in the database, and get similar tracks.",
    responses={
        200: {
            "model": SimilarityUploadSuccessResponse,
            "description": "Track uploaded and similarity calculation completed successfully"
        },
        415: {
            "model": SimilarityErrorResponse,
            "description": "Unsupported media type or invalid audio file"
        },
        422: {
            "model": SimilarityErrorResponse,
            "description": "File too large, empty, or validation error"
        },
        500: {
            "model": SimilarityErrorResponse,
            "description": "Database upload or internal server error"
        },
        503: {
            "model": SimilarityErrorResponse,
            "description": "Similarity service unavailable"
        }
    }
)
async def get_similarity_upload_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Audio file to analyze for similarity (max 100MB)"), 
    top_sk: Optional[int] = Query(None, description="Number of similar tracks to return (10, 20, 50, or 100)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Upload an audio track and find similar tracks.
    
    This endpoint performs a two-step process:
    1. **Upload to Database**: Extracts metadata and stores the track with type="upload"
    2. **Similarity Analysis**: Finds similar tracks and returns results
    
    The response includes both the uploaded track information and similarity results.
    
    - **file**: The audio file to upload and analyze (max 100MB)
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    """
    return await similarity_controller.get_similarity_upload(db, request, file, top_sk)


@router.post(
    "/get_selection_similarity/",
    response_model=SimilarityByIdSuccessResponse,
    summary="Calculate Similarity by Track ID",
    description="Get similar tracks for a track identified by its database ID.",
    responses={
        200: {
            "model": SimilarityByIdSuccessResponse,
            "description": "Similarity calculation completed successfully"
        },
        404: {
            "model": SimilarityErrorResponse,
            "description": "Track not found or path missing"
        },
        422: {
            "model": SimilarityErrorResponse,
            "description": "Invalid track ID or validation error"
        },
        503: {
            "model": SimilarityErrorResponse,
            "description": "Similarity service unavailable"
        }
    }
)
async def get_similarity_by_id_endpoint(
    request: Request,
    request_data: SimilarityByIdRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get similar tracks for a track identified by its database ID.
    
    - **track_id**: The database ID of the track to find similar tracks for.
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    """
    return await similarity_controller.get_similarity_by_id(db, request, request_data.track_id, request_data.top_sk)


# New endpoint to poll segment status

@router.get(
    "/segment_status/{playlist_uuid}",
    summary="Check if segment preview processing completed for a playlist",
    description="Returns segmentation_completed true/false based on playlist type.",
    response_model=dict,
)
async def segment_status_endpoint(
    playlist_uuid: str,
    db: AsyncSession = Depends(get_database_session),
) -> JSONResponse:
    playlist = await playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    completed = playlist.type != "waiting_segments"
    return JSONResponse(content={"segmentation_completed": completed})
