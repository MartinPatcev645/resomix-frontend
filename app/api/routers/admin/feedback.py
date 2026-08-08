"""
Admin Feedback API Router
==========================

This module defines the FastAPI router for admin feedback management endpoints.
It handles HTTP requests for feedback list, filtering, deletion, status updates,
and statistics with authentication for administrative operations.

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminFeedbackUpdateRequest,
    AdminFeedbackDetailResponse,
    AdminFeedbackStatsResponse,
    AdminDeleteResponse,
    AdminFeedbackExportRequest,
    AdminFeedbackExportResponse,
    FeedbackErrorResponse
)

# Create router instance
router = APIRouter(
    prefix="/admin/feedback",
    tags=["admin-feedback"],
    responses={
        400: {"model": FeedbackErrorResponse},
        401: {"model": FeedbackErrorResponse},
        403: {"model": FeedbackErrorResponse},
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
    description="Get paginated feedback list with advanced filtering, searching, and sorting capabilities."
)
async def get_feedback_list(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    search_column: Optional[str] = Query("message", description="Column to search in: message or id"),
    status: str = Query("all", description="Filter by status: open, resolved, or all"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("submitted_at", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Get paginated feedback list with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['message', 'id']
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    # Validate status
    if status and status not in ['open', 'resolved', 'all']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid status. Must be 'open', 'resolved', or 'all'."
        })
    
    filters = {
        "page": page, "page_size": page_size, "search": search,
        "search_column": search_column, "status": status,
        "date_from": date_from, "date_to": date_to,
        "sort_by": sort_by, "sort_order": sort_order
    }
    return await feedback_controller.get_feedback_list_admin(db, request, filters, current_admin=current_admin)


@router.get(
    "/stats",
    response_model=AdminFeedbackStatsResponse,
    summary="Get Feedback Statistics",
    description="Get overview statistics for user feedback (total, open, resolved, category breakdown)."
)
async def get_feedback_stats(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Get feedback statistics."""
    return await feedback_controller.get_feedback_statistics_admin(db, request, current_admin=current_admin)


@router.get(
    "/{feedback_id}",
    response_model=AdminFeedbackDetailResponse,
    summary="Get Feedback Detail",
    description="Get full detail for a single feedback entry."
)
async def get_feedback_detail(
    request: Request,
    feedback_id: int = Path(..., ge=1, description="Feedback ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Full detail for one piece of feedback.

    Everything we hold, plus WHO sent it. Feedback carries no email of its own, so a guest
    submission genuinely cannot be matched to an account — the request metadata is all there is,
    and the response says so rather than implying otherwise.
    """
    from fastapi import status as http_status

    from app.services.submission_detail_service import SubmissionDetailService
    from app.utils.response_utils import format_response

    data = await SubmissionDetailService().feedback(db, feedback_id)
    if data is None:
        return JSONResponse(
            status_code=http_status.HTTP_404_NOT_FOUND,
            content=format_response(success=False, error="Feedback not found"),
        )
    return JSONResponse(
        status_code=http_status.HTTP_200_OK,
        content=format_response(success=True, data=data),
    )


@router.patch(
    "/{feedback_id}/status",
    response_model=AdminFeedbackDetailResponse,
    summary="Update Feedback Status",
    description="Mark feedback as open or resolved."
)
async def update_feedback_status(
    request: Request,
    status_data: AdminFeedbackUpdateRequest,
    feedback_id: int = Path(..., ge=1, description="Feedback ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("feedback:manage"))
) -> JSONResponse:
    """Update feedback status."""
    return await feedback_controller.mark_feedback_status_admin(
        db, request, feedback_id, status_data.status, current_admin=current_admin
    )


@router.delete(
    "/{feedback_id}",
    response_model=AdminDeleteResponse,
    summary="Delete Feedback",
    description="Permanently delete a feedback entry."
)
async def delete_feedback(
    request: Request,
    feedback_id: int = Path(..., ge=1, description="Feedback ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("feedback:manage"))
) -> JSONResponse:
    """Delete feedback entry."""
    return await feedback_controller.delete_feedback_admin(db, request, feedback_id, current_admin=current_admin)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    summary="Batch Delete Feedback",
    description="Delete multiple feedback entries at once."
)
async def batch_delete_feedback(
    request: Request,
    request_data: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("feedback:manage"))
) -> JSONResponse:
    """Batch delete feedback entries."""
    return await feedback_controller.batch_delete_feedback_admin(
        db, request, request_data.ids, current_admin=current_admin
    )


@router.post(
    "/export",
    response_model=AdminFeedbackExportResponse,
    summary="Export Feedback CSV",
    description="Generate a CSV export of feedback data."
)
async def export_feedback(
    request: Request,
    export_data: AdminFeedbackExportRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("reports:view"))
) -> JSONResponse:
    """Export feedback to CSV."""
    filters = export_data.dict(exclude_none=True)
    return await feedback_controller.export_feedback_csv_admin(db, request, filters, current_admin=current_admin)
