"""
User Schemas
============

This module contains Pydantic schemas for user management and role-based access control (RBAC).
It defines request and response models for user operations, role management,
and permission handling with comprehensive validation and error handling.

Provides schemas for user authentication, role assignments, permission validation,
and administrative operations for access control management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field

from app.schemas.common import APIResponse


class UserSearchItem(BaseModel):
    """Lightweight user representation for search results."""

    id: int = Field(..., description="Internal user ID")
    uuid: str = Field(..., description="Public user UUID")
    email: str = Field(..., description="User email address")
    username: str = Field(..., description="User handle/username")
    name: Optional[str] = Field(None, description="Display name if available")
    is_email_verified: bool = Field(..., description="Email verification status")
    created_at: Optional[datetime] = Field(
        None, description="Account creation timestamp"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": 42,
                "uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
                "email": "dj@example.com",
                "username": "dj42",
                "name": "DJ Example",
                "is_email_verified": True,
                "created_at": "2025-01-15T12:30:45",
            }
        }


class UserSearchResultsResponse(APIResponse):
    """Response payload for user search."""

    data: List[UserSearchItem] = Field(
        default_factory=list, description="Matching users"
    )


class RoleInfo(BaseModel):
    """Basic role information."""
    id: int
    name: str
    description: Optional[str] = None


class AdminUserItem(BaseModel):
    """Detailed user representation for admin panel."""
    id: int
    uuid: str
    email: str
    username: str
    name: Optional[str] = None
    is_active: bool
    roles: List[RoleInfo] = []
    created_at: Optional[datetime] = None


class AdminUserListResponse(APIResponse):
    """Paginated user list for admin."""
    data: List[AdminUserItem]
    pagination: Dict[str, Any]


class UserRoleAssignmentRequest(BaseModel):
    """Request to assign or remove a role."""
    role_id: int


class UserStatusUpdateRequest(BaseModel):
    """Request to update user active status."""
    is_active: bool


class RoleCreateRequest(BaseModel):
    """Request to create a new role."""
    name: str
    description: Optional[str] = None


class RolePermissionsUpdateRequest(BaseModel):
    """Request to update role permissions."""
    permission_ids: List[int]
