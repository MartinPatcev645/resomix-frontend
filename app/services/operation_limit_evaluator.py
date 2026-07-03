"""
Operation Limit Evaluator
=========================

Utility service to check per-user operation limits (e.g. playlist creation)
before executing operations in demo mode or other constrained environments.

Version: 3.0.1
Init Date: November 09, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import OperationType, UserOperationLimit, Playlist
from app.repositories.operation_limit_repository import OperationLimitRepository


@dataclass
class OperationLimitResult:
    allowed: bool
    status_code: int
    message: Optional[str] = None


class OperationLimitEvaluator:
    """Evaluate whether a user can perform an operation within their configured limits."""

    def __init__(self) -> None:
        self._op_repo = OperationLimitRepository()

    async def check(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        operation_code: str,
    ) -> OperationLimitResult:
        """
        Check whether the user is allowed to perform the operation.

        Returns OperationLimitResult indicating whether the request should proceed.
        """
        if not user_id:
            return OperationLimitResult(allowed=True, status_code=200)

        operation = await db.execute(
            select(OperationType).where(OperationType.code == operation_code)
        )
        operation_obj = operation.scalar_one_or_none()
        if not operation_obj:
            return OperationLimitResult(allowed=True, status_code=200)

        limit_row = await db.execute(
            select(UserOperationLimit).where(
                UserOperationLimit.user_id == user_id,
                UserOperationLimit.operation_id == operation_obj.id,
            )
        )
        limit = limit_row.scalar_one_or_none()

        if not limit:
            return OperationLimitResult(
                allowed=False,
                status_code=403,
                message="You are not yet allowed to perform this action. Please contact support.",
            )

        if limit.limit_value == 0:
            return OperationLimitResult(
                allowed=False,
                status_code=403,
                message="This action is disabled for your account.",
            )

        if operation_code == "playlist_create":
            # Prefer stored usage if present; if zero, backfill from actual playlist count once.
            current_usage = (getattr(limit, "usage", 0) or 0)
            if current_usage == 0:
                count_stmt = select(func.count(Playlist.id)).where(
                    Playlist.user_id == user_id, Playlist.deleted_at.is_(None)
                )
                current_usage = (await db.execute(count_stmt)).scalar_one() or 0
                # Best-effort backfill of usage so future checks are O(1)
                try:
                    # Only update if different to avoid unnecessary writes
                    if current_usage > 0:
                        await self._op_repo.async_increment_usage(
                            db, user_id=user_id, operation_code=operation_obj.code, increment=current_usage
                        )
                        # Refresh local value
                        limit = await self._fetch_limit(db, user_id, operation_obj.id)
                        current_usage = getattr(limit, "usage", current_usage)
                except Exception:
                    # Do not fail the request because of a metering write issue
                    pass
            if current_usage >= limit.limit_value:
                return OperationLimitResult(
                    allowed=False,
                    status_code=403,
                    message=f"Playlist limit reached ({limit.limit_value}). Please remove an existing playlist or upgrade your plan.",
                )

        if operation_code == "spotify_transfer":
            # Enforce using the per-user usage counter stored on the limit row
            current_usage = getattr(limit, "usage", 0) or 0
            if current_usage >= limit.limit_value:
                return OperationLimitResult(
                    allowed=False,
                    status_code=403,
                    message=f"Spotify transfer limit reached ({limit.limit_value}). Please upgrade your plan or contact support.",
                )

        return OperationLimitResult(allowed=True, status_code=200)

    async def _fetch_limit(self, db: AsyncSession, user_id: int, operation_id: int) -> UserOperationLimit | None:
        stmt = select(UserOperationLimit).where(
            UserOperationLimit.user_id == user_id,
            UserOperationLimit.operation_id == operation_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

