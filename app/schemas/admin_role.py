r"""
Admin Role Management Schemas
============================

Pydantic models for RBAC role and permission management.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from .common import APIResponse


class PermissionSummary(BaseModel):
    """Available permission summary."""
    name: str = Field(..., description="Unique permission identifier")
    description: Optional[str] = Field(None, description="What this permission grants")


class RoleDetail(BaseModel):
    """Detailed role information including permissions."""
    name: str = Field(..., description="Unique role name")
    description: Optional[str] = Field(None, description="Purpose of the role")
    permissions: List[str] = Field(default_factory=list, description="List of permission names")


class RoleCreateRequest(BaseModel):
    """Request to create a new RBAC role."""
    name: str = Field(..., description="Unique role name (slug-like)")
    description: Optional[str] = Field(None, description="What this role represents")


class RoleListResponse(APIResponse):
    """List of all available roles."""
    data: List[RoleDetail] = Field(..., description="List of role details")
