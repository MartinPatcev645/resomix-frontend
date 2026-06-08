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
from app.services.ingestion_service import process_ingestion_batch

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

    job = await partner_processing_service.create_job(
        db,
        partner_id=payload.partner_id,
        job_type="embeddings",
        ingest_log_id=payload.ingest_log_id,
        triggered_by=getattr(current_admin, "email", None) or str(getattr(current_admin, "id", "admin")),
    )

    background_tasks.add_task(
        partner_processing_service.run_embeddings_job,
        job_id=job.id,
        partner_id=payload.partner_id,
        env=payload.env,
        index_after=payload.index_after,
        ingest_log_id=payload.ingest_log_id,
        only_pending=payload.only_pending,
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
    return JSONResponse(content={"status": "success", "jobs": [_job_to_dict(j) for j in jobs]})


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
    return JSONResponse(content={"status": "success", "logs": [_log_to_dict(l) for l in logs]})


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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    env = (payload.env or "live").lower()
    if env not in ("test", "live"):
        raise HTTPException(status_code=400, detail="env must be 'test' or 'live'")

    batch_path = f"{settings.sftp_base_path}/partners/{payload.partner_id}/{env}"
    background_tasks.add_task(
        process_ingestion_batch,
        partner_id=payload.partner_id,
        batch_path=batch_path,
        env=env,
    )
    return JSONResponse(
        status_code=202,
        content={
            "status": "accepted",
            "message": "Ingestion started",
            "partner_id": payload.partner_id,
            "env": env,
            "batch_path": batch_path,
        },
    )


@router.post(
    "/ingestion/logs/{log_id}/retry",
    status_code=202,
    summary="Retry a previously failed/completed ingestion batch",
)
async def retry_ingestion(
    log_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage")),
) -> JSONResponse:
    set_admin_context(True)
    log = await db.get(IngestLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Ingest log not found")

    env = _derive_env_from_path(log.package_folder)
    background_tasks.add_task(
        process_ingestion_batch,
        partner_id=log.partner_id,
        batch_path=log.package_folder,
        env=env,
    )
    return JSONResponse(
        status_code=202,
        content={
            "status": "accepted",
            "message": "Ingestion retry started",
            "ingest_log_id": log_id,
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
