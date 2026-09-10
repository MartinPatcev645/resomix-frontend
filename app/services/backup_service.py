"""
Backup Service
==============

Business logic for the backup control plane: run history, health, manual
triggers, and ingesting the metrics the backup agents post back.

THE ONE RULE THIS FILE ENFORCES

A run's status is **derived from its components, never taken on trust**. An
agent can crash between finishing a component and reporting the run, so a run
that says "succeeded" because a caller said so is a run that can lie. Every
write that touches a component recomputes the parent, and the parent is a pure
function of its children:

    any component failed        -> failed  (if none succeeded)
                                -> partial (if some succeeded)
    all reported and succeeded  -> succeeded
    otherwise                   -> running

WHAT "HEALTHY" MEANS HERE

Not "the last run exited 0". The question that matters in an incident is how
old the newest usable restore point is, per component. A run can succeed for
four components every night while the fifth has been failing for a week, and a
run-level green light would hide exactly that. So health is computed per
component from the last time each one actually succeeded.

Version: 1.0.0
Init Date: August 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import logging
import uuid as uuid_lib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.backup_run import (
    BACKUP_COMPONENTS,
    BACKUP_ROLES,
    BackupComponent,
    BackupRun,
    COMPONENT_STATES,
    RUN_STATES,
    TRIGGERS,
)
from app.repositories.backup_repository import BackupRepository
from app.services.backup_agent_client import backup_agent_client

logger = logging.getLogger(__name__)

# Components each role is responsible for. Listing them explicitly is what lets
# the status page say "the media box did not report media" instead of "some
# component is missing somewhere".
#
# This must mirror `run_nightly.sh`'s own `case "$ROLE"` block, which is the only
# thing that decides what actually runs where. Corrected 2026-09-09 against it:
#
#   * `analysis` runs on MEDIA, not on Alwyzon. `backup_analysis.sh` opens with
#     `require_role media` and reads a path under /home/ubuntu. Expecting it from
#     Alwyzon made every Alwyzon night `partial` with "no report from:
#     analysis-results", forever, on a completely healthy system.
#   * `secrets` runs on BOTH roles, and that is deliberate. The previous comment
#     here claimed the media box has no secrets bundle; the backup repo fixed
#     exactly that belief, because while secrets ran on Alwyzon alone the media
#     and analysis .env files, the SFTPGo admin password and the audit signing
#     key were captured NOWHERE. Expecting it on both is what makes that
#     regression visible if it ever returns.
ROLE_COMPONENTS: Dict[str, Tuple[str, ...]] = {
    "alwyzon": ("db", "secrets"),
    "media": ("secrets", "media", "analysis"),
}

# Components that are maintenance, not data capture. They are recorded, but a
# failed retention pass does not mean last night's data is missing, so they do
# not drag the run to failed on their own.
NON_DATA_COMPONENTS = ("verify", "retention")

TERMINAL_RUN_STATES = ("succeeded", "partial", "failed")


class BackupServiceError(Exception):
    """Raised for conditions the caller should turn into a 4xx, not a 500."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BackupService:
    """Coordinates the backup control plane."""

    def __init__(self, repo: Optional[BackupRepository] = None, agent=None):
        self.repo = repo or BackupRepository()
        # Injectable so the tests can exercise dispatch without a live agent.
        self.agent = agent or backup_agent_client

    # ------------------------------------------------------------------ #
    # Serialisation
    # ------------------------------------------------------------------ #

    @staticmethod
    def _iso(value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None

    def serialize_component(self, c: BackupComponent) -> Dict[str, Any]:
        return {
            "id": c.id,
            "component": c.component,
            "status": c.status,
            "started_at": self._iso(c.started_at),
            "finished_at": self._iso(c.finished_at),
            "duration_s": c.duration_s,
            "snapshot_id": c.snapshot_id,
            "files_new": c.files_new,
            "files_changed": c.files_changed,
            "files_processed": c.files_processed,
            "bytes_processed": c.bytes_processed,
            # Both, always. bytes_added is restic's logical figure and
            # bytes_stored is what the Storage Box actually holds; showing only
            # the first overstates growth by roughly the compression ratio.
            "bytes_added": c.bytes_added,
            "bytes_stored": c.bytes_stored,
            "error": c.error,
        }

    def serialize_run(self, run: BackupRun, components: Optional[List[BackupComponent]] = None) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": run.id,
            "run_uid": run.run_uid,
            "server_role": run.server_role,
            "hostname": run.hostname,
            "trigger": run.trigger,
            "triggered_by_user_id": run.triggered_by_user_id,
            "status": run.status,
            "started_at": self._iso(run.started_at),
            "finished_at": self._iso(run.finished_at),
            "duration_s": run.duration_s,
            "bytes_stored": run.bytes_stored,
            "files_processed": run.files_processed,
            "error": run.error,
            "created_at": self._iso(run.created_at),
        }
        if components is not None:
            data["components"] = [self.serialize_component(c) for c in components]
        return data

    # ------------------------------------------------------------------ #
    # Reads
    # ------------------------------------------------------------------ #

    async def list_runs(
        self,
        db: AsyncSession,
        *,
        server_role: Optional[str] = None,
        status: Optional[str] = None,
        trigger: Optional[str] = None,
        days: Optional[int] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> Tuple[List[Dict[str, Any]], int]:
        self._validate_enum("server_role", server_role, BACKUP_ROLES)
        self._validate_enum("status", status, RUN_STATES)
        self._validate_enum("trigger", trigger, TRIGGERS)

        since = datetime.utcnow() - timedelta(days=days) if days else None
        rows, total = await self.repo.list_runs(
            db,
            server_role=server_role,
            status=status,
            trigger=trigger,
            since=since,
            limit=page_size,
            offset=(page - 1) * page_size,
            with_components=True,
        )
        return [self.serialize_run(r, list(r.components)) for r in rows], total

    async def get_run(self, db: AsyncSession, run_uid: str) -> Dict[str, Any]:
        run = await self.repo.get_run_by_uid(db, run_uid, with_components=True)
        if not run:
            raise BackupServiceError("Backup run not found", 404)
        return self.serialize_run(run, list(run.components))

    async def get_status(self, db: AsyncSession) -> Dict[str, Any]:
        """The status card: per role and per component, is our restore point fresh.

        This is intentionally answerable with the agents offline. It reports what
        was last recorded, and says so, rather than failing because a server is
        unreachable at the moment somebody opens the page.
        """
        stale_after = timedelta(hours=int(getattr(settings, "backup_stale_after_hours", 26)))
        now = datetime.utcnow()

        component_success = await self.repo.last_component_success(db)

        roles: List[Dict[str, Any]] = []
        for role in BACKUP_ROLES:
            latest = await self.repo.latest_run(db, role)
            active = await self.repo.active_run(db, role)

            components = []
            for name in ROLE_COMPONENTS.get(role, ()):
                last_ok = component_success.get(name)
                age_h = round((now - last_ok).total_seconds() / 3600, 1) if last_ok else None
                components.append({
                    "component": name,
                    "last_success_at": self._iso(last_ok),
                    "age_hours": age_h,
                    # `never` is deliberately distinct from `stale`. A component
                    # that has never succeeded is a setup problem; one that used
                    # to succeed and stopped is an incident. They need different
                    # responses, so the UI must be able to tell them apart.
                    "health": "never" if last_ok is None else (
                        "stale" if (now - last_ok) > stale_after else "ok"
                    ),
                })

            unhealthy = [c for c in components if c["health"] != "ok"]
            roles.append({
                "server_role": role,
                "agent_configured": self.agent.is_configured(role),
                "running": active is not None,
                "active_run_uid": active.run_uid if active else None,
                "last_run": self.serialize_run(latest, list(latest.components)) if latest else None,
                "components": components,
                "health": "ok" if components and not unhealthy else (
                    "never" if components and all(c["health"] == "never" for c in components) else
                    "degraded" if components else "unknown"
                ),
            })

        overall = "ok"
        if any(r["health"] == "never" for r in roles):
            overall = "never"
        elif any(r["health"] in ("degraded", "unknown") for r in roles):
            overall = "degraded"

        return {
            "overall_health": overall,
            "stale_after_hours": stale_after.total_seconds() / 3600,
            "generated_at": self._iso(now),
            "roles": roles,
        }

    async def get_stats(self, db: AsyncSession, *, days: int = 30) -> Dict[str, Any]:
        stats = await self.repo.stats(db, days=days)
        stats["daily"] = await self.repo.daily_bytes(db, days=days)
        return stats

    async def list_snapshots(self, role: str, tag: Optional[str] = None) -> Dict[str, Any]:
        """Repository inventory, read live from restic through the agent.

        Never served from our tables: our history is what we believe happened,
        the repository is what is actually recoverable, and this view exists to
        catch the case where the two disagree.
        """
        self._require_role(role)
        result = await self.agent.list_snapshots(role, tag=tag)
        if not result.get("success"):
            raise BackupServiceError(
                result.get("error") or "Could not read the snapshot inventory",
                503 if result.get("reason") in ("not_configured", "unreachable") else 502,
            )
        return result.get("data") or {}

    # ------------------------------------------------------------------ #
    # Triggers
    # ------------------------------------------------------------------ #

    @staticmethod
    def generate_run_uid() -> str:
        """Same shape the scripts generate: UTC compact timestamp, plus a short
        suffix so two manual runs in the same second cannot collide on the
        unique index."""
        return f"{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}-{uuid_lib.uuid4().hex[:6]}"

    async def trigger_run(
        self,
        db: AsyncSession,
        *,
        server_role: str,
        user_id: Optional[int],
        components: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Start a manual run on one server.

        The row is created BEFORE dispatch. If the dispatch response is lost in
        transit, a backup may still be running on that server, and a record that
        says "dispatch failed, verify manually" is far safer than no record at
        all of something that is touching the repository.
        """
        self._require_role(server_role)
        if components:
            unknown = [c for c in components if c not in BACKUP_COMPONENTS]
            if unknown:
                raise BackupServiceError(f"Unknown component(s): {', '.join(unknown)}", 400)

        existing = await self.repo.active_run(db, server_role)
        if existing:
            # restic locks the repository, so a second run would not corrupt
            # anything; it would queue and then time out on the lock, which
            # surfaces as a failed backup. Refusing here is the honest answer.
            raise BackupServiceError(
                f"A backup is already {existing.status} on '{server_role}' "
                f"(run {existing.run_uid}). Wait for it to finish.",
                409,
            )

        run_uid = self.generate_run_uid()
        run = await self.repo.create_run(
            db,
            run_uid=run_uid,
            server_role=server_role,
            trigger="manual",
            triggered_by_user_id=user_id,
            status="pending",
        )
        await db.commit()
        await db.refresh(run)

        dispatch = await self.agent.start_backup(server_role, run_uid, components)

        if dispatch.get("success"):
            await self.repo.update_run(db, run, status="running", started_at=datetime.utcnow())
            await db.commit()
            await db.refresh(run)
            return {
                "dispatched": True,
                "run": self.serialize_run(run, []),
                "message": f"Backup started on '{server_role}'.",
            }

        reason = dispatch.get("reason")
        error = dispatch.get("error") or "Dispatch failed"
        await self.repo.update_run(db, run, status="failed", finished_at=datetime.utcnow(),
                                   error=f"dispatch: {error}")
        await db.commit()
        await db.refresh(run)

        return {
            "dispatched": False,
            "reason": reason,
            "run": self.serialize_run(run, []),
            # Distinguished so the UI can say "not wired up yet" instead of
            # "the backup failed", which are very different things to read at
            # 3am.
            "message": (
                f"No backup agent is configured for '{server_role}'. The run was recorded "
                f"as failed so the history stays truthful."
                if reason == "not_configured" else error
            ),
        }

    async def trigger_verify(
        self, db: AsyncSession, *, server_role: str, user_id: Optional[int], full: bool = False
    ) -> Dict[str, Any]:
        """Ask a server to verify its repository.

        Recorded as a run with a single `verify` component so it shows up in the
        same history as everything else. A verification that leaves no trace is
        a verification nobody can point to later.
        """
        self._require_role(server_role)

        existing = await self.repo.active_run(db, server_role)
        if existing:
            raise BackupServiceError(
                f"A backup is already {existing.status} on '{server_role}' "
                f"(run {existing.run_uid}). Wait for it to finish.",
                409,
            )

        run_uid = self.generate_run_uid()
        run = await self.repo.create_run(
            db, run_uid=run_uid, server_role=server_role, trigger="manual",
            triggered_by_user_id=user_id, status="pending",
        )
        await self.repo.upsert_component(db, run_id=run.id, component="verify", status="pending")
        await db.commit()
        await db.refresh(run)

        dispatch = await self.agent.start_verify(server_role, run_uid, full=full)
        if dispatch.get("success"):
            await self.repo.update_run(db, run, status="running", started_at=datetime.utcnow())
            await db.commit()
            await db.refresh(run)
            return {"dispatched": True, "run": self.serialize_run(run, []),
                    "message": f"Verification started on '{server_role}'."}

        error = dispatch.get("error") or "Dispatch failed"
        await self.repo.update_run(db, run, status="failed", finished_at=datetime.utcnow(),
                                   error=f"dispatch: {error}")
        await self.repo.upsert_component(db, run_id=run.id, component="verify",
                                         status="failed", error=error)
        await db.commit()
        await db.refresh(run)
        return {"dispatched": False, "reason": dispatch.get("reason"),
                "run": self.serialize_run(run, []), "message": error}

    # ------------------------------------------------------------------ #
    # Ingest (called by the agents)
    # ------------------------------------------------------------------ #

    async def ingest_component(
        self,
        db: AsyncSession,
        *,
        run_uid: str,
        server_role: str,
        component: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Record one component's metrics file, then recompute the run.

        Idempotent by design. This is called over the network by a shell script,
        so a retry after a lost response is the normal case, not an edge one.
        """
        if server_role not in BACKUP_ROLES:
            raise BackupServiceError(f"Unknown server_role '{server_role}'", 400)
        if component not in BACKUP_COMPONENTS:
            raise BackupServiceError(f"Unknown component '{component}'", 400)
        status_value = payload.get("status")
        if status_value not in COMPONENT_STATES:
            raise BackupServiceError(f"Unknown component status '{status_value}'", 400)

        run = await self.repo.upsert_run(
            db,
            run_uid=run_uid,
            server_role=server_role,
            hostname=payload.get("hostname"),
            trigger=payload.get("trigger"),
            started_at=self._parse_dt(payload.get("run_started_at")),
        )
        if run.status in (None, "pending"):
            run.status = "running"
        if run.started_at is None:
            run.started_at = self._parse_dt(payload.get("started_at")) or datetime.utcnow()

        started = self._parse_dt(payload.get("started_at"))
        finished = self._parse_dt(payload.get("finished_at"))
        duration = payload.get("duration_s")
        if duration is None and started and finished:
            duration = int((finished - started).total_seconds())

        await self.repo.upsert_component(
            db,
            run_id=run.id,
            component=component,
            status=status_value,
            started_at=started,
            finished_at=finished,
            duration_s=duration,
            snapshot_id=payload.get("snapshot_id"),
            files_new=self._as_int(payload.get("files_new")),
            files_changed=self._as_int(payload.get("files_changed")),
            files_processed=self._as_int(payload.get("files_processed")),
            bytes_processed=self._as_int(payload.get("bytes_processed")),
            bytes_added=self._as_int(payload.get("bytes_added")),
            bytes_stored=self._as_int(payload.get("bytes_stored")),
            error=payload.get("error"),
        )

        await self.recompute_run(db, run)
        await db.commit()
        await db.refresh(run)

        components = await self.repo.list_components(db, run.id)
        return self.serialize_run(run, components)

    async def finish_run(
        self, db: AsyncSession, *, run_uid: str, error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Called when the agent's nightly wrapper exits.

        It supplies the finish time and any wrapper-level error, but NOT the
        status: that is still derived from the components, so a wrapper that
        exits 0 after a component failed cannot mark the night green.
        """
        run = await self.repo.get_run_by_uid(db, run_uid)
        if not run:
            raise BackupServiceError("Backup run not found", 404)

        run.finished_at = datetime.utcnow()
        if error:
            run.error = error
        await self.recompute_run(db, run, force_terminal=True)
        await db.commit()
        await db.refresh(run)

        components = await self.repo.list_components(db, run.id)
        return self.serialize_run(run, components)

    # ------------------------------------------------------------------ #
    # Rollup
    # ------------------------------------------------------------------ #

    async def recompute_run(
        self, db: AsyncSession, run: BackupRun, *, force_terminal: bool = False
    ) -> BackupRun:
        """Derive the run's status and totals from its components.

        `force_terminal` is set when the agent says the run is over: at that
        point "no failures yet but not everything reported" stops meaning
        `running` and starts meaning `partial`, because nothing further is
        coming.
        """
        components = await self.repo.list_components(db, run.id)

        run.bytes_stored = sum(c.bytes_stored or 0 for c in components)
        run.files_processed = sum(c.files_processed or 0 for c in components)

        data = [c for c in components if c.component not in NON_DATA_COMPONENTS]
        # A verify-only run has no data components at all; judging it by the
        # empty set would call it succeeded no matter what verify reported.
        judged = data or components

        failed = [c for c in judged if c.status == "failed"]
        succeeded = [c for c in judged if c.status == "succeeded"]
        pending = [c for c in judged if c.status in ("pending", "running")]

        expected = ROLE_COMPONENTS.get(run.server_role, ())
        reported = {c.component for c in components}
        missing = [c for c in expected if c not in reported] if data else []

        # "Missing" means a component the run ENDED without, and a run has not
        # ended until the agent says so (force_terminal). This used to be judged
        # on every ingest, so every healthy night flipped to `partial` the moment
        # its first component reported, before the second had even started. Seen
        # on production 2026-09-10: the Alwyzon run read "no report from:
        # secrets" while its own components table showed secrets succeeded. And
        # because `partial` is a terminal state, the backup watchdog would have
        # read a healthy night in progress as a finished failure and emailed
        # about it, every night, in the window between first and last component.
        #
        # Our own "no report from" text is also recomputed on every pass instead
        # of being written once. Written once, it went on naming components that
        # had reported a minute later. A wrapper or component error is not ours
        # and is left untouched.
        missing_prefix = "no report from:"
        if run.error and run.error.startswith(missing_prefix):
            run.error = None

        if failed:
            run.status = "failed" if not succeeded else "partial"
        elif (pending or missing) and not force_terminal:
            run.status = "running"
        elif missing or pending:
            # The run has ended without one of them reporting at all. That is a
            # gap, not a success.
            run.status = "partial"
            if missing and not run.error:
                run.error = f"{missing_prefix} {', '.join(missing)}"
        elif succeeded:
            run.status = "succeeded"
        else:
            run.status = "running" if not force_terminal else "failed"

        if run.status in TERMINAL_RUN_STATES:
            if run.finished_at is None:
                latest = [c.finished_at for c in components if c.finished_at]
                run.finished_at = max(latest) if latest else datetime.utcnow()
            if run.started_at and run.finished_at:
                run.duration_s = max(0, int((run.finished_at - run.started_at).total_seconds()))

        if not run.error:
            errs = [f"{c.component}: {c.error}" for c in components if c.status == "failed" and c.error]
            if errs:
                run.error = "; ".join(errs)[:4000]

        await db.flush()
        return run

    # ------------------------------------------------------------------ #
    # Housekeeping
    # ------------------------------------------------------------------ #

    async def purge_history(self, db: AsyncSession, *, days: Optional[int] = None) -> int:
        days = days or int(getattr(settings, "backup_history_retention_days", 730))
        removed = await self.repo.purge_older_than(db, days=days)
        await db.commit()
        return removed

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _require_role(role: str) -> None:
        if role not in BACKUP_ROLES:
            raise BackupServiceError(
                f"Unknown server role '{role}'. Expected one of: {', '.join(BACKUP_ROLES)}", 400
            )

    @staticmethod
    def _validate_enum(name: str, value: Optional[str], allowed) -> None:
        if value is not None and value not in allowed:
            raise BackupServiceError(
                f"Invalid {name} '{value}'. Expected one of: {', '.join(allowed)}", 400
            )

    @staticmethod
    def _as_int(value: Any) -> int:
        """Metrics arrive from shell, where an unset value is an empty string and
        a very large byte count may arrive as a float. Never raise over a number:
        losing a counter must not lose the record that the backup happened."""
        if value is None or value == "":
            return 0
        try:
            return max(0, int(float(value)))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _parse_dt(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value
        try:
            text = str(value).replace("Z", "+00:00")
            parsed = datetime.fromisoformat(text)
            # Stored naive UTC, matching every other DateTime column here. The
            # conversion is to UTC and not to local time: the scripts run on two
            # boxes and stamp UTC, and normalising to the API server's zone
            # would silently shift every timestamp by the offset.
            if parsed.tzinfo:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except (TypeError, ValueError):
            return None


backup_service = BackupService()
