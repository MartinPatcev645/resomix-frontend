"""
Admin Contact API Router
=========================

This module defines the FastAPI router for admin contact management endpoints.
It handles HTTP requests for contact list, filtering, deletion, status updates,
and export with authentication for administrative operations.

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.contact_controller import ContactController
from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.contact import (
    AdminContactListResponse,
    AdminBatchDeleteRequest,
    AdminBatchDeleteResponse,
    AdminContactDetailResponse,
    AdminContactExportRequest,
    AdminContactExportResponse,
    AdminDeleteResponse,
    ContactErrorResponse,
    ContactUpdateRequest
)

# Create router instance
router = APIRouter(
    prefix="/admin/contact",
    tags=["admin-contact"],
    responses={
        400: {"model": ContactErrorResponse},
        401: {"model": ContactErrorResponse},
        403: {"model": ContactErrorResponse},
        404: {"model": ContactErrorResponse},
        500: {"model": ContactErrorResponse}
    }
)

# Initialize controller
contact_controller = ContactController()


@router.get(
    "/",
    response_model=AdminContactListResponse,
    status_code=200,
    summary="Get Paginated Contact List",
    description="Get paginated contact list with advanced filtering, searching, and sorting capabilities."
)
async def get_contact_list(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    search_column: Optional[str] = Query("message", description="Column to search in: id, user_id, name, email, message"),
    status: Optional[str] = Query(None, description="Filter by status: open, resolved"),
    contact_type: Optional[str] = Query(None, description="Filter by type: consumer, partner"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("id", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Get paginated contact list with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'user_id', 'name', 'email', 'message']
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })

    # Validate status
    if status and status not in ['open', 'resolved']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid status. Must be 'open' or 'resolved'."
        })

    # Validate contact_type
    if contact_type and contact_type not in ['consumer', 'partner']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid contact_type. Must be 'consumer' or 'partner'."
        })

    filters = {
        "page": page, "page_size": page_size, "search": search,
        "search_column": search_column, "status": status, "contact_type": contact_type,
        "date_from": date_from, "date_to": date_to,
        "sort_by": sort_by, "sort_order": sort_order
    }
    return await contact_controller.get_contact_list_admin(db, request, filters, current_admin=current_admin)


@router.get(
    "/{contact_id}",
    response_model=AdminContactDetailResponse,
    summary="Get Contact Detail",
    description="Get full detail for a single contact entry."
)
async def get_contact_detail(
    request: Request,
    contact_id: int = Path(..., ge=1, description="Contact ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """Get contact detail."""
    return await contact_controller.get_contact_by_id(db, request, contact_id)


@router.delete(
    "/{contact_id}",
    response_model=AdminDeleteResponse,
    summary="Delete Contact",
    description="Permanently delete a contact entry."
)
async def delete_contact(
    request: Request,
    contact_id: int = Path(..., ge=1, description="Contact ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("contact:manage"))
) -> JSONResponse:
    """Delete contact entry."""
    return await contact_controller.delete_contact_admin(db, request, contact_id, current_admin=current_admin)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    summary="Batch Delete Contacts",
    description="Delete multiple contact entries at once."
)
async def batch_delete_contacts(
    request: Request,
    request_data: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("contact:manage"))
) -> JSONResponse:
    """Batch delete contact entries."""
    return await contact_controller.batch_delete_contact_admin(
        db, request, request_data.ids, current_admin=current_admin
    )


@router.post(
    "/mark-status/{contact_id}",
    response_model=AdminContactDetailResponse,
    summary="Update Contact Status",
    description="Mark contact as open or resolved."
)
async def update_contact_status(
    request: Request,
    status_data: ContactUpdateRequest,
    contact_id: int = Path(..., ge=1, description="Contact ID"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("contact:manage"))
) -> JSONResponse:
    """Update contact status."""
    if status_data.status not in ['open', 'resolved']:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid status. Must be 'open' or 'resolved'."
        })
    return await contact_controller.mark_contact_status_admin(
        db, request, contact_id, status_data.status, current_admin=current_admin
    )


@router.post(
    "/export",
    response_model=AdminContactExportResponse,
    summary="Export Contact CSV",
    description="Generate a CSV export of contact data."
)
async def export_contact(
    request: Request,
    export_data: AdminContactExportRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("reports:view"))
) -> JSONResponse:
    """Export contact to CSV."""
    if export_data.format != "csv":
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid format. Only 'csv' is supported."
        })
    
    filters = export_data.dict(exclude_none=True)
    return await contact_controller.export_contact_csv_admin(db, request, filters, current_admin=current_admin)
