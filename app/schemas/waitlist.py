"""
Waitlist Schemas
================

This module contains Pydantic schemas for waitlist functionality.
It defines request and response models for waitlist operations including
email submission, status management, and validation with comprehensive error handling.

Provides schemas for waitlist management, email validation, status tracking,
and administrative operations for user waitlist management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from app.schemas.common import APIResponse, ErrorResponse


class WaitlistRequest(BaseModel):
    """Request schema for waitlist email submission."""
    email: EmailStr = Field(..., description="Email address to add to waitlist")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class WaitlistResponse(BaseModel):
    """Response schema for waitlist operations."""
    id: int = Field(..., description="Waitlist entry ID")
    email: str = Field(..., description="Email address")
    status: str = Field(..., description="Waitlist status (pending, approved, rejected)")
    created_at: datetime = Field(..., description="When the entry was created")
    updated_at: datetime = Field(..., description="When the entry was last updated")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "user@example.com",
                "status": "pending",
                "created_at": "2025-01-11T10:30:00",
                "updated_at": "2025-01-11T10:30:00"
            }
        }


class WaitlistSuccessResponse(APIResponse):
    """Success response for waitlist operations."""
    data: WaitlistResponse = Field(..., description="Waitlist entry data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "id": 1,
                    "email": "user@example.com",
                    "status": "pending",
                    "created_at": "2025-01-11T10:30:00",
                    "updated_at": "2025-01-11T10:30:00"
                }
            }
        }


class WaitlistErrorResponse(ErrorResponse):
    """Error response for waitlist operations."""
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Email already exists in waitlist"
            }
        }


# ============================================================================
# Admin Schemas
# ============================================================================

class AdminWaitlistFilters(BaseModel):
    """Query parameters for admin waitlist list endpoint."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("email", description="Column to search in: id, email")
    status: Optional[str] = Field(None, description="Filter by status: pending, approved, rejected")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("id", description="Column to sort by: id, created_at")
    sort_order: str = Field("desc", description="Sort order: asc or desc")


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int
    page_size: int
    total: int
    total_pages: int


class WaitlistEntity(BaseModel):
    """Schema for waitlist database entity."""
    id: int
    email: str
    status: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class AdminWaitlistListResponse(BaseModel):
    """Response schema for admin waitlist list."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[WaitlistEntity] = Field(..., description="List of waitlist entries")
    pagination: PaginationMeta = Field(..., description="Pagination information")


class AdminBatchDeleteRequest(BaseModel):
    """Request schema for batch delete operation."""
    ids: List[int] = Field(..., description="List of waitlist IDs to delete", min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "ids": [1, 2, 3, 4, 5]
            }
        }


class AdminBatchDeleteResponse(BaseModel):
    """Response schema for batch delete operation."""
    success: bool = Field(True, description="Always true for successful responses")
    deleted_count: int = Field(..., description="Number of items deleted")
    message: str = Field(..., description="Success message")


class AdminWaitlistStatusUpdateRequest(BaseModel):
    """Request schema for updating waitlist status."""
    status: str = Field(..., description="New status: pending, approved, or rejected")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "approved"
            }
        }


class AdminWaitlistDetailResponse(BaseModel):
    """Response schema for admin waitlist detail operations."""
    success: bool = Field(True, description="Always true for successful responses")
    data: WaitlistEntity = Field(..., description="Waitlist data")
    message: str = Field(..., description="Success message")


class AdminWaitlistExportRequest(BaseModel):
    """Request schema for waitlist export."""
    format: str = Field("csv", description="Export format (only csv supported)")
    page: int = Field(1, ge=1, description="Page number (not used in export)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page (not used in export)")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("email", description="Column to search in")
    status: Optional[str] = Field(None, description="Filter by status")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("id", description="Column to sort by")
    sort_order: str = Field("desc", description="Sort order: asc or desc")


class AdminWaitlistExportResponse(BaseModel):
    """Response schema for waitlist export."""
    success: bool = Field(True, description="Always true for successful responses")
    download_url: str = Field(..., description="URL to download the exported file")
    filename: str = Field(..., description="Name of the exported file")
    expires_at: str = Field(..., description="ISO timestamp when the download link expires")


class AdminDeleteResponse(BaseModel):
    """Response schema for delete operations."""
    success: bool = Field(True, description="Always true for successful responses")
    data: Dict[str, str] = Field(..., description="Delete result data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Waitlist entry deleted successfully"
                }
            }
        }
