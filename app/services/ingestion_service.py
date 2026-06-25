"""
B2B CSV Ingestion Service
=========================

Service for processing batch CSV/manifest uploads from partners via SFTP.
Validates metadata, handles insertion of Tracks and Deals, and logs row-level errors.
"""

import csv
import logging
import secrets
import uuid
import os
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, or_, and_

from typing import Optional
import redis.asyncio as aioredis
from app.db import redis as redis_module
from app.models.b2b import IngestLog, IngestionError, Deal
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.core.context import set_current_partner_id
from database.connection import AsyncSessionLocal
from sqlalchemy import text
from app.tasks.webhooks import dispatch_webhook
from app.services.ingestion_stages import Stage, advance_stage, ACTIVE_STAGES

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Async two-server ingestion (Alwyzon ⇄ Hetzner)
# ---------------------------------------------------------------------------
# In production Alwyzon (DB + admin) and Hetzner (partner files + compute) run on
# different machines, so Alwyzon cannot read the uploaded CSV/audio directly. The
# flow is therefore:
#
#   1. start_ingestion_job  — Alwyzon inserts an ``ingest_logs`` row (PROCESSING),
#      then fire-and-forgets the validation to Hetzner (job_id = ingest_logs.id).
#   2. Hetzner validates in a background task and writes a result JSON.
#   3. apply_ingestion_result — when admin polls, Alwyzon pulls that JSON back and
#      persists the validated records (genre resolution + Track/AudioFile/status).
#
# Hetzner stays DB-less; all persistence happens here.

# ---------------------------------------------------------------------------
# Per-partner concurrency guard (Stage 3): one active batch per partner.
# ---------------------------------------------------------------------------
_INGEST_LOCK_TTL_SECONDS = 60
_NO_REDIS_TOKEN = "no-redis"


def _partner_ingest_lock_key(partner_id: int) -> str:
    return f"ingest:lock:{partner_id}"


async def acquire_partner_ingest_lock(partner_id: int) -> Optional[str]:
    """Best-effort per-partner lock that serialises ``.done`` handling.

    Returns a token if acquired (caller MUST release), or ``None`` if the lock is
    already held (a concurrent ``.done`` is mid-flight → reject). If Redis is
    unavailable the lock is a no-op (returns a sentinel token) and we rely on the
    DB active-batch check alone.
    """
    pool = redis_module._redis_pool
    if not pool:
        return _NO_REDIS_TOKEN
    try:
        client = aioredis.Redis(connection_pool=pool)
        token = secrets.token_hex(8)
        ok = await client.set(
            _partner_ingest_lock_key(partner_id), token, nx=True, ex=_INGEST_LOCK_TTL_SECONDS
        )
        return token if ok else None
    except Exception as e:  # Redis hiccup → don't block ingestion, fall back to DB check
        logger.warning(f"[IngestionService] ingest lock acquire failed for {partner_id}: {e}")
        return _NO_REDIS_TOKEN


async def release_partner_ingest_lock(partner_id: int, token: Optional[str]) -> None:
    """Release the lock only if we still own it (compare-and-delete)."""
    if not token or token == _NO_REDIS_TOKEN:
        return
    pool = redis_module._redis_pool
    if not pool:
        return
    try:
        client = aioredis.Redis(connection_pool=pool)
        key = _partner_ingest_lock_key(partner_id)
        current = await client.get(key)
        if current is not None and (current.decode() if isinstance(current, bytes) else current) == token:
            await client.delete(key)
    except Exception as e:
        logger.warning(f"[IngestionService] ingest lock release failed for {partner_id}: {e}")


