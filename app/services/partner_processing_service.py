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
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy import select, update as sa_update

from database.connection import AsyncSessionLocal
from app.core.context import set_current_partner_id, set_admin_context
from app.models.partner_processing_job import PartnerProcessingJob
from app.models.track_processing_status import TrackProcessingStatus
from app.models.track import Track
from app.models.document_file import DocumentFile
from app.services.hetzner_service import HetznerService

logger = logging.getLogger(__name__)

# Per-chunk size for the bulk terminal result-apply (kept off the request in a Celery
# task). Each chunk is one bulk SELECT + a few bulk UPDATEs, committed in its own session.
_APPLY_CHUNK = max(1, int(os.getenv("PROCESSING_APPLY_CHUNK", "1000") or 1000))
# Cap how many per-track error samples/filenames we accumulate in memory + persist (a
# pathological all-failed 1M batch must not build a 1M-entry list). Counts stay exact.
_MAX_REPORTED = 100
_ERR_MAX = 2000  # cap stored per-track error message length
# A job stuck at status='finalizing' this long means the finalize worker likely died →
# a poll re-enqueues the (idempotent) finalize task.
_FINALIZE_STALE_SECONDS = int(os.getenv("PROCESSING_FINALIZE_STALE_SECONDS", "900") or 900)

# Per-stage TrackProcessingStatus column names (status / error / completed-at).
_STAGE_FIELDS = {
    "transcode": ("transcode_status", "transcode_error", "transcode_completed_at"),
    "embeddings": ("embedding_status", "embedding_error", "embedding_completed_at"),
    "peaks": ("peaks_status", "peaks_error", "peaks_completed_at"),
    "segments": ("segments_status", "segments_error", "segments_completed_at"),
}
# Stages whose FAILURE makes the track unusable → deactivate it (exclude from catalog/search).
# A peaks/segments failure only degrades PLAYBACK; the track stays searchable, so we don't
# deactivate it (per the pipeline failure matrix).
_DEACTIVATE_ON_FAIL = {"transcode", "embeddings"}

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
    transcode_job_id: Optional[int] = None,
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
        transcode_job_id=transcode_job_id,
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
    db, partner_id: int, ingest_log_id: int, triggered_by: Optional[str] = None,
    transcode_job_id: Optional[int] = None,
) -> Optional[PartnerProcessingJob]:
    """Idempotently create + start the embeddings job for a batch. Skips if one already
    exists for this ingest_log (so re-polls / concurrent applies can't duplicate it —
    the double-job class of bug).

    ``transcode_job_id`` enables OVERLAP mode: the embeddings job is spawned alongside the
    transcode job (at ingestion success) and consumes each mp3 as transcode produces it.
    Left None for the post-transcode safety-net call (transcode already done → single pass).
    """
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
        transcode_job_id=transcode_job_id,
    )


# ===========================================================================
# Phase-2 playback-asset jobs: PEAKS + SEGMENTS (consume the transcoded mp3).
# Only spawned for similarity_playback partners. They mirror transcode but need no
# processing_dir (each track is read from raw/<uuid>.mp3 by uuid).
# ===========================================================================

async def _start_simple_stage_job(
    db, job_id: int, partner_id: int, stage: str, env: str = "live",
    ingest_log_id: Optional[int] = None, only_pending: bool = True,
) -> PartnerProcessingJob:
    """Shared hand-off for a peaks/segments job (``stage`` ∈ {peaks, segments})."""
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

    pending_field = "peaks_status" if stage == "peaks" else "segments_status"
    targets = await _collect_targets(db, partner_id, ingest_log_id, only_pending, pending_field=pending_field)
    job.total_tracks = len(targets)
    await db.commit()
    if not targets:
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        await db.commit()
        logger.info(f"[ProcessingService] {stage.capitalize()} job {job_id}: nothing to do.")
        return job

    items = [{"track_uuid": t["track_uuid"], "filename": t["filename"]} for t in targets]
    starter = hetzner_service.start_peaks if stage == "peaks" else hetzner_service.start_segments
    result = await starter(job_id=job_id, partner_id=partner_id, items=items, env=env)
    if not result.get("success"):
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_details = {"error": result.get("error"), "detail": result.get("detail")}
        await db.commit()
        logger.error(f"[ProcessingService] {stage.capitalize()} job {job_id} hand-off failed: {result.get('error')}")
        return job

    logger.info(
        f"[ProcessingService] Handed {stage} job {job_id} to Hetzner "
        f"(partner {partner_id}, env={env}, {len(items)} track(s))."
    )
    return job


