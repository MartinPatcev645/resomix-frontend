"""
Users API Router
================

FastAPI router for user profile management endpoints including profile CRUD,
password changes, session management, and 2FA settings.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import List
from fastapi import APIRouter, Depends, Path, Query, Request, Security
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.user_controller import UserController
from app.api.dependencies.partner import get_public_partner
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    UserProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    UserSessionResponse,
    Enable2FARequest,
    Disable2FARequest,
    DeleteAccountRequest,
    MessageResponse,
)
from app.schemas.common import ErrorResponse
from app.schemas.user import UserSearchResultsResponse

# Create router instance
router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

# Initialize controller
user_controller = UserController()


@router.get(
    "/search",
    response_model=UserSearchResultsResponse,
    status_code=200,
    summary="Search users by email, username, or UUID",
    description="Admin-focused user search endpoint for lookup by email, username, UUID, or numeric ID.",
)
async def search_users(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results to return"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
):
    return await user_controller.search_users(db, request, q, limit)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=200,
    summary="Get Current User Profile",
    description="Get authenticated user's profile information.",
    response_description="User profile data",
)
async def get_my_profile(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's profile.

    Returns complete profile information including:
    - UUID, email, username
    - Display name and profile picture
    - Language and timezone preferences
    - Email verification status
    - 2FA settings
    - Account creation date

    Requires authentication (JWT token).
    """
    return await user_controller.get_profile(db, request, current_user.uuid)


@router.patch(
    "/me",
    response_model=MessageResponse,
    status_code=200,
    summary="Update User Profile",
    description="Update authenticated user's profile information.",
    response_description="Profile updated successfully",
)
async def update_my_profile(
    request: Request,
    profile_update: UpdateProfileRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's profile.

    Allows updating:
    - **name**: Display name
    - **language**: Preferred language (e.g., 'en', 'es')
    - **timezone**: User timezone (e.g., 'UTC', 'America/New_York')
    - **profile_picture**: Profile picture URL

    All fields are optional. Only provided fields will be updated.
    Requires authentication (JWT token).
    """
    profile_data = profile_update.dict(exclude_unset=True)
    return await user_controller.update_profile(db, request, current_user.id, profile_data)


@router.post(
    "/me/change-password",
    response_model=MessageResponse,
    status_code=200,
    summary="Change Password",
    description="Change authenticated user's password.",
    response_description="Password changed successfully",
    responses={
        401: {"model": ErrorResponse, "description": "Current password incorrect"},
        400: {"model": ErrorResponse, "description": "New password validation failed"},
    },
)
async def change_my_password(
    request: Request,
    password_change: ChangePasswordRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Change user password.

    Requires:
    - **current_password**: Current password for verification
    - **new_password**: New password (min 8 characters, strong)

    After successful password change:
    - All active sessions are revoked
    - User must login again on all devices

    Requires authentication (JWT token).
    """
    password_data = password_change.dict()
    return await user_controller.change_password(db, request, current_user.id, password_data)


@router.get(
    "/me/sessions",
    response_model=List[UserSessionResponse],
    status_code=200,
    summary="Get Active Sessions",
    description="Get list of authenticated user's active sessions.",
    response_description="List of active sessions",
)
async def get_my_sessions(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get active sessions (devices).

    Returns list of active sessions with:
    - Session ID
    - User agent (browser/device info)
    - IP address
    - Creation and expiration times

    Useful for viewing all logged-in devices.
    Requires authentication (JWT token).
    """
    return await user_controller.get_sessions(db, request, current_user.id)


@router.delete(
    "/me/sessions/{session_id}",
    response_model=MessageResponse,
    status_code=200,
    summary="Revoke Session",
    description="Logout from specific session (device).",
    response_description="Session revoked successfully",
    responses={
        403: {
            "model": ErrorResponse,
            "description": "Session doesn't belong to current user",
        },
        404: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def revoke_my_session(
    request: Request,
    session_id: str = Path(..., description="Session ID to revoke"),
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Revoke specific session.

    Logs out from a specific device/session:
    - **session_id**: Session ID from sessions list

    The refresh token for that session becomes invalid.
    Useful for remote logout from lost/stolen devices.
    Requires authentication (JWT token).
    """
    return await user_controller.revoke_session(db, request, current_user.id, session_id)


@router.post(
    "/me/enable-2fa",
    response_model=MessageResponse,
    status_code=200,
    summary="Enable Two-Factor Authentication",
    description="Enable 2FA for additional security.",
    response_description="2FA enabled successfully",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid 2FA method or email not verified"}
    },
)
async def enable_my_2fa(
    request: Request,
    enable_request: Enable2FARequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Enable two-factor authentication.

    Adds extra security layer to login:
    - **method**: 2FA method ('email' or 'app')

    **Requirements:**
    - Email must be verified before enabling 2FA
    - Valid authentication (JWT token)

    After enabling:
    - Login will require 2FA code
    - Code sent via email (or app in future)
    """
    return await user_controller.enable_2fa(db, request, current_user.id, enable_request.method)


@router.post(
    "/me/disable-2fa",
    response_model=MessageResponse,
    status_code=200,
    summary="Disable Two-Factor Authentication",
    description="Disable 2FA (requires password confirmation).",
    response_description="2FA disabled successfully",
    responses={
        401: {"model": ErrorResponse, "description": "Password incorrect"}
    },
)
async def disable_my_2fa(
    request: Request,
    disable_request: Disable2FARequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Disable two-factor authentication.

    Removes 2FA requirement from login:
    - **password**: Password for confirmation

    After disabling:
    - Login will only require email/password
    - No 2FA code needed

    Requires authentication (JWT token).
    """
    return await user_controller.disable_2fa(db, request, current_user.id, disable_request.password)


@router.delete(
    "/me",
    response_model=MessageResponse,
    status_code=200,
    summary="Delete User Account",
    description="Permanently delete authenticated user's account (requires password confirmation).",
    response_description="Account deleted successfully",
    responses={
        401: {"model": ErrorResponse, "description": "Password incorrect"},
        404: {"model": ErrorResponse, "description": "User not found"},
    },
)
async def delete_my_account(
    request: Request,
    delete_request: DeleteAccountRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete user account permanently.

    This action:
    - **password**: Password for confirmation (required)
    - Permanently deletes the user account
    - Deletes all related data (cascade delete)
    - Invalidates all active sessions

    **Warning**: This action cannot be undone.

    Requires authentication (JWT token).
    """
    return await user_controller.delete_account(db, request, current_user.id, delete_request.password)
