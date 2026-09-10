"""
Watchdog — spot a spike in failures and tell somebody
====================================================

Everything needed to *investigate* an incident already exists: `system_logs` records every 5xx,
every HTTPException and every unhandled exception, with correlation ids and stack traces. What
was missing is anything that *notices*. Both August 2026 outages — the Cloudflare 520 and the
silently-dead uptime monitor — were found by a person, days late, because nothing aggregated
those rows into "this is happening more than it should".

Scope is deliberately small (known failure shapes, cheap to run, additive):

* **5xx spike** — the server is breaking.
* **4xx spike** — mostly rate limiting and auth failures. Their absolute count is not
  interesting; a sudden jump is, and it is what a broken deploy or a stuck client looks like.
* **Job failures** — similarity uploads that never produced a playlist.

How it works
------------
`record_error_status()` increments a per-minute Redis counter from the middleware — one INCR on
responses that are already failing, nothing on the happy path. The worker wakes on an interval,
sums the last window, and if a threshold is crossed writes a `WATCHDOG` row to `system_logs` (so
it appears on the existing admin Logs page with no new table and no migration) and emails the
ops inbox.

Design rules, each learned the hard way this month:

* **Never affect the request.** Counting is fire-and-forget behind a bare `except`.
* **Redis, not process memory.** Alwyzon is moving to multiple uvicorn workers; in-process
  counters would silently divide by the worker count.
* **One evaluator.** A Redis lock per tick means N workers do not send N emails.
* **Cooldown.** An ongoing incident is one email, not one per interval — an alert that spams is
  an alert that gets filtered, and then it may as well not exist.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.core.config import settings
from app.db.redis import get_redis_or_none

logger = logging.getLogger(__name__)

# Per-minute buckets: watchdog:err:<status-class>:<YYYYMMDDHHMM>
_PREFIX = "watchdog:err"
# Buckets outlive the widest window we read, and nothing more — these are counters, not history.
# The durable record is the system_logs row the watchdog writes when something actually fires.
_BUCKET_TTL_S = 3600

# Set while an incident is live so we alert on the transition, not on every tick.
_COOLDOWN_KEY = "watchdog:cooldown:{kind}"
# Held for the length of one evaluation so only one worker evaluates a given minute.
_LOCK_KEY = "watchdog:lock"


def _bucket(ts: Optional[float] = None) -> str:
    return time.strftime("%Y%m%d%H%M", time.gmtime(ts if ts is not None else time.time()))


def _klass(status_code: int) -> str:
    return "5xx" if status_code >= 500 else "4xx"


async def record_error_status(status_code: int) -> None:
    """Count one failing response. Called from the middleware; must never raise."""
    if status_code < 400:
        return
    client = await get_redis_or_none()
    if client is None:
        return
    try:
        key = f"{_PREFIX}:{_klass(status_code)}:{_bucket()}"
        await client.incr(key)
        await client.expire(key, _BUCKET_TTL_S)
    except Exception as exc:  # pragma: no cover — telemetry must not break a response
        logger.debug("watchdog: could not record status %s: %s", status_code, exc)
    finally:
        await client.close()


async def record_job_failure(kind: str = "similarity_upload") -> None:
    """Count one background-job failure — work that failed where no user saw a status code."""
    client = await get_redis_or_none()
    if client is None:
        return
    try:
        key = f"{_PREFIX}:job_{kind}:{_bucket()}"
        await client.incr(key)
        await client.expire(key, _BUCKET_TTL_S)
    except Exception as exc:  # pragma: no cover
        logger.debug("watchdog: could not record job failure: %s", exc)
    finally:
        await client.close()


async def _sum_window(client, kind: str, minutes: int) -> int:
    """Total for `kind` over the last `minutes` whole minutes."""
    now = time.time()
    keys = [f"{_PREFIX}:{kind}:{_bucket(now - 60 * i)}" for i in range(minutes)]
    try:
        values = await client.mget(keys)
    except Exception:
        return 0
    total = 0
    for v in values or []:
        try:
            total += int(v)
        except (TypeError, ValueError):
            continue
    return total


async def _evaluate_backups() -> Dict[str, Dict[str, Any]]:
    """Ask the backup tables two questions per server role. Never raises.

    Returns ``{kind: {...}}`` for whatever is currently wrong, empty when all is
    well, so the caller can apply the same cooldown-and-clear logic it uses for
    the counter checks.

    WHY THIS IS NOT A HOOK IN ``recompute_run``
    -------------------------------------------
    A hook fires when a box REPORTS. The failure this exists to catch is a box
    that reports nothing at all: on 2026-09-06 a leaked repository lock stopped
    the production database backup for three nights, and it was found eleven days
    later by a person running a component by hand. Only a question asked from the
    outside notices silence. Hence two conditions, and the second is the one that
    matters:

    1. ``backup_failed:<role>``  the most recent finished run ended failed or
       partial. Deliberately the LATEST run rather than any run in a window, so a
       failure that has since been followed by a success does not keep alerting.
    2. ``backup_stale:<role>``   no run has SUCCEEDED within the stale window.
       This fires whether the run failed, never started, or the whole machine is
       gone, which is the case no report-driven check can see.
    """
    if not bool(getattr(settings, "watchdog_backup_enabled", True)):
        return {}

    from sqlalchemy import select

    from app.models.backup_run import BackupRun
    from app.services.backup_service import ROLE_COMPONENTS, TERMINAL_RUN_STATES
    from database.connection import AsyncSessionLocal

    stale_hours = int(getattr(settings, "watchdog_backup_stale_hours", 26))
    cutoff = datetime.utcnow() - timedelta(hours=stale_hours)
    incidents: Dict[str, Dict[str, Any]] = {}

    async with AsyncSessionLocal() as db:
        for role in ROLE_COMPONENTS:
            latest = (
                await db.execute(
                    select(BackupRun)
                    .where(
                        BackupRun.server_role == role,
                        BackupRun.status.in_(tuple(TERMINAL_RUN_STATES)),
                    )
                    .order_by(BackupRun.id.desc())
                    .limit(1)
                )
            ).scalars().first()

            good = (
                await db.execute(
                    select(BackupRun)
                    .where(
                        BackupRun.server_role == role,
                        BackupRun.status == "succeeded",
                        BackupRun.finished_at.is_not(None),
                    )
                    .order_by(BackupRun.finished_at.desc())
                    .limit(1)
                )
            ).scalars().first()

            if latest is not None and latest.status != "succeeded":
                incidents[f"backup_failed:{role}"] = {
                    "title": f"backup on {role} ended {latest.status}",
                    "detail": (latest.error or "no error text was reported")[:500],
                    "run_uid": latest.run_uid,
                    "role": role,
                    "status": latest.status,
                }

            # A role that has NEVER succeeded is stale too. `good is None` is not
            # "nothing to judge", it is the worst reading available: no restore
            # point exists at all.
            last_good = good.finished_at if good else None
            if last_good is None or last_good < cutoff:
                age = (
                    f"{int((datetime.utcnow() - last_good).total_seconds() // 3600)}h ago"
                    if last_good
                    else "never"
                )
                incidents[f"backup_stale:{role}"] = {
                    "title": f"no successful backup on {role} for over {stale_hours}h",
                    "detail": f"last succeeded: {age}",
                    "role": role,
                    "last_success": last_good.isoformat() if last_good else None,
                }

    return incidents


async def evaluate() -> Dict[str, Any]:
    """Read the counters, decide whether anything is wrong, and report it once.

    Returns a summary for logging/tests. Never raises.
    """
    window = int(getattr(settings, "watchdog_window_minutes", 5))
    thresholds = {
        "5xx": int(getattr(settings, "watchdog_5xx_threshold", 25)),
        "4xx": int(getattr(settings, "watchdog_4xx_threshold", 200)),
        "job_similarity_upload": int(getattr(settings, "watchdog_job_failure_threshold", 5)),
    }

    client = await get_redis_or_none()
    if client is None:
        return {"evaluated": False, "reason": "redis_unavailable"}

    try:
        # One evaluator per tick. Without this, four uvicorn workers would each evaluate the same
        # window and send the same email four times.
        got_lock = await client.set(_LOCK_KEY, "1", nx=True, ex=max(30, window * 60 // 2))
        if not got_lock:
            return {"evaluated": False, "reason": "another_worker_evaluating"}

        counts = {k: await _sum_window(client, k, window) for k in thresholds}
        breaches = {k: v for k, v in counts.items() if v >= thresholds[k]}

        fired = []
        for kind, count in breaches.items():
            cooldown_key = _COOLDOWN_KEY.format(kind=kind)
            if await client.exists(cooldown_key):
                continue  # already alerted; still ongoing
            await client.set(
                cooldown_key, "1",
                ex=int(getattr(settings, "watchdog_cooldown_minutes", 30)) * 60,
            )
            await _raise_incident(kind, count, thresholds[kind], window)
            fired.append(kind)

        # --- backups ---------------------------------------------------------
        # Its own try: a database problem here must not discard the counter
        # incidents that have already fired above.
        backups: Dict[str, Dict[str, Any]] = {}
        try:
            backups = await _evaluate_backups()
        except Exception as exc:  # pragma: no cover
            logger.error("watchdog: backup evaluation failed: %s", exc, exc_info=True)

        backup_cooldown = int(getattr(settings, "watchdog_backup_cooldown_minutes", 720)) * 60
        for kind, info in backups.items():
            cooldown_key = _COOLDOWN_KEY.format(kind=kind)
            if await client.exists(cooldown_key):
                continue  # already alerted; still ongoing
            await client.set(cooldown_key, "1", ex=backup_cooldown)
            await _raise_backup_incident(kind, info)
            fired.append(kind)

        # Clear the cooldown as soon as a signal returns to normal, so the NEXT occurrence alerts
        # immediately instead of waiting out a timer against a system that has recovered.
        for kind in thresholds:
            if kind not in breaches:
                try:
                    await client.delete(_COOLDOWN_KEY.format(kind=kind))
                except Exception:
                    pass

        # Same for backups, and it matters more here: the cooldown is 12 hours, so
        # a role that recovered and then failed again would otherwise stay silent
        # through the next night.
        try:
            from app.services.backup_service import ROLE_COMPONENTS

            for role in ROLE_COMPONENTS:
                for kind in (f"backup_failed:{role}", f"backup_stale:{role}"):
                    if kind not in backups:
                        await client.delete(_COOLDOWN_KEY.format(kind=kind))
        except Exception:  # pragma: no cover
            pass

        return {
            "evaluated": True, "counts": counts, "breaches": list(breaches),
            "backups": list(backups), "fired": fired,
        }
    except Exception as exc:  # pragma: no cover
        logger.error("watchdog: evaluation failed: %s", exc, exc_info=True)
        return {"evaluated": False, "reason": "error"}
    finally:
        await client.close()


async def _raise_incident(kind: str, count: int, threshold: int, window: int) -> None:
    """Record the incident where admins already look, then email. Never raises."""
    human = {
        "5xx": "server errors",
        "4xx": "client errors (rate limiting / auth failures)",
        "job_similarity_upload": "similarity upload job failures",
    }.get(kind, kind)

    message = (
        f"Watchdog: {count} {human} in the last {window} minute(s) "
        f"(threshold {threshold})."
    )
    logger.error(message)

    # 1. system_logs — reuses the existing admin Logs page. No new table, no migration, and it is
    #    filterable by category alongside the individual errors that caused it.
    try:
        from app.services.logging_service import LoggingService

        LoggingService().log(
            level="ERROR",
            category="WATCHDOG",
            action=f"spike_{kind}",
            message=message,
            status_code=None,
            context="Automated threshold breach detected by the watchdog worker",
            metadata={
                "kind": kind, "count": count,
                "threshold": threshold, "window_minutes": window,
            },
        )
    except Exception as exc:  # pragma: no cover
        logger.error("watchdog: could not write incident to system_logs: %s", exc)

    # 2. Email. Best-effort and last, so a mail failure can never cost us the DB record.
    recipient = getattr(settings, "admin_notification_email", None) or getattr(
        settings, "smtp_from_email", None
    )
    if not recipient:
        logger.warning("watchdog: no admin_notification_email configured — incident not emailed")
        return
    try:
        from app.services.email_service import EmailService

        await EmailService().send_html(
            recipient,
            f"[Resomix] {human} spike",
            f"<p>{message}</p>"
            f"<p>Admin &rarr; Logs, filter category <code>WATCHDOG</code> for the incident, "
            f"and <code>ERROR</code> / <code>AUTH</code> for the individual failures.</p>",
        )
    except Exception as exc:  # pragma: no cover
        logger.error("watchdog: could not email incident: %s", exc)


async def _raise_backup_incident(kind: str, info: Dict[str, Any]) -> None:
    """Same two steps as ``_raise_incident``: durable row first, email second.

    Kept separate rather than folded into it because a backup incident is a state,
    not a rate: there is no count, no threshold and no window to report, and
    forcing one into that shape would produce an email full of meaningless zeroes.
    """
    role = info.get("role") or "unknown"
    message = f"Backup alert on {role}: {info.get('title')} ({info.get('detail')})"
    logger.error(message)

    try:
        from app.services.logging_service import LoggingService

        LoggingService().log(
            level="ERROR",
            category="WATCHDOG",
            action=f"backup_{kind.split(':', 1)[0].replace('backup_', '')}",
            message=message,
            status_code=None,
            context="Backup state check by the watchdog worker",
            metadata={"kind": kind, **info},
        )
    except Exception as exc:  # pragma: no cover
        logger.error("watchdog: could not write backup incident to system_logs: %s", exc)

    recipient = getattr(settings, "admin_notification_email", None) or getattr(
        settings, "smtp_from_email", None
    )
    if not recipient:
        logger.warning(
            "watchdog: no admin_notification_email configured — backup incident not emailed"
        )
        return
    try:
        from app.services.email_service import EmailService

        detail = info.get("detail") or ""
        run_uid = info.get("run_uid")
        run_line = f"<p>Run <code>{run_uid}</code>.</p>" if run_uid else ""
        await EmailService().send_html(
            recipient,
            f"[Resomix] Backup problem on {role}",
            f"<p><strong>{info.get('title')}</strong></p>"
            f"<p>{detail}</p>"
            f"{run_line}"
            f"<p>Admin &rarr; Backups for the run and its components, and "
            f"<code>/var/log/server-backups/</code> on the {role} box for the "
            f"component log.</p>"
            f"<p>A backup that has not run is not a backup. Do not wait for the "
            f"next night to see whether it clears.</p>",
        )
    except Exception as exc:  # pragma: no cover
        logger.error("watchdog: could not email backup incident: %s", exc)


async def start_watchdog_worker() -> None:
    """Background loop. Started from the FastAPI lifespan, cancelled on shutdown."""
    import asyncio

    if not bool(getattr(settings, "watchdog_enabled", True)):
        logger.info("Watchdog worker disabled (WATCHDOG_ENABLED=false)")
        return

    interval = int(getattr(settings, "watchdog_interval_seconds", 300))
    logger.info("Watchdog worker started. Interval: %ss", interval)

    await asyncio.sleep(30)  # let the app finish starting before the first evaluation
    while True:
        try:
            await evaluate()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover — the loop must outlive any single failure
            logger.error("watchdog: cycle failed: %s", exc, exc_info=True)
        await asyncio.sleep(interval)
