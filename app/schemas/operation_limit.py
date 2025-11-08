"""
Operation Limit Schemas
=======================

Pydantic models for admin operation limit management.
Provides request/response schemas for listing operation types and
managing per-user operation limits.

Version: 3.0.1
Init Date: November 08, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, validator

from app.schemas.common import APIResponse, PaginationResponse, PaginatedResponse


class OperationTypeResponse(BaseModel):
    """Representation of an operation type."""

    id: int = Field(..., description="Operation type identifier")
    code: str = Field(..., description="Stable operation code")
    description: Optional[str] = Field(None, description="Human readable description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "code": "playlist_create",
                "description": "Maximum playlists the user can create",
            }
        }


class AdminOperationTypeListResponse(BaseModel):
    """Response for listing operation types."""

    success: bool = Field(True, description="Whether request succeeded")
    data: List[OperationTypeResponse] = Field(..., description="Operation types")
    total: int = Field(..., description="Total operation types available")


class UserOperationLimitResponse(BaseModel):
    """Detailed per-user operation limit."""

    user_id: int = Field(..., description="Internal user identifier")
    user_uuid: Optional[str] = Field(None, description="Public user UUID if available")
    user_email: Optional[str] = Field(None, description="User email address")
    user_username: Optional[str] = Field(None, description="User username")
    operation_id: int = Field(..., description="Operation type identifier")
    operation_code: str = Field(..., description="Operation type code")
    operation_description: Optional[str] = Field(None, description="Operation description")
    limit_value: int = Field(..., description="Maximum allowed occurrences")
    window_seconds: Optional[int] = Field(
        None, description="Sliding window in seconds for rate limited operations"
    )
    playlist_count: Optional[int] = Field(
        None,
        description="Current number of playlists created by the user (for playlist creation limits)",
    )
    created_by: Optional[int] = Field(None, description="Admin user who created the limit")
    created_at: Optional[str] = Field(None, description="Creation timestamp (ISO format)")
    updated_at: Optional[str] = Field(None, description="Last update timestamp (ISO format)")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 42,
                "user_uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
                "user_email": "dj@example.com",
                "user_username": "dj42",
                "operation_id": 1,
                "operation_code": "playlist_create",
                "operation_description": "Maximum playlists the user can create",
                "limit_value": 15,
                "window_seconds": None,
                "playlist_count": 7,
                "created_by": 1,
                "created_at": "2025-10-02T12:00:00",
                "updated_at": "2025-10-03T09:45:00",
            }
        }


class UserOperationLimitListFilters(BaseModel):
    """Query filters for listing user operation limits."""

    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(
        None, description="Search by email, username, or UUID (case insensitive)"
    )
    operation_code: Optional[str] = Field(
        None, description="Filter by operation code (e.g., playlist_create)"
    )

    @validator("search")
    def normalize_search(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class UserOperationLimitListResponse(PaginatedResponse):
    """Paginated response for user operation limits."""

    data: List[UserOperationLimitResponse] = Field(..., description="User operation limits")
    pagination: PaginationResponse = Field(..., description="Pagination metadata")

class UserOperationLimitDetailResponse(APIResponse):
    """Response wrapper for single user operation limit."""

    data: Optional[UserOperationLimitResponse] = Field(
        None, description="User operation limit details"
    )


class UserOperationLimitUpsertRequest(BaseModel):
    """Request payload for creating/updating a user operation limit."""

    user_identifier: str = Field(
        ...,
        description="User email or UUID. The backend resolves to internal ID.",
        example="user@example.com",
    )
    operation_code: str = Field(
        ..., description="Operation type code to limit", example="playlist_create"
    )
    limit_value: int = Field(
        ...,
        ge=0,
        description="Maximum allowed count (0 blocks the operation, omit for unlimited behavior)",
    )
    window_seconds: Optional[int] = Field(
        None,
        ge=60,
        description="Optional rolling window in seconds (minimum 60) for rate-limited operations",
    )

    @validator("user_identifier", "operation_code")
    def not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must not be empty")
        return value.strip()


class UserOperationLimitDeleteResponse(BaseModel):
    """Response for deleting a user operation limit."""

    success: bool = Field(True, description="Whether deletion succeeded")
    message: str = Field(..., description="Human readable confirmation message")
