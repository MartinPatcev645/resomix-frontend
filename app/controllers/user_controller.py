"""
User Controller
===============

HTTP request handling for user profile management endpoints including
profile CRUD, password changes, and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Dict, Any
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi import status, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import time

from app.services.user_service import UserService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService


class UserController:
    """Controller for user profile operations"""

    def __init__(self):
        self.user_service = UserService()
        self.logging_service = LoggingService()

    async def search_users(
        self,
        db: AsyncSession,
        request: Request,
        query: str,
        limit: int = 20,
    ) -> JSONResponse:
        """Search users by email, username, UUID, or ID."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        trimmed_query = (query or "").strip()
        if not trimmed_query:
            response_data = format_response(
                success=False, error="Query parameter cannot be empty"
            )
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST, content=response_data
            )

        try:
            results = await self.user_service.search_users(
                db=db,
                query=trimmed_query,
                limit=limit,
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=True, data=results)

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="ADMIN_USER",
                action="search_users_success",
                message=f"User search matched {len(results)} records",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={
                    "query": trimmed_query,
                    "limit": limit,
                    "result_count": len(results),
                },
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="Failed to search users"
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_USER",
                action="search_users_failed",
                message=f"User search failed: {exc}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                metadata={"query": trimmed_query, "limit": limit},
                error=exc,
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=jsonable_encoder(response_data)
            )

    async def get_profile(
        self, db: AsyncSession, request: Request, user_uuid: str
    ) -> JSONResponse:
        """
        Get user profile.

        Args:
            db: Database session
            request: FastAPI request object
            user_uuid: User's UUID

        Returns:
            JSON response with user profile
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user = await self.user_service.get_user_profile(db=db, user_uuid=user_uuid)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
                )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "uuid": user.uuid,
                    "email": user.email,
                    "username": user.username,
                    "name": user.name,
                    "profile_picture": user.profile_picture,
                    "language": user.language,
                    "timezone": user.timezone,
                    "is_email_verified": user.is_email_verified,
                    "is_two_factor_enabled": user.is_two_factor_enabled,
                    "two_factor_method": user.two_factor_method,
                    "created_at": (
                        user.created_at.isoformat() if user.created_at else None
                    ),
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="get_profile_success",
                message=f"User profile retrieved: {user.email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_uuid": user_uuid},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="get_profile_failed",
                message=f"Get profile failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_uuid": user_uuid, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def update_profile(
        self,
        db: AsyncSession,
        request: Request,
        user_id: int,
        profile_data: Dict[str, Any],
    ) -> JSONResponse:
        """
        Update user profile.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            profile_data: Profile update data

        Returns:
            JSON response with updated profile
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            user = await self.user_service.update_profile(
                db=db,
                user_id=user_id,
                name=profile_data.get("name"),
                language=profile_data.get("language"),
                timezone=profile_data.get("timezone"),
                profile_picture=profile_data.get("profile_picture"),
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "uuid": user.uuid,
                    "email": user.email,
                    "username": user.username,
                    "name": user.name,
                    "profile_picture": user.profile_picture,
                    "language": user.language,
                    "timezone": user.timezone,
                    "message": "Profile updated successfully",
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="update_profile_success",
                message=f"Profile updated: {user.email}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_uuid": user.uuid, "updates": profile_data},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="update_profile_failed",
                message=f"Profile update failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def change_password(
        self,
        db: AsyncSession,
        request: Request,
        user_id: int,
        password_data: Dict[str, Any],
    ) -> JSONResponse:
        """
        Change user password.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            password_data: Current and new password

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            await self.user_service.change_password(
                db=db,
                user_id=user_id,
                current_password=password_data["current_password"],
                new_password=password_data["new_password"],
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": "Password changed successfully. All sessions have been logged out."
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="change_password_success",
                message=f"Password changed for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="change_password_failed",
                message=f"Password change failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def get_sessions(
        self, db: AsyncSession, request: Request, user_id: int
    ) -> JSONResponse:
        """
        Get user sessions.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID

        Returns:
            JSON response with active sessions
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            sessions = await self.user_service.get_user_sessions(db=db, user_id=user_id)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=True, data={"sessions": sessions})

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="get_sessions_success",
                message=f"Sessions retrieved for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "session_count": len(sessions)},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while retrieving sessions",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="USER_ACTION",
                action="get_sessions_failed",
                message=f"Get sessions failed: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                metadata={"user_id": user_id, "error": str(e)},
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=jsonable_encoder(response_data)
            )

    async def revoke_session(
        self, db: AsyncSession, request: Request, user_id: int, session_id: str
    ) -> JSONResponse:
        """
        Revoke a specific session.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            session_id: Session ID to revoke

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            await self.user_service.revoke_session(
                db=db, user_id=user_id, session_id=session_id
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True, data={"message": "Session revoked successfully"}
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="revoke_session_success",
                message=f"Session revoked for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "session_id": session_id},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="revoke_session_failed",
                message=f"Session revocation failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={
                    "user_id": user_id,
                    "session_id": session_id,
                    "error": e.detail,
                },
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def enable_2fa(
        self, db: AsyncSession, request: Request, user_id: int, method: str = "email"
    ) -> JSONResponse:
        """
        Enable 2FA.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            method: 2FA method

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            await self.user_service.enable_2fa(db=db, user_id=user_id, method=method)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": f"Two-factor authentication enabled via {method}",
                    "is_two_factor_enabled": True,
                    "two_factor_method": method,
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="enable_2fa_success",
                message=f"2FA enabled for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "method": method},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="enable_2fa_failed",
                message=f"Enable 2FA failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def disable_2fa(
        self, db: AsyncSession, request: Request, user_id: int, password: str
    ) -> JSONResponse:
        """
        Disable 2FA.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            password: Password for confirmation

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            await self.user_service.disable_2fa(
                db=db, user_id=user_id, password=password
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": "Two-factor authentication disabled",
                    "is_two_factor_enabled": False,
                },
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="disable_2fa_success",
                message=f"2FA disabled for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="disable_2fa_failed",
                message=f"Disable 2FA failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "error": e.detail},
            )

            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def delete_account(
        self, db: AsyncSession, request: Request, user_id: int, password: str
    ) -> JSONResponse:
        """
        Delete user account.

        Args:
            db: Database session
            request: FastAPI request object
            user_id: User's internal ID
            password: Password for confirmation

        Returns:
            JSON response with result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            # Bypass multi-tenancy failsafe for account deletion
            # This allows cascade deletion of partner-scoped records (like tracks) 
            # associated with the user without requiring a partner_id in the request context.
            from app.core.context import set_admin_context
            set_admin_context(True)
            
            await self.user_service.delete_account(
                db=db, user_id=user_id, password=password
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={"message": "Account deleted successfully"},
            )

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="delete_account_success",
                message=f"Account deleted for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id},
            )

            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))

        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)
            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=str(e))

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="USER_ACTION",
                action="delete_account_failed",
                message=f"Account deletion failed: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                metadata={"user_id": user_id, "error": str(e)},
            )

            return JSONResponse(status_code=500, content=jsonable_encoder(response_data))
