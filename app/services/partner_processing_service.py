"""
Partner Processing Service
==========================

Orchestrates admin-triggered, fire-and-forget batch processing jobs against the
Hetzner media server. The API layer creates a ``partner_processing_jobs`` row
(status ``pending``) and returns a job id immediately; the background worker here
opens its own DB session, drives the Hetzner ``/internal/process/batch-embeddings``
endpoint, updates the per-track ``track_processing_status`` rows, and finalizes the
job record (``completed`` / ``partial`` / ``failed``).

Generated artifacts that physically live on the media server (embedding .npy files,
etc.) are *referenced* in ``document_files`` so the admin file browser / analytics
can surface them. The state-machine itself lives in ``track_processing_status``.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy import select

from database.connection import AsyncSessionLocal
from app.core.context import set_current_partner_id
from app.models.partner_processing_job import PartnerProcessingJob
from app.models.track_processing_status import TrackProcessingStatus
from app.models.track import Track
from app.models.document_file import DocumentFile
from app.services.hetzner_service import HetznerService

logger = logging.getLogger(__name__)

hetzner_service = HetznerService()


async def create_job(
    db,
    partner_id: int,
    job_type: str,
    ingest_log_id: Optional[int] = None,
    triggered_by: Optional[str] = None,
) -> PartnerProcessingJob:
    """Insert a pending job row and return it (committed + refreshed)."""
    job = PartnerProcessingJob(
        partner_id=partner_id,
        ingest_log_id=ingest_log_id,
        job_type=job_type,
        status="pending",
        triggered_by=triggered_by,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def find_active_job(
    db, partner_id: int, job_type: str, ingest_log_id: Optional[int] = None
) -> Optional[PartnerProcessingJob]:
    """Return an existing NON-terminal job of this type for the partner (+ batch), or
    None. Used to debounce duplicate triggers — a second click while one is already
    pending/running/paused returns the existing job instead of spawning a duplicate."""
    set_current_partner_id(partner_id)
    stmt = select(PartnerProcessingJob).where(
        PartnerProcessingJob.partner_id == partner_id,
        PartnerProcessingJob.job_type == job_type,
        PartnerProcessingJob.status.notin_(TERMINAL_JOB_STATES),
    )
    if ingest_log_id is not None:
        stmt = stmt.where(PartnerProcessingJob.ingest_log_id == ingest_log_id)
    stmt = stmt.order_by(PartnerProcessingJob.id.desc()).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _collect_targets(
    db,
    partner_id: int,
    ingest_log_id: Optional[int],
    only_pending: bool,
    pending_field: str = "embedding_status",
) -> List[Dict[str, Any]]:
    """
    Build the work list joining tracks + their processing-status rows.

    ``pending_field`` selects which per-stage status the ``only_pending`` filter looks
    at (``embedding_status`` for embeddings, ``transcode_status`` for transcode, etc.),
    so the same collector drives every job type.

    Returns a list of dicts: {tps_id, track_id, track_uuid, filename, party_id, env}.
    """
    stmt = (
        select(TrackProcessingStatus, Track)
        .join(Track, Track.id == TrackProcessingStatus.track_id)
        .where(TrackProcessingStatus.partner_id == partner_id)
    )
    if ingest_log_id is not None:
        stmt = stmt.where(TrackProcessingStatus.ingest_log_id == ingest_log_id)
    if only_pending:
        stmt = stmt.where(getattr(TrackProcessingStatus, pending_field) != "completed")

    rows = (await db.execute(stmt)).all()
    targets: List[Dict[str, Any]] = []
    for tps, track in rows:
        targets.append(
            {
                "tps_id": tps.id,
                "track_id": track.id,
                "track_uuid": track.uuid,
                "filename": tps.audio_filename or f"{track.uuid}.wav",
                "party_id": track.party_id,
                "env": tps.sftp_env or "live",
            }
        )
    return targets


async def _register_embedding_artifacts(
    db,
    target: Dict[str, Any],
    partner_id: int,
    ingest_log_id: Optional[int],
) -> None:
    """
    Best-effort: register the generated embedding files as document_files rows so
    they appear in the admin file browser. The files physically live on Hetzner;
    we store a logical reference path. Skipped silently if required FKs are missing.
    """
    party_id = target.get("party_id")
    if not party_id or ingest_log_id is None:
        return
    uuid = target["track_uuid"]
    for engine, doc_type in (("maest", "embedding_maest"), ("discogs", "embedding_discogs")):
        # Avoid duplicate registration.
        existing = (
            await db.execute(
                select(DocumentFile.id).where(
                    DocumentFile.track_id == target["track_id"],
                    DocumentFile.doc_type == doc_type,
                )
            )
        ).first()
        if existing:
            continue
        db.add(
            DocumentFile(
                party_id=party_id,
                ingest_log_id=ingest_log_id,
                track_id=target["track_id"],
                partner_id=partner_id,
                original_filename=f"{uuid}.npy",
                stored_path=f"internal/embeddings/{engine}/{uuid}.npy",
                mime_type="application/octet-stream",
                doc_type=doc_type,
            )
        )


# Job states that are final — no further Hetzner polling needed.
TERMINAL_JOB_STATES = ("completed", "failed", "partial")


async def start_embeddings_job(
    db,
    job_id: int,
    partner_id: int,
    env: str = "live",
    index_after: bool = True,
    ingest_log_id: Optional[int] = None,
    only_pending: bool = True,
) -> PartnerProcessingJob:
    """
    Hand off a batch-embeddings job to Hetzner (fire-and-forget).

    Alwyzon owns the DB, so it collects the work list here (joining tracks +
    their processing-status rows), marks the job ``running``, and POSTs the item
    list to Hetzner's async ``/internal/process/embeddings/run``. Hetzner runs the
    embeddings in its own background task; the admin poll later calls
    ``apply_embeddings_result`` to persist per-track status.

    This replaces the old synchronous ``run_embeddings_job`` that blocked a single
    600 s HTTP call for the whole batch (and died on any Alwyzon restart).
    """
    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    dry_run = env == "test"

    set_current_partner_id(partner_id)

    job = await db.get(PartnerProcessingJob, job_id)
    if job is None:
        raise ValueError(f"Processing job {job_id} not found")

    job.status = "running"
    job.started_at = datetime.utcnow()
    await db.commit()

    targets = await _collect_targets(db, partner_id, ingest_log_id, only_pending)
    job.total_tracks = len(targets)
    await db.commit()

    if not targets:
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        await db.commit()
        logger.info(f"[ProcessingService] Job {job_id}: no targets to process.")
        return job

    items = [{"track_uuid": t["track_uuid"], "filename": t["filename"]} for t in targets]

    processing_dir = None
    if ingest_log_id:
        from app.models.b2b import IngestLog
        log = await db.get(IngestLog, ingest_log_id)
        if log:
            processing_dir = log.processing_dir

    result = await hetzner_service.start_embeddings(
        job_id=job_id,
        partner_id=partner_id,
        items=items,
        env=env,
        index_after=index_after and not dry_run,
        processing_dir=processing_dir,
    )

    if not result.get("success"):
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_details = {"error": result.get("error"), "detail": result.get("detail")}
        await db.commit()
        logger.error(
            f"[ProcessingService] Job {job_id} hand-off to media server failed: {result.get('error')}"
        )
        return job

    logger.info(
        f"[ProcessingService] Handed embeddings job {job_id} to Hetzner "
        f"(partner {partner_id}, env={env}, {len(items)} track(s))."
    )
    return job


# ===========================================================================
# Transcode job (raw upload -> 128k mp3) — auto-spawned at ingestion success.
# ===========================================================================

async def start_transcode_job(
    db,
    job_id: int,
    partner_id: int,
    env: str = "live",
    ingest_log_id: Optional[int] = None,
    only_pending: bool = True,
) -> PartnerProcessingJob:
    """Hand off a transcode job to Hetzner (fire-and-forget). Mirrors
    ``start_embeddings_job`` but reads the moved sources from the batch's
    ``processing_dir`` and filters pending on ``transcode_status``."""
    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    set_current_partner_id(partner_id)

    job = await db.get(PartnerProcessingJob, job_id)
    if job is None:
        raise ValueError(f"Processing job {job_id} not found")
    job.status = "running"
    job.started_at = datetime.utcnow()
    await db.commit()

    # The transcode job needs the snapshot dir holding the moved uploads.
    processing_dir = None
    if ingest_log_id:
        from app.models.b2b import IngestLog
        log = await db.get(IngestLog, ingest_log_id)
        if log:
            processing_dir = log.processing_dir
    if not processing_dir:
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_details = {"error": "no processing_dir on ingest log; cannot locate sources"}
        await db.commit()
        logger.error(f"[ProcessingService] Transcode job {job_id}: no processing_dir; aborting.")
        return job

    targets = await _collect_targets(
        db, partner_id, ingest_log_id, only_pending, pending_field="transcode_status"
    )
    job.total_tracks = len(targets)
    await db.commit()
    if not targets:
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        await db.commit()
        logger.info(f"[ProcessingService] Transcode job {job_id}: nothing to do.")
        return job

    items = [{"track_uuid": t["track_uuid"], "filename": t["filename"]} for t in targets]
    result = await hetzner_service.start_transcode(
        job_id=job_id, partner_id=partner_id, items=items, processing_dir=processing_dir, env=env,
    )
    if not result.get("success"):
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_details = {"error": result.get("error"), "detail": result.get("detail")}
        await db.commit()
        logger.error(f"[ProcessingService] Transcode job {job_id} hand-off failed: {result.get('error')}")
        return job

    logger.info(
        f"[ProcessingService] Handed transcode job {job_id} to Hetzner "
        f"(partner {partner_id}, env={env}, {len(items)} track(s))."
    )
    return job


async def pause_transcode_job(db, job: PartnerProcessingJob) -> Tuple[PartnerProcessingJob, Dict[str, Any]]:
    """Ask the media server to pause a running transcode job, then mark it ``paused``."""
    set_current_partner_id(job.partner_id)
    result = await hetzner_service.pause_transcode(job.partner_id, job.id)
    if result.get("success"):
        job.status = "paused"
        await db.commit()
        logger.info(f"[ProcessingService] Transcode job {job.id} paused (partner {job.partner_id}).")
    else:
        logger.error(f"[ProcessingService] Transcode job {job.id} pause failed: {result.get('error')}")
    return job, result


async def _ensure_embedding_job_for_log(
    db, partner_id: int, ingest_log_id: int, triggered_by: Optional[str] = None
) -> Optional[PartnerProcessingJob]:
    """Idempotently create + start the embeddings job for a batch. Skips if one already
    exists for this ingest_log (so re-polls / concurrent applies can't duplicate it —
    the double-job class of bug)."""
    set_current_partner_id(partner_id)
    existing = (
        await db.execute(
            select(PartnerProcessingJob.id).where(
                PartnerProcessingJob.partner_id == partner_id,
                PartnerProcessingJob.ingest_log_id == ingest_log_id,
                PartnerProcessingJob.job_type == "embeddings",
            )
        )
    ).first()
    if existing:
        return None
    job = await create_job(
        db, partner_id=partner_id, job_type="embeddings",
        ingest_log_id=ingest_log_id, triggered_by=triggered_by,
    )
    return await start_embeddings_job(
        db, job_id=job.id, partner_id=partner_id, env="live",
        index_after=True, ingest_log_id=ingest_log_id, only_pending=True,
    )


# Partner-safe per-stage phrasing (no internal error text — the technical reason is
# kept in track_processing_status.<stage>_error for admin diagnostics).
_STAGE_FAIL_VERB = {
    "transcode": "could not be processed",
    "embedding": "could not be embedded",
    "peaks": "waveform peaks could not be generated",
    "segments": "playback segments could not be generated",
}


async def _notify_job_failures(
    db, partner_id: int, kind: str, failed_files: List[str], succeeded: int, failed: int
) -> None:
    """Email partner + admin (with the top-25 failed filenames) when a stage job has
    per-track failures. Best-effort — never breaks the job finalize."""
    if not failed_files:
        return
    try:
        from app.services.notification_service import NotificationService
        verb = _STAGE_FAIL_VERB.get(kind, "failed")
        more = "" if len(failed_files) <= 25 else f" (+{len(failed_files) - 25} more)"
        await NotificationService().notify_partner_operation(
            db, partner_id, kind, "failed",
            summary=f"{len(failed_files)} track(s) {verb} and were skipped.",
            title=f"{kind.capitalize()} — {len(failed_files)} track(s) failed",
            details=[fn for fn in failed_files[:25]] + ([more.strip()] if more else []),
            counts={"Succeeded": succeeded, "Failed": failed},
        )
    except Exception as exc:  # notification must never break the pipeline
        logger.error(f"[ProcessingService] failure notification ({kind}) errored: {exc}")


async def apply_transcode_result(
    db, job: PartnerProcessingJob, state: Dict[str, Any]
) -> PartnerProcessingJob:
    """Persist a Hetzner transcode-job snapshot into Alwyzon's DB. Mirrors
    ``apply_embeddings_result``:
      • running/paused → update live counters only.
      • terminal       → set per-track ``transcode_status`` + finalize the job, then
                         AUTO-SPAWN the embeddings job (idempotently)."""
    status = (state.get("status") or "unknown").lower()
    partner_id = job.partner_id
    ingest_log_id = job.ingest_log_id
    set_current_partner_id(partner_id)

    if status in ("running", "pending", "unknown", "paused"):
        if state.get("total"):
            job.total_tracks = state["total"]
        job.processed_tracks = state.get("succeeded", job.processed_tracks)
        job.failed_tracks = state.get("failed", job.failed_tracks)
        if status == "paused":
            job.status = "paused"
        await db.commit()
        return job

    results = state.get("results", []) or []
    now = datetime.utcnow()
    processed = 0
    failed = 0
    errors: List[Dict[str, Any]] = []
    failed_files: List[str] = []
    for r in results:
        uuid = r.get("track_uuid")
        ok = r.get("status") == "ok"
        row = (
            await db.execute(
                select(TrackProcessingStatus, Track)
                .join(Track, Track.id == TrackProcessingStatus.track_id)
                .where(Track.uuid == uuid, TrackProcessingStatus.partner_id == partner_id)
                .limit(1)
            )
        ).first()
        tps, track = (row[0], row[1]) if row else (None, None)
        if ok:
            processed += 1
            if tps is not None:
                tps.transcode_status = "completed"
                tps.transcode_completed_at = now
                tps.transcode_error = None
        else:
            failed += 1
            msg = r.get("message") or "Unknown transcode error"
            errors.append({"track_uuid": uuid, "message": msg})
            failed_files.append((tps.audio_filename if tps and tps.audio_filename else uuid) or "unknown")
            if tps is not None:
                tps.transcode_status = "failed"
                tps.transcode_error = msg
            # No mp3 → embedding/peaks/segments can't run → the track is unusable.
            if track is not None:
                track.is_active = False

    job.processed_tracks = processed
    job.failed_tracks = failed
    if status == "failed":
        job.status = "failed"
        job.error_details = {
            "error": state.get("error_message") or "Media server reported failure",
            **({"failures": errors} if errors else {}),
        }
    else:
        job.error_details = {"failures": errors} if errors else None
        job.status = "completed" if failed == 0 else ("failed" if processed == 0 else "partial")
    job.completed_at = datetime.utcnow()
    await db.commit()

    # Notify partner + admin about any tracks that failed to transcode.
    await _notify_job_failures(db, partner_id, "transcode", failed_files, processed, failed)

    # Transcode produced the mp3s → kick off embeddings automatically (idempotent).
    if job.status in ("completed", "partial") and ingest_log_id:
        try:
            await _ensure_embedding_job_for_log(
                db, partner_id, ingest_log_id, triggered_by="auto:post-transcode"
            )
        except Exception as exc:  # never let the auto-spawn break the transcode finalize
            logger.error(f"[ProcessingService] auto-spawn embeddings after transcode failed: {exc}")
    return job


async def pause_embeddings_job(db, job: PartnerProcessingJob) -> Tuple[PartnerProcessingJob, Dict[str, Any]]:
    """
    Ask the media server to pause a running embeddings job, then mark it ``paused``.

    The media loop stops after its current track and writes a ``paused`` snapshot.
    Idempotent — safe even if the job already finished or isn't actively running.
    """
    set_current_partner_id(job.partner_id)
    result = await hetzner_service.pause_embeddings(job.partner_id, job.id)
    if result.get("success"):
        job.status = "paused"
        await db.commit()
        logger.info(f"[ProcessingService] Job {job.id} paused (partner {job.partner_id}).")
    else:
        logger.error(
            f"[ProcessingService] Job {job.id} pause request failed: {result.get('error')}"
        )
    return job, result


async def resume_embeddings_job(
    db,
    job: PartnerProcessingJob,
    env: str = "live",
    index_after: bool = True,
) -> PartnerProcessingJob:
    """
    Resume a paused/interrupted embeddings job.

    Re-collects the partner's FULL track list (``only_pending=False``) and re-hands
    it to the media server under the SAME ``job_id``. The media runner skips every
    track whose ``.npy`` already exists, so only the outstanding work runs, and the
    FAISS index is rebuilt from all embeddings on completion. This makes resume
    idempotent and crash-safe (e.g. after a process restart mid-job).
    """
    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    dry_run = env == "test"

    set_current_partner_id(job.partner_id)

    job.status = "running"
    job.completed_at = None
    job.started_at = job.started_at or datetime.utcnow()
    await db.commit()

    targets = await _collect_targets(db, job.partner_id, job.ingest_log_id, only_pending=False)
    job.total_tracks = len(targets)
    await db.commit()

    if not targets:
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        await db.commit()
        logger.info(f"[ProcessingService] Resume job {job.id}: nothing to process.")
        return job

    items = [{"track_uuid": t["track_uuid"], "filename": t["filename"]} for t in targets]
    result = await hetzner_service.start_embeddings(
        job_id=job.id,
        partner_id=job.partner_id,
        items=items,
        env=env,
        index_after=index_after and not dry_run,
    )
    if not result.get("success"):
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_details = {"error": result.get("error"), "detail": result.get("detail")}
        await db.commit()
        logger.error(
            f"[ProcessingService] Resume job {job.id} hand-off failed: {result.get('error')}"
        )
        return job

    logger.info(
        f"[ProcessingService] Resumed embeddings job {job.id} "
        f"(partner {job.partner_id}, {len(items)} track(s); already-done skipped on media)."
    )
    return job


async def apply_embeddings_result(
    db,
    job: PartnerProcessingJob,
    state: Dict[str, Any],
) -> PartnerProcessingJob:
    """
    Persist a Hetzner embeddings-job status snapshot into Alwyzon's DB.

    Mirrors ``apply_ingestion_result``:
      • running/unknown → update live progress counters only (job stays running).
      • failed          → mark the job failed.
      • completed       → apply per-track ``track_processing_status`` updates,
                          register artifacts, and finalize the job
                          (completed | partial | failed depending on per-track results).

    Re-queries each track by uuid (the work list isn't persisted), so it is safe to
    call from any poll without the original in-memory target list.
    """
    status = (state.get("status") or "unknown").lower()
    env = (state.get("env") or "live").lower()
    dry_run = env == "test"
    partner_id = job.partner_id
    ingest_log_id = job.ingest_log_id

    # ----- Non-terminal (running/paused): surface live progress, never finalize. -
    # 'paused' must NOT fall through to the terminal branch (that would mark the
    # job completed). Keep it paused so it can be resumed.
    if status in ("running", "pending", "unknown", "paused"):
        if state.get("total"):
            job.total_tracks = state["total"]
        job.processed_tracks = state.get("succeeded", job.processed_tracks)
        job.failed_tracks = state.get("failed", job.failed_tracks)
        if status == "paused":
            job.status = "paused"
        await db.commit()
        return job

    # ----- Terminal (completed | failed): apply whatever per-track results exist.
    # A mid-run crash on Hetzner reports status="failed" *with* partial results, so
    # we always persist the per-track outcomes we did get, then let the media-server
    # status decide the final job state (a crash must never be reported as success).
    results = state.get("results", []) or []
    processed = 0
    failed = 0
    errors: List[Dict[str, Any]] = []
    failed_files: List[str] = []
    now = datetime.utcnow()

    for r in results:
        uuid = r.get("track_uuid")
        ok = r.get("status") == "ok"

        # Re-derive the track + its processing-status row by uuid.
        row = (
            await db.execute(
                select(TrackProcessingStatus, Track)
                .join(Track, Track.id == TrackProcessingStatus.track_id)
                .where(Track.uuid == uuid, TrackProcessingStatus.partner_id == partner_id)
                .limit(1)
            )
        ).first()
        tps, track = (row[0], row[1]) if row else (None, None)

        if ok:
            processed += 1
            if not dry_run and tps is not None:
                tps.embedding_status = "completed"
                tps.embedding_completed_at = now
                tps.embedding_error = None
                if r.get("maest_indexed") or r.get("discogs_indexed"):
                    tps.faiss_indexed = True
                    tps.faiss_indexed_at = now
                # Register embedding artifacts (best-effort).
                if track is not None:
                    target = {
                        "track_uuid": track.uuid,
                        "track_id": track.id,
                        "party_id": track.party_id,
                    }
                    try:
                        await _register_embedding_artifacts(db, target, partner_id, ingest_log_id)
                    except Exception as art_ex:
                        logger.warning(f"Artifact registration failed for {uuid}: {art_ex}")
        else:
            failed += 1
            msg = r.get("message") or "Unknown embedding error"
            errors.append({"track_uuid": uuid, "message": msg})
            failed_files.append((tps.audio_filename if tps and tps.audio_filename else uuid) or "unknown")
            if not dry_run and tps is not None:
                tps.embedding_status = "failed"
                tps.embedding_error = msg
            # No vector → the track can't be a similarity result or a usable reference.
            # Deactivate it so it never appears in the partner catalog/search as broken.
            if not dry_run and track is not None:
                track.is_active = False

    job.processed_tracks = processed
    job.failed_tracks = failed
    if status == "failed":
        # Hetzner aborted mid-run — the un-attempted tracks stay pending; the job
        # is failed regardless of how many of the attempted ones succeeded.
        job.status = "failed"
        job.error_details = {
            "error": state.get("error_message") or "Media server reported failure",
            **({"failures": errors} if errors else {}),
        }
    else:
        job.error_details = {"failures": errors} if errors else None
        if failed == 0:
            job.status = "completed"
        elif processed == 0:
            job.status = "failed"
        else:
            job.status = "partial"
    job.completed_at = datetime.utcnow()
    await db.commit()

    # Notify partner + admin about any tracks that failed to embed.
    if not dry_run:
        await _notify_job_failures(db, partner_id, "embedding", failed_files, processed, failed)

    if job.ingest_log_id and job.status in ("completed", "partial"):
        from app.models.b2b import IngestLog
        from app.services.ingestion_stages import advance_stage, Stage
        from app.tasks.webhooks import dispatch_webhook
        
        log = await db.get(IngestLog, job.ingest_log_id)
        if log and log.status != "COMPLETED":
            advance_stage(log, Stage.EMBEDDING)
            advance_stage(log, Stage.INDEXED)
            advance_stage(log, Stage.FINALIZING)
            advance_stage(log, Stage.READY)
            log.status = "COMPLETED"
            log.completed_at = datetime.utcnow()
            await db.commit()
            
            dispatch_webhook.delay(
                partner_id=partner_id,
                event_type="ingestion.completed",
                payload={
                    "batch": log.batch_filename,
                    "status": "completed",
                    "stage": Stage.READY,
                    "track_count": log.track_count,
                    "env": env,
                },
            )

    # Notify partner + admin of the embedding outcome (best-effort; own session so a
    # mail/DB hiccup can't roll back the finalized job). Skip dry-run (test env) noise.
    if not dry_run:
        try:
            from app.services.notification_service import NotificationService
            from database.connection import AsyncSessionLocal
            if job.status == "completed":
                n_status, summary = "success", (
                    f"Embedding completed for your batch: {processed} track(s) processed "
                    f"and indexed. Your tracks are now searchable."
                )
            elif job.status == "partial":
                n_status, summary = "warning", (
                    f"Embedding finished with some failures: {processed} succeeded, "
                    f"{failed} failed. The successful tracks are searchable."
                )
            else:
                n_status, summary = "failed", (
                    "Embedding failed for your batch. Our team has been notified and "
                    "will look into it."
                )
            async with AsyncSessionLocal() as ndb:
                await NotificationService().notify_partner_operation(
                    ndb, partner_id=partner_id, event_type="embedding", status=n_status,
                    summary=summary, counts={"Processed": processed, "Failed": failed},
                    commit=True,
                )
        except Exception as ex:
            logger.error("[ProcessingService] embedding notification failed for partner %s: %s",
                         partner_id, ex)

    logger.info(
        f"[ProcessingService] Job {job.id} finalized from media server: env={env} "
        f"processed={processed} failed={failed} status={job.status}"
    )
    return job
