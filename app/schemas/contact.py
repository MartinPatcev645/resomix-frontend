"""
Contact Schemas
===============

This module contains Pydantic schemas for contact form functionality.
It defines request and response models for contact submissions, inquiry management,
and status updates with comprehensive validation and error handling.

Provides schemas for contact forms, field validation, status management,
and administrative operations for user inquiry tracking.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator, EmailStr
from datetime import datetime
from app.schemas.common import StatusEnum


class ContactRequest(BaseModel):
    """Request schema for contact form submission."""
    name: str = Field(..., description="Contact person's name", min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Contact person's email address")
    message: str = Field(..., description="Contact message", min_length=1, max_length=2000)
    subject: Optional[str] = Field(None, description="Optional subject line", max_length=150)
    phone: Optional[str] = Field(None, description="Optional phone number", max_length=20)
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None:
            # Basic phone validation - remove spaces, dashes, parentheses, and plus signs
            cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('+', '')
            if not cleaned.isdigit() or len(cleaned) < 7 or len(cleaned) > 15:
                raise ValueError('Invalid phone number format')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "message": "I would like to know more about your services",
                "subject": "General Inquiry",
                "phone": "+1-555-123-4567"
            }
        }


class ContactResponse(BaseModel):
    """Response schema for contact form submission."""
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Contact form submitted successfully and saved to database."
            }
        }


class ContactSuccessResponse(BaseModel):
    """Success response wrapper for contact form submission."""
    success: bool = Field(True, description="Always true for successful responses")
    data: ContactResponse = Field(..., description="Contact form submission result")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Contact form submitted successfully and saved to database."
                }
            }
        }


class ContactErrorResponse(BaseModel):
    """Error response schema for contact operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Name and email are required"
            }
        }


class ContactEntity(BaseModel):
    """Schema for contact database entity."""
    id: Optional[int] = Field(None, description="Contact record ID")
    user_id: Optional[str] = Field(None, description="User ID")
    name: Optional[str] = Field(None, description="Contact name")
    email: Optional[str] = Field(None, description="Contact email")
    subject: Optional[str] = Field(None, description="Contact subject")
    phone: Optional[str] = Field(None, description="Contact phone")
    message: Optional[str] = Field(None, description="Contact message")
    status: StatusEnum = Field(StatusEnum.OPEN, description="Contact status")
    submitted_at: Optional[str] = Field(None, description="Submission timestamp")

    class Config:
        from_attributes = True


class ContactUpdateRequest(BaseModel):
    """Request schema for updating contact status."""
    status: StatusEnum = Field(..., description="New status for the contact")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        }


# ============================================================================
# Admin Schemas
# ============================================================================

class AdminContactFilters(BaseModel):
    """Query parameters for admin contact list endpoint."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("message", description="Column to search in: id, user_id, name, email, message")
    status: Optional[str] = Field(None, description="Filter by status: open, resolved")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("id", description="Column to sort by")
    sort_order: str = Field("desc", description="Sort order: asc or desc")


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int
    page_size: int
    total: int
    total_pages: int


class AdminContactListResponse(BaseModel):
    """Response schema for admin contact list."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[ContactEntity] = Field(..., description="List of contact entries")
    pagination: PaginationMeta = Field(..., description="Pagination information")


class AdminBatchDeleteRequest(BaseModel):
    """Request schema for batch delete operation."""
    ids: List[int] = Field(..., description="List of contact IDs to delete", min_length=1)

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


class AdminContactDetailResponse(BaseModel):
    """Response schema for admin contact detail operations."""
    success: bool = Field(True, description="Always true for successful responses")
    data: ContactEntity = Field(..., description="Contact data")
    message: str = Field(..., description="Success message")


class AdminContactExportRequest(BaseModel):
    """Request schema for contact export."""
    format: str = Field("csv", description="Export format (only csv supported)")
    page: int = Field(1, ge=1, description="Page number (not used in export)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page (not used in export)")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("message", description="Column to search in")
    status: Optional[str] = Field(None, description="Filter by status")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("id", description="Column to sort by")
    sort_order: str = Field("desc", description="Sort order: asc or desc")


class AdminContactExportResponse(BaseModel):
    """Response schema for contact export."""
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
                    "message": "Contact deleted successfully"
                }
            }
        }
