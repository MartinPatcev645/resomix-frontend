"""
Monthly Pipeline API Router
===========================

This module defines the FastAPI router for monthly pipeline track endpoints.
It handles HTTP requests for monthly pipeline track processing including file uploads,
metadata extraction, embedding preview generation, and database storage.

Provides RESTful API endpoints for monthly pipeline track functionality
in the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, File, UploadFile, Form, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.monthly_pipeline_controller import MonthlyPipelineController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.monthly_pipeline import (
    MonthlyPipelineTrackSuccessResponse,
    MonthlyPipelineTrackErrorResponse
)

router = APIRouter(
    prefix="/monthly_pipeline",
    tags=["monthly_pipeline"],
    responses={
        415: {"model": MonthlyPipelineTrackErrorResponse},
        422: {"model": MonthlyPipelineTrackErrorResponse},
        500: {"model": MonthlyPipelineTrackErrorResponse},
        503: {"model": MonthlyPipelineTrackErrorResponse}
    }
)

# Initialize controller
monthly_pipeline_controller = MonthlyPipelineController()


@router.post(
    "/track/",
    response_model=MonthlyPipelineTrackSuccessResponse,
    summary="Monthly Pipeline Track Processing",
    description="Process audio file for monthly pipeline: extract metadata, generate embedding preview, and store in database.",
    responses={
        200: {
            "model": MonthlyPipelineTrackSuccessResponse,
            "description": "Track processed successfully and stored in database"
        },
        415: {
            "model": MonthlyPipelineTrackErrorResponse,
            "description": "Unsupported media type or invalid audio file"
        },
        422: {
            "model": MonthlyPipelineTrackErrorResponse,
            "description": "File too large, empty, or validation error"
        },
        500: {
            "model": MonthlyPipelineTrackErrorResponse,
            "description": "Database upload or internal server error"
        },
        503: {
            "model": MonthlyPipelineTrackErrorResponse,
            "description": "Similarity service unavailable"
        }
    }
)
async def monthly_pipeline_track_endpoint(
    file: UploadFile = File(..., description="Audio file to process for monthly pipeline"),
    path: str = Form(..., description="File path for the track"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Process an audio file for the monthly pipeline.
    
    This endpoint performs a three-step process:
    1. **Extract Metadata**: Extracts metadata and generates UUID
    2. **Generate Embedding Preview**: Sends to similarity server's /generate_embedding_preview endpoint
    3. **Store in Database**: If similarity server succeeds, stores track in database with type="monthly_pipeline"
    
    - **file**: The audio file to process
    - **path**: The file path for the track
    """
    return await monthly_pipeline_controller.process_monthly_pipeline_track(db, file, path) 