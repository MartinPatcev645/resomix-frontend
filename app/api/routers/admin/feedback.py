"""
Admin Feedback API Router
==========================

This module defines the FastAPI router for admin feedback management endpoints.
It handles HTTP requests for feedback list, filtering, deletion, status updates,
and statistics with authentication for administrative operations.

Provides comprehensive admin panel endpoints for managing user feedback
and support requests in the ResomiX application.

Version: 1.0.0
Init Date: October 1, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminFeedbackUpdateRequest,
    AdminFeedbackDetailResponse,
    AdminFeedbackStatsResponse,
    AdminDeleteResponse,
    FeedbackErrorResponse
)

# Create router instance
router = APIRouter(
    prefix="/admin/feedback",
    tags=["admin-feedback"],
    responses={
        400: {"model": FeedbackErrorResponse},
        401: {"model": FeedbackErrorResponse},
        404: {"model": FeedbackErrorResponse},
        500: {"model": FeedbackErrorResponse}
    }
)

# Initialize controller
feedback_controller = FeedbackController()


@router.get(
    "/",
    response_model=AdminFeedbackListResponse,
    status_code=200,
    summary="Get Paginated Feedback List",
    description="Get paginated feedback list with advanced filtering, searching, and sorting capabilities.",
    response_description="Paginated feedback list with metadata"
)
async def get_feedback_list(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    search_column: Optional[str] = Query(None, description="Column to search in: message, category, or user_id"),
    status: str = Query("all", description="Filter by status: open, resolved, or all"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("submitted_at", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get paginated feedback list with filters.
    
    This endpoint retrieves feedback entries with comprehensive filtering options:
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 30, max: 100)
    - **search**: Search term to filter results
    - **search_column**: Specific column to search in (message, category, user_id)
    - **status**: Filter by status (open, resolved, all)
    - **date_from**: Start date for filtering (YYYY-MM-DD)
    - **date_to**: End date for filtering (YYYY-MM-DD)
    - **sort_by**: Column to sort by (id, submitted_at, satisfaction, recommendation)
    - **sort_order**: Sort order (asc, desc)
    
    Returns paginated feedback list with pagination metadata.
    """
    filters = {
        "page": page,
        "page_size": page_size,
        "search": search,
        "search_column": search_column,
        "status": status,
        "date_from": date_from,
        "date_to": date_to,
        "sort_by": sort_by,
        "sort_order": sort_order
    }
    
    return await feedback_controller.get_feedback_list_admin(db, request, filters)


@router.delete(
    "/delete/{feedback_id}",
    response_model=AdminDeleteResponse,
    status_code=200,
    summary="Delete Single Feedback",
    description="Delete a single feedback entry by ID.",
    responses={
        404: {
            "model": FeedbackErrorResponse,
            "description": "Feedback not found"
        }
    }
)
async def delete_feedback(
    request: Request,
    feedback_id: int = Path(..., description="The ID of the feedback to delete", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Delete a single feedback entry.
    
    This endpoint permanently deletes a feedback entry by its ID.
    Useful for removing spam, test entries, or inappropriate content.
    """
    return await feedback_controller.delete_feedback_admin(db, request, feedback_id)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    status_code=200,
    summary="Batch Delete Feedback",
    description="Delete multiple feedback entries in a single request.",
    response_description="Batch delete result with count"
)
async def batch_delete_feedback(
    request: Request,
    delete_request: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Delete multiple feedback entries.
    
    This endpoint accepts a list of feedback IDs and deletes them all in a single operation.
    Useful for bulk cleanup operations.
    
    - **ids**: List of feedback IDs to delete (required)
    
    Returns the count of successfully deleted entries.
    """
    return await feedback_controller.batch_delete_feedback_admin(db, request, delete_request.ids)


@router.post(
    "/mark-status/{feedback_id}",
    response_model=AdminFeedbackDetailResponse,
    status_code=200,
    summary="Mark Feedback Status",
    description="Update the status of a feedback entry (open/resolved).",
    responses={
        404: {
            "model": FeedbackErrorResponse,
            "description": "Feedback not found"
        }
    }
)
async def mark_feedback_status(
    request: Request,
    status_request: AdminFeedbackUpdateRequest,
    feedback_id: int = Path(..., description="The ID of the feedback to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Mark feedback status as open or resolved.
    
    This endpoint updates the status of a feedback entry and returns the updated feedback data.
    
    - **status**: New status value (required) - "open" or "resolved"
    
    Returns the updated feedback entry with all fields.
    """
    if not status_request.status:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Status is required"
            }
        )
    
    return await feedback_controller.mark_feedback_status_admin(
        db, request, feedback_id, status_request.status
    )


@router.patch(
    "/update/{feedback_id}",
    response_model=AdminFeedbackDetailResponse,
    status_code=200,
    summary="Update Feedback",
    description="Update feedback fields (status, category, etc.).",
    responses={
        404: {
            "model": FeedbackErrorResponse,
            "description": "Feedback not found"
        }
    }
)
async def update_feedback(
    request: Request,
    update_request: AdminFeedbackUpdateRequest,
    feedback_id: int = Path(..., description="The ID of the feedback to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Update feedback entry.
    
    This endpoint allows updating multiple fields of a feedback entry:
    - **status**: Feedback status (optional)
    - **category**: Feedback category (optional)
    
    Returns the updated feedback entry with all fields.
    """
    update_data = update_request.dict(exclude_none=True)
    
    if not update_data:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "At least one field must be provided for update"
            }
        )
    
    return await feedback_controller.update_feedback_admin(db, request, feedback_id, update_data)


@router.get(
    "/stats",
    response_model=AdminFeedbackStatsResponse,
    status_code=200,
    summary="Get Feedback Statistics",
    description="Get comprehensive feedback statistics for admin dashboard.",
    response_description="Feedback statistics including counts and averages"
)
async def get_feedback_statistics(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get feedback statistics.
    
    This endpoint retrieves comprehensive statistics about feedback:
    - **total**: Total number of feedback entries
    - **open**: Number of open feedback entries
    - **resolved**: Number of resolved feedback entries
    - **avg_satisfaction**: Average satisfaction rating
    - **avg_recommendation**: Average recommendation rating
    - **by_category**: Feedback count grouped by category
    
    Useful for admin dashboard and reporting.
    """
    return await feedback_controller.get_feedback_statistics_admin(db, request)
