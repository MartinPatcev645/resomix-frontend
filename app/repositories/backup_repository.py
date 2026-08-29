"""
Backup Repository
=================

Data access for ``backup_runs`` and ``backup_components``.

Not partner-scoped. Backups are infrastructure, not tenant data, so neither
table carries ``partner_id`` and the global failsafe in
``database/connection.py`` leaves these queries alone.

Two things here are load-bearing and deliberate:

* **Both writes are upserts keyed on the natural key** (``run_uid`` for a run,
  ``(run_id, component)`` for a component). The callers are shell scripts on two
  different servers posting over the network; the one thing that is guaranteed
  to happen eventually is a retry after a response goes missing. An insert-only
  write would answer that retry with a second, contradictory record of the same
  night.
* **The run rollup is derived, never trusted from the caller.** Status and totals
  are recomputed from the component rows every time one changes, so a run whose
  final "everything finished" call never arrives still shows the truth of what
  its components reported.

Version: 1.0.0
Init Date: August 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.backup_run import BackupComponent, BackupRun

logger = logging.getLogger(__name__)


class BackupRepository:
    """Reads and writes for the backup control plane."""

    # ------------------------------------------------------------------ #
    # Runs
    # ------------------------------------------------------------------ #

    async def get_run_by_uid(
        self, db: AsyncSession, run_uid: str, *, with_components: bool = False
    ) -> Optional[BackupRun]:
        stmt = select(BackupRun).where(BackupRun.run_uid == run_uid)
        if with_components:
            stmt = stmt.options(selectinload(BackupRun.components))
        return (await db.execute(stmt)).scalars().first()

    async def get_run_by_id(
        self, db: AsyncSession, run_id: int, *, with_components: bool = False
    ) -> Optional[BackupRun]:
        stmt = select(BackupRun).where(BackupRun.id == run_id)
        if with_components:
            stmt = stmt.options(selectinload(BackupRun.components))
        return (await db.execute(stmt)).scalars().first()

    async def list_runs(
        self,
        db: AsyncSession,
        *,
        server_role: Optional[str] = None,
        status: Optional[str] = None,
        trigger: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
        with_components: bool = False,
    ) -> Tuple[List[BackupRun], int]:
        """A page of runs, newest first, plus the unpaginated total.

        Ordered by ``id`` and not ``started_at``: a run that was created but
        never started has a null ``started_at``, and sorting on it would bury
        exactly the rows an operator is looking for.
        """
        conds = []
        if server_role:
            conds.append(BackupRun.server_role == server_role)
        if status:
            conds.append(BackupRun.status == status)
        if trigger:
            conds.append(BackupRun.trigger == trigger)
        if since:
            conds.append(BackupRun.created_at >= since)

        count_stmt = select(func.count(BackupRun.id))
        stmt = select(BackupRun)
        for c in conds:
            count_stmt = count_stmt.where(c)
            stmt = stmt.where(c)

        total = int((await db.execute(count_stmt)).scalar() or 0)

        stmt = stmt.order_by(BackupRun.id.desc()).limit(limit).offset(offset)
        if with_components:
            stmt = stmt.options(selectinload(BackupRun.components))

        rows = list((await db.execute(stmt)).scalars().all())
        return rows, total

    async def latest_run(
        self, db: AsyncSession, server_role: str, *, statuses: Optional[Sequence[str]] = None
    ) -> Optional[BackupRun]:
        stmt = select(BackupRun).where(BackupRun.server_role == server_role)
        if statuses:
            stmt = stmt.where(BackupRun.status.in_(list(statuses)))
        stmt = stmt.order_by(BackupRun.id.desc()).limit(1)
        stmt = stmt.options(selectinload(BackupRun.components))
        return (await db.execute(stmt)).scalars().first()

    async def active_run(self, db: AsyncSession, server_role: str) -> Optional[BackupRun]:
        """A run on this server that has not reached a terminal state.

        This is what stops an admin starting a second backup on top of one that
        is already running. restic takes a repository lock, so a concurrent run
        does not corrupt anything, it just waits and then fails on the lock
        timeout, which reads as a broken backup rather than a duplicated click.
        """
        stmt = (
            select(BackupRun)
            .where(BackupRun.server_role == server_role)
            .where(BackupRun.status.in_(("pending", "running")))
            .order_by(BackupRun.id.desc())
            .limit(1)
            .options(selectinload(BackupRun.components))
        )
        return (await db.execute(stmt)).scalars().first()

    async def create_run(
        self,
        db: AsyncSession,
        *,
        run_uid: str,
        server_role: str,
        trigger: str = "scheduled",
        hostname: Optional[str] = None,
        triggered_by_user_id: Optional[int] = None,
        status: str = "pending",
        started_at: Optional[datetime] = None,
    ) -> BackupRun:
        run = BackupRun(
            run_uid=run_uid,
            server_role=server_role,
            trigger=trigger,
            hostname=hostname,
            triggered_by_user_id=triggered_by_user_id,
            status=status,
            started_at=started_at,
        )
        db.add(run)
        await db.flush()
        await db.refresh(run)
        return run

    async def upsert_run(
        self,
        db: AsyncSession,
        *,
        run_uid: str,
        server_role: str,
        **fields: Any,
    ) -> BackupRun:
        """Find by ``run_uid`` and update, or create.

        The agent that posts metrics knows its own ``run_uid`` and nothing about
        our primary keys, so this is the only join it can make. Scheduled runs
        arrive here with no prior row at all; a manual run created from the
        admin panel already has one.
        """
        run = await self.get_run_by_uid(db, run_uid)
        if run is None:
            run = BackupRun(run_uid=run_uid, server_role=server_role)
            db.add(run)
        for key, value in fields.items():
            if value is not None and hasattr(run, key):
                setattr(run, key, value)
        await db.flush()
        return run

    async def update_run(self, db: AsyncSession, run: BackupRun, **fields: Any) -> BackupRun:
        for key, value in fields.items():
            if hasattr(run, key):
                setattr(run, key, value)
        await db.flush()
        return run

    # ------------------------------------------------------------------ #
    # Components
    # ------------------------------------------------------------------ #

    async def get_component(
        self, db: AsyncSession, run_id: int, component: str
    ) -> Optional[BackupComponent]:
        stmt = (
            select(BackupComponent)
            .where(BackupComponent.run_id == run_id)
            .where(BackupComponent.component == component)
        )
        return (await db.execute(stmt)).scalars().first()

    async def upsert_component(
        self, db: AsyncSession, *, run_id: int, component: str, **fields: Any
    ) -> BackupComponent:
        """One row per component per run, matching the unique constraint.

        Written as a read-then-write rather than a dialect upsert because the
        caller also needs the resulting object back for the rollup, and the
        volume here is a handful of rows a night.
        """
        row = await self.get_component(db, run_id, component)
        if row is None:
            row = BackupComponent(run_id=run_id, component=component)
            db.add(row)
        for key, value in fields.items():
            if value is not None and hasattr(row, key):
                setattr(row, key, value)
        await db.flush()
        return row

    async def list_components(self, db: AsyncSession, run_id: int) -> List[BackupComponent]:
        stmt = (
            select(BackupComponent)
            .where(BackupComponent.run_id == run_id)
            .order_by(BackupComponent.id.asc())
        )
        return list((await db.execute(stmt)).scalars().all())

    # ------------------------------------------------------------------ #
    # Aggregates for the status card
    # ------------------------------------------------------------------ #

    async def last_success_per_role(self, db: AsyncSession) -> Dict[str, datetime]:
        """When each server last completed a run that was not a failure.

        `partial` counts. A night where four of five components worked still
        moved the restore point forward for those four, and calling it "no
        successful backup" would be a lie in the direction that causes panic.
        """
        stmt = (
            select(BackupRun.server_role, func.max(BackupRun.finished_at))
            .where(BackupRun.status.in_(("succeeded", "partial")))
            .group_by(BackupRun.server_role)
        )
        return {role: ts for role, ts in (await db.execute(stmt)).all() if ts is not None}

    async def last_component_success(self, db: AsyncSession) -> Dict[str, datetime]:
        """When each component last succeeded, across every run.

        The per-component answer is the one that matters in an incident: "the
        last run succeeded" is no comfort if the database component inside it
        has been failing for a week.
        """
        stmt = (
            select(BackupComponent.component, func.max(BackupComponent.finished_at))
            .where(BackupComponent.status == "succeeded")
            .group_by(BackupComponent.component)
        )
        return {c: ts for c, ts in (await db.execute(stmt)).all() if ts is not None}

    async def stats(self, db: AsyncSession, *, days: int = 30) -> Dict[str, Any]:
        """Rollup counters for the page header, over a trailing window."""
        since = datetime.utcnow() - timedelta(days=days)

        stmt = (
            select(BackupRun.status, func.count(BackupRun.id))
            .where(BackupRun.created_at >= since)
            .group_by(BackupRun.status)
        )
        by_status = {s: int(n) for s, n in (await db.execute(stmt)).all()}

        totals = (
            await db.execute(
                select(
                    func.coalesce(func.sum(BackupRun.bytes_stored), 0),
                    func.coalesce(func.avg(BackupRun.duration_s), 0),
                ).where(BackupRun.created_at >= since)
            )
        ).one()

        return {
            "window_days": days,
            "runs_by_status": by_status,
            "runs_total": sum(by_status.values()),
            "bytes_stored": int(totals[0] or 0),
            "avg_duration_s": int(totals[1] or 0),
        }

    async def daily_bytes(self, db: AsyncSession, *, days: int = 30) -> List[Dict[str, Any]]:
        """Bytes actually stored per day, for the growth chart.

        ``bytes_stored``, not ``bytes_added``: the second is restic's logical,
        pre-compression figure, and charting it would show growth several times
        larger than what the Storage Box bill reflects.
        """
        since = datetime.utcnow() - timedelta(days=days)
        day = func.date(BackupRun.started_at)
        stmt = (
            select(day, func.sum(BackupRun.bytes_stored), func.count(BackupRun.id))
            .where(BackupRun.started_at.isnot(None))
            .where(BackupRun.started_at >= since)
            .group_by(day)
            .order_by(day.asc())
        )
        return [
            {"date": str(d), "bytes_stored": int(b or 0), "runs": int(n or 0)}
            for d, b, n in (await db.execute(stmt)).all()
        ]

    # ------------------------------------------------------------------ #
    # Housekeeping
    # ------------------------------------------------------------------ #

    async def purge_older_than(self, db: AsyncSession, *, days: int) -> int:
        """Drop run history older than ``days``. Components go with them via the
        FK cascade. Kept generous by default: this table grows by two rows a
        night, and the history is what makes a slow regression visible."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = await db.execute(delete(BackupRun).where(BackupRun.created_at < cutoff))
        return int(result.rowcount or 0)