async def start_peaks_job(db, job_id, partner_id, env="live", ingest_log_id=None, only_pending=True):
    return await _start_simple_stage_job(db, job_id, partner_id, "peaks", env, ingest_log_id, only_pending)


async def start_segments_job(db, job_id, partner_id, env="live", ingest_log_id=None, only_pending=True):
    return await _start_simple_stage_job(db, job_id, partner_id, "segments", env, ingest_log_id, only_pending)


async def _pause_stage_job(db, job: PartnerProcessingJob, stage: str) -> Tuple[PartnerProcessingJob, Dict[str, Any]]:
    set_current_partner_id(job.partner_id)
    pauser = hetzner_service.pause_peaks if stage == "peaks" else hetzner_service.pause_segments
    result = await pauser(job.partner_id, job.id)
    if result.get("success"):
        job.status = "paused"
        await db.commit()
        logger.info(f"[ProcessingService] {stage.capitalize()} job {job.id} paused (partner {job.partner_id}).")
    else:
        logger.error(f"[ProcessingService] {stage.capitalize()} job {job.id} pause failed: {result.get('error')}")
    return job, result


async def pause_peaks_job(db, job):
    return await _pause_stage_job(db, job, "peaks")


async def pause_segments_job(db, job):
    return await _pause_stage_job(db, job, "segments")


async def _ensure_stage_job_for_log(
    db, partner_id: int, ingest_log_id: int, stage: str, triggered_by: Optional[str] = None,
) -> Optional[PartnerProcessingJob]:
    """Idempotently create + start a peaks/segments job for a batch (skips if one exists)."""
    set_current_partner_id(partner_id)
    existing = (await db.execute(
        select(PartnerProcessingJob.id).where(
            PartnerProcessingJob.partner_id == partner_id,
            PartnerProcessingJob.ingest_log_id == ingest_log_id,
            PartnerProcessingJob.job_type == stage,
        )
    )).first()
    if existing:
        return None
    job = await create_job(db, partner_id=partner_id, job_type=stage,
                           ingest_log_id=ingest_log_id, triggered_by=triggered_by)
    return await _start_simple_stage_job(
        db, job_id=job.id, partner_id=partner_id, stage=stage,
        env="live", ingest_log_id=ingest_log_id, only_pending=True,
    )


async def _partner_wants_playback(db, partner_id: int) -> bool:
    """True if the partner's service_mode is similarity_playback (so peaks/segments run)."""
    from app.models.partner import Partner
    mode = (await db.execute(select(Partner.service_mode).where(Partner.id == partner_id))).scalar_one_or_none()
    return (mode or "").lower() == "similarity_playback"


async def _apply_simple_stage_result(db, job: PartnerProcessingJob, state: Dict[str, Any], kind: str) -> PartnerProcessingJob:
    """Persist a peaks/segments job snapshot. Like apply_transcode_result but with no
    downstream auto-spawn, and a failure does NOT deactivate the track (playback-only)."""
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
    summary = await _apply_track_results_bulk(partner_id, kind, results, ingest_log_id)
    processed = summary["processed"]
    failed = summary["failed"]
    errors = summary["errors"]
    failed_files = summary["failed_files"]

    job.processed_tracks = processed
    job.failed_tracks = failed
    if status == "failed":
        job.status = "failed"
        job.error_details = {
            "error": state.get("error_message") or "Media server reported failure",
            **({"failures": errors, "failed_count": failed} if errors else {}),
        }
    else:
        job.error_details = {"failures": errors, "failed_count": failed} if errors else None
        job.status = "completed" if failed == 0 else ("failed" if processed == 0 else "partial")
    job.completed_at = datetime.utcnow()
    job.finalizing_at = None
    await db.commit()

    await _notify_job_failures(db, partner_id, kind, failed_files, processed, failed)
    return job


async def apply_peaks_result(db, job, state):
    return await _apply_simple_stage_result(db, job, state, "peaks")


