"""
Admin Logs Router
=================

Read-only endpoints powering the admin "Logs" page:

  • ``/admin/logs``                 — application system logs (list + filters)
  • ``/admin/logs/stats``           — rollup counters for the page header
  • ``/admin/logs/{log_id}``        — one system log in full detail
  • ``/admin/operation-logs``       — admin audit trail (who did what)
  • ``/admin/operation-logs/{id}``  — one audit record in full detail

Guarded by admin auth + the ``reports:view`` permission.

Version: 1.0.0
Date: June 18, 2026
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_async_db
from app.api.dependencies.auth import require_admin, require_permission
from app.controllers.admin_log_controller import AdminLogController

router = APIRouter(
    prefix="/admin",
    tags=["Admin Logs"],
    dependencies=[Depends(require_admin), Depends(require_permission("reports:view"))],
)

controller = AdminLogController()


@router.get("/logs")
async def list_system_logs(
    db: AsyncSession = Depends(get_async_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    level: Optional[str] = Query(None, description="DEBUG | INFO | WARNING | ERROR | CRITICAL"),
    category: Optional[List[str]] = Query(None, description="One or more categories (e.g. NOISE, AUTH, ERROR, REQUEST). Repeat the param to match several."),
    action: Optional[List[str]] = Query(None, description="One or more exact action names. Repeat the param to match several."),
    endpoint: Optional[str] = Query(None, description="Substring match on endpoint"),
    q: Optional[str] = Query(None, description="Free-text search over message/action/endpoint"),
    client_ip: Optional[str] = Query(None),
    correlation_id: Optional[str] = Query(None),
    status_code: Optional[int] = Query(None),
    track_id: Optional[int] = Query(None),
    playlist_id: Optional[int] = Query(None),
    min_duration: Optional[float] = Query(None, ge=0, description="Min duration_ms"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    order_by: str = Query("created_at"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List system logs with filters + pagination (newest first by default)."""
    filters = {
        "level": level, "category": category, "action": action, "endpoint": endpoint,
        "q": q, "client_ip": client_ip, "correlation_id": correlation_id,
        "status_code": status_code, "track_id": track_id, "playlist_id": playlist_id,
        "min_duration": min_duration, "start_date": start_date, "end_date": end_date,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    return await controller.list_system_logs(
        db, page=page, page_size=page_size, filters=filters,
        order_by=order_by, order_dir=order_dir,
    )


@router.get("/logs/overview")
async def logs_overview(
    db: AsyncSession = Depends(get_async_db),
    hours: int = Query(
        24, ge=0,
        description=(
            "Look-back window in hours. Presets: 1 (last hour), 24 (day), 72 (3 days), "
            "168 (week), 720 (month), 2160 (3 months), 4320 (6 months), 8760 (year), "
            "0 = all time. Buckets adapt: ≤72h hourly, ≤2160h daily, longer/all-time monthly."
        ),
    ),
):
    """System-health + admin-activity snapshot for the dashboard header widget.

    Health is derived from log *level* (ERROR/CRITICAL/WARNING) and merges the
    system-log rollup with admin-operation activity. Use a small ``hours`` (e.g.
    24) for a live header; larger windows for trend cards; ``0`` for all time.
    """
    return await controller.overview(db, hours=hours)


@router.get("/logs/stats")
async def system_log_stats(
    db: AsyncSession = Depends(get_async_db),
    hours: int = Query(24, ge=0, description="Look-back window in hours (0 = all time)"),
):
    """Aggregate counters (level/category distribution, error rate) for the page header."""
    return await controller.system_log_stats(db, hours=hours)


@router.get("/logs/facets")
async def system_log_facets(
    db: AsyncSession = Depends(get_async_db),
):
    """Distinct levels / categories / actions present in the logs (for the filter dropdowns).

    Declared before ``/logs/{log_id}`` so the literal path isn't swallowed by the id route.
    """
    return await controller.log_facets(db)


@router.get("/logs/{log_id}")
async def get_system_log(
    log_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    """Fetch one system log in full detail."""
    return await controller.get_system_log(db, log_id)


@router.get("/operation-logs")
async def list_operation_logs(
    db: AsyncSession = Depends(get_async_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    admin_user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None, description="Substring match, e.g. partner.rotate_api_key"),
    target_type: Optional[str] = Query(None, description="e.g. partner, api_key, sftp_user, user"),
    target_id: Optional[str] = Query(None),
    correlation_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List admin operation (audit) logs with filters + pagination."""
    filters = {
        "admin_user_id": admin_user_id, "action": action, "target_type": target_type,
        "target_id": target_id, "correlation_id": correlation_id,
        "start_date": start_date, "end_date": end_date,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    return await controller.list_operation_logs(
        db, page=page, page_size=page_size, filters=filters, order_dir=order_dir,
    )


@router.get("/operation-logs/{log_id}")
async def get_operation_log(
    log_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    """Fetch one admin operation log (with before/after state) in full detail."""
    return await controller.get_operation_log(db, log_id)
