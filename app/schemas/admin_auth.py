"""
Admin Authentication Schemas
===========================

Pydantic schemas for administrative authentication endpoints.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class AdminLoginRequest(BaseModel):
    """Admin login request"""
    email: EmailStr = Field(..., description="Admin email address")
    password: str = Field(..., description="Admin password")


class AdminUserShort(BaseModel):
    """Short user info for admin response"""
    uuid: str
    email: str
    name: Optional[str] = None
    roles: List[str] = []


class AdminLoginResponse(BaseModel):
    """Admin login response. The refresh token is delivered as an HttpOnly cookie, never in the body."""
    access_token: str
    token_type: str = "bearer"
    user: AdminUserShort


class AdminTokenRefreshResponse(BaseModel):
    """Admin token refresh response"""
    access_token: str
    token_type: str = "bearer"
