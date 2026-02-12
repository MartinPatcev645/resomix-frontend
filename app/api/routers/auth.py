"""
Authentication API Router
=========================

FastAPI router for authentication endpoints including registration, login,
email verification, password reset, 2FA, and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from fastapi import APIRouter, Depends, Query, Request, Cookie, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.auth_controller import AuthController
from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user
from app.api.middlewares.rate_limit import limiter, auth_rate_limit
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    TwoFactorRequiredResponse,
    TwoFactorVerifyRequest,
    TokenRefreshResponse,
    ResendVerificationRequest,
    EmailVerificationResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    PasswordResetConfirmRequest,
    MessageResponse,
)
from app.schemas.common import ErrorResponse

# Create router instance
router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

# Initialize controller
auth_controller = AuthController()


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=201,
    summary="Register New User",
    description="Create a new user account with email verification.",
    response_description="User registration successful, verification email sent",
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Email/username already exists or validation failed",
        }
    },
)
@limiter.limit(auth_rate_limit("register"))
async def register(
    request: Request,
    registration_request: RegisterRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Register a new user account.

    This endpoint creates a new user account and sends a verification email:
    - **email**: Valid email address (must be unique)
    - **username**: Unique username (3-50 characters, alphanumeric+_-)
    - **password**: Strong password (min 8 characters, requires uppercase, lowercase, digit)
    - **name**: Optional display name

    Returns user information and sends verification email.
    """
    registration_data = registration_request.dict()
    return await auth_controller.register(db, request, registration_data)


@router.post(
    "/login",
    response_model=LoginResponse | TwoFactorRequiredResponse,
    status_code=200,
    summary="User Login",
    description="Authenticate user with email/username and password.",
    response_description="Login successful, returns tokens or 2FA requirement",
    responses={401: {"model": ErrorResponse, "description": "Invalid credentials"}},
)
@limiter.limit(auth_rate_limit("login"))
async def login(
    request: Request,
    login_request: LoginRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Authenticate user and create session.

    This endpoint authenticates a user and returns JWT tokens:
    - **email_or_username**: Email address or username
    - **password**: User password

    Returns access token, refresh token, and user information.
    If 2FA is enabled, returns 2FA requirement instead.
    """
    login_data = login_request.dict()
    return await auth_controller.login(db, request, login_data)


@router.post(
    "/verify-2fa",
    response_model=LoginResponse,
    status_code=200,
    summary="Verify 2FA Code",
    description="Complete login by verifying 2FA code.",
    response_description="2FA verified, returns tokens",
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired 2FA code"}
    },
)
@limiter.limit("5/minute")
async def verify_2fa(
    request: Request,
    verification_request: TwoFactorVerifyRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Verify 2FA code and complete login.

    This endpoint verifies the 2FA code sent via email:
    - **user_id**: User ID from initial login response
    - **code**: 6-digit verification code

    Returns access token, refresh token, and user information.
    """
    verification_data = verification_request.dict()
    return await auth_controller.verify_2fa(db, request, verification_data)


@router.get(
    "/verify-email",
    response_model=EmailVerificationResponse,
    status_code=200,
    summary="Verify Email Address",
    description="Verify user email with token from email.",
    response_description="Email verified successfully",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid or expired token"}
    },
)
async def verify_email(
    request: Request,
    token: str = Query(..., description="Email verification token"),
    db: AsyncSession = Depends(get_database_session),
):
    """
    Verify email address with token.

    This endpoint verifies the user's email address:
    - **token**: Verification token from email (query parameter)

    Marks email as verified and sends welcome email.
    """
    return await auth_controller.verify_email(db, request, token)


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    status_code=200,
    summary="Resend Verification Email",
    description="Resend email verification link.",
    response_description="Verification email sent",
    responses={
        400: {"model": ErrorResponse, "description": "Email already verified"},
        404: {"model": ErrorResponse, "description": "User not found"},
    },
)
@limiter.limit(auth_rate_limit("password_reset"))
async def resend_verification(
    request: Request,
    resend_request: ResendVerificationRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Resend verification email.

    This endpoint resends the email verification link:
    - **email**: User email address

    Generates new verification token and sends email.
    """
    return await auth_controller.resend_verification(db, request, resend_request.email)


@router.post(
    "/password-reset",
    response_model=PasswordResetResponse,
    status_code=200,
    summary="Request Password Reset",
    description="Request password reset link via email.",
    response_description="Password reset email sent (if email exists)",
)
@limiter.limit(auth_rate_limit("password_reset"))
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Request password reset link.

    This endpoint generates a password reset token:
    - **email**: User email address

    Sends reset link via email. Always returns success for security
    (doesn't reveal if email exists).
    """
    return await auth_controller.request_password_reset(
        db, request, reset_request.email
    )


@router.post(
    "/password-reset-confirm",
    response_model=MessageResponse,
    status_code=200,
    summary="Confirm Password Reset",
    description="Reset password with token from email.",
    response_description="Password reset successful",
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Invalid/expired token or weak password",
        }
    },
)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    reset_confirm: PasswordResetConfirmRequest,
    db: AsyncSession = Depends(get_database_session),
):
    """
    Reset password with token.

    This endpoint completes the password reset:
    - **token**: Reset token from email
    - **new_password**: New password (min 8 characters, strong)

    Resets password and revokes all active sessions.
    """
    reset_data = reset_confirm.dict()
    return await auth_controller.reset_password(db, request, reset_data)


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=200,
    summary="Refresh Access Token",
    description="Get new access token using refresh token from HttpOnly cookie.",
    response_description="New access token issued and new refresh token set in cookie",
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"}
    },
)
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    refresh_token: str = Cookie(None),
):
    """
    Refresh access token with token rotation.

    This endpoint reads the refresh token from HttpOnly cookie and issues:
    - New access token (returned in JSON)
    - New refresh token (set in HttpOnly cookie)

    No request body required - refresh token automatically read from cookie.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookie",
        )

    return await auth_controller.refresh_token(db, request, refresh_token)


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=200,
    summary="Logout",
    description="Logout from current session (revoke refresh token from cookie).",
    response_description="Logged out successfully and cookie cleared",
)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    refresh_token: str = Cookie(None),
):
    """
    Logout user by revoking session.

    This endpoint reads the refresh token from HttpOnly cookie and:
    - Revokes the session in the database
    - Clears the refresh token cookie

    No request body required - refresh token automatically read from cookie.
    Access token remains valid until expiry.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookie",
        )

    return await auth_controller.logout(db, request, refresh_token)


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    status_code=200,
    summary="Logout All Devices",
    description="Logout from all sessions (all devices). Requires authentication.",
    response_description="Logged out from all devices",
)
async def logout_all(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    """
    Logout from all devices.

    This endpoint revokes all user sessions for the authenticated user.
    User ID is automatically extracted from the JWT token.

    Invalidates all refresh tokens. User must login again on all devices.
    Requires valid JWT access token in Authorization header.
    """
    return await auth_controller.logout_all(db, request, current_user.id)
