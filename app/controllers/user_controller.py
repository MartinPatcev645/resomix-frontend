"""
User Controller
===============

HTTP request handling for user profile management endpoints including
profile CRUD, password changes, and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Dict, Any, Optional
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi import status, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import time

import logging

from app.services.user_service import UserService
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User

logger = logging.getLogger(__name__)


class UserController:
    """Controller for user profile operations"""

    def __init__(self):
        self.user_service = UserService()
        self.auth_service = AuthService()
        self.logging_service = LoggingService()
        self.email_service = EmailService()
        self.admin_log_service = AdminOperationLogService()

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

            # Linked social identities (e.g. ["google"]) — drives the Account tab's Linked Accounts UI.
            auth_providers = await self.user_service.user_repo.async_list_providers(db, user.id)

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
                    # Drives "Set password" vs "Change password" in the UI (Google-only accounts).
                    "has_password": bool(user.password_hash),
                    # Linked OAuth providers, e.g. ["google"]. Empty when only email/password.
                    "auth_providers": auth_providers,
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

    async def link_google(
        self, db: AsyncSession, request: Request, user_id: int, credential: str
    ) -> JSONResponse:
        """Link a Google account to the CURRENT user (Connect Google in the profile).

        Never switches accounts or creates one, unlike Google *login*. Rejects (409) a Google
        identity already linked to a different account.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            await self.auth_service.link_google_to_user(db=db, user_id=user_id, credential=credential)
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=True, data={"message": "Google connected successfully."})
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="link_provider_success",
                message=f"Google linked for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "provider": "google"},
            )
            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))
        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="link_provider_failed",
                message=f"Google link failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "provider": "google", "error": e.detail},
            )
            return JSONResponse(status_code=e.status_code, content=jsonable_encoder(response_data))

    async def unlink_provider(
        self, db: AsyncSession, request: Request, user_id: int, provider: str
    ) -> JSONResponse:
        """Unlink a social provider (e.g. Google) from the current user."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            await self.user_service.unlink_auth_provider(db=db, user_id=user_id, provider=provider)
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={"message": f"{provider.capitalize()} disconnected successfully."},
            )
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="unlink_provider_success",
                message=f"Provider {provider} unlinked for user {user_id}",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "provider": provider},
            )
            return JSONResponse(status_code=status.HTTP_200_OK, content=jsonable_encoder(response_data))
        except HTTPException as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=e.detail)
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="unlink_provider_failed",
                message=f"Provider unlink failed: {e.detail}",
                correlation_id=correlation_id,
                request=request,
                status_code=e.status_code,
                duration_ms=duration_ms,
                metadata={"user_id": user_id, "provider": provider, "error": e.detail},
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

    async def _notify_deletion_scheduled(
        self, db: AsyncSession, user_id: int, purge_due_at, *, had_subscription: bool = False
    ) -> None:
        """Tell the user their account is going, and how long they have to change their mind.

        Best-effort: the deletion has already been recorded and committed, and a mail failure must
        not turn a completed request into an error the user might retry. Matches the convention in
        `contact_service`.
        """
        try:
            from sqlalchemy import select

            from app.models.user import User as UserModel

            user = (
                await db.execute(select(UserModel).where(UserModel.id == user_id))
            ).scalar_one_or_none()
            if user is None or not user.email:
                return

            await self.email_service.send_account_deletion_scheduled(
                email=user.email,
                name=user.name or user.username or "there",
                purge_date=purge_due_at.strftime("%-d %B %Y"),
                had_subscription=had_subscription,
            )
        except Exception as exc:  # noqa: BLE001 — see the docstring
            logger.error("Could not send deletion-scheduled email to user %s: %s", user_id, exc)

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
            # SOFT delete: access stops now, the data is kept untouched for 30 days, an admin
            # destroys it afterwards. Nothing is removed here, so the tenancy bypass the old hard
            # delete needed is gone with it.
            result = await self.user_service.request_account_deletion(
                db=db, user_id=user_id, password=password
            )

            # Stop Stripe billing — AFTER the commit, so the webhooks this provokes cannot race
            # our own write. Best-effort: the account is already gone from the user's point of
            # view, and a Stripe hiccup must not turn that into an error they might retry. A
            # failure logs "it will keep billing", which is the signal to reconcile by hand.
            if result.get("stripe_subscription_id"):
                from app.services.billing_refund_service import BillingRefundService

                BillingRefundService.cancel_in_stripe(result["stripe_subscription_id"])

            await self._notify_deletion_scheduled(
                db, user_id, result["purge_due_at"], had_subscription=result["had_subscription"]
            )

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True,
                data={
                    "message": (
                        "Your account has been deactivated and is scheduled for deletion on "
                        f"{result['purge_due_at'].strftime('%-d %B %Y')}."
                    ),
                    "purge_due_at": result["purge_due_at"].isoformat(),
                    "grace_days": result["grace_days"],
                },
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

    # ------------------------------------------------------------------
    # RBAC Management Methods
    # ------------------------------------------------------------------

    async def list_users_admin(
        self,
        db: AsyncSession,
        request: Request,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """List users for admin with filters."""
        start_time = time.time()
        try:
            users, total = await self.user_service.list_users_admin(
                db, page, page_size, search, role_id, is_active
            )
            total_pages = (total + page_size - 1) // page_size

            data = [
                {
                    "id": u.id,
                    "uuid": u.uuid,
                    "email": u.email,
                    "username": u.username,
                    "name": u.name,
                    "is_active": u.is_active,
                    "roles": [
                        {"id": r.id, "name": r.name, "description": r.description}
                        for r in u.roles
                    ],
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in users
            ]

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=data,
                    pagination={
                        "total": total,
                        "pages": total_pages,
                        "page": page,
                        "size": page_size,
                    }
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e)),
            )

    async def assign_role_admin(
        self,
        db: AsyncSession,
        request: Request,
        user_id: int,
        role_id: int,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """Assign a role to a user."""
        try:
            result = await self.user_service.assign_role(db, user_id, role_id)
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="user.assign_role",
                    target_type="user",
                    target_id=str(user_id),
                    before_state=None,
                    after_state={"role_id": role_id},
                    ip_address=request.client.host if request and request.client else None
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST,
                content=format_response(
                    success=result.get("success"),
                    data=result.get("data"),
                    error=result.get("error")
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e)),
            )

    async def remove_role_admin(
        self,
        db: AsyncSession,
        request: Request,
        user_id: int,
        role_id: int,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """Remove a role from a user."""
        try:
            result = await self.user_service.remove_role(db, user_id, role_id)
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="user.remove_role",
                    target_type="user",
                    target_id=str(user_id),
                    before_state=None,
                    after_state={"role_id": role_id},
                    ip_address=request.client.host if request and request.client else None
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST,
                content=format_response(
                    success=result.get("success"),
                    data=result.get("data"),
                    error=result.get("error")
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e)),
            )

    async def update_user_status_admin(
        self,
        db: AsyncSession,
        request: Request,
        user_id: int,
        is_active: bool,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """Enable or disable a user account."""
        try:
            # Audit: Get before state
            user_res = await self.user_service.get_user_by_id(db, user_id)
            before_state = None
            if user_res:
                 before_state = {"is_active": user_res.is_active}

            result = await self.user_service.update_user_status(db, user_id, is_active)
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="user.update_status",
                    target_type="user",
                    target_id=str(user_id),
                    before_state=before_state,
                    after_state={"is_active": is_active},
                    ip_address=request.client.host if request and request.client else None
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST,
                content=format_response(
                    success=result.get("success"),
                    data=result.get("data"),
                    error=result.get("error")
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e)),
            )
