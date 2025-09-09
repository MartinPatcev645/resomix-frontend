"""
Waitlist API Router
==================

This module defines the FastAPI router for waitlist management endpoints.
It handles HTTP requests for waitlist operations including email submission,
status checking, and waitlist management with authentication and validation.

Provides RESTful API endpoints for waitlist functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.waitlist_controller import WaitlistController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.waitlist import (
    WaitlistRequest,
    WaitlistSuccessResponse,
    WaitlistErrorResponse
)

router = APIRouter(
    prefix="/waitlist",
    tags=["waitlist"],
    responses={
        404: {"model": WaitlistErrorResponse},
        422: {"model": WaitlistErrorResponse},
        500: {"model": WaitlistErrorResponse}
    }
)

# Initialize controller
waitlist_controller = WaitlistController()


@router.post(
    "/",
    response_model=WaitlistSuccessResponse,
    summary="Join Waitlist",
    description="Add an email address to the waitlist for early access to ResomiX features.",
    responses={
        200: {
            "model": WaitlistSuccessResponse,
            "description": "Successfully added to waitlist"
        },
        422: {
            "model": WaitlistErrorResponse,
            "description": "Invalid email or email already exists in waitlist"
        },
        500: {
            "model": WaitlistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def join_waitlist_endpoint(
    request_data: WaitlistRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Add an email address to the waitlist.
    
    - **email**: The email address to add to the waitlist
    """
    return await waitlist_controller.add_to_waitlist(db, request_data.dict())


@router.get(
    "/",
    response_model=WaitlistSuccessResponse,
    summary="Check Waitlist Status",
    description="Check if an email address is already in the waitlist and get its status.",
    responses={
        200: {
            "model": WaitlistSuccessResponse,
            "description": "Waitlist entry found"
        },
        404: {
            "model": WaitlistErrorResponse,
            "description": "Email not found in waitlist"
        },
        500: {
            "model": WaitlistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def check_waitlist_status_endpoint(
    email: str = Query(..., description="Email address to check in waitlist"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Check if an email address is in the waitlist and get its status.
    
    - **email**: The email address to check (query parameter)
    """
    return await waitlist_controller.get_waitlist_entry(db, email)