async def has_active_batch(db: AsyncSession, partner_id: int) -> Optional[IngestLog]:
    """Return the partner's currently-active batch row, if any.

    Active = a fine-grained ``stage`` that is non-terminal (RECEIVED … FINALIZING),
    OR a legacy row (``stage`` NULL) still in coarse status ``PROCESSING``. This is
    exactly what the ``.done`` guard checks — one active batch per partner.
    """
    stmt = (
        select(IngestLog)
        .where(
            IngestLog.partner_id == partner_id,
            or_(
                IngestLog.stage.in_(ACTIVE_STAGES),
                and_(IngestLog.stage.is_(None), IngestLog.status == "PROCESSING"),
            ),
        )
        .order_by(IngestLog.id.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _notify(
    partner_id: int,
    event_type: str,
    status: str,
    summary: str,
    *,
    title: Optional[str] = None,
    details: Optional[list] = None,
    counts: Optional[dict] = None,
    reference_path: Optional[str] = None,
) -> None:
    """Best-effort partner+admin notification. Runs in its OWN session so a mail or
    DB hiccup can never roll back / block the ingestion flow. Never raises."""
    try:
        from app.services.notification_service import NotificationService
        from database.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as ndb:
            await NotificationService().notify_partner_operation(
                ndb, partner_id=partner_id, event_type=event_type, status=status,
                summary=summary, title=title, details=details, counts=counts,
                reference_path=reference_path, commit=True,
            )
    except Exception as e:
        logger.error("[IngestionService] notification failed for partner %s (%s/%s): %s",
                     partner_id, event_type, status, e)


async def reject_duplicate_done(
    partner_id: int, home_dir: str, env: str, active_log: Optional[IngestLog] = None
) -> dict:
    """A ``.done`` arrived while the partner already has an active batch.

    Delete ONLY that marker on the media box (the rest of ``live/`` is untouched)
    and notify the partner to wait. Never creates an ``ingest_logs`` row.
    """
    from app.services.hetzner_service import HetznerService

    result = await HetznerService().reject_done(partner_id, home_dir, env)
    dispatch_webhook.delay(
        partner_id=partner_id,
        event_type="ingestion.rejected",
        payload={
            "reason": (
                "A batch is already in progress for this partner. Wait until it "
                "completes (through embedding) before uploading another .done."
            ),
            "active_ingest_log_id": getattr(active_log, "id", None),
            "active_stage": getattr(active_log, "stage", None),
            "env": env,
        },
    )
    await _notify(
        partner_id, "ingestion", "rejected",
        "A batch is already being processed for your account. Please wait until it "
        "finishes (through embedding) before uploading another .done marker.",
        title="Upload rejected — batch already in progress",
    )
    logger.info(
        "[IngestionService] Rejected duplicate .done for partner %s (env=%s); marker_deleted=%s",
        partner_id, env, result.get("success"),
    )
    return result


async def create_ingest_log(
    db: AsyncSession,
    partner_id: int,
    home_dir: str,
    env: str = "live",
) -> IngestLog:
    """Insert the ``ingest_logs`` row (stage RECEIVED) and commit.

    Split out from the media hand-off so the concurrency guard can create the row
    **synchronously under the per-partner lock** — once it exists, a racing ``.done``
    sees an active batch and is rejected.
    """
    from app.models.party import Party
    from app.models.partner import Partner

    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"

    set_current_partner_id(partner_id)

    # Resolve the party id for the log row. ingest_logs.party_id is a NOT NULL FK to
    # parties.party_id, so a synthetic value that doesn't exist would violate the
    # constraint. Get-or-create a Party for this partner instead.
    party_stmt = select(Party).where(Party.partner_id == partner_id).limit(1)
    party = (await db.execute(party_stmt)).scalar_one_or_none()
    if party is None:
        partner = await db.get(Partner, partner_id)
        party_name = (
            getattr(partner, "legal_name", None)
            or getattr(partner, "display_name", None)
            or f"Partner {partner_id}"
        )
        party = Party(
            party_id=f"PARTNER-{partner_id}",
            partner_id=partner_id,
            party_name=party_name,
        )
        db.add(party)
        await db.flush()  # ensure the parties row exists before the FK insert
    party_id = party.party_id

    log_entry = IngestLog(
        partner_id=partner_id,
        party_id=party_id,
        package_folder=f"{home_dir.rstrip('/')}/{env}",
        status="PROCESSING",
        started_at=datetime.utcnow(),
    )
    # v2 fine-grained lifecycle: the batch has been received and accepted.
    advance_stage(log_entry, Stage.RECEIVED)
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry


async def dispatch_to_media(
    db: AsyncSession,
    log_entry: IngestLog,
    partner_id: int,
    home_dir: str,
    env: str = "live",
) -> IngestLog:
    """Hand the (already-created) batch off to Hetzner and advance its stage."""
    from app.services.hetzner_service import HetznerService

    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    set_current_partner_id(partner_id)

    # ingest_logs.id is the cross-server job key.
    result = await HetznerService().start_ingestion(
        job_id=log_entry.id,
        partner_id=partner_id,
        home_dir=home_dir,
        env=env,
    )

    if not result.get("success"):
        log_entry.status = "FAILED"
        advance_stage(log_entry, Stage.FAILED)
        log_entry.error_message = (
            f"Could not start ingestion on media server: "
            f"{result.get('error')} {result.get('detail') or ''}".strip()
        )
        log_entry.completed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(log_entry)
        logger.error(
            f"[IngestionService] Hetzner start-ingestion failed for partner {partner_id} "
            f"job {log_entry.id}: {log_entry.error_message}"
        )
        return log_entry

    # Hand-off accepted → Hetzner is now validating the batch.
    advance_stage(log_entry, Stage.VALIDATING)
    await db.commit()
    await db.refresh(log_entry)

    dispatch_webhook.delay(
        partner_id=partner_id,
        event_type="ingestion.started",
        payload={
            "ingest_log_id": log_entry.id,
            "package_folder": log_entry.package_folder,
            "env": env,
            "started_at": log_entry.started_at.isoformat(),
        },
    )
    logger.info(
        f"[IngestionService] Handed ingestion job {log_entry.id} to Hetzner "
        f"(partner {partner_id}, env={env})."
    )
    return log_entry


async def start_ingestion_job(
    db: AsyncSession,
    partner_id: int,
    home_dir: str,
    env: str = "live",
) -> IngestLog:
    """Create the ``ingest_logs`` row and hand the job off to Hetzner.

    Thin wrapper preserved for direct callers/tests. The SFTP event hook does NOT
    use this — it creates the row under the per-partner lock (``create_ingest_log``)
    and hands off separately (``dispatch_to_media``) so the concurrency guard can
    close the race.
    """
    log_entry = await create_ingest_log(db, partner_id, home_dir, env)
    return await dispatch_to_media(db, log_entry, partner_id, home_dir, env)


# If a log has been stuck at stage=PERSISTING this long, assume the background worker
# died mid-run and let a poll re-enqueue the (idempotent) persist task.
_PERSIST_STALE_SECONDS = int(os.getenv("INGEST_PERSIST_STALE_SECONDS", "900") or 900)  # 15 min


async def _partner_subscribes(db, partner_id: int, event_type: str) -> bool:
    """True if the partner has an active webhook subscribed to ``event_type``. Used to skip
    a large per-track fan-out when nobody is listening. Best-effort — on any error we assume
    yes (the dispatch task itself re-checks and no-ops, so we never silently drop events)."""
    try:
        from sqlalchemy import select as _select
        from app.models.partner import PartnerWebhook
        rows = (await db.execute(
            _select(PartnerWebhook.events).where(
                PartnerWebhook.partner_id == partner_id,
                PartnerWebhook.is_active == True,  # noqa: E712
            )
        )).scalars().all()
        return any(event_type in (events or []) for events in rows)
    except Exception as exc:
        logger.warning(f"[IngestionService] webhook-subscription check failed for partner {partner_id}: {exc}")
        return True


def _persist_stage_stale(log_entry) -> bool:
    """True if PERSISTING was stamped too long ago (worker likely died) → safe to re-enqueue."""
    ts = (log_entry.stage_timeline or {}).get(Stage.PERSISTING)
    if not ts:
        return True
    try:
        started = datetime.fromisoformat(ts)
        now = datetime.now(started.tzinfo) if started.tzinfo else datetime.utcnow()
        return (now - started).total_seconds() > _PERSIST_STALE_SECONDS
    except Exception:
        return True


async def apply_ingestion_result(
    db: AsyncSession,
    log_entry: IngestLog,
    state: dict,
):
    """Consume a Hetzner job-state snapshot and update/persist the DB accordingly.

    Idempotent enough for repeated polling: only acts when the remote job has
    reached a terminal status (``completed``/``failed``). While ``running`` it
    leaves the PROCESSING row untouched.

    - failed     → write IngestionError rows + mark FAILED.
    - completed + test → record dry-run counts, persist nothing, mark COMPLETED.
    - completed + live → resolve genres, insert Track + AudioFile +
      TrackProcessingStatus, mark COMPLETED.
    """
    partner_id = log_entry.partner_id
    set_current_partner_id(partner_id)

    remote_status = (state.get("status") or "").lower()
    env = (state.get("env") or "live").lower()
    if env not in ("test", "live"):
        env = "live"

    # Still running on Hetzner — nothing to persist yet.
    if remote_status not in ("completed", "failed"):
        return log_entry

    if state.get("batch_filename"):
        log_entry.batch_filename = state["batch_filename"]
    
    if state.get("processing_dir"):
        log_entry.processing_dir = state["processing_dir"]

    # --- FAILED on Hetzner (validation errors or runner exception) ---
    if remote_status == "failed":
        errors = state.get("errors") or []
        for err in errors:
            code = err.get("code", "VALIDATION_ERROR")
            r_num = err.get("row", 0)
            msg = err.get("message", "")
            ref = err.get("ref") or f"Row {r_num}"
            severity = "critical" if code in [
                "MISSING_HEADERS", "MISSING_ISRC", "MISSING_TITLE",
                "MISSING_AUDIO_FILENAME", "MISSING_AUDIO_FILE",
                "DUPLICATE_ISRC_IN_BATCH",
                "DISALLOWED_ZIP_ENTRY", "ZIP_CONTAINS_FOLDER",
                "ZIP_SYMLINK", "ZIP_BOMB", "AV_INFECTED",
                "NOT_AUDIO", "EXTRA_FILE_NOT_IN_MANIFEST"
            ] else "warning"
            db.add(IngestionError(
                ingest_log_id=log_entry.id,
                partner_id=partner_id,
                error_code=code,
                error_message=f"Row {r_num}: {msg}" if r_num and r_num > 1 else msg,
                error_severity=severity,
                reference_node=str(ref),
            ))
        log_entry.status = "FAILED"
        advance_stage(log_entry, Stage.FAILED_VALIDATION)
        log_entry.track_count = 0
        log_entry.error_message = state.get("error_message") or (
            f"Validation failed with {len(errors)} error(s). Ingestion aborted."
        )
        log_entry.completed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(log_entry)
        dispatch_webhook.delay(
            partner_id=partner_id,
            event_type="ingestion.failed",
            payload={
                "ingest_log_id": log_entry.id,
                "error_message": log_entry.error_message,
                "failed_at": log_entry.completed_at.isoformat(),
            },
        )
        # Partner-safe detail list (the validation messages are already partner-safe).
        detail_list = [
            (f"Row {e.get('row')}: {e.get('message','')}"
             if e.get("row", 0) and e.get("row", 0) > 1 else e.get("message", ""))
            for e in errors if e.get("message")
        ]
        await _notify(
            partner_id, "ingestion", "failed",
            log_entry.error_message or "Your batch failed validation and was not ingested.",
            title="Ingestion failed — validation errors",
            details=detail_list or None,
            counts={"Errors": len(errors)},
            # Prefer the partner-visible report the media server actually wrote
            # (validation fails pre-move, so it lands in live/, not processing/).
            reference_path=state.get("report_path") or (
                f"processing/{state['processing_dir']}/errors.txt"
                if state.get("processing_dir") else None
            ),
        )
        return log_entry

    # --- COMPLETED on Hetzner ---
    # ``records`` may be omitted on progress polls (include_records=false); use the cheap
    # ``valid_count`` scalar for counts and fall back to the array length when present.
    records = state.get("records") or []
    valid_count = state.get("valid_count")
    if valid_count is None:
        valid_count = len(records)

    if env == "test":
        # Dry-run: validation passed, persist nothing. Terminal immediately (no
        # move/transcode/embedding follows), so mark READY so it never counts as an
        # active batch blocking the partner.
        log_entry.status = "COMPLETED"
        advance_stage(log_entry, Stage.READY)
        log_entry.track_count = valid_count
        log_entry.error_message = (
            f"DRY-RUN (test env): {valid_count} track(s) passed validation. "
            f"Nothing was persisted."
        )
        log_entry.completed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(log_entry)
        dispatch_webhook.delay(
            partner_id=partner_id,
            event_type="ingestion.completed",
            payload={
                "ingest_log_id": log_entry.id,
                "batch_filename": log_entry.batch_filename,
                "track_count": valid_count,
                "dry_run": True,
                "env": env,
                "completed_at": log_entry.completed_at.isoformat(),
            },
        )
        await _notify(
            partner_id, "ingestion", "success",
            f"Dry-run validation passed: {valid_count} track(s) are valid. "
            f"Nothing was persisted (test environment).",
            title="Dry-run validation passed",
            counts={"Validated": valid_count},
        )
        return log_entry

    # LIVE: the DB persist (insert Track/AudioFile/TrackProcessingStatus for every record)
    # can be 50k–1M rows. Doing it inside this admin poll would hang the request, so we hand
    # it to a background Celery task and return immediately. The task inserts the records in
    # idempotent chunks (app.services.ingestion_persist) and finalizes the log COMPLETED when
    # done; subsequent polls just read progress (stage=PERSISTING, track_count climbing).
    # Atomic claim under a row lock: two concurrent admin polls must not both advance to
    # PERSISTING and enqueue duplicate persist tasks (→ duplicate finalize → duplicate
    # transcode/embedding jobs — the double-job bug). The loser blocks on the lock, then
    # sees PERSISTING (fresh) and returns without enqueueing. (with_for_update is a no-op
    # on engines that don't support it; the persist task is idempotent regardless.)
    from sqlalchemy import select as _select
    locked = (
        await db.execute(_select(IngestLog).where(IngestLog.id == log_entry.id).with_for_update())
    ).scalar_one()
    if locked.stage == Stage.PERSISTING and not _persist_stage_stale(locked):
        # A background task is already inserting this batch → release the lock, report progress.
        await db.commit()
        return locked

    # Claim it: mark PERSISTING and enqueue. Staleness re-enqueues if a worker died
    # mid-run — the persist is idempotent (skip-existing by uuid).
    advance_stage(locked, Stage.PERSISTING)
    await db.commit()
    await db.refresh(locked)
    try:
        from app.tasks.ingestion_tasks import persist_and_finalize_ingestion
        persist_and_finalize_ingestion.delay(locked.id)
        logger.info(
            f"[IngestionService] enqueued background persist for log {locked.id} "
            f"(~{valid_count} record(s), partner {partner_id})."
        )
    except Exception as exc:
        logger.error(f"[IngestionService] failed to enqueue persist task for log {locked.id}: {exc}")
    return locked


async def finalize_successful_ingestion(db, log_entry, records, env, result) -> None:
    """Mark the ingest log COMPLETED, fire webhooks + partner notification, and auto-spawn
    the transcode job. Called by the background persist task once every record is in.
    Idempotent on re-run (the transcode auto-spawn guards against duplicate jobs)."""
    partner_id = log_entry.partner_id
    inserted_count = result["already"] + result["inserted"]

    log_entry.status = "COMPLETED"
    # v2: ingestion is the GATE — tracks persisted = "ingestion successful". The batch stays
    # ACTIVE (INGESTED ∈ active stages) while the auto-spawned transcode → embedding jobs run.
    advance_stage(log_entry, Stage.INGESTED)
    log_entry.track_count = inserted_count
    log_entry.completed_at = datetime.utcnow()
    if result["failures"]:
        log_entry.error_message = (
            f"{len(result['failures'])} record(s) could not be persisted and were skipped."
        )
    await db.commit()
    await db.refresh(log_entry)
    logger.info(
        f"[IngestionService] Persisted {inserted_count} track(s) "
        f"({len(result['failures'])} failed) for partner {partner_id} job {log_entry.id}."
    )

    dispatch_webhook.delay(
        partner_id=partner_id,
        event_type="ingestion.completed",
        payload={
            "ingest_log_id": log_entry.id,
            "batch_filename": log_entry.batch_filename,
            "track_count": inserted_count,
            "dry_run": False,
            "env": env,
            "completed_at": log_entry.completed_at.isoformat(),
        },
    )
    # Per-track `track.indexed` webhooks — but only if the partner actually subscribes.
    # Otherwise a 1M-track batch would enqueue 1M Celery messages that each just query
    # subscriptions and no-op. One check up front keeps the common case O(1).
    if await _partner_subscribes(db, partner_id, "track.indexed"):
        _failed_fns = {f.get("audio_filename") for f in result["failures"]}
        for rec in records:
            if rec.get("audio_filename") in _failed_fns:
                continue
            dispatch_webhook.delay(
                partner_id=partner_id,
                event_type="track.indexed",
                payload={
                    "track_uuid": rec.get("track_uuid"),
                    "isrc": rec.get("isrc"),
                    "title": rec.get("title"),
                    "display_artist": rec.get("display_artist"),
                },
            )
    await _notify(
        partner_id, "ingestion", "success",
        f"Your batch was ingested successfully: {inserted_count} track(s) added. "
        f"Embedding will follow shortly.",
        title="Ingestion completed",
        counts={"Tracks ingested": inserted_count},
    )

    # AUTO-PROGRESS GATE: if too many records failed to persist, do NOT auto-start the
    # downstream pipeline (transcode/embeddings) — escalate to admin (only) to review + start
    # manually. The ingestion itself is already COMPLETED above; only auto-progress is paused.
    from app.services import partner_processing_service as _pps
    _persist_failed = len(result.get("failures") or [])
    _persist_total = result.get("total") or 0
    if _pps._failure_rate(_persist_failed, _persist_total) >= _pps._AUTOSPAWN_MAX_FAILURE_RATE:
        await _pps._notify_autospawn_halted(
            db, partner_id, "ingestion", _persist_failed, _persist_total, "transcode + embeddings"
        )
        return

    # Auto-spawn the transcode job (raw -> 128k mp3) AND the embeddings job — no admin
    # click. The two run CONCURRENTLY (overlap mode): the embeddings job consumes each
    # mp3 as soon as transcode produces it, so the GPU embed-server isn't idle while
    # ffmpeg runs. Both spawns are idempotent (an existing job for this batch is reused),
    # so a re-poll / retry never duplicates them.
    try:
        from sqlalchemy import select as _select
        from app.models.partner_processing_job import PartnerProcessingJob
        from app.services import partner_processing_service as _pps

        # 1. Transcode job (find-or-create + hand off).
        tjob = (await db.execute(
            _select(PartnerProcessingJob).where(
                PartnerProcessingJob.partner_id == partner_id,
                PartnerProcessingJob.ingest_log_id == log_entry.id,
                PartnerProcessingJob.job_type == "transcode",
            ).limit(1)
        )).scalar_one_or_none()
        if tjob is None:
            tjob = await _pps.create_job(
                db, partner_id=partner_id, job_type="transcode",
                ingest_log_id=log_entry.id, triggered_by="auto:ingestion",
            )
            await _pps.start_transcode_job(
                db, job_id=tjob.id, partner_id=partner_id, env=env,
                ingest_log_id=log_entry.id, only_pending=True,
            )

        # 2. Embeddings job, spawned concurrently in OVERLAP mode against the transcode
        #    job. Only once the transcode hand-off was accepted (status running/paused) —
        #    if it failed to hand off there are no mp3s to consume, so we leave embeddings
        #    to the post-transcode safety-net spawn instead. Idempotent.
        if tjob is not None and tjob.status in ("running", "paused"):
            await _pps._ensure_embedding_job_for_log(
                db, partner_id, log_entry.id,
                triggered_by="auto:ingestion-overlap", transcode_job_id=tjob.id,
            )
    except Exception as exc:  # never let auto-spawn break a successful ingestion
        logger.error(f"[IngestionService] auto-spawn transcode/embeddings after ingestion failed: {exc}")


async def process_ingestion_batch(
    partner_id: int,
    batch_path: str,
    env: str = "live",
    csv_path: Optional[str] = None,
    checksum_verified: bool = False,
    validation_error: Optional[str] = None
):
    """
    Background task to process a partner's uploaded CSV manifest.

    Args:
        partner_id: The tenant ID.
        batch_path: The absolute path to the partner's SFTP env directory (``.../{test|live}``).
        env: SFTP env the batch came from. ``"test"`` => dry-run (validate + report only, persist
            nothing); ``"live"`` => full ingestion (persist tracks + processing-status rows).
        csv_path: Absolute path to the CSV file if already discovered.
        checksum_verified: Whether the CSV was already verified via checksum.
        validation_error: Early validation error string, if any.
    """
    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    dry_run = env == "test"
    logger.info(f"[IngestionService] Starting batch process for partner {partner_id} at {batch_path}")
    
    # Establish partner context for the background task to satisfy the multi-tenancy failsafe
    set_current_partner_id(partner_id)
    
    # We create a new DB session since this runs in the background
    async with AsyncSessionLocal() as db:
        # Find a valid Party ID for the partner
        from app.models.party import Party
        party_stmt = select(Party).where(Party.partner_id == partner_id).limit(1)
        party_res = await db.execute(party_stmt)
        party = party_res.scalar_one_or_none()
        party_id = party.party_id if party else f"PARTNER-{partner_id}"

        # Create an initial IngestLog entry
        log_entry = IngestLog(
            partner_id=partner_id,
            party_id=party_id,
            package_folder=batch_path,
            status="PROCESSING",
            started_at=datetime.utcnow()
        )
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)
        
        # Trigger ingestion.started webhook event
        dispatch_webhook.delay(
            partner_id=partner_id,
            event_type="ingestion.started",
            payload={
                "ingest_log_id": log_entry.id,
                "batch_filename": log_entry.batch_filename or "manifest.csv",
                "package_folder": batch_path,
                "started_at": log_entry.started_at.isoformat()
            }
        )

        if validation_error:
            # We already failed pre-flight validation
            log_entry.status = "FAILED"
            log_entry.error_message = validation_error
            log_entry.completed_at = datetime.utcnow()
            await db.commit()

            # Trigger ingestion.failed webhook event
            dispatch_webhook.delay(
                partner_id=partner_id,
                event_type="ingestion.failed",
                payload={
                    "ingest_log_id": log_entry.id,
                    "error_message": validation_error,
                    "failed_at": log_entry.completed_at.isoformat()
                }
            )
            return

        try:
            # 1. Locate the manifest CSV file
            if csv_path:
                manifest_path = Path(csv_path)
            else:
                folder = Path(batch_path)
                csv_files = list(folder.glob("*.csv"))
                
                if not csv_files:
                    raise FileNotFoundError("No CSV manifest found in the incoming directory.")
                
                manifest_path = csv_files[0]
                
            logger.info(f"[IngestionService] Found manifest: {manifest_path}")
            
            # Update log with filename
            log_entry.batch_filename = manifest_path.name
            await db.commit()
            
            # 2. Parse and Validate CSV
            import re
            
            required_headers = ["isrc", "title", "audio_filename", "display_artist"]
            success_count = 0
            validation_errors_list = [] # List of tuples: (row_num, error_code, error_message, ref)
            seen_isrcs = set()
            
            with open(manifest_path, mode='r', encoding='utf-8-sig') as f:
                # Read headers and validate
                header_line = f.readline()
                f.seek(0)
                
                # Check for completely empty file
                if not header_line.strip():
                    raise ValueError("The uploaded CSV manifest file is empty.")
                
                reader = csv.DictReader(f)
                headers = reader.fieldnames if reader.fieldnames else []
                
                # Enforce required column headers
                missing_headers = [h for h in required_headers if h not in headers]
                if missing_headers:
                    validation_errors_list.append((
                        1, 
                        "MISSING_HEADERS", 
                        f"CSV is missing required column headers: {', '.join(missing_headers)}", 
                        "Header"
                    ))
                
                # Only proceed to rows if headers are valid
                if not missing_headers:
                    row_num = 1 # Header is row 1
                    
                    # We will collect tracks and audio files to insert *only* if validation passes for everything
                    tracks_to_insert = []
                    audio_files_to_insert = []

                    # In-batch genre cache: maps lowercased name -> genres.id
                    # Avoids repeated DB hits for the same genre string within a single batch.
                    _genre_id_cache: dict[str, int] = {}

                    async def _resolve_genre_id(name: Optional[str]) -> Optional[int]:
                        """Get-or-create a genre row and return its PK."""
                        if not name or not name.strip():
                            return None
                        key = name.strip().lower()
                        if key in _genre_id_cache:
                            return _genre_id_cache[key]
                        clean = name.strip()[:80]  # genres.name is VARCHAR(80)
                        await db.execute(
                            text("INSERT IGNORE INTO genres (name) VALUES (:name)"),
                            {"name": clean},
                        )
                        row = (await db.execute(
                            text("SELECT id FROM genres WHERE name = :name"),
                            {"name": clean},
                        )).first()
                        genre_id = row[0] if row else None
                        if genre_id:
                            _genre_id_cache[key] = genre_id
                        return genre_id

                    for row in reader:
                        row_num += 1
                        row_errors = []
                        
                        # Extract fields
                        isrc = (row.get("isrc") or "").strip()
                        title = (row.get("title") or "").strip()
                        audio_filename = (row.get("audio_filename") or "").strip()
                        display_artist = (row.get("display_artist") or "").strip()
                        
                        # 1. Required field checks
                        if not isrc:
                            row_errors.append(("MISSING_ISRC", "Missing required field 'isrc'", isrc))
                        else:
                            # Standard ISRC regex validation
                            isrc_pattern = re.compile(r"^[A-Z]{2}[A-Z0-9]{3}\d{7}$", re.IGNORECASE)
                            if not isrc_pattern.match(isrc):
                                row_errors.append(("INVALID_ISRC_FORMAT", f"ISRC '{isrc}' is invalid. Must be 12 alphanumeric characters (2 alpha country, 3 registrant, 7 numeric).", isrc))
                            elif isrc.upper() in seen_isrcs:
                                row_errors.append(("DUPLICATE_ISRC_IN_BATCH", f"ISRC '{isrc}' is duplicated within the same ingestion batch.", isrc))
                            else:
                                seen_isrcs.add(isrc.upper())
                                
                        if not title:
                            row_errors.append(("MISSING_TITLE", "Missing required field 'title'", isrc or f"Row {row_num}"))
                        
                        if not display_artist:
                            row_errors.append(("MISSING_DISPLAY_ARTIST", "Missing required field 'display_artist'", isrc or f"Row {row_num}"))
                            
                        if not audio_filename:
                            row_errors.append(("MISSING_AUDIO_FILENAME", "Missing required field 'audio_filename'", isrc or f"Row {row_num}"))
                        else:
                            # Extension check
                            ext = Path(audio_filename).suffix.lower()
                            if ext not in [".wav", ".flac", ".mp3"]:
                                row_errors.append(("INVALID_AUDIO_FORMAT", f"Audio file extension '{ext}' is not supported. Must be .wav, .flac, or .mp3", isrc or audio_filename))
                            
                            # Physical file presence check
                            audio_file_path = manifest_path.parent / audio_filename
                            if not audio_file_path.exists():
                                row_errors.append(("MISSING_AUDIO_FILE", f"Physical audio file '{audio_filename}' not found in the incoming directory.", isrc or audio_filename))
                        
                        # 2. Type and Format validations
                        bpm_str = row.get("bpm")
                        bpm_val = None
                        if bpm_str and bpm_str.strip():
                            try:
                                bpm_val = int(bpm_str)
                                if not (30 <= bpm_val <= 300):
                                    row_errors.append(("INVALID_BPM", f"BPM '{bpm_str}' must be an integer between 30 and 300.", isrc))
                            except ValueError:
                                row_errors.append(("INVALID_BPM_FORMAT", f"BPM '{bpm_str}' is not a valid integer.", isrc))
                                
                        duration_str = row.get("duration_ms")
                        duration_val = None
                        if duration_str and duration_str.strip():
                            try:
                                duration_val = int(duration_str)
                                if duration_val <= 0:
                                    row_errors.append(("INVALID_DURATION", f"Duration '{duration_str}' must be a positive integer.", isrc))
                            except ValueError:
                                row_errors.append(("INVALID_DURATION_FORMAT", f"Duration '{duration_str}' is not a valid integer.", isrc))
                                
                        parental = (row.get("parental_warning") or "").strip()
                        if parental and parental not in ["NoAdviceAvailable", "NotExplicit", "Explicit", "ExplicitContentEdited"]:
                            row_errors.append(("INVALID_PARENTAL_WARNING", f"Parental warning '{parental}' is invalid. Allowed: NoAdviceAvailable, NotExplicit, Explicit, ExplicitContentEdited", isrc))
                            
                        rel_date_str = (row.get("release_date") or "").strip()
                        if rel_date_str:
                            try:
                                datetime.strptime(rel_date_str, "%Y-%m-%d")
                            except ValueError:
                                row_errors.append(("INVALID_RELEASE_DATE", f"Release date '{rel_date_str}' must be in YYYY-MM-DD format.", isrc))
                                
                        lang = (row.get("audio_language") or "").strip()
                        if lang and len(lang) != 2:
                            row_errors.append(("INVALID_LANGUAGE_CODE", f"Audio language '{lang}' must be a 2-letter ISO code or 'xx'.", isrc))
                            
                        # Booleans parse check
                        for bool_field in ["is_explicit", "is_instrumental"]:
                            val = row.get(bool_field)
                            if val and val.strip() not in ["0", "1", "true", "false"]:
                                row_errors.append((f"INVALID_{bool_field.upper()}", f"{bool_field.replace('_', ' ').capitalize()} '{val}' must be 0, 1, true, or false.", isrc))
                                
                        p_year_str = row.get("p_line_year")
                        if p_year_str and p_year_str.strip():
                            try:
                                p_year = int(p_year_str)
                                if not (1900 <= p_year <= 2100):
                                    row_errors.append(("INVALID_P_LINE_YEAR", f"P line year '{p_year_str}' must be between 1900 and 2100.", isrc))
                            except ValueError:
                                row_errors.append(("INVALID_P_LINE_YEAR_FORMAT", f"P line year '{p_year_str}' is not a valid integer.", isrc))
                                
                        upc = (row.get("upc_ean") or "").strip()
                        if upc and not re.match(r"^\d{12,13}$", upc):
                            row_errors.append(("INVALID_UPC_EAN", f"UPC/EAN '{upc}' must be exactly 12 or 13 digits.", isrc))
                            
                        # If row errors occurred, accumulate them
                        if row_errors:
                            for err_code, err_msg, ref in row_errors:
                                validation_errors_list.append((row_num, err_code, err_msg, ref or f"Row {row_num}"))
                        else:
                            # Resolve genre strings to FK IDs
                            genre_id_val    = await _resolve_genre_id(row.get("genre"))
                            sub_genre_id_val = await _resolve_genre_id(row.get("sub_genre"))

                            # Prepare track & audio records
                            new_track = Track(
                                uuid=str(uuid.uuid4()),
                                isrc=isrc.upper(),
                                title=title,
                                version_title=row.get("version_title"),
                                display_artist=display_artist,
                                partner_id=partner_id,
                                duration_ms=duration_val,
                                bpm=bpm_val,
                                musical_key=row.get("musical_key"),
                                genre_id=genre_id_val,
                                sub_genre_id=sub_genre_id_val,
                                mix_name=row.get("mix_name") or "Original Mix",
                                parental_warning=parental or "NotExplicit",
                                is_explicit=(row.get("is_explicit") in ["1", "true"]),
                                is_instrumental=(row.get("is_instrumental") in ["1", "true"]),
                                audio_language=lang or "xx",
                                language_of_lyrics=row.get("language_of_lyrics"),
                                p_line_year=int(row.get("p_line_year")) if row.get("p_line_year") else None,
                                p_line_text=row.get("p_line_text"),
                                ingestion_source="csv",
                                track_type="electrobuzz"
                            )
                            tracks_to_insert.append((new_track, audio_filename))
            
            # 3. Finalize Atomic Transaction (All-or-Nothing)
            if validation_errors_list:
                # ROLLBACK everything and save all ingestion error descriptions
                await db.rollback()
                
                for r_num, code, msg, ref in validation_errors_list:
                    severity = "critical" if code in ["MISSING_HEADERS", "MISSING_ISRC", "MISSING_TITLE", "MISSING_AUDIO_FILENAME", "MISSING_AUDIO_FILE", "DUPLICATE_ISRC_IN_BATCH"] else "warning"
                    err = IngestionError(
                        ingest_log_id=log_entry.id,
                        partner_id=partner_id,
                        error_code=code,
                        error_message=f"Row {r_num}: {msg}" if r_num > 1 else msg,
                        error_severity=severity,
                        reference_node=str(ref)
                    )
                    db.add(err)
                
                log_entry.status = "FAILED"
                log_entry.track_count = 0
                log_entry.error_message = f"Validation failed with {len(validation_errors_list)} errors. Ingestion aborted."
                await db.commit()
                logger.warning(f"[IngestionService] Batch failed due to validation errors. Ingestion aborted.")
                
                # Trigger ingestion.failed webhook event
                dispatch_webhook.delay(
                    partner_id=partner_id,
                    event_type="ingestion.failed",
                    payload={
                        "ingest_log_id": log_entry.id,
                        "error_message": log_entry.error_message,
                        "failed_at": datetime.utcnow().isoformat()
                    }
                )
            elif dry_run:
                # --- TEST env: dry-run. Validation already passed; report success and persist
                # NOTHING (no tracks/audio_files/track_processing_status). The downstream
                # embedding/segment generation is exercised separately by the admin via the
                # batch-embeddings endpoint with env="test" (generate-to-temp + delete).
                await db.rollback()
                candidate_count = len(tracks_to_insert)
                log_entry.status = "COMPLETED"
                log_entry.track_count = candidate_count
                log_entry.error_message = (
                    f"DRY-RUN (test env): {candidate_count} track(s) passed validation. "
                    f"Nothing was persisted."
                )
                log_entry.completed_at = datetime.utcnow()
                await db.commit()
                logger.info(
                    f"[IngestionService] DRY-RUN complete for partner {partner_id}: "
                    f"{candidate_count} track(s) would ingest."
                )
                dispatch_webhook.delay(
                    partner_id=partner_id,
                    event_type="ingestion.completed",
                    payload={
                        "ingest_log_id": log_entry.id,
                        "batch_filename": log_entry.batch_filename,
                        "track_count": candidate_count,
                        "dry_run": True,
                        "env": env,
                        "completed_at": log_entry.completed_at.isoformat(),
                    },
                )
            else:
                # --- LIVE env: persist all tracks, link audio files, and create the
                # per-track processing-status rows that the admin pipeline (§C) drives.
                from app.models.track_processing_status import TrackProcessingStatus

                for track, audio_fn in tracks_to_insert:
                    db.add(track)
                    await db.flush()  # Flush to populate track.id

                    audio_file_path = manifest_path.parent / audio_fn
                    file_size = audio_file_path.stat().st_size if audio_file_path.exists() else 0

                    new_audio = AudioFile(
                        party_id=party_id,
                        ingest_log_id=log_entry.id,
                        track_id=track.id,
                        partner_id=partner_id,
                        asset_class="Master",
                        asset_subtype="master",
                        original_filename=audio_fn,
                        stored_path=str(audio_file_path.absolute()),
                        file_size_bytes=file_size,
                        mime_type="audio/wav" if audio_fn.endswith(".wav") else "audio/mpeg" if audio_fn.endswith(".mp3") else "audio/flac"
                    )
                    db.add(new_audio)

                    # Create the processing-status row (all stages pending). This REPLACES the
                    # old premature add-vector call: embeddings don't exist yet, so FAISS
                    # indexing is deferred to the admin-triggered processing jobs.
                    db.add(TrackProcessingStatus(
                        track_id=track.id,
                        partner_id=partner_id,
                        ingest_log_id=log_entry.id,
                        audio_filename=audio_fn,
                        sftp_env=env,
                    ))
                    success_count += 1

                log_entry.status = "COMPLETED"
                log_entry.track_count = success_count
                log_entry.completed_at = datetime.utcnow()
                await db.commit()
                logger.info(f"[IngestionService] Batch complete. Successfully ingested {success_count} tracks.")

                # Trigger ingestion.completed webhook event
                dispatch_webhook.delay(
                    partner_id=partner_id,
                    event_type="ingestion.completed",
                    payload={
                        "ingest_log_id": log_entry.id,
                        "batch_filename": log_entry.batch_filename,
                        "track_count": success_count,
                        "dry_run": False,
                        "env": env,
                        "completed_at": log_entry.completed_at.isoformat()
                    }
                )

                # Trigger track.indexed webhook events for all successfully inserted tracks
                for track, _ in tracks_to_insert:
                    dispatch_webhook.delay(
                        partner_id=partner_id,
                        event_type="track.indexed",
                        payload={
                            "track_uuid": track.uuid,
                            "isrc": track.isrc,
                            "title": track.title,
                            "display_artist": track.display_artist
                        }
                    )

        except Exception as e:
            logger.error(f"[IngestionService] Critical failure: {e}")
            await db.rollback()
            log_entry.status = "FAILED"
            log_entry.error_message = str(e)
            log_entry.completed_at = datetime.utcnow()
            await db.commit()
            logger.info(f"[IngestionService] Batch ended with failure for partner {partner_id} (env={env}).")

            # Trigger ingestion.failed webhook event
            try:
                dispatch_webhook.delay(
                    partner_id=partner_id,
                    event_type="ingestion.failed",
                    payload={
                        "ingest_log_id": log_entry.id,
                        "error_message": log_entry.error_message,
                        "failed_at": log_entry.completed_at.isoformat()
                    }
                )
            except Exception as w_ex:
                logger.error(f"Failed to trigger failed webhook after exception: {w_ex}")