async def apply_segments_result(db, job, state):
    return await _apply_simple_stage_result(db, job, state, "segments")


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
    """Email partner + admin (with up to 25 sample failed filenames) when a stage job has
    per-track failures. ``failed`` is the TRUE failure count (``failed_files`` may be a
    capped sample). Best-effort — never breaks the job finalize."""
    if failed <= 0:
        return
    try:
        from app.services.notification_service import NotificationService
        verb = _STAGE_FAIL_VERB.get(kind, "failed")
        shown = failed_files[:25]
        more = "" if failed <= len(shown) else f" (+{failed - len(shown)} more)"
        await NotificationService().notify_partner_operation(
            db, partner_id, kind, "failed",
            summary=f"{failed} track(s) {verb} and were skipped.",
            title=f"{kind.capitalize()} — {failed} track(s) failed",
            details=list(shown) + ([more.strip()] if more else []),
            counts={"Succeeded": succeeded, "Failed": failed},
        )
    except Exception as exc:  # notification must never break the pipeline
        logger.error(f"[ProcessingService] failure notification ({kind}) errored: {exc}")


async def _register_embedding_artifacts_bulk(
    db, partner_id: int, ingest_log_id: int, ok_rows: List[Tuple[str, int, Any]]
) -> None:
    """Bulk-register embedding .npy ``document_files`` for the ok tracks (both engines),
    skipping any that already exist — ONE existence query + bulk add (vs 2 SELECT + 2 add
    per track). ``ok_rows`` = list of (uuid, track_id, party_id)."""
    rows = [(u, tid, p) for (u, tid, p) in ok_rows if p]
    if not rows:
        return
    track_ids = [tid for _u, tid, _p in rows]
    existing = set()
    res = await db.execute(
        select(DocumentFile.track_id, DocumentFile.doc_type).where(
            DocumentFile.track_id.in_(track_ids),
            DocumentFile.doc_type.in_(["embedding_maest", "embedding_discogs"]),
        )
    )
    for tid, dt in res.all():
        existing.add((tid, dt))
    for uuid, track_id, party_id in rows:
        for engine, doc_type in (("maest", "embedding_maest"), ("discogs", "embedding_discogs")):
            if (track_id, doc_type) in existing:
                continue
            db.add(DocumentFile(
                party_id=party_id, ingest_log_id=ingest_log_id, track_id=track_id,
                partner_id=partner_id, original_filename=f"{uuid}.npy",
                stored_path=f"internal/embeddings/{engine}/{uuid}.npy",
                mime_type="application/octet-stream", doc_type=doc_type,
            ))


