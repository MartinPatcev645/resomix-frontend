"""
Contact Router
==============

This module defines contact form API endpoints for handling contact submissions.

Author: AI Assistant
Date: December 2024
"""

from fastapi import APIRouter, Depends, Path, Security
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.contact_controller import ContactController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.contact import (
    ContactRequest,
    ContactSuccessResponse,
    ContactErrorResponse,
    ContactEntity,
    ContactUpdateRequest
)

# Create router instance
router = APIRouter(
    prefix="/contact",
    tags=["contact"],
    responses={
        400: {"model": ContactErrorResponse},
        422: {"model": ContactErrorResponse},
        500: {"model": ContactErrorResponse}
    }
)

# Initialize controller
contact_controller = ContactController()


@router.post(
    "/",
    response_model=ContactSuccessResponse,
    status_code=200,
    summary="Submit Contact Form",
    description="Submit a contact form with name, email, message, and optional fields.",
    response_description="Contact form submission confirmation",
    responses={
        422: {
            "model": ContactErrorResponse,
            "description": "Validation error - missing required fields or invalid data format"
        }
    }
)
async def submit_contact(
    contact_request: ContactRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
):
    """
    Submit a contact form.
    
    This endpoint accepts contact form submissions with the following information:
    - **name**: Required - Contact person's name
    - **email**: Required - Valid email address
    - **message**: Required - Contact message
    - **subject**: Optional - Subject line
    - **phone**: Optional - Phone number
    - **user_id**: Optional - User ID for authenticated users
    
    Returns success confirmation or validation errors.
    """
    contact_data = contact_request.dict()
    return await contact_controller.submit_contact(db, contact_data)


@router.get(
    "/{contact_id}",
    response_model=ContactEntity,
    summary="Get Contact by ID",
    description="Retrieve a specific contact submission by its ID.",
    responses={
        404: {
            "model": ContactErrorResponse,
            "description": "Contact not found"
        }
    }
)
async def get_contact(
    contact_id: int = Path(..., description="The ID of the contact to retrieve", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
):
    """
    Get a contact submission by ID.
    
    This endpoint retrieves a specific contact submission using its unique ID.
    Useful for administrators to view contact details.
    """
    return await contact_controller.get_contact_by_id(db, contact_id)


@router.patch(
    "/{contact_id}/status",
    response_model=ContactSuccessResponse,
    summary="Update Contact Status",
    description="Update the status of a contact submission (open/resolved).",
    responses={
        404: {
            "model": ContactErrorResponse,
            "description": "Contact not found"
        }
    }
)
async def update_contact_status(
    status_request: ContactUpdateRequest,
    contact_id: int = Path(..., description="The ID of the contact to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
):
    """
    Update contact submission status.
    
    This endpoint allows administrators to update the status of a contact submission.
    Status can be changed between 'open' and 'resolved'.
    """
    status_data = status_request.dict()
    return await contact_controller.update_contact_status(db, contact_id, status_data) 