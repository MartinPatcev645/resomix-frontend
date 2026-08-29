"""
Admin Backups Router
====================

Endpoints powering the admin "Backups" page:

  • ``GET  /admin/backups/status``          — the health card: per server, per component
  • ``GET  /admin/backups/stats``           — rollup counters and the daily growth series
  • ``GET  /admin/backups/runs``            — run history (filter + paginate)
  • ``GET  /admin/backups/runs/{run_uid}``  — one run with its components
  • ``GET  /admin/backups/snapshots``       — live repository inventory from restic
  • ``POST /admin/backups/run``             — start a backup on one server
  • ``POST /admin/backups/verify``          — start a repository verification
  • ``DELETE /admin/backups/history``       — purge old run history

Reads need ``backup:read``; anything that starts work or deletes history needs
``backup:manage``. The split is deliberate: seeing whether last night worked is
something anyone on call should be able to do, while starting a run touches the
only copy of the data we would ever recover from.

Version: 1.0.0
Date: August 2026
"""

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.controllers.admin_backup_controller import AdminBackupController
from app.models.user import User
from database.connection import get_async_db

router = APIRouter(
    prefix="/admin/backups",
    tags=["Admin Backups"],
    dependencies=[Depends(require_admin)],
)

controller = AdminBackupController()


class TriggerRunRequest(BaseModel):
    server_role: str = Field(..., description="alwyzon | media")
    components: Optional[List[str]] = Field(
        default=None,
        description="Restrict the run to these components. Omit to run everything the role owns.",
    )


class TriggerVerifyRequest(BaseModel):
    server_role: str = Field(..., description="alwyzon | media")
    full: bool = Field(
        default=False,
        description="Re-read every pack rather than a subset. Expensive; not the default.",
    )


# ── Reads ──────────────────────────────────────────────────────────────────

@router.get("/status", dependencies=[Depends(require_permission("backup:read"))])
async def backup_status(db: AsyncSession = Depends(get_async_db)):
    """Per server and per component: how fresh is the newest usable restore point."""
    return await controller.get_status(db)


@router.get("/stats", dependencies=[Depends(require_permission("backup:read"))])
async def backup_stats(
    db: AsyncSession = Depends(get_async_db),
    days: int = Query(30, ge=1, le=365),
):
    return await controller.get_stats(db, days=days)


@router.get("/runs", dependencies=[Depends(require_permission("backup:read"))])
async def list_backup_runs(
    db: AsyncSession = Depends(get_async_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    server_role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    trigger: Optional[str] = Query(None),
    days: Optional[int] = Query(None, ge=1, le=3650),
):
    return await controller.list_runs(
        db, page=page, page_size=page_size, server_role=server_role,
        run_status=status, trigger=trigger, days=days,
    )


@router.get("/runs/{run_uid}", dependencies=[Depends(require_permission("backup:read"))])
async def get_backup_run(run_uid: str, db: AsyncSession = Depends(get_async_db)):
    return await controller.get_run(db, run_uid)


@router.get("/snapshots", dependencies=[Depends(require_permission("backup:read"))])
async def list_snapshots(
    server_role: str = Query(..., description="alwyzon | media"),
    tag: Optional[str] = Query(None, description="Restrict to one restic tag, e.g. db"),
):
    """Read straight from the repository, not from our tables.

    Our history says what we believe happened; this says what is actually
    recoverable. The view exists to catch the case where they disagree.
    """
    return await controller.list_snapshots(server_role, tag)


# ── Actions ────────────────────────────────────────────────────────────────

@router.post("/run", dependencies=[Depends(require_permission("backup:manage"))])
async def trigger_backup(
    payload: TriggerRunRequest = Body(...),
    db: AsyncSession = Depends(get_async_db),
    current_admin: User = Depends(require_admin),
):
    """Start a backup now. Returns 202 once the server has accepted it.

    The run is recorded before dispatch, so a lost response still leaves a row
    an operator can find rather than a backup nothing points at.
    """
    return await controller.trigger_run(
        db,
        server_role=payload.server_role,
        user_id=getattr(current_admin, "id", None),
        components=payload.components,
    )


@router.post("/verify", dependencies=[Depends(require_permission("backup:manage"))])
async def trigger_verify(
    payload: TriggerVerifyRequest = Body(...),
    db: AsyncSession = Depends(get_async_db),
    current_admin: User = Depends(require_admin),
):
    return await controller.trigger_verify(
        db,
        server_role=payload.server_role,
        user_id=getattr(current_admin, "id", None),
        full=payload.full,
    )


@router.delete("/history", dependencies=[Depends(require_permission("backup:manage"))])
async def purge_history(
    db: AsyncSession = Depends(get_async_db),
    days: Optional[int] = Query(None, ge=30, le=3650,
                                description="Delete runs older than this. Defaults to the configured retention."),
):
    """Kept behind a 30-day floor. This table grows by two rows a night, and the
    history is what makes a slow regression visible, so there is no good reason
    to allow trimming it to nothing."""
    return await controller.purge_history(db, days=days)
