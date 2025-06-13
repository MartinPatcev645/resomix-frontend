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
from fastapi import APIRouter, File, UploadFile, Query, Body, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.similarity_controller import SimilarityController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.similarity import SimilarityByIdRequest

router = APIRouter(tags=["similarity"])

# Initialize controller
similarity_controller = SimilarityController()


@router.post("/get_similarity/")
async def get_similarity_upload_endpoint(
    file: UploadFile = File(...), 
    top_sk: Optional[int] = Query(None, description="Number of similar tracks to return (10, 20, 50, or 100)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Process an audio file and return similar tracks.
    
    - **file**: The audio file to analyze (max 100MB)
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    """
    return await similarity_controller.get_similarity_upload(db, file, top_sk)


@router.post("/get_selection_similarity/")
async def get_similarity_by_id_endpoint(
    request_data: SimilarityByIdRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get similar tracks for a track identified by its MongoDB ID.
    
    - **track_id**: The MongoDB ID of the track to find similar tracks for.
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    """
    return await similarity_controller.get_similarity_by_id(db, request_data.track_id, request_data.top_sk) 