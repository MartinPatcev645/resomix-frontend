"""
Feedback Router
===============

This module defines feedback API endpoints for handling feedback submissions only.

Author: AI Assistant
Date: December 2024
"""

from fastapi import APIRouter, Security, Depends, Path
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.feedback import (
    FeedbackRequest, 
    FeedbackSuccessResponse, 
    FeedbackErrorResponse, 
    FeedbackEntity,
    FeedbackUpdateRequest
)

# Create router instance
router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    responses={
        400: {"model": FeedbackErrorResponse},
        422: {"model": FeedbackErrorResponse},
        500: {"model": FeedbackErrorResponse}
    }
)

# Initialize controller
feedback_controller = FeedbackController()


@router.post(
    "/",
    response_model=FeedbackSuccessResponse,
    status_code=200,
    summary="Submit Feedback",
    description="Submit user feedback with satisfaction and recommendation ratings.",
    response_description="Feedback submission confirmation",
    responses={
        422: {
            "model": FeedbackErrorResponse,
            "description": "Validation error - ratings must be between 1-10"
        }
    }
)
async def submit_feedback(
    feedback_request: FeedbackRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Submit user feedback.
    
    This endpoint accepts feedback submissions with the following information:
    - **satisfaction**: Required - Rating from 1-10
    - **recommendation**: Required - Rating from 1-10
    - **feedback**: Optional - Feedback text message
    - **category**: Optional - Feedback category
    - **user_id**: Optional - User ID for authenticated users
    
    Returns success confirmation or validation errors.
    """
    feedback_data = feedback_request.dict()
    return await feedback_controller.submit_feedback(db, feedback_data)


@router.get(
    "/{feedback_id}",
    response_model=FeedbackEntity,
    summary="Get Feedback by ID",
    description="Retrieve a specific feedback submission by its ID.",
    responses={
        404: {
            "model": FeedbackErrorResponse,
            "description": "Feedback not found"
        }
    }
)
async def get_feedback(
    feedback_id: int = Path(..., description="The ID of the feedback to retrieve", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
):
    """
    Get a feedback submission by ID.
    
    This endpoint retrieves a specific feedback submission using its unique ID.
    Useful for administrators to view feedback details.
    """
    return await feedback_controller.get_feedback_by_id(db, feedback_id)


@router.patch(
    "/{feedback_id}/status",
    response_model=FeedbackSuccessResponse,
    summary="Update Feedback Status",
    description="Update the status of a feedback submission (open/resolved).",
    responses={
        404: {
            "model": FeedbackErrorResponse,
            "description": "Feedback not found"
        }
    }
)
async def update_feedback_status(
    status_request: FeedbackUpdateRequest,
    feedback_id: int = Path(..., description="The ID of the feedback to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
):
    """
    Update feedback submission status.
    
    This endpoint allows administrators to update the status of a feedback submission.
    Status can be changed between 'open' and 'resolved'.
    """
    status_data = status_request.dict()
    return await feedback_controller.update_feedback_status(db, feedback_id, status_data)
