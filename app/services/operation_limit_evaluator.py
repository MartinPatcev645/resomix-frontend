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

from app.core.config import settings
from app.models import OperationType, UserOperationLimit, Playlist


@dataclass
class OperationLimitResult:
    allowed: bool
    status_code: int
    message: Optional[str] = None


class OperationLimitEvaluator:
    """Evaluate whether a user can perform an operation within their configured limits."""

    def __init__(self) -> None:
        pass

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
        if not user_id or not settings.demo_mode:
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
            count_stmt = select(func.count(Playlist.id)).where(Playlist.user_id == user_id)
            count_result = await db.execute(count_stmt)
            playlist_count = count_result.scalar_one() or 0

            if playlist_count >= limit.limit_value:
                return OperationLimitResult(
                    allowed=False,
                    status_code=403,
                    message=f"Playlist limit reached ({limit.limit_value}). Please remove an existing playlist or upgrade your plan.",
                )

        return OperationLimitResult(allowed=True, status_code=200)

