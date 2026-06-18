"""
Admin Log Controller
=====================

Read-only HTTP handlers for the admin "Logs" page. Exposes the broad
application ``system_logs`` table and the ``admin_operation_logs`` audit trail,
each with filtering, pagination, and single-record detail.

Version: 1.0.0
Date: June 18, 2026
"""

import logging
from typing import Any, Dict, Optional
from datetime import datetime

from fastapi import status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.log_repository import LogRepository
from app.repositories.admin_operation_log_repository import AdminOperationLogRepository
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class AdminLogController:
    """Coordinates admin log queries between the API layer and repositories."""

    def __init__(self):
        self.log_repo = LogRepository()
        self.op_log_repo = AdminOperationLogRepository()

    @staticmethod
    def _pagination(total: int, page: int, page_size: int) -> Dict[str, Any]:
        total_pages = (total + page_size - 1) // page_size if page_size else 0
        return {
            "total": total,
            "pages": total_pages,
            "page": page,
            "size": page_size,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }

    # ── System logs (system_logs) ───────────────────────────────────────────

    async def list_system_logs(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        order_by: str = "created_at",
        order_dir: str = "desc",
    ) -> JSONResponse:
        try:
            offset = (page - 1) * page_size
            rows, total = await self.log_repo.async_get_filtered_logs(
                db, filters=filters or {}, limit=page_size, offset=offset,
                order_by=order_by, order_dir=order_dir,
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({
                    "success": True,
                    "data": [r.to_dict() for r in rows],
                    "pagination": self._pagination(total, page, page_size),
                }),
            )
        except Exception as e:
            logger.error(f"Failed to list system logs: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to list logs")),
            )

    async def get_system_log(self, db: AsyncSession, log_id: int) -> JSONResponse:
        try:
            row = await self.log_repo.async_get_by_id(db, log_id)
            if not row:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=jsonable_encoder(format_response(success=False, error="Log not found")),
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({"success": True, "data": row.to_dict()}),
            )
        except Exception as e:
            logger.error(f"Failed to get system log {log_id}: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to fetch log")),
            )

    async def system_log_stats(self, db: AsyncSession, hours: int = 24) -> JSONResponse:
        try:
            stats = await self.log_repo.async_get_log_stats(db, hours=hours)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({"success": True, "data": stats}),
            )
        except Exception as e:
            logger.error(f"Failed to get log stats: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to fetch log stats")),
            )

    async def overview(self, db: AsyncSession, hours: int = 24) -> JSONResponse:
        """Combined system-health + admin-activity snapshot for the admin dashboard
        header. Merges the ``system_logs`` health rollup with the
        ``admin_operation_logs`` activity summary under one ``health`` status."""
        try:
            system = await self.log_repo.async_get_system_overview(db, hours=hours)
            operations = await self.op_log_repo.async_get_activity_summary(db, hours=hours)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({
                    "success": True,
                    "data": {
                        "window_hours": hours,
                        "generated_at": datetime.utcnow().isoformat(),
                        "status": system.get("status", "unknown"),
                        "system_logs": system,
                        "operations": operations,
                    },
                }),
            )
        except Exception as e:
            logger.error(f"Failed to build log overview: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to build overview")),
            )

    # ── Admin operation logs (admin_operation_logs) ─────────────────────────

    @staticmethod
    def _op_to_dict(row) -> Dict[str, Any]:
        return {
            "id": row.id,
            "admin_user_id": row.admin_user_id,
            "admin_email": getattr(row.admin_user, "email", None) if row.admin_user else None,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "before_state": row.before_state,
            "after_state": row.after_state,
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
            "correlation_id": row.correlation_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    async def list_operation_logs(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        order_dir: str = "desc",
    ) -> JSONResponse:
        try:
            offset = (page - 1) * page_size
            rows, total = await self.op_log_repo.async_get_filtered(
                db, filters=filters or {}, limit=page_size, offset=offset, order_dir=order_dir,
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({
                    "success": True,
                    "data": [self._op_to_dict(r) for r in rows],
                    "pagination": self._pagination(total, page, page_size),
                }),
            )
        except Exception as e:
            logger.error(f"Failed to list operation logs: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to list operation logs")),
            )

    async def get_operation_log(self, db: AsyncSession, log_id: int) -> JSONResponse:
        try:
            row = await self.op_log_repo.async_get_detail(db, log_id)
            if not row:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=jsonable_encoder(format_response(success=False, error="Operation log not found")),
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({"success": True, "data": self._op_to_dict(row)}),
            )
        except Exception as e:
            logger.error(f"Failed to get operation log {log_id}: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to fetch operation log")),
            )
