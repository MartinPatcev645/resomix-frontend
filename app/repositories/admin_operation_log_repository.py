"""
Admin Operation Log Repository
==============================

Read access to the ``admin_operation_logs`` audit trail (who-did-what) for the
admin logs page. Writes are handled by :class:`AdminOperationLogService`.
"""

from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, func, and_, asc, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base_repository import BaseRepository
from app.models.admin_operation_log import AdminOperationLog


class AdminOperationLogRepository(BaseRepository[AdminOperationLog]):
    """Repository for reading administrative operation (audit) logs."""

    def __init__(self):
        super().__init__(AdminOperationLog)

    def _find_existing(self, db, **kwargs):  # not used for an append-only audit table
        return None

    async def _async_find_existing(self, db, **kwargs):
        return None

    async def async_get_filtered(
        self,
        db: AsyncSession,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
        order_dir: str = "desc",
    ) -> Tuple[List[AdminOperationLog], int]:
        """Filtered + paginated fetch. Returns ``(rows, total_count)``.

        Supported filter keys: ``admin_user_id``, ``action`` (LIKE),
        ``target_type``, ``target_id``, ``correlation_id``, ``start_date``,
        ``end_date``. The acting admin user is eager-loaded for display.
        """
        conditions = []
        if filters:
            if filters.get("admin_user_id"):
                conditions.append(AdminOperationLog.admin_user_id == filters["admin_user_id"])
            if filters.get("action"):
                conditions.append(AdminOperationLog.action.like(f"%{filters['action']}%"))
            if filters.get("target_type"):
                conditions.append(AdminOperationLog.target_type == filters["target_type"])
            if filters.get("target_id"):
                conditions.append(AdminOperationLog.target_id == str(filters["target_id"]))
            if filters.get("correlation_id"):
                conditions.append(AdminOperationLog.correlation_id == filters["correlation_id"])
            if filters.get("start_date"):
                conditions.append(AdminOperationLog.created_at >= filters["start_date"])
            if filters.get("end_date"):
                conditions.append(AdminOperationLog.created_at <= filters["end_date"])

        base = select(AdminOperationLog).options(selectinload(AdminOperationLog.admin_user))
        count_stmt = select(func.count(AdminOperationLog.id))
        if conditions:
            cond = and_(*conditions)
            base = base.where(cond)
            count_stmt = count_stmt.where(cond)

        total = (await db.execute(count_stmt)).scalar() or 0

        order_col = AdminOperationLog.created_at
        base = base.order_by(asc(order_col) if order_dir.lower() == "asc" else desc(order_col))
        base = base.offset(offset).limit(limit)

        rows = (await db.execute(base)).scalars().all()
        return rows, total

    async def async_get_detail(self, db: AsyncSession, log_id: int) -> Optional[AdminOperationLog]:
        """Fetch one operation log with the acting admin eager-loaded."""
        stmt = (
            select(AdminOperationLog)
            .options(selectinload(AdminOperationLog.admin_user))
            .where(AdminOperationLog.id == log_id)
        )
        return (await db.execute(stmt)).scalar_one_or_none()
