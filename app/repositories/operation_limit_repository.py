"""
Operation Limit Repository
==========================

Database access layer for operation limit entities.
Provides async helpers to fetch operation types and manage
per-user operation limits with enriched metadata for admin views.

Version: 3.0.1
Init Date: November 08, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import OperationType, Playlist, User, UserOperationLimit
from app.repositories.base_repository import BaseRepository


class OperationLimitRepository(BaseRepository[UserOperationLimit]):
    """Repository for operation types and user operation limit management."""

    def __init__(self) -> None:
        super().__init__(UserOperationLimit)

    # ------------------------------------------------------------------
    # BaseRepository overrides
    # ------------------------------------------------------------------
    def _find_existing(self, db: Session, **kwargs) -> Optional[UserOperationLimit]:
        user_id = kwargs.get("user_id")
        operation_id = kwargs.get("operation_id")
        if user_id is None or operation_id is None:
            return None

        return (
            db.query(self.model)
            .filter(
                self.model.user_id == user_id,
                self.model.operation_id == operation_id,
            )
            .first()
        )

    async def _async_find_existing(
        self, db: AsyncSession, **kwargs
    ) -> Optional[UserOperationLimit]:
        user_id = kwargs.get("user_id")
        operation_id = kwargs.get("operation_id")
        if user_id is None or operation_id is None:
            return None

        stmt = select(self.model).where(
            self.model.user_id == user_id,
            self.model.operation_id == operation_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Operation type helpers
    # ------------------------------------------------------------------
    async def async_get_operation_type_by_code(
        self, db: AsyncSession, code: str
    ) -> Optional[OperationType]:
        stmt = select(OperationType).where(OperationType.code == code)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_list_operation_types(
        self, db: AsyncSession
    ) -> List[OperationType]:
        stmt = select(OperationType).order_by(OperationType.code.asc())
        result = await db.execute(stmt)
        return result.scalars().all()

    # ------------------------------------------------------------------
    # User operation limit helpers
    # ------------------------------------------------------------------
    async def async_get_limit(
        self, db: AsyncSession, user_id: int, operation_id: int
    ) -> Optional[UserOperationLimit]:
        stmt = select(UserOperationLimit).where(
            UserOperationLimit.user_id == user_id,
            UserOperationLimit.operation_id == operation_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_upsert_limit(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        operation_id: int,
        limit_value: int,
        window_seconds: Optional[int],
        created_by: Optional[int],
    ) -> UserOperationLimit:
        existing = await self.async_get_limit(db, user_id, operation_id)

        if existing:
            existing.limit_value = limit_value
            existing.window_seconds = window_seconds
            existing.created_by = created_by
            db.add(existing)
            await db.flush()
            await db.refresh(existing)
            return existing

        new_limit = UserOperationLimit(
            user_id=user_id,
            operation_id=operation_id,
            limit_value=limit_value,
            window_seconds=window_seconds,
            created_by=created_by,
        )
        db.add(new_limit)
        await db.flush()
        await db.refresh(new_limit)
        return new_limit

    async def async_delete_limit(
        self, db: AsyncSession, user_id: int, operation_id: int
    ) -> bool:
        limit = await self.async_get_limit(db, user_id, operation_id)
        if not limit:
            return False

        await db.delete(limit)
        await db.flush()
        return True

    async def async_list_user_limits(
        self,
        db: AsyncSession,
        *,
        search: Optional[str],
        operation_code: Optional[str],
        offset: int,
        limit: int,
    ) -> Tuple[List[Dict[str, object]], int]:
        playlist_count_sq = (
            select(func.count(Playlist.id))
            .where(Playlist.user_id == UserOperationLimit.user_id)
            .correlate(UserOperationLimit)
            .scalar_subquery()
        )

        stmt = (
            select(
                UserOperationLimit,
                OperationType,
                User,
                playlist_count_sq.label("playlist_count"),
            )
            .join(OperationType, OperationType.id == UserOperationLimit.operation_id)
            .join(User, User.id == UserOperationLimit.user_id)
        )

        count_stmt = (
            select(func.count())
            .select_from(UserOperationLimit)
            .join(OperationType, OperationType.id == UserOperationLimit.operation_id)
            .join(User, User.id == UserOperationLimit.user_id)
        )

        filters: List = []
        if operation_code:
            filters.append(OperationType.code == operation_code)
        if search:
            lowered = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(User.email).like(lowered),
                    func.lower(User.username).like(lowered),
                    func.lower(User.uuid).like(lowered),
                )
            )

        if filters:
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))

        stmt = stmt.order_by(UserOperationLimit.updated_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        rows: Sequence = result.all()

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        limits: List[Dict[str, object]] = []
        for row in rows:
            limit_obj: UserOperationLimit = row[0]
            operation_obj: OperationType = row[1]
            user_obj: User = row[2]
            playlist_count = row[3]

            limits.append(
                {
                    "limit": limit_obj,
                    "operation": operation_obj,
                    "user": user_obj,
                    "playlist_count": playlist_count,
                }
            )

        return limits, total

    # ------------------------------------------------------------------
    # Usage helpers
    # ------------------------------------------------------------------
    async def async_increment_usage(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        operation_code: str,
        increment: int = 1,
    ) -> bool:
        """
        Atomically increment usage counter for a user's operation limit.
        Returns True if a row was updated, False if no matching limit exists.
        """
        op = await self.async_get_operation_type_by_code(db, operation_code)
        if not op:
            return False

        stmt = (
            update(UserOperationLimit)
            .where(
                UserOperationLimit.user_id == user_id,
                UserOperationLimit.operation_id == op.id,
            )
            .values(usage=UserOperationLimit.usage + increment)
        )
        result = await db.execute(stmt)
        if result.rowcount and result.rowcount > 0:
            await db.flush()
            return True
        return False

