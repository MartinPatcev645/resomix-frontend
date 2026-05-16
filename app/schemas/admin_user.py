"""
Admin User Management Schemas
============================

Pydantic models for administrative user management operations.
Follows strictly decoupled approach from consumer schemas.

Version: 1.0.0
Date: May 16, 2026
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from .common import APIResponse


class AdminUserSummary(BaseModel):
    """Summary of user for admin list view."""
    uuid: str = Field(..., description="Public user identifier")
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., description="User handle")
    name: Optional[str] = Field(None, description="Display name")
    partner_id: int = Field(..., description="Owner partner ID")
    is_active: bool = Field(..., description="Whether account is active")
    is_email_verified: bool = Field(..., description="Whether email is verified")
    roles: List[str] = Field(default_factory=list, description="List of role names")
    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


class AdminUserDetail(AdminUserSummary):
    """
    Full detail of user for admin view.
    In Phase 2, this will include limits, sessions, and SFTP linkage.
    """
    last_login: Optional[datetime] = Field(None, description="Last recorded activity")


class AdminUserCreateRequest(BaseModel):
    """Request to create a user manually via admin."""
    email: EmailStr = Field(..., description="New user email")
    username: str = Field(..., description="New user handle")
    password: str = Field(..., description="Temporary or initial password")
    name: Optional[str] = Field(None, description="Display name")
    partner_id: int = Field(1, description="Partner to link user to")
    initial_role: Optional[str] = Field("user", description="Initial role to assign")


class AdminUserUpdateRequest(BaseModel):
    """Request to update user profile via admin."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    name: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    is_email_verified: Optional[bool] = None


class AdminRoleAssignRequest(BaseModel):
    """Request to assign a role to a user."""
    role_name: str = Field(..., description="Name of role to assign")


class AdminUserListResponse(APIResponse):
    """Paginated user list for admin."""
    data: List[AdminUserSummary] = Field(..., description="List of user summaries")
    total: int = Field(..., description="Total count across all pages")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
