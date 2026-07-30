"""
Authentication Schemas
======================

Pydantic schemas for authentication endpoints including registration, login,
email verification, password reset, 2FA, and user profile management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, validator


# ============================================================================
# Registration Schemas
# ============================================================================

class RegisterRequest(BaseModel):
    """User registration request"""

    email: EmailStr = Field(..., description="User email address")
    # Optional: the sign-up form only asks for email + password. When omitted the server derives
    # the username from the email's local part and resolves collisions itself — a client cannot do
    # that safely (it would need to probe for availability and would still race).
    username: Optional[str] = Field(
        None, min_length=3, max_length=50, description="Unique username (derived from email if omitted)"
    )
    password: str = Field(..., min_length=8, description="User password")
    name: Optional[str] = Field(None, max_length=100, description="Display name")

    @validator("username")
    def validate_username_format(cls, v):
        """Validate username format"""
        if v is None:
            return v
        if not v[0].isalpha():
            raise ValueError("Username must start with a letter")
        # Mirrors core.security.validate_username — dots included, since derived usernames keep
        # the dots from the email local part.
        if not all(c.isalnum() or c in "._-" for c in v):
            raise ValueError(
                "Username can only contain letters, numbers, dots, underscores, and hyphens"
            )
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "johndoe",
                "password": "SecurePass123",
                "name": "John Doe",
            }
        }


class RegisterResponse(BaseModel):
    """User registration response"""

    user_uuid: str = Field(..., description="User's external UUID")
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., description="Username")
    message: str = Field(
        default="Registration successful. Please check your email to verify your account.",
        description="Success message",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_uuid": "550e8400-e29b-41d4-a716-446655440000",
                "email": "user@example.com",
                "username": "johndoe",
                "message": "Registration successful. Please check your email to verify your account.",
            }
        }


# ============================================================================
# Login Schemas
# ============================================================================

class LoginRequest(BaseModel):
    """User login request"""

    email_or_username: str = Field(..., description="Email address or username")
    password: str = Field(..., description="User password")

    class Config:
        json_schema_extra = {
            "example": {"email_or_username": "user@example.com", "password": "SecurePass123"}
        }


class LoginResponse(BaseModel):
    """Successful login response (refresh token set in HttpOnly cookie)"""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    user: dict = Field(..., description="User information")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "user": {
                    "uuid": "550e8400-e29b-41d4-a716-446655440000",
                    "email": "user@example.com",
                    "username": "johndoe",
                    "name": "John Doe",
                    "profile_picture": "https://example.com/avatar.jpg",
                    "language": "en",
                    "timezone": "UTC",
                    "is_email_verified": True,
                    "is_two_factor_enabled": False,
                    "two_factor_method": "email",
                    "created_at": "2025-10-23T10:30:00Z",
                },
            }
        }


class GoogleLoginRequest(BaseModel):
    """'Continue with Google' request — the ID token issued by Google Identity Services."""

    credential: str = Field(..., description="Google ID token (JWT) from the GIS button / One Tap")

    class Config:
        json_schema_extra = {"example": {"credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."}}


class TwoFactorRequiredResponse(BaseModel):
    """2FA required response"""

    requires_2fa: bool = Field(default=True, description="Indicates 2FA is required")
    user_id: int = Field(..., description="User ID for 2FA verification")
    message: str = Field(
        default="Two-factor authentication required. Please check your email for the verification code.",
        description="Instruction message",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "requires_2fa": True,
                "user_id": 123,
                "message": "Two-factor authentication required. Please check your email for the verification code.",
            }
        }


class TwoFactorVerifyRequest(BaseModel):
    """2FA verification request"""

    user_id: int = Field(..., description="User ID from initial login")
    code: str = Field(..., min_length=6, max_length=10, description="2FA verification code")

    class Config:
        json_schema_extra = {"example": {"user_id": 123, "code": "123456"}}


class TokenRefreshRequest(BaseModel):
    """Token refresh request (DEPRECATED - now uses HttpOnly cookie)"""

    refresh_token: str = Field(..., description="Valid refresh token")

    class Config:
        json_schema_extra = {
            "example": {"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
        }


class TokenRefreshResponse(BaseModel):
    """Token refresh response (new refresh token set in HttpOnly cookie)"""

    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }


# ============================================================================
# Email Verification Schemas
# ============================================================================

class EmailVerificationRequest(BaseModel):
    """Email verification request"""

    token: str = Field(..., description="Email verification token from email")

    class Config:
        json_schema_extra = {
            "example": {"token": "abc123def456ghi789jkl012mno345pqr678"}
        }


class ResendVerificationRequest(BaseModel):
    """Resend verification email request"""

    email: EmailStr = Field(..., description="User email address")

    class Config:
        json_schema_extra = {"example": {"email": "user@example.com"}}


class EmailVerificationResponse(BaseModel):
    """Email verification response"""

    message: str = Field(..., description="Success message")
    user_uuid: str = Field(..., description="User's external UUID")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Email verified successfully!",
                "user_uuid": "550e8400-e29b-41d4-a716-446655440000",
            }
        }


# ============================================================================
# Password Reset Schemas
# ============================================================================

class PasswordResetRequest(BaseModel):
    """Password reset request"""

    email: EmailStr = Field(..., description="User email address")

    class Config:
        json_schema_extra = {"example": {"email": "user@example.com"}}


class PasswordResetResponse(BaseModel):
    """Password reset response"""

    message: str = Field(
        default="If the email exists, a password reset link has been sent.",
        description="Success message (same for existing and non-existing emails for security)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "If the email exists, a password reset link has been sent."
            }
        }


class PasswordResetConfirmRequest(BaseModel):
    """Password reset confirmation request"""

    token: str = Field(..., description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New password")

    class Config:
        json_schema_extra = {
            "example": {
                "token": "abc123def456ghi789jkl012mno345pqr678",
                "new_password": "NewSecurePass123",
            }
        }


class ChangePasswordRequest(BaseModel):
    """Change (or first-time set) password request for an authenticated user.

    `current_password` is optional: social-login accounts (e.g. Google) have no password yet, so
    this same endpoint sets the first one. When a password already exists the server still requires
    the correct current password.
    """

    current_password: Optional[str] = Field(default="", description="Current password (omit when setting the first one)")
    new_password: str = Field(..., min_length=8, description="New password")

    class Config:
        json_schema_extra = {
            "example": {
                "current_password": "OldSecurePass123",
                "new_password": "NewSecurePass123",
            }
        }


# ============================================================================
# User Profile Schemas
# ============================================================================

class UserProfileResponse(BaseModel):
    """User profile response"""

    uuid: str = Field(..., description="User's external UUID")
    email: EmailStr = Field(..., description="Email address")
    username: str = Field(..., description="Username")
    name: Optional[str] = Field(None, description="Display name")
    profile_picture: Optional[str] = Field(None, description="Profile picture URL")
    language: Optional[str] = Field(None, description="Preferred language")
    timezone: Optional[str] = Field(None, description="User timezone")
    is_email_verified: bool = Field(..., description="Email verification status")
    is_two_factor_enabled: bool = Field(..., description="2FA enabled status")
    two_factor_method: Optional[str] = Field(None, description="2FA method (email/app)")
    created_at: datetime = Field(..., description="Account creation date")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "uuid": "550e8400-e29b-41d4-a716-446655440000",
                "email": "user@example.com",
                "username": "johndoe",
                "name": "John Doe",
                "profile_picture": "https://example.com/avatar.jpg",
                "language": "en",
                "timezone": "UTC",
                "is_email_verified": True,
                "is_two_factor_enabled": False,
                "two_factor_method": "email",
                "created_at": "2025-10-23T10:30:00Z",
            }
        }


class UpdateProfileRequest(BaseModel):
    """Update profile request"""

    name: Optional[str] = Field(None, max_length=100, description="Display name")
    language: Optional[str] = Field(None, max_length=10, description="Preferred language")
    timezone: Optional[str] = Field(None, max_length=50, description="User timezone")
    profile_picture: Optional[str] = Field(None, max_length=255, description="Profile picture URL")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Smith",
                "language": "en",
                "timezone": "America/New_York",
                "profile_picture": "https://example.com/new-avatar.jpg",
            }
        }


# ============================================================================
# Session Management Schemas
# ============================================================================

class UserSessionResponse(BaseModel):
    """User session response"""

    session_id: str = Field(..., description="Session ID")
    user_agent: Optional[str] = Field(None, description="User agent string")
    ip_address: Optional[str] = Field(None, description="IP address")
    created_at: Optional[str] = Field(None, description="Session creation time")
    expires_at: Optional[str] = Field(None, description="Session expiration time")

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
                "ip_address": "192.168.1.1",
                "created_at": "2025-10-23T10:30:00Z",
                "expires_at": "2025-11-22T10:30:00Z",
            }
        }


# ============================================================================
# 2FA Management Schemas
# ============================================================================

class Enable2FARequest(BaseModel):
    """Enable 2FA request"""

    method: str = Field(default="email", description="2FA method (email or app)")

    @validator("method")
    def validate_method(cls, v):
        """Validate 2FA method"""
        if v not in ["email", "app"]:
            raise ValueError("Method must be 'email' or 'app'")
        return v

    class Config:
        json_schema_extra = {"example": {"method": "email"}}


class Disable2FARequest(BaseModel):
    """Disable 2FA request"""

    password: str = Field(..., description="Password for confirmation")

    class Config:
        json_schema_extra = {"example": {"password": "SecurePass123"}}


class DeleteAccountRequest(BaseModel):
    """Delete account request"""

    password: str = Field(..., description="Password for confirmation")

    class Config:
        json_schema_extra = {"example": {"password": "SecurePass123"}}


# ============================================================================
# Generic Response Schemas
# ============================================================================

class MessageResponse(BaseModel):
    """Generic message response"""

    message: str = Field(..., description="Response message")

    class Config:
        json_schema_extra = {"example": {"message": "Operation completed successfully"}}


class LogoutRequest(BaseModel):
    """Logout request (DEPRECATED - now uses HttpOnly cookie)"""

    refresh_token: str = Field(..., description="Refresh token to revoke")

    class Config:
        json_schema_extra = {
            "example": {"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
        }

