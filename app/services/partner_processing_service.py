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


async def run_embeddings_job(
    job_id: int,
    partner_id: int,
    env: str = "live",
    index_after: bool = True,
    ingest_log_id: Optional[int] = None,
    only_pending: bool = True,
) -> None:
    """
    Fire-and-forget worker: generate (and optionally index) embeddings for a
    partner's tracks via Hetzner, updating job + per-track status as it goes.
    """
    env = (env or "live").lower()
    if env not in ("test", "live"):
        env = "live"
    dry_run = env == "test"

    set_current_partner_id(partner_id)

    async with AsyncSessionLocal() as db:
        job = await db.get(PartnerProcessingJob, job_id)
        if job is None:
            logger.error(f"[ProcessingService] Job {job_id} not found; aborting.")
            return

        job.status = "running"
        job.started_at = datetime.utcnow()
        await db.commit()

        try:
            targets = await _collect_targets(db, partner_id, ingest_log_id, only_pending)
            job.total_tracks = len(targets)
            await db.commit()

            if not targets:
                job.status = "completed"
                job.completed_at = datetime.utcnow()
                await db.commit()
                logger.info(f"[ProcessingService] Job {job_id}: no targets to process.")
                return

            items = [{"track_uuid": t["track_uuid"], "filename": t["filename"]} for t in targets]

            result = await hetzner_service.batch_embeddings(
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
                logger.error(f"[ProcessingService] Job {job_id} failed: {result.get('error')}")
                return

            data = result.get("data", {}) or {}
            results_by_uuid = {r.get("track_uuid"): r for r in data.get("results", [])}

            processed = 0
            failed = 0
            errors: List[Dict[str, Any]] = []
            now = datetime.utcnow()

            for target in targets:
                r = results_by_uuid.get(target["track_uuid"], {})
                ok = r.get("status") == "ok"
                tps = await db.get(TrackProcessingStatus, target["tps_id"])

                if ok:
                    processed += 1
                    if not dry_run and tps is not None:
                        tps.embedding_status = "completed"
                        tps.embedding_completed_at = now
                        tps.embedding_error = None
                        if index_after and (r.get("maest_indexed") or r.get("discogs_indexed")):
                            tps.faiss_indexed = True
                            tps.faiss_indexed_at = now
                        # Register embedding artifacts (best-effort).
                        try:
                            await _register_embedding_artifacts(db, target, partner_id, ingest_log_id)
                        except Exception as art_ex:
                            logger.warning(f"Artifact registration failed for {target['track_uuid']}: {art_ex}")
                else:
                    failed += 1
                    msg = r.get("message") or "Unknown embedding error"
                    errors.append({"track_uuid": target["track_uuid"], "message": msg})
                    if not dry_run and tps is not None:
                        tps.embedding_status = "failed"
                        tps.embedding_error = msg

            job.processed_tracks = processed
            job.failed_tracks = failed
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
                f"[ProcessingService] Job {job_id} done: env={env} processed={processed} "
                f"failed={failed} status={job.status}"
            )

        except Exception as e:
            logger.error(f"[ProcessingService] Job {job_id} crashed: {e}", exc_info=True)
            await db.rollback()
            job = await db.get(PartnerProcessingJob, job_id)
            if job is not None:
                job.status = "failed"
                job.completed_at = datetime.utcnow()
                job.error_details = {"error": str(e)}
                await db.commit()
