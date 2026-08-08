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
from app.schemas.common import StatusEnum


class ContactRequest(BaseModel):
    """Request schema for contact form submission (both the consumer contact form and the B2B
    /partners developer form — distinguished by ``contact_type``)."""
    name: str = Field(..., description="Contact person's name", min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Contact person's email address")
    # Optional: consumer contact messages are typically required client-side, but a B2B partner
    # request can be valid without a free-text use-case (the structured fields carry the intent).
    message: Optional[str] = Field(None, description="Contact message / use case", max_length=2000)
    subject: Optional[str] = Field(None, description="Optional subject line", max_length=150)
    phone: Optional[str] = Field(None, description="Optional phone number", max_length=20)
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")

    # Which form this came from — drives admin categorization + which confirmation copy is sent.
    contact_type: Optional[str] = Field("consumer", description="'consumer' or 'partner'")
    # B2B partner-request fields (ignored for consumer contacts). Each landing form fills only the
    # subset it asks for — /partners sends role/partner_type/preferred_path/catalog_context, the
    # /partners-pilot form sends role/partner_type/catalog_size — so all of these stay optional.
    company_name: Optional[str] = Field(None, description="Legal / company name (B2B)", max_length=150)
    role: Optional[str] = Field(None, description="Submitter's role / job title (B2B)", max_length=120)
    partner_type: Optional[str] = Field(None, description="Partner type: label, distributor, store… (B2B)", max_length=80)
    preferred_path: Optional[str] = Field(None, description="Preferred engagement path (B2B)", max_length=80)
    catalog_context: Optional[str] = Field(None, description="Catalogue or product context, free text (B2B)", max_length=255)
    catalog_size: Optional[str] = Field(None, description="Estimated catalog size in tracks (B2B)", max_length=60)
    estimated_calls: Optional[str] = Field(None, description="Estimated monthly API calls / tier (B2B)", max_length=120)

    @validator('contact_type')
    def validate_contact_type(cls, v):
        if v is None:
            return "consumer"
        if v not in ("consumer", "partner"):
            raise ValueError("contact_type must be 'consumer' or 'partner'")
        return v

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
    contact_type: Optional[str] = Field("consumer", description="'consumer' or 'partner'")
    company_name: Optional[str] = Field(None, description="Legal / company name (B2B)")
    role: Optional[str] = Field(None, description="Submitter's role / job title (B2B)")
    partner_type: Optional[str] = Field(None, description="Partner type (B2B)")
    preferred_path: Optional[str] = Field(None, description="Preferred engagement path (B2B)")
    catalog_context: Optional[str] = Field(None, description="Catalogue or product context (B2B)")
    catalog_size: Optional[str] = Field(None, description="Estimated catalog size in tracks (B2B)")
    estimated_calls: Optional[str] = Field(None, description="Estimated monthly API calls / tier (B2B)")
    status: StatusEnum = Field(StatusEnum.OPEN, description="Contact status")
    submitted_at: Optional[str] = Field(None, description="Submission timestamp")

    class Config:
        from_attributes = True


class SubmissionRequestMeta(BaseModel):
    """Where a submission came from. Both nullable: rows predating capture have neither."""
    client_ip: Optional[str] = Field(None, description="Caller IP, proxy headers honoured")
    user_agent: Optional[str] = Field(None, description="Raw User-Agent string")


class SubmissionSubmitter(BaseModel):
    """Who sent it.

    Two shapes in one model, distinguished by ``matched_account``. When false, everything below it
    is absent — we genuinely do not know who this was, and padding the fields out would invite an
    admin to trust an anonymous form fill.
    """
    type: str = Field(..., description="'account' or 'guest'")
    matched_account: bool = Field(..., description="False when no account could be resolved")
    matched_by_email: Optional[bool] = Field(
        None,
        description="True when they were NOT signed in and we matched on the email they typed — "
                    "an inference, not a verified session",
    )
    id: Optional[int] = None
    uuid: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
    is_email_verified: Optional[bool] = None
    created_at: Optional[str] = None
    last_seen_at: Optional[str] = None
    deactivated_at: Optional[str] = None
    plan: Optional[Dict[str, Any]] = Field(None, description="Effective plan: {code, name}")
    total_contacts: Optional[int] = Field(None, description="-1 when the count was unavailable")
    total_feedbacks: Optional[int] = Field(None, description="-1 when the count was unavailable")


class SubmissionReply(BaseModel):
    """A reply already sent for this submission, so nobody answers the same thread twice."""
    id: int
    subject: Optional[str] = None
    body: Optional[str] = None
    recipient_email: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[str] = None


class ContactDetailEntity(ContactEntity):
    """One contact submission in full, as the admin detail screen receives it.

    Extends the list entity rather than restating it, so the two can never drift apart.
    """
    business: Optional[Dict[str, Any]] = Field(
        None, description="B2B answers, grouped. Only populated on a partner request."
    )
    request: Optional[SubmissionRequestMeta] = None
    submitter: Optional[SubmissionSubmitter] = None
    replies: List[SubmissionReply] = Field(default_factory=list)


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
    data: ContactDetailEntity = Field(..., description="Contact data, submitter and replies")
    message: Optional[str] = Field(None, description="Success message")


class AdminContactExportRequest(BaseModel):
    """Request schema for contact export."""
    format: str = Field("csv", description="Export format (only csv supported)")
    page: int = Field(1, ge=1, description="Page number (not used in export)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page (not used in export)")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("message", description="Column to search in")
    status: Optional[str] = Field(None, description="Filter by status")
    contact_type: Optional[str] = Field(None, description="Filter by type: consumer, partner")
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
