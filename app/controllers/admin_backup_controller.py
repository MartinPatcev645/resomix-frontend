"""
Admin Backup Controller
=======================

HTTP handlers for the admin "Backups" page. Thin: shapes responses and turns
``BackupServiceError`` into the status code it carries. All logic lives in
``app/services/backup_service.py``.

Version: 1.0.0
Date: August 2026
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.backup_service import BackupService, BackupServiceError
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class AdminBackupController:
    """Coordinates the admin backup endpoints."""

    def __init__(self, service: Optional[BackupService] = None):
        self.service = service or BackupService()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

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

    @staticmethod
    def _ok(payload: Dict[str, Any], code: int = status.HTTP_200_OK) -> JSONResponse:
        return JSONResponse(status_code=code, content=jsonable_encoder(payload))

    @staticmethod
    def _error(message: str, code: int) -> JSONResponse:
        return JSONResponse(
            status_code=code,
            content=jsonable_encoder(format_response(success=False, error=message)),
        )

    # ------------------------------------------------------------------ #
    # Reads
    # ------------------------------------------------------------------ #

    async def list_runs(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 25,
        server_role: Optional[str] = None,
        run_status: Optional[str] = None,
        trigger: Optional[str] = None,
        days: Optional[int] = None,
    ) -> JSONResponse:
        try:
            runs, total = await self.service.list_runs(
                db, server_role=server_role, status=run_status, trigger=trigger,
                days=days, page=page, page_size=page_size,
            )
            return self._ok({
                "success": True,
                "data": runs,
                "pagination": self._pagination(total, page, page_size),
            })
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to list backup runs: {e}", exc_info=True)
            return self._error("Failed to list backup runs", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def get_run(self, db: AsyncSession, run_uid: str) -> JSONResponse:
        try:
            return self._ok({"success": True, "data": await self.service.get_run(db, run_uid)})
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to get backup run {run_uid}: {e}", exc_info=True)
            return self._error("Failed to fetch the backup run", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def get_status(self, db: AsyncSession) -> JSONResponse:
        try:
            return self._ok({"success": True, "data": await self.service.get_status(db)})
        except Exception as e:
            logger.error(f"Failed to compute backup status: {e}", exc_info=True)
            return self._error("Failed to fetch backup status", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def get_stats(self, db: AsyncSession, days: int = 30) -> JSONResponse:
        try:
            return self._ok({"success": True, "data": await self.service.get_stats(db, days=days)})
        except Exception as e:
            logger.error(f"Failed to compute backup stats: {e}", exc_info=True)
            return self._error("Failed to fetch backup stats", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def list_snapshots(self, server_role: str, tag: Optional[str] = None) -> JSONResponse:
        try:
            return self._ok({"success": True, "data": await self.service.list_snapshots(server_role, tag)})
        except BackupServiceError as e:
            # 503 here means "the agent is not wired up / not reachable", which
            # is a different situation from "there are no snapshots", and the
            # page needs to be able to say which.
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to list snapshots for {server_role}: {e}", exc_info=True)
            return self._error("Failed to list snapshots", status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ------------------------------------------------------------------ #
    # Actions
    # ------------------------------------------------------------------ #

    async def trigger_run(
        self,
        db: AsyncSession,
        *,
        server_role: str,
        user_id: Optional[int],
        components: Optional[List[str]] = None,
    ) -> JSONResponse:
        try:
            result = await self.service.trigger_run(
                db, server_role=server_role, user_id=user_id, components=components
            )
            # 202 on success: the run was accepted and is now in progress
            # elsewhere. 200 would imply the backup itself is finished.
            code = status.HTTP_202_ACCEPTED if result["dispatched"] else status.HTTP_503_SERVICE_UNAVAILABLE
            return self._ok({
                "success": result["dispatched"],
                "data": result["run"],
                "message": result["message"],
            }, code)
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to trigger backup on {server_role}: {e}", exc_info=True)
            return self._error("Failed to trigger the backup", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def trigger_verify(
        self, db: AsyncSession, *, server_role: str, user_id: Optional[int], full: bool = False
    ) -> JSONResponse:
        try:
            result = await self.service.trigger_verify(
                db, server_role=server_role, user_id=user_id, full=full
            )
            code = status.HTTP_202_ACCEPTED if result["dispatched"] else status.HTTP_503_SERVICE_UNAVAILABLE
            return self._ok({
                "success": result["dispatched"],
                "data": result["run"],
                "message": result["message"],
            }, code)
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to trigger verify on {server_role}: {e}", exc_info=True)
            return self._error("Failed to trigger verification", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def purge_history(self, db: AsyncSession, days: Optional[int] = None) -> JSONResponse:
        try:
            removed = await self.service.purge_history(db, days=days)
            return self._ok({"success": True, "data": {"removed": removed}})
        except Exception as e:
            logger.error(f"Failed to purge backup history: {e}", exc_info=True)
            return self._error("Failed to purge backup history", status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ------------------------------------------------------------------ #
    # Ingest (agent-facing, not admin-facing)
    # ------------------------------------------------------------------ #

    async def ingest_component(
        self,
        db: AsyncSession,
        *,
        run_uid: str,
        server_role: str,
        component: str,
        payload: Dict[str, Any],
    ) -> JSONResponse:
        try:
            run = await self.service.ingest_component(
                db, run_uid=run_uid, server_role=server_role, component=component, payload=payload
            )
            return self._ok({"success": True, "data": run})
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to ingest metrics for {run_uid}/{component}: {e}", exc_info=True)
            return self._error("Failed to record backup metrics", status.HTTP_500_INTERNAL_SERVER_ERROR)

    async def finish_run(
        self, db: AsyncSession, *, run_uid: str, error: Optional[str] = None
    ) -> JSONResponse:
        try:
            run = await self.service.finish_run(db, run_uid=run_uid, error=error)
            return self._ok({"success": True, "data": run})
        except BackupServiceError as e:
            return self._error(e.message, e.status_code)
        except Exception as e:
            logger.error(f"Failed to finish backup run {run_uid}: {e}", exc_info=True)
            return self._error("Failed to finish the backup run", status.HTTP_500_INTERNAL_SERVER_ERROR)