async def _apply_track_results_bulk(
    partner_id: int, job_type: str, results: List[Dict[str, Any]],
    ingest_log_id: Optional[int], dry_run: bool = False,
) -> Dict[str, Any]:
    """Apply per-track transcode/embedding outcomes to ``track_processing_status`` + ``tracks``
    in BULK, chunked with a fresh committed session per chunk.

    This replaces the old per-result ``SELECT``-then-mutate loop that ran inline in the admin
    poll — at 50k–1M tracks that was N queries in one giant request-bound transaction and would
    hang. Here each chunk is one bulk SELECT (uuid→row map) + a handful of bulk UPDATEs, so the
    whole apply is O(total/chunk) statements and never holds a batch-sized transaction.
    Idempotent (re-running sets the same terminal statuses), so a re-enqueue is safe.

    Returns ``{processed, failed, indexed, failed_files (≤100 sample), errors (≤100 sample)}``.
    ``processed``/``failed`` are exact counts; the sample lists are capped for memory.
    """
    status_col, error_col, completed_col = _STAGE_FIELDS[job_type]
    processed = 0
    failed = 0
    indexed = 0
    failed_files: List[str] = []
    errors: List[Dict[str, Any]] = []
    now = datetime.utcnow()

    for i in range(0, len(results), _APPLY_CHUNK):
        chunk = results[i:i + _APPLY_CHUNK]
        ok = [r for r in chunk if r.get("status") == "ok"]
        bad = [r for r in chunk if r.get("status") != "ok"]
        processed += len(ok)
        failed += len(bad)

        if dry_run:
            for r in bad:
                if len(errors) < _MAX_REPORTED:
                    errors.append({"track_uuid": r.get("track_uuid"), "message": r.get("message") or "error"})
                if len(failed_files) < _MAX_REPORTED:
                    failed_files.append(r.get("track_uuid") or "unknown")
            continue

        chunk_uuids = [r.get("track_uuid") for r in chunk if r.get("track_uuid")]
        async with AsyncSessionLocal() as db:
            set_admin_context(True)
            set_current_partner_id(partner_id)
            rows = (await db.execute(
                select(
                    TrackProcessingStatus.id, TrackProcessingStatus.track_id,
                    TrackProcessingStatus.audio_filename, Track.uuid, Track.party_id,
                )
                .join(Track, Track.id == TrackProcessingStatus.track_id)
                .where(Track.uuid.in_(chunk_uuids), TrackProcessingStatus.partner_id == partner_id)
            )).all()
            # uuid -> (tps_id, track_id, filename, party_id)
            by_uuid = {uuid: (tps_id, tid, fn, party) for tps_id, tid, fn, uuid, party in rows}

            # OK: bulk status update + bulk faiss_indexed for the indexed subset (embeddings).
            ok_tps = [by_uuid[r["track_uuid"]][0] for r in ok if r.get("track_uuid") in by_uuid]
            if ok_tps:
                await db.execute(
                    sa_update(TrackProcessingStatus).where(TrackProcessingStatus.id.in_(ok_tps))
                    .values(**{status_col: "completed", error_col: None, completed_col: now})
                )
            if job_type == "embeddings":
                idx_tps = [
                    by_uuid[r["track_uuid"]][0] for r in ok
                    if r.get("track_uuid") in by_uuid and (r.get("maest_indexed") or r.get("discogs_indexed"))
                ]
                indexed += len(idx_tps)
                if idx_tps:
                    await db.execute(
                        sa_update(TrackProcessingStatus).where(TrackProcessingStatus.id.in_(idx_tps))
                        .values(faiss_indexed=True, faiss_indexed_at=now)
                    )

            # FAILED: per-row message differs → small loop (failures are the exception, not
            # the rule). Collect track_ids to deactivate in one bulk UPDATE.
            fail_track_ids: List[int] = []
            for r in bad:
                u = r.get("track_uuid")
                raw_msg = r.get("message") or "Unknown error"
                if len(errors) < _MAX_REPORTED:
                    errors.append({"track_uuid": u, "message": raw_msg})
                if u in by_uuid:
                    tps_id, tid, fn, _party = by_uuid[u]
                    if len(failed_files) < _MAX_REPORTED:
                        failed_files.append(fn or u or "unknown")
                    fail_track_ids.append(tid)
                    await db.execute(
                        sa_update(TrackProcessingStatus).where(TrackProcessingStatus.id == tps_id)
                        .values(**{status_col: "failed", error_col: raw_msg[:_ERR_MAX]})
                    )
                elif len(failed_files) < _MAX_REPORTED:
                    failed_files.append(u or "unknown")
            if fail_track_ids and job_type in _DEACTIVATE_ON_FAIL:
                # No mp3 (transcode) / no vector (embedding) → unusable → exclude from
                # catalog + search (the catalog query filters is_active != False). A
                # peaks/segments failure only degrades playback, so the track stays active.
                await db.execute(
                    sa_update(Track).where(Track.id.in_(fail_track_ids)).values(is_active=False)
                )

            # Embeddings artifacts (best-effort; bulk + skip-existing).
            if job_type == "embeddings" and ingest_log_id:
                ok_artifacts = [
                    (r["track_uuid"], by_uuid[r["track_uuid"]][1], by_uuid[r["track_uuid"]][3])
                    for r in ok if r.get("track_uuid") in by_uuid
                ]
                try:
                    await _register_embedding_artifacts_bulk(db, partner_id, ingest_log_id, ok_artifacts)
                except Exception as art_ex:
                    logger.warning(f"[ProcessingService] bulk artifact registration failed: {art_ex}")

            await db.commit()

    return {"processed": processed, "failed": failed, "indexed": indexed,
            "failed_files": failed_files, "errors": errors}


def _finalize_stale(job: PartnerProcessingJob) -> bool:
    """True if a job has been stuck at status='finalizing' too long (worker likely died)."""
    if job.finalizing_at is None:
        return True
    return (datetime.utcnow() - job.finalizing_at).total_seconds() > _FINALIZE_STALE_SECONDS


