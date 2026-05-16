"""
Admin Waitlist API Router
==========================

This module defines the FastAPI router for admin waitlist management endpoints.
It handles HTTP requests for waitlist list, filtering, deletion, status updates,
and export with authentication for administrative operations.

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.waitlist_controller import WaitlistController
from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.waitlist import (
    AdminWaitlistListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminWaitlistDetailResponse,
    AdminWaitlistExportRequest,
    AdminWaitlistExportResponse,
    AdminDeleteResponse,
    WaitlistErrorResponse,
    AdminWaitlistStatusUpdateRequest
)

# Create router instance
router = APIRouter(
    prefix="/admin/waitlist",
    tags=["admin-waitlist"],
    responses={
        400: {"model": WaitlistErrorResponse},
        401: {"model": WaitlistErrorResponse},
        403: {"model": WaitlistErrorResponse},
        404: {"model": WaitlistErrorResponse},
        500: {"model": WaitlistErrorResponse}
    }
)

# Initialize controller
waitlist_controller = WaitlistController()


@router.get(
    "/",
    response_model=AdminWaitlistListResponse,
    status_code=200,
    summary="Get Paginated Waitlist",
    description="Get paginated waitlist with advanced filtering, searching, and sorting capabilities."
)
async def get_waitlist_list(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    search_column: Optional[str] = Query("email", description="Column to search in: id, email"),
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("id", description="Column to sort by: id, created_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Get paginated waitlist with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'email']
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    # Validate sort_by
    ALLOWED_SORT_COLUMNS = ['id', 'created_at']
    if sort_by and sort_by not in ALLOWED_SORT_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid sort_by. Allowed values: {', '.join(ALLOWED_SORT_COLUMNS)}"
        })
    
    # Validate status
    if status and status not in ['pending', 'approved', 'rejected']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid status. Must be 'pending', 'approved', or 'rejected'."
        })
    
    filters = {
        "page": page, "page_size": page_size, "search": search,
        "search_column": search_column, "status": status,
        "date_from": date_from, "date_to": date_to,
        "sort_by": sort_by, "sort_order": sort_order
    }
    return await waitlist_controller.get_waitlist_list_admin(db, request, filters, current_admin=current_admin)


@router.delete(
    "/{waitlist_id}",
    response_model=AdminDeleteResponse,
    summary="Delete Waitlist Entry",
    description="Permanently delete a single waitlist entry from the database."
)
async def delete_waitlist(
    request: Request,
    waitlist_id: int = Path(..., ge=1, description="Waitlist entry ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("waitlist:manage"))
) -> JSONResponse:
    """Delete a single waitlist entry."""
    return await waitlist_controller.delete_waitlist_admin(db, request, waitlist_id, current_admin=current_admin)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    summary="Batch Delete Waitlist",
    description="Delete multiple waitlist entries at once by providing their IDs."
)
async def batch_delete_waitlist(
    request: Request,
    request_data: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("waitlist:manage"))
) -> JSONResponse:
    """Delete multiple waitlist entries."""
    return await waitlist_controller.batch_delete_waitlist_admin(
        db, request, request_data.ids, current_admin=current_admin
    )


@router.post(
    "/update-status/{waitlist_id}",
    response_model=AdminWaitlistDetailResponse,
    summary="Update Waitlist Status",
    description="Update the status of a waitlist entry (pending, approved, rejected)."
)
async def update_waitlist_status(
    request: Request,
    status_request: AdminWaitlistStatusUpdateRequest,
    waitlist_id: int = Path(..., ge=1, description="Waitlist entry ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("waitlist:manage"))
) -> JSONResponse:
    """Update waitlist status."""
    if status_request.status not in ['pending', 'approved', 'rejected']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid status. Must be 'pending', 'approved', or 'rejected'."
        })
    return await waitlist_controller.update_waitlist_status_admin(
        db, request, waitlist_id, status_request.status, current_admin=current_admin
    )


@router.post(
    "/export",
    response_model=AdminWaitlistExportResponse,
    summary="Export Waitlist CSV",
    description="Generate a CSV export of waitlist data with filters and return a temporary download URL."
)
async def export_waitlist(
    request: Request,
    export_data: AdminWaitlistExportRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("reports:view"))
) -> JSONResponse:
    """Export waitlist to CSV."""
    if export_data.format != "csv":
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid format. Only 'csv' is supported."
        })
    
    filters = export_data.dict(exclude_none=True)
    return await waitlist_controller.export_waitlist_csv_admin(db, request, filters, current_admin=current_admin)
