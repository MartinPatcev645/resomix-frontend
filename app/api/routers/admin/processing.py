"""
Admin Processing, Ingestion & Track Control Router
==================================================

Operator-facing endpoints so an admin can drive the partner ingestion/processing
pipeline from the UI — without a developer running server commands:

  §C  Processing jobs   — fire-and-forget batch embedding generation/indexing.
  §F  Ingestion control — list/inspect ingest logs, manually trigger or retry a batch.
  §G  Track control     — list tracks, set a track live (index it), or stop it (de-index).

All endpoints require an authenticated admin with the ``partners:manage`` permission.
Long-running work is fire-and-forget: the request returns immediately (202) and the
caller polls a status row (``partner_processing_jobs`` / ``ingest_logs``).
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.core.config import settings
from app.core.context import set_admin_context
from app.models.user import User
from app.models.b2b import IngestLog, IngestionError
from app.models.track import Track
from app.models.track_processing_status import TrackProcessingStatus
from app.models.partner_processing_job import PartnerProcessingJob
from app.services import partner_processing_service
from app.services.hetzner_service import HetznerService
from app.services.ingestion_service import (
    start_ingestion_job,
    apply_ingestion_result,
)
from app.repositories.sftp_user_repository import sftp_user_repo

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin",
    tags=["admin-processing"],
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        500: {"description": "Internal Server Error"},
    },
)

hetzner_service = HetznerService()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class EmbeddingsJobRequest(BaseModel):
    partner_id: int = Field(..., description="Partner tenant id")
    env: str = Field(default="live", description="'live' persists + indexes; 'test' is a dry-run")
    ingest_log_id: Optional[int] = Field(default=None, description="Restrict to one ingest batch")
    index_after: bool = Field(default=True, description="Insert vectors into FAISS after generating")
    only_pending: bool = Field(default=True, description="Skip tracks already embedded")


class IngestionTriggerRequest(BaseModel):
    partner_id: int = Field(..., description="Partner tenant id")
    env: str = Field(default="live", description="SFTP env to ingest from ('test' | 'live')")


def _derive_env_from_path(path: str) -> str:
    norm = (path or "").replace("\\", "/").lower()
    if "/test/" in norm or norm.endswith("/test"):
        return "test"
    return "live"


async def _refresh_log_from_hetzner(db: AsyncSession, log: IngestLog) -> IngestLog:
    """Advance a non-terminal ingest log by polling Hetzner and persisting the result.

    Terminal logs (COMPLETED/FAILED) are returned untouched — no media-server call.
    Any media-server error is swallowed (best-effort): the log simply stays
    PROCESSING and the caller still sees the current DB state.
    """
    # A sibling log's refresh may have triggered a rollback (e.g. a persist
    # IntegrityError inside apply_ingestion_result). rollback() expires every
    # object in the session regardless of expire_on_commit, so reading an expired
    # scalar like ``log.status`` here would emit lazy SQL outside the async
    # greenlet → MissingGreenlet. Re-hydrate through an awaited refresh first.
    from sqlalchemy import inspect as sa_inspect

    if sa_inspect(log).expired or "status" in sa_inspect(log).unloaded:
        await db.refresh(log)
    if log.status in ("COMPLETED", "FAILED"):
        return log
    try:
        remote = await hetzner_service.get_ingestion_status(log.partner_id, log.id)
        if remote.get("success"):
            log = await apply_ingestion_result(db, log, remote["data"])
    except Exception as exc:  # never let a refresh break the listing
        logger.warning(
            f"[ingestion] refresh of log {log.id} from media server failed: {exc}"
        )
    return log


async def _refresh_processing_job_from_hetzner(
    db: AsyncSession, job: PartnerProcessingJob
) -> PartnerProcessingJob:
    """Advance a non-terminal embeddings job by polling Hetzner and persisting the result.

    Terminal jobs (completed/failed/partial) are returned untouched — no media-server
    call. Any media-server error is swallowed (best-effort): the job stays running
    and the caller still sees the current DB state (incl. live progress counters).
    """
    if job.status in partner_processing_service.TERMINAL_JOB_STATES:
        return job
    # transcode + embeddings have Hetzner-side async runners; both poll-and-persist here.
    if job.job_type not in ("embeddings", "transcode"):
        return job
    try:
        if job.job_type == "transcode":
            remote = await hetzner_service.get_transcode_status(job.partner_id, job.id)
            if remote.get("success"):
                job = await partner_processing_service.apply_transcode_result(db, job, remote["data"])
        else:
            remote = await hetzner_service.get_embeddings_status(job.partner_id, job.id)
            if remote.get("success"):
                job = await partner_processing_service.apply_embeddings_result(db, job, remote["data"])
    except Exception as exc:  # never let a refresh break the listing
        logger.warning(
            f"[processing] refresh of job {job.id} from media server failed: {exc}"
        )
    return job


# ===========================================================================
# §C  PROCESSING JOBS (fire-and-forget)
# ===========================================================================
@router.post(
    "/processing/jobs/embeddings",
    status_code=202,
    summary="Trigger a fire-and-forget batch embeddings job",
)
async def trigger_embeddings_job(
    payload: EmbeddingsJobRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)

    # Debounce: if an embeddings job for this partner/batch is already pending/running/
    # paused, return it instead of spawning a duplicate (guards the double-click bug).
    existing = await partner_processing_service.find_active_job(
        db, payload.partner_id, "embeddings", payload.ingest_log_id
    )
    if existing is not None:
        return JSONResponse(
            status_code=200,
            content={
                "status": "already_running",
                "message": "An embeddings job is already active for this partner/batch.",
                "job_id": existing.id,
                "job_type": "embeddings",
            },
        )

    job = await partner_processing_service.create_job(
        db,
        partner_id=payload.partner_id,
        job_type="embeddings",
        ingest_log_id=payload.ingest_log_id,
        triggered_by=getattr(current_admin, "email", None) or str(getattr(current_admin, "id", "admin")),
    )

    # Fire-and-forget hand-off to Hetzner: collect the work list + POST it, then
    # return immediately. Hetzner runs the embeddings in its own background task;
    # the admin poll (list/detail) pulls progress back via _refresh_*.
    job = await partner_processing_service.start_embeddings_job(
        db,
        job_id=job.id,
        partner_id=payload.partner_id,
        env=payload.env,
        index_after=payload.index_after,
        ingest_log_id=payload.ingest_log_id,
        only_pending=payload.only_pending,
    )

    if job.status == "failed":
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": "Failed to hand the embeddings job to the media server",
                "job_id": job.id,
                "job_type": "embeddings",
                "detail": (job.error_details or {}).get("error"),
            },
        )

    return JSONResponse(
        status_code=202,
        content={
            "status": "accepted",
            "message": "Embeddings job started",
            "job_id": job.id,
            "job_type": "embeddings",
            "env": payload.env,
        },
    )


@router.post(
    "/processing/jobs/{job_id}/pause",
    summary="Pause a running embeddings job",
)
async def pause_processing_job(
    job_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    """Signal the media server to pause this embeddings job after its current track."""
    set_admin_context(True)
    job = await db.get(PartnerProcessingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found")
    if job.job_type != "embeddings":
        raise HTTPException(status_code=400, detail="Only embeddings jobs support pause")

    job, result = await partner_processing_service.pause_embeddings_job(db, job)
    if not result.get("success"):
        return JSONResponse(
            status_code=502,
            content={"status": "error", "message": "Failed to pause job on the media server",
                     "job_id": job.id, "detail": result.get("error")},
        )
    return JSONResponse(content={
        "status": "accepted", "message": "Pause requested", "job_id": job.id, "job_status": job.status,
    })


@router.post(
    "/processing/jobs/{job_id}/resume",
    status_code=202,
    summary="Resume a paused/interrupted embeddings job",
)
async def resume_processing_job(
    job_id: int,
    env: str = Query("live", description="'live' to persist, 'test' for dry-run"),
    index_after: bool = Query(True, description="Rebuild the FAISS index from all embeddings on completion"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    """Re-hand the job's full track list to the media server; already-embedded tracks are skipped."""
    set_admin_context(True)
    job = await db.get(PartnerProcessingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found")
    if job.job_type != "embeddings":
        raise HTTPException(status_code=400, detail="Only embeddings jobs support resume")

    job = await partner_processing_service.resume_embeddings_job(db, job, env=env, index_after=index_after)
    if job.status == "failed":
        return JSONResponse(
            status_code=502,
            content={"status": "error", "message": "Failed to resume job on the media server",
                     "job_id": job.id, "detail": (job.error_details or {}).get("error")},
        )
    return JSONResponse(
        status_code=202,
        content={"status": "accepted", "message": "Embeddings job resumed",
                 "job_id": job.id, "job_status": job.status, "total_tracks": job.total_tracks},
    )


@router.get(
    "/processing/jobs/{job_id}",
    summary="Get a processing job status",
)
async def get_processing_job(
    job_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    set_admin_context(True)
    job = await db.get(PartnerProcessingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found")
    job = await _refresh_processing_job_from_hetzner(db, job)
    return JSONResponse(content={"status": "success", "job": _job_to_dict(job)})


@router.get(
    "/processing/jobs",
    summary="List processing jobs",
)
async def list_processing_jobs(
    partner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    set_admin_context(True)
    stmt = select(PartnerProcessingJob)
    if partner_id is not None:
        stmt = stmt.where(PartnerProcessingJob.partner_id == partner_id)
    if status:
        stmt = stmt.where(PartnerProcessingJob.status == status)
    stmt = stmt.order_by(PartnerProcessingJob.id.desc()).limit(page_size).offset((page - 1) * page_size)
    jobs = (await db.execute(stmt)).scalars().all()
    # Self-heal: pull live progress / final results for any non-terminal job from Hetzner.
    refreshed = [await _refresh_processing_job_from_hetzner(db, j) for j in jobs]
    return JSONResponse(content={"status": "success", "jobs": [_job_to_dict(j) for j in refreshed]})


# ===========================================================================
# §F  INGESTION CONTROL
# ===========================================================================
@router.get(
    "/ingestion/logs",
    summary="List ingestion logs",
)
async def list_ingestion_logs(
    partner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, regex="^(PENDING|PROCESSING|COMPLETED|FAILED)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    set_admin_context(True)
    stmt = select(IngestLog)
    if partner_id is not None:
        stmt = stmt.where(IngestLog.partner_id == partner_id)
    if status:
        stmt = stmt.where(IngestLog.status == status)
    stmt = stmt.order_by(IngestLog.id.desc()).limit(page_size).offset((page - 1) * page_size)
    logs = (await db.execute(stmt)).scalars().all()

    # Self-heal: for any log still in flight, pull the latest state from Hetzner and
    # persist it before serializing. Terminal logs are skipped (no media-server call).
    refreshed = [await _refresh_log_from_hetzner(db, l) for l in logs]
    return JSONResponse(content={"status": "success", "logs": [_log_to_dict(l) for l in refreshed]})


@router.get(
    "/ingestion/logs/{log_id}",
    summary="Get ingestion log detail (with row-level errors)",
)
async def get_ingestion_log(
    log_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    set_admin_context(True)
    log = await db.get(IngestLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Ingest log not found")

    # Self-heal: advance the log from Hetzner if it's still in flight, so the detail
    # view (and its row-level errors below) reflect the latest state.
    log = await _refresh_log_from_hetzner(db, log)

    errs = (
        await db.execute(
            select(IngestionError).where(IngestionError.ingest_log_id == log_id).order_by(IngestionError.id)
        )
    ).scalars().all()

    return JSONResponse(
        content={
            "status": "success",
            "log": _log_to_dict(log),
            "errors": [
                {
                    "id": e.id,
                    "error_code": e.error_code,
                    "error_message": e.error_message,
                    "error_severity": e.error_severity,
                    "reference_node": e.reference_node,
                }
                for e in errs
            ],
        }
    )


@router.post(
    "/ingestion/trigger",
    status_code=202,
    summary="Manually trigger ingestion of a partner's SFTP batch",
)
async def trigger_ingestion(
    payload: IngestionTriggerRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    env = (payload.env or "live").lower()
    if env not in ("test", "live"):
        raise HTTPException(status_code=400, detail="env must be 'test' or 'live'")

    # Resolve the partner's provisioned SFTP home dir (``partners/<uuid-slug>``).
    # The files physically live on the Hetzner media server, so we only hand the
    # container home to it; Hetzner translates it to its own host path. Fall back
    # to the integer id only if the partner was never SFTP-provisioned.
    sftp_user = await sftp_user_repo.get_by_partner_id(db, payload.partner_id)
    home_dir = (
        sftp_user.sftp_home_dir
        if sftp_user and sftp_user.sftp_home_dir
        else f"{settings.sftp_base_path}/partners/{payload.partner_id}"
    )

    # Insert the ingest_logs row (PROCESSING) and fire-and-forget the validation
    # to Hetzner. Admin polls /ingestion/logs/{id}/status to advance + persist.
    log_entry = await start_ingestion_job(
        db,
        partner_id=payload.partner_id,
        home_dir=home_dir,
        env=env,
    )

    if log_entry.status == "FAILED":
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": log_entry.error_message or "Failed to start ingestion on media server",
                "ingest_log_id": log_entry.id,
                "partner_id": payload.partner_id,
                "env": env,
            },
        )

    return JSONResponse(
        status_code=202,
        content={
            "status": "accepted",
            "message": "Ingestion handed off to media server",
            "ingest_log_id": log_entry.id,
            "partner_id": payload.partner_id,
            "env": env,
            "home_dir": home_dir,
        },
    )


@router.get(
    "/ingestion/logs/{log_id}/status",
    summary="Poll an ingestion job's status (advances it by pulling from Hetzner)",
)
async def get_ingestion_status(
    log_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    """Return the current ingestion status.

    If the log is already terminal (COMPLETED/FAILED) the stored DB state is
    returned directly. Otherwise we poll Hetzner for the job result and, on a
    terminal remote status, persist it (genres + Track/AudioFile/status for live;
    dry-run counts for test) before returning the updated state.
    """
    set_admin_context(True)
    log = await db.get(IngestLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Ingest log not found")

    # Already finished — no need to bother the media server.
    if log.status in ("COMPLETED", "FAILED"):
        return JSONResponse(
            content={"status": "success", "remote_status": None, "log": _log_to_dict(log)}
        )

    remote = await hetzner_service.get_ingestion_status(log.partner_id, log.id)
    if not remote.get("success"):
        if remote.get("error") == "not_found":
            # Job file not written yet (or partner mismatch) — still in flight.
            return JSONResponse(
                content={
                    "status": "success",
                    "remote_status": "pending",
                    "message": "Media server has not produced a result yet.",
                    "log": _log_to_dict(log),
                }
            )
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": f"Could not reach media server: {remote.get('error')}",
                "detail": remote.get("detail"),
                "log": _log_to_dict(log),
            },
        )

    state = remote["data"]
    # Persist/advance the DB on terminal remote status; no-op while running.
    log = await apply_ingestion_result(db, log, state)

    return JSONResponse(
        content={
            "status": "success",
            "remote_status": state.get("status"),
            "log": _log_to_dict(log),
            "errors": state.get("errors") or [],
        }
    )


@router.post(
    "/ingestion/logs/{log_id}/retry",
    status_code=202,
    summary="Retry a previously failed/completed ingestion batch",
)
async def retry_ingestion(
    log_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    log = await db.get(IngestLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Ingest log not found")

    env = _derive_env_from_path(log.package_folder)
    # package_folder is ``<home_dir>/<env>`` — strip the trailing env to recover
    # the home dir we hand to Hetzner. Prefer the live SFTP record if available.
    sftp_user = await sftp_user_repo.get_by_partner_id(db, log.partner_id)
    if sftp_user and sftp_user.sftp_home_dir:
        home_dir = sftp_user.sftp_home_dir
    else:
        folder = (log.package_folder or "").rstrip("/")
        home_dir = folder[: -(len(env) + 1)] if folder.lower().endswith(f"/{env}") else folder

    new_log = await start_ingestion_job(
        db,
        partner_id=log.partner_id,
        home_dir=home_dir,
        env=env,
    )

    if new_log.status == "FAILED":
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": new_log.error_message or "Failed to start ingestion on media server",
                "ingest_log_id": new_log.id,
                "partner_id": log.partner_id,
                "env": env,
            },
        )

    return JSONResponse(
        status_code=202,
        content={
            "status": "accepted",
            "message": "Ingestion retry handed off to media server",
            "ingest_log_id": new_log.id,
            "partner_id": log.partner_id,
            "env": env,
        },
    )


# ===========================================================================
# §G  TRACK CONTROL
# ===========================================================================
@router.get(
    "/tracks",
    summary="List tracks with processing status",
)
async def list_tracks(
    partner_id: int = Query(..., description="Partner ID to filter tracks by (required)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    ingestion_source: Optional[str] = Query(None, description="Filter by ingestion source (csv, cc_by, user_upload, …)"),
    q: Optional[str] = Query(None, description="Search in title, ISRC, UUID, or display_artist"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    set_admin_context(True)

    base_where = [Track.partner_id == partner_id]
    if is_active is not None:
        base_where.append(Track.is_active == is_active)
    if ingestion_source is not None:
        base_where.append(Track.ingestion_source == ingestion_source)
    if q:
        pattern = f"%{q}%"
        from sqlalchemy import or_
        base_where.append(
            or_(
                Track.title.ilike(pattern),
                Track.isrc.ilike(pattern),
                Track.uuid.ilike(pattern),
                Track.display_artist.ilike(pattern),
            )
        )

    # Total count (without pagination)
    count_stmt = select(func.count()).select_from(Track).where(*base_where)
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginated data
    stmt = (
        select(Track, TrackProcessingStatus)
        .join(TrackProcessingStatus, TrackProcessingStatus.track_id == Track.id, isouter=True)
        .where(*base_where)
        .order_by(Track.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    rows = (await db.execute(stmt)).all()

    total_pages = (total + page_size - 1) // page_size

    return JSONResponse(
        content={
            "status": "success",
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
            "tracks": [
                {
                    "id": t.id,
                    "uuid": t.uuid,
                    "title": t.title,
                    "display_artist": t.display_artist,
                    "isrc": t.isrc,
                    "type": t.track_type,
                    "duration_seconds": round(t.duration_ms / 1000.0, 3) if t.duration_ms else None,
                    "bpm": t.bpm,
                    "musical_key": t.musical_key,
                    "ingestion_source": t.ingestion_source,
                    "is_active": t.is_active,
                    "partner_id": t.partner_id,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                    "processing": _tps_to_dict(tps) if tps else None,
                }
                for (t, tps) in rows
            ],
        }
    )


@router.post(
    "/tracks/{track_id}/set-live",
    summary="Set a track live (activate + index its embeddings in FAISS)",
)
async def set_track_live(
    track_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    track = await db.get(Track, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    tps = (
        await db.execute(
            select(TrackProcessingStatus).where(TrackProcessingStatus.track_id == track_id)
        )
    ).scalar_one_or_none()

    filename = (tps.audio_filename if tps else None) or f"{track.uuid}.wav"

    # Index the (already-generated) embeddings into the partner FAISS index.
    index_results = {}
    all_ok = True
    for engine in ("maest", "discogs"):
        res = await hetzner_service.add_vector(
            partner_id=track.partner_id, track_uuid=track.uuid, filename=filename, engine=engine
        )
        index_results[engine] = res
        if not res.get("success"):
            all_ok = False

    track.is_active = True
    if tps is not None and all_ok:
        from datetime import datetime
        tps.faiss_indexed = True
        tps.faiss_indexed_at = datetime.utcnow()
    await db.commit()

    return JSONResponse(
        content={
            "status": "success" if all_ok else "partial",
            "track_id": track_id,
            "is_active": True,
            "faiss_indexed": bool(tps and all_ok),
            "index_results": index_results,
        }
    )


@router.post(
    "/tracks/{track_id}/stop",
    summary="Stop a track (deactivate + remove from FAISS index)",
)
async def stop_track(
    track_id: int,
    delete_embedding_file: bool = Query(False, description="Also delete the .npy embedding file(s) on the media server"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    track = await db.get(Track, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    # Idempotent removal from both engines.
    res = await hetzner_service.remove_vector(
        partner_id=track.partner_id,
        track_uuid=track.uuid,
        engine=None,
        delete_embedding_file=delete_embedding_file,
    )

    track.is_active = False
    tps = (
        await db.execute(
            select(TrackProcessingStatus).where(TrackProcessingStatus.track_id == track_id)
        )
    ).scalar_one_or_none()
    if tps is not None:
        tps.faiss_indexed = False
        tps.faiss_indexed_at = None
    await db.commit()

    return JSONResponse(
        content={
            "status": "success" if res.get("success") else "partial",
            "track_id": track_id,
            "is_active": False,
            "remove_result": res,
        }
    )


class StopTracksBatchRequest(BaseModel):
    partner_id: int = Field(..., description="Partner the tracks belong to")
    track_ids: List[int] = Field(..., description="Track ids to take down")


@router.post(
    "/tracks/stop-batch",
    summary="Stop MANY tracks at once (deactivate + ONE FAISS rebuild)",
)
async def stop_tracks_batch(
    payload: StopTracksBatchRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    """Take down a set of tracks in one shot — the media server removes all vectors and
    rebuilds the index ONCE (vs once per track if you looped /tracks/{id}/stop)."""
    set_admin_context(True)
    if not payload.track_ids:
        raise HTTPException(status_code=400, detail="track_ids is empty")

    tracks = (await db.execute(
        select(Track).where(Track.id.in_(payload.track_ids), Track.partner_id == payload.partner_id)
    )).scalars().all()
    if not tracks:
        raise HTTPException(status_code=404, detail="No matching tracks for this partner")

    uuids = [t.uuid for t in tracks]
    res = await hetzner_service.remove_vectors_batch(payload.partner_id, uuids, engine=None)

    track_ids = [t.id for t in tracks]
    for t in tracks:
        t.is_active = False
    tps_rows = (await db.execute(
        select(TrackProcessingStatus).where(TrackProcessingStatus.track_id.in_(track_ids))
    )).scalars().all()
    for tps in tps_rows:
        tps.faiss_indexed = False
        tps.faiss_indexed_at = None
    await db.commit()

    return JSONResponse(
        content={
            "status": "success" if res.get("success") else "partial",
            "partner_id": payload.partner_id,
            "stopped": len(tracks),
            "remove_result": res,
        }
    )


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
def _job_to_dict(job: PartnerProcessingJob) -> dict:
    return {
        "id": job.id,
        "partner_id": job.partner_id,
        "ingest_log_id": job.ingest_log_id,
        "job_type": job.job_type,
        "status": job.status,
        "total_tracks": job.total_tracks,
        "processed_tracks": job.processed_tracks,
        "failed_tracks": job.failed_tracks,
        "error_details": job.error_details,
        "triggered_by": job.triggered_by,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


def _log_to_dict(log: IngestLog) -> dict:
    return {
        "id": log.id,
        "partner_id": log.partner_id,
        "party_id": log.party_id,
        "package_folder": log.package_folder,
        "batch_filename": log.batch_filename,
        "status": log.status,
        "track_count": log.track_count,
        "error_message": log.error_message,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


def _tps_to_dict(tps: TrackProcessingStatus) -> dict:
    return {
        "embedding_status": tps.embedding_status,
        "peaks_status": tps.peaks_status,
        "segments_status": tps.segments_status,
        "faiss_indexed": tps.faiss_indexed,
        "faiss_indexed_at": tps.faiss_indexed_at.isoformat() if tps.faiss_indexed_at else None,
        "sftp_env": tps.sftp_env,
        "audio_filename": tps.audio_filename,
        "embedding_error": tps.embedding_error,
    }