async def claim_and_enqueue_finalize(db, job: PartnerProcessingJob) -> PartnerProcessingJob:
    """The media job is terminal → hand the (potentially huge) per-track result-apply to a
    background task instead of doing it in the poll request. Row-locked claim so concurrent
    polls don't enqueue duplicates; a stale 'finalizing' (dead worker) re-enqueues."""
    set_current_partner_id(job.partner_id)
    locked = (await db.execute(
        select(PartnerProcessingJob).where(PartnerProcessingJob.id == job.id).with_for_update()
    )).scalar_one()
    if locked.status in TERMINAL_JOB_STATES:
        await db.commit()
        return locked
    if locked.status == "finalizing" and not _finalize_stale(locked):
        await db.commit()  # already being finalized → release lock, report progress
        return locked
    locked.status = "finalizing"
    locked.finalizing_at = datetime.utcnow()
    await db.commit()
    try:
        from app.tasks.processing_tasks import finalize_processing_job
        finalize_processing_job.delay(locked.id)
        logger.info(f"[ProcessingService] enqueued background finalize for {locked.job_type} job {locked.id}.")
    except Exception as exc:
        logger.error(f"[ProcessingService] failed to enqueue finalize for job {locked.id}: {exc}")
    return locked


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

    # Terminal: apply per-track outcomes in BULK (chunked, own sessions — never an N-query
    # in-request loop), then finalize the job row here.
    results = state.get("results", []) or []
    summary = await _apply_track_results_bulk(partner_id, "transcode", results, ingest_log_id)
    processed = summary["processed"]
    failed = summary["failed"]
    errors = summary["errors"]
    failed_files = summary["failed_files"]

    job.processed_tracks = processed
    job.failed_tracks = failed
    if status == "failed":
        job.status = "failed"
        job.error_details = {
            "error": state.get("error_message") or "Media server reported failure",
            **({"failures": errors, "failed_count": failed} if errors else {}),
        }
    else:
        job.error_details = {"failures": errors, "failed_count": failed} if errors else None
        job.status = "completed" if failed == 0 else ("failed" if processed == 0 else "partial")
    job.completed_at = datetime.utcnow()
    job.finalizing_at = None
    await db.commit()

    # Notify partner + admin about any tracks that failed to transcode.
    await _notify_job_failures(db, partner_id, "transcode", failed_files, processed, failed)

    # Safety net: the embeddings job is normally spawned concurrently at ingestion
    # success (overlap mode) and consumes mp3s as they land. This idempotent call only
    # creates one if that earlier spawn never happened (e.g. the media hand-off hiccuped);
    # transcode is already done here, so it runs single-pass (transcode_job_id=None).
    if job.status in ("completed", "partial") and ingest_log_id:
        try:
            await _ensure_embedding_job_for_log(
                db, partner_id, ingest_log_id, triggered_by="auto:post-transcode"
            )
        except Exception as exc:  # never let the auto-spawn break the transcode finalize
            logger.error(f"[ProcessingService] auto-spawn embeddings after transcode failed: {exc}")

        # Phase-2 playback assets: peaks + segments jobs, but ONLY for similarity_playback
        # partners. They consume the transcoded mp3 (now present). Idempotent; independent
        # of each other and of embeddings (run in parallel on the 3/4-core pool).
        try:
            if await _partner_wants_playback(db, partner_id):
                for _stage in ("peaks", "segments"):
                    await _ensure_stage_job_for_log(
                        db, partner_id, ingest_log_id, _stage, triggered_by="auto:post-transcode"
                    )
        except Exception as exc:  # never let the auto-spawn break the transcode finalize
            logger.error(f"[ProcessingService] auto-spawn peaks/segments after transcode failed: {exc}")
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
    # Apply per-track outcomes in BULK (chunked, own sessions) — no N-query in-request loop.
    # Sets embedding_status/error, faiss_indexed for the indexed subset, deactivates failed
    # tracks, and bulk-registers embedding artifacts. dry_run (test env) computes counts only.
    results = state.get("results", []) or []
    summary = await _apply_track_results_bulk(
        partner_id, "embeddings", results, ingest_log_id, dry_run=dry_run
    )
    processed = summary["processed"]
    failed = summary["failed"]
    errors = summary["errors"]
    failed_files = summary["failed_files"]

    job.processed_tracks = processed
    job.failed_tracks = failed
    if status == "failed":
        # Hetzner aborted mid-run — the un-attempted tracks stay pending; the job
        # is failed regardless of how many of the attempted ones succeeded.
        job.status = "failed"
        job.error_details = {
            "error": state.get("error_message") or "Media server reported failure",
            **({"failures": errors, "failed_count": failed} if errors else {}),
        }
    else:
        job.error_details = {"failures": errors, "failed_count": failed} if errors else None
        if failed == 0:
            job.status = "completed"
        elif processed == 0:
            job.status = "failed"
        else:
            job.status = "partial"
    job.completed_at = datetime.utcnow()
    job.finalizing_at = None
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
