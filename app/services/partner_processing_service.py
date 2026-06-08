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
from typing import Optional, List, Dict, Any

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


async def _collect_targets(
    db,
    partner_id: int,
    ingest_log_id: Optional[int],
    only_pending: bool,
) -> List[Dict[str, Any]]:
    """
    Build the work list joining tracks + their processing-status rows.

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
        stmt = stmt.where(TrackProcessingStatus.embedding_status != "completed")

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

    result = await hetzner_service.start_embeddings(
        job_id=job_id,
        partner_id=partner_id,
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
            f"[ProcessingService] Job {job_id} hand-off to media server failed: {result.get('error')}"
        )
        return job

    logger.info(
        f"[ProcessingService] Handed embeddings job {job_id} to Hetzner "
        f"(partner {partner_id}, env={env}, {len(items)} track(s))."
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

    # ----- Still running: just surface live progress counters. ---------------
    if status in ("running", "pending", "unknown"):
        if state.get("total"):
            job.total_tracks = state["total"]
        job.processed_tracks = state.get("succeeded", job.processed_tracks)
        job.failed_tracks = state.get("failed", job.failed_tracks)
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
            if not dry_run and tps is not None:
                tps.embedding_status = "failed"
                tps.embedding_error = msg

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
    logger.info(
        f"[ProcessingService] Job {job.id} finalized from media server: env={env} "
        f"processed={processed} failed={failed} status={job.status}"
    )
    return job
