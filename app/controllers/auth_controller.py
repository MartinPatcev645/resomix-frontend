"""
Authentication Controller
=========================

HTTP request handling for authentication endpoints including registration,
login, email verification, password reset, 2FA, and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Dict, Any
from fastapi.responses import JSONResponse
from fastapi import status, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import time

from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService
from app.core.config import settings


class AuthController:
    """Controller for authentication operations"""

    def __init__(self):
        self.auth_service = AuthService()
        self.email_service = EmailService()
        self.logging_service = LoggingService()

    def _get_client_info(self, request: Request) -> Dict[str, str]:
        """Extract client information from request"""
        return {
            "user_agent": request.headers.get("user-agent"),
            "ip_address": request.client.host if request.client else None,
        }

    async def register(
        self, db: AsyncSession, request: Request, registration_data: Dict[str, Any]
    ) -> JSONResponse:
        """
        Handle user registration.

        Args:
            db: Database session
            request: FastAPI request object
            registration_data: Registration form data

        Returns:
            JSON response with registration result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            # Register user
            user, verification_token = await self.auth_service.register_user(
                db=db,
                email=registration_data["email"],
                username=registration_data["username"],
                password=registration_data["password"],
                name=registration_data.get("name"),
            )

            # Send verification email
            await self.email_service.send_verification_email(
                email=user.email,
                username=user.username,
                verification_token=verification_token,
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "user_uuid": user.uuid,
                    "email": user.email,
                    "username": user.username,
                    "message": "Registration successful. Please check your email to verify your account.",
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="register_success",
                message=f"User registered successfully: {user.email}",
                correlation_id=correlation_id,
                request=request,
                status_code=201,
                duration_ms=duration_ms,
                metadata={
                    "user_uuid": user.uuid,
                    "email": user.email,
                    "username": user.username,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_201_CREATED, content=response_data
            )

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="register_failed",
                message=f"Registration failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"email": registration_data.get("email"), "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def login(
        self, db: AsyncSession, request: Request, login_data: Dict[str, Any]
    ) -> JSONResponse:
        """
        Handle user login.

        Args:
            db: Database session
            request: FastAPI request object
            login_data: Login credentials

        Returns:
            JSON response with tokens or 2FA requirement
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        client_info = self._get_client_info(request)

        try:
            # Attempt login
            result = await self.auth_service.login_user(
                db=db,
                email_or_username=login_data["email_or_username"],
                password=login_data["password"],
                user_agent=client_info["user_agent"],
                ip_address=client_info["ip_address"],
            )

            # Check if 2FA is required
            if result.get("requires_2fa"):
                # Send 2FA code via email
                user = await self.auth_service.user_repo.async_get_by_id(
                    db, result["user_id"]
                )
                await self.email_service.send_2fa_code_email(
                    email=user.email,
                    username=user.username,
                    code=result["two_factor_code"],
                    purpose="login",
                )

                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=True,
                    data={
                        "requires_2fa": True,
                        "user_id": result["user_id"],
                        "message": "Two-factor authentication required. Please check your email for the verification code.",
                    },
                )

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="AUTH",
                    action="login_2fa_required",
                    message=f"2FA code sent to user {result['user_id']}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={"user_id": result["user_id"]},
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_data
                )

            # Successful login
            duration_ms = (time.time() - start_time) * 1000

            # Extract refresh token from result
            refresh_token = result.pop("refresh_token")

            # Prepare response data without refresh token
            response_data = format_response(success=True, data=result)

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="login_success",
                message=f"User logged in successfully: {result['user']['email']}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={
                    "user_uuid": result["user"]["uuid"],
                    "email": result["user"]["email"],
                },
            )

            # Create response and set refresh token cookie
            response = JSONResponse(
                status_code=status.HTTP_200_OK, content=response_data
            )
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                max_age=settings.jwt_refresh_token_expire_days
                * 24
                * 60
                * 60,  # Convert days to seconds
                httponly=True,
                secure=settings.cookie_secure,
                samesite=settings.cookie_samesite,
                domain=settings.cookie_domain,
                path="/",
            )

            return response

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="login_failed",
                message=f"Login failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={
                    "email_or_username": login_data.get("email_or_username"),
                    "error": e.detail,
                },
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def verify_2fa(
        self, db: AsyncSession, request: Request, verification_data: Dict[str, Any]
    ) -> JSONResponse:
        """
        Handle 2FA verification.

        Args:
            db: Database session
            request: FastAPI request object
            verification_data: User ID and 2FA code

        Returns:
            JSON response with tokens
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        client_info = self._get_client_info(request)

        try:
            result = await self.auth_service.verify_2fa_and_login(
                db=db,
                user_id=verification_data["user_id"],
                code=verification_data["code"],
                user_agent=client_info["user_agent"],
                ip_address=client_info["ip_address"],
            )

            duration_ms = (time.time() - start_time) * 1000

            # Extract refresh token from result
            refresh_token = result.pop("refresh_token")

            # Prepare response data without refresh token
            response_data = format_response(success=True, data=result)

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="2fa_verify_success",
                message=f"2FA verified successfully: {result['user']['email']}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_uuid": result["user"]["uuid"]},
            )

            # Create response and set refresh token cookie
            response = JSONResponse(
                status_code=status.HTTP_200_OK, content=response_data
            )
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
                httponly=True,
                secure=settings.cookie_secure,
                samesite=settings.cookie_samesite,
                domain=settings.cookie_domain,
                path="/",
            )

            return response

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="2fa_verify_failed",
                message=f"2FA verification failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={
                    "user_id": verification_data.get("user_id"),
                    "error": e.detail,
                },
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def verify_email(
        self, db: AsyncSession, request: Request, token: str
    ) -> JSONResponse:
        """
        Handle email verification.

        Args:
            db: Database session
            request: FastAPI request object
            token: Verification token

        Returns:
            JSON response with verification result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user = await self.auth_service.verify_email(db=db, token=token)

            # Send welcome email
            await self.email_service.send_welcome_email(
                email=user.email, username=user.username
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": "Email verified successfully!",
                    "user_uuid": user.uuid,
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="email_verify_success",
                message=f"Email verified successfully: {user.email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_uuid": user.uuid, "email": user.email},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="email_verify_failed",
                message=f"Email verification failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def resend_verification(
        self, db: AsyncSession, request: Request, email: str
    ) -> JSONResponse:
        """
        Resend verification email.

        Args:
            db: Database session
            request: FastAPI request object
            email: User email address

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user, verification_token = (
                await self.auth_service.resend_verification_email(db=db, email=email)
            )

            # Send verification email
            await self.email_service.send_verification_email(
                email=user.email,
                username=user.username,
                verification_token=verification_token,
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={"message": "Verification email sent. Please check your inbox."},
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="resend_verification_success",
                message=f"Verification email resent: {email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"email": email},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="resend_verification_failed",
                message=f"Resend verification failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"email": email, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def request_password_reset(
        self, db: AsyncSession, request: Request, email: str
    ) -> JSONResponse:
        """
        Handle password reset request.

        Args:
            db: Database session
            request: FastAPI request object
            email: User email address

        Returns:
            JSON response (always success for security)
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user, reset_token = await self.auth_service.request_password_reset(
                db=db, email=email
            )

            # Send email only if user exists
            if user:
                await self.email_service.send_password_reset_email(
                    email=user.email, username=user.username, reset_token=reset_token
                )

            duration_ms = (time.time() - start_time) * 1000
            # Always return same message for security
            response_data = format_response(
                success=True,
                data={
                    "message": "If the email exists, a password reset link has been sent."
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="password_reset_requested",
                message=f"Password reset requested: {email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"email": email, "user_exists": user is not None},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            # Still return success message for security
            response_data = format_response(
                success=True,
                data={
                    "message": "If the email exists, a password reset link has been sent."
                },
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="AUTH",
                action="password_reset_error",
                message=f"Password reset error: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"email": email, "error": str(e)},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

    async def reset_password(
        self, db: AsyncSession, request: Request, reset_data: Dict[str, Any]
    ) -> JSONResponse:
        """
        Handle password reset confirmation.

        Args:
            db: Database session
            request: FastAPI request object
            reset_data: Token and new password

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user = await self.auth_service.reset_password(
                db=db,
                token=reset_data["token"],
                new_password=reset_data["new_password"],
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": "Password reset successfully. Please login with your new password."
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="password_reset_success",
                message=f"Password reset successfully: {user.email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_uuid": user.uuid, "email": user.email},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="password_reset_failed",
                message=f"Password reset failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=response_data)

    async def refresh_token(
        self, db: AsyncSession, request: Request, refresh_token: str
    ) -> JSONResponse:
        """
        Handle token refresh with token rotation.

        Args:
            db: Database session
            request: FastAPI request object
            refresh_token: Refresh token from cookie

        Returns:
            JSON response with new access token and sets new refresh token cookie
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.auth_service.refresh_access_token(
                db=db, refresh_token=refresh_token
            )

            duration_ms = (time.time() - start_time) * 1000

            # Extract new refresh token from result
            new_refresh_token = result.pop("refresh_token")

            # Prepare response data without refresh token
            response_data = format_response(success=True, data=result)

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="token_refresh_success",
                message="Access token refreshed successfully",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
            )

            # Create response and set new refresh token cookie (token rotation)
            response = JSONResponse(
                status_code=status.HTTP_200_OK, content=response_data
            )
            response.set_cookie(
                key="refresh_token",
                value=new_refresh_token,
                max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
                httponly=True,
                secure=settings.cookie_secure,
                samesite=settings.cookie_samesite,
                domain=settings.cookie_domain,
                path="/",
            )

            return response

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            # Create response
            response = JSONResponse(status_code=e.status_code, content=response_data)

            # If token reuse detected, clear the refresh token cookie
            if "Refresh token reuse detected" in e.detail:
                # Fix cookie domain for localhost - must be None, not "localhost"
                cookie_domain = (
                    None
                    if settings.cookie_domain.lower() in ["localhost", "127.0.0.1", ""]
                    else settings.cookie_domain
                )

                # Clear the refresh token cookie
                response.delete_cookie(
                    key="refresh_token",
                    path="/",
                    domain=cookie_domain,
                    samesite=settings.cookie_samesite,
                    secure=settings.cookie_secure,
                )

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="token_refresh_failed",
                message=f"Token refresh failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"error": e.detail},
            )

            return response

    async def logout(
        self, db: AsyncSession, request: Request, refresh_token: str
    ) -> JSONResponse:
        """
        Handle logout (revoke session).

        Args:
            db: Database session
            request: FastAPI request object
            refresh_token: Refresh token to revoke

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            await self.auth_service.logout(db=db, refresh_token=refresh_token)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True, data={"message": "Logged out successfully"}
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="logout_success",
                message="User logged out successfully",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
            )

            # Create response and clear refresh token cookie
            response = JSONResponse(
                status_code=status.HTTP_200_OK, content=response_data
            )

            # Fix cookie domain for localhost - must be None, not "localhost"
            cookie_domain = (
                None
                if settings.cookie_domain.lower() in ["localhost", "127.0.0.1", ""]
                else settings.cookie_domain
            )

            response.delete_cookie(
                key="refresh_token",
                path="/",
                domain=cookie_domain,
                samesite=settings.cookie_samesite,
                secure=settings.cookie_secure,
            )

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True, data={"message": "Logged out successfully"}
            )

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="AUTH",
                action="logout_error",
                message=f"Logout error: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"error": str(e)},
            )

            # Clear cookie even if logout fails
            response = JSONResponse(
                status_code=status.HTTP_200_OK, content=response_data
            )
            response.delete_cookie(
                key="refresh_token", domain=settings.cookie_domain, path="/"
            )

            return response

    async def logout_all(
        self, db: AsyncSession, request: Request, user_id: int
    ) -> JSONResponse:
        """
        Handle logout from all devices.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User ID

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            count = await self.auth_service.logout_all_devices(db=db, user_id=user_id)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": f"Logged out from {count} device(s) successfully",
                    "sessions_revoked": count,
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="AUTH",
                action="logout_all_success",
                message=f"User logged out from all devices: {count} sessions revoked",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"sessions_revoked": count},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while logging out from all devices",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="AUTH",
                action="logout_all_failed",
                message=f"Logout all devices failed: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                metadata={"error": str(e)},
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )
