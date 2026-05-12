"""
Feedback API Router
===================

This module defines the FastAPI router for user feedback endpoints.
It handles HTTP requests for feedback submissions, retrieval, and status updates
with authentication and validation for customer satisfaction tracking.

Provides RESTful API endpoints for managing user feedback and support
requests in the Resomix application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Path, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.partner import get_current_partner
from app.models.partner import Partner
from app.api.dependencies.auth import get_current_user_optional
from app.api.dependencies.database import get_database_session
from app.models.user import User
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
    request: Request,
    feedback_request: FeedbackRequest,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Submit user feedback.
    
    This endpoint accepts feedback submissions with the following information:
    - **satisfaction**: Required - Rating from 1-10
    - **recommendation**: Required - Rating from 1-10
    - **feedback**: Optional - Feedback text message
    - **category**: Optional - Feedback category
    - **user_id**: Optional - User ID for authenticated users - overridden by JWT if present
    
    Returns success confirmation or validation errors.
    """
    feedback_data = feedback_request.dict()
    return await feedback_controller.submit_feedback(db, request, feedback_data, current_user, partner_id=partner.id)


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
    request: Request,
    feedback_id: int = Path(..., description="The ID of the feedback to retrieve", ge=1),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner)
):
    """
    Get a feedback submission by ID.
    
    This endpoint retrieves a specific feedback submission using its unique ID.
    Useful for administrators to view feedback details.
    """
    return await feedback_controller.get_feedback_by_id(db, request, feedback_id, partner_id=partner.id)


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
    request: Request,
    status_request: FeedbackUpdateRequest,
    feedback_id: int = Path(..., description="The ID of the feedback to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner)
):
    """
    Update feedback submission status.
    
    This endpoint allows administrators to update the status of a feedback submission.
    Status can be changed between 'open' and 'resolved'.
    """
    status_data = status_request.dict()
    return await feedback_controller.update_feedback_status(db, request, feedback_id, status_data, partner_id=partner.id)
