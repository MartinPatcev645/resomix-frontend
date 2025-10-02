"""
Admin Contact API Router
=========================

This module defines the FastAPI router for admin contact management endpoints.
It handles HTTP requests for contact list, filtering, deletion, status updates,
and export with authentication for administrative operations.

Provides comprehensive admin panel endpoints for managing user contact inquiries
in the ResomiX application.

Version: 1.0.0
Init Date: October 2, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.contact_controller import ContactController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
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
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    sort_by: str = Query("id", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Get paginated contact list with filters."""
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'user_id', 'name', 'email', 'message']
    if search_column and search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    filters = {
        "page": page, "page_size": page_size, "search": search,
        "search_column": search_column, "status": status,
        "date_from": date_from, "date_to": date_to,
        "sort_by": sort_by, "sort_order": sort_order
    }
    return await contact_controller.get_contact_list_admin(db, request, filters)


@router.delete(
    "/delete/{contact_id}",
    response_model=AdminDeleteResponse,
    status_code=200,
    summary="Delete Single Contact",
    description="Delete a single contact entry by ID."
)
async def delete_contact(
    request: Request,
    contact_id: int = Path(..., description="The ID of the contact to delete", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Delete a single contact entry."""
    return await contact_controller.delete_contact_admin(db, request, contact_id)


@router.post(
    "/batch-delete",
    response_model=AdminBatchDeleteResponse,
    status_code=200,
    summary="Batch Delete Contact",
    description="Delete multiple contact entries in a single request."
)
async def batch_delete_contact(
    request: Request,
    delete_request: AdminBatchDeleteRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Delete multiple contact entries."""
    return await contact_controller.batch_delete_contact_admin(db, request, delete_request.ids)


@router.post(
    "/mark-status/{contact_id}",
    response_model=AdminContactDetailResponse,
    status_code=200,
    summary="Mark Contact Status",
    description="Update the status of a contact entry (open/resolved)."
)
async def mark_contact_status(
    request: Request,
    status_request: ContactUpdateRequest,
    contact_id: int = Path(..., description="The ID of the contact to update", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Mark contact status as open or resolved."""
    if not status_request.status:
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Status is required"
        })
    return await contact_controller.mark_contact_status_admin(db, request, contact_id, status_request.status)


@router.post(
    "/export",
    response_model=AdminContactExportResponse,
    status_code=200,
    summary="Export Contact to CSV",
    description="Export contact data to CSV file with current filters and return download URL."
)
async def export_contact(
    request: Request,
    export_request: AdminContactExportRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """Export contact to CSV."""
    # Validate format
    if export_request.format != "csv":
        return JSONResponse(status_code=400, content={
            "success": False, "error": "Invalid format. Only 'csv' is supported."
        })
    
    # Validate search_column
    ALLOWED_SEARCH_COLUMNS = ['id', 'user_id', 'name', 'email', 'message']
    if export_request.search_column and export_request.search_column not in ALLOWED_SEARCH_COLUMNS:
        return JSONResponse(status_code=400, content={
            "success": False, "error": f"Invalid search_column. Allowed values: {', '.join(ALLOWED_SEARCH_COLUMNS)}"
        })
    
    filters = export_request.dict()
    return await contact_controller.export_contact_csv_admin(db, request, filters)
