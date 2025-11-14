"""
Spotify App Management Schemas
==============================

Pydantic models for admin Spotify app management.
Provides request/response schemas for managing multiple Spotify apps
and user associations.

Version: 3.0.1
Init Date: November 14, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, validator

from app.schemas.common import APIResponse, PaginationResponse, PaginatedResponse


# ============================================================================
# Spotify App Schemas
# ============================================================================

class SpotifyAppResponse(BaseModel):
    """Response schema for Spotify app (excludes client_secret)."""

    id: int = Field(..., description="Spotify app identifier")
    name: str = Field(..., description="App name")
    description: Optional[str] = Field(None, description="App description")
    client_id: str = Field(..., description="Spotify client ID")
    is_active: bool = Field(..., description="Whether the app is active")
    user_count: int = Field(..., description="Number of users associated with this app")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Resomix Production App",
                "description": "Main production Spotify app",
                "client_id": "abc123def456",
                "is_active": True,
                "user_count": 15,
                "created_at": "2025-11-14T10:00:00",
                "updated_at": "2025-11-14T10:00:00",
            }
        }


class SpotifyAppDetailResponse(BaseModel):
    """Detailed response for single Spotify app (includes optional client_secret for admin view)."""

    id: int = Field(..., description="Spotify app identifier")
    name: str = Field(..., description="App name")
    description: Optional[str] = Field(None, description="App description")
    client_id: str = Field(..., description="Spotify client ID")
    client_secret: Optional[str] = Field(None, description="Spotify client secret (admin only)")
    is_active: bool = Field(..., description="Whether the app is active")
    user_count: int = Field(..., description="Number of users associated with this app")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Resomix Production App",
                "description": "Main production Spotify app",
                "client_id": "abc123def456",
                "client_secret": "secret123",
                "is_active": True,
                "user_count": 15,
                "created_at": "2025-11-14T10:00:00",
                "updated_at": "2025-11-14T10:00:00",
            }
        }


class SpotifyAppListResponse(PaginatedResponse):
    """Paginated response for listing Spotify apps."""

    data: List[SpotifyAppResponse] = Field(..., description="List of Spotify apps")
    pagination: PaginationResponse = Field(..., description="Pagination metadata")


class SpotifyAppCreateRequest(BaseModel):
    """Request payload for creating a new Spotify app."""

    name: str = Field(..., description="App name (must be unique)", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="App description", max_length=255)
    client_id: str = Field(..., description="Spotify client ID (must be unique)", min_length=1)
    client_secret: str = Field(..., description="Spotify client secret", min_length=1)
    is_active: bool = Field(True, description="Whether the app should be active")

    @validator("name", "client_id", "client_secret")
    def not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must not be empty")
        return value.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Resomix Production App",
                "description": "Main production Spotify app",
                "client_id": "abc123def456",
                "client_secret": "secret123",
                "is_active": True,
            }
        }


class SpotifyAppUpdateRequest(BaseModel):
    """Request payload for updating a Spotify app."""

    name: Optional[str] = Field(None, description="App name (must be unique)", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="App description", max_length=255)
    client_id: Optional[str] = Field(None, description="Spotify client ID (must be unique)", min_length=1)
    client_secret: Optional[str] = Field(None, description="Spotify client secret", min_length=1)
    is_active: Optional[bool] = Field(None, description="Whether the app should be active")

    @validator("name", "client_id", "client_secret")
    def not_empty_if_provided(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            if not value or not value.strip():
                raise ValueError("must not be empty")
            return value.strip()
        return value

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Resomix Production App Updated",
                "description": "Updated description",
                "is_active": False,
            }
        }


class SpotifyAppDeleteResponse(BaseModel):
    """Response for deleting a Spotify app."""

    success: bool = Field(True, description="Whether deletion succeeded")
    message: str = Field(..., description="Human readable confirmation message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Spotify app deleted successfully",
            }
        }


# ============================================================================
# User Spotify App Association Schemas
# ============================================================================

class UserSpotifyAppResponse(BaseModel):
    """Response schema for user-Spotify app association."""

    user_id: int = Field(..., description="Internal user identifier")
    user_email: Optional[str] = Field(None, description="User email address")
    user_username: Optional[str] = Field(None, description="User username")
    user_uuid: Optional[str] = Field(None, description="Public user UUID")
    spotify_app_id: int = Field(..., description="Associated Spotify app identifier")
    spotify_app_name: Optional[str] = Field(None, description="Associated Spotify app name")
    created_at: datetime = Field(..., description="Association creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 42,
                "user_email": "user@example.com",
                "user_username": "dj42",
                "user_uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
                "spotify_app_id": 1,
                "spotify_app_name": "Resomix Production App",
                "created_at": "2025-11-14T10:00:00",
                "updated_at": "2025-11-14T10:00:00",
            }
        }


class UserSpotifyAppListFilters(BaseModel):
    """Query filters for listing user-Spotify app associations."""

    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(
        None, description="Search by email, username, or UUID (case insensitive)"
    )
    spotify_app_id: Optional[int] = Field(
        None, description="Filter by Spotify app ID"
    )

    @validator("search")
    def normalize_search(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class UserSpotifyAppListResponse(PaginatedResponse):
    """Paginated response for user-Spotify app associations."""

    data: List[UserSpotifyAppResponse] = Field(..., description="User associations")
    pagination: PaginationResponse = Field(..., description="Pagination metadata")


class UserSpotifyAppUpsertRequest(BaseModel):
    """Request payload for creating/updating a user-Spotify app association."""

    user_identifier: str = Field(
        ...,
        description="User email, UUID, username, or ID. The backend resolves to internal ID.",
        example="user@example.com",
    )
    spotify_app_id: int = Field(
        ..., description="Spotify app ID to associate with user", ge=1
    )

    @validator("user_identifier")
    def not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must not be empty")
        return value.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "user_identifier": "user@example.com",
                "spotify_app_id": 1,
            }
        }


class UserSpotifyAppDeleteResponse(BaseModel):
    """Response for deleting a user-Spotify app association."""

    success: bool = Field(True, description="Whether deletion succeeded")
    message: str = Field(..., description="Human readable confirmation message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "User association deleted successfully",
            }
        }


class UserSpotifyAppClientIdResponse(BaseModel):
    """Response for getting user's associated Spotify app client_id."""

    success: bool = Field(..., description="Whether the request succeeded")
    client_id: Optional[str] = Field(None, description="Spotify client ID if user has association")
    app_name: Optional[str] = Field(None, description="Spotify app name if user has association")
    message: Optional[str] = Field(
        None, description="Message explaining next steps if no association"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "success": True,
                    "client_id": "abc123def456",
                    "app_name": "Resomix Production App",
                    "message": None,
                },
                {
                    "success": False,
                    "client_id": None,
                    "app_name": None,
                    "message": "User not associated with any Spotify app. Please contact admin.",
                },
            ]
        }

