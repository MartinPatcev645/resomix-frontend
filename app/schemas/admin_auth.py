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
    """Admin login step 1 — verify credentials and trigger the emailed 2FA code."""
    email: EmailStr = Field(..., description="Admin email address")
    password: str = Field(..., description="Admin password")


class AdminVerify2faRequest(BaseModel):
    """Admin login step 2 — email + password + the emailed 2FA code, verified together."""
    email: EmailStr = Field(..., description="Admin email address")
    password: str = Field(..., description="Admin password")
    code: str = Field(..., min_length=4, max_length=12, description="Verification code from email")


class Admin2faChallengeResponse(BaseModel):
    """Admin login step 1 response — signals that a code was emailed."""
    requires_2fa: bool = True
    message: str = "A verification code has been sent to your email."


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
