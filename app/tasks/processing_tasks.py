"""
Processing-job finalize tasks
=============================

When a transcode/embeddings job reaches a terminal state on the media server, its per-track
result-apply (set transcode_status/embedding_status for every track, deactivate failed ones,
register artifacts, finalize the job + auto-spawn the next stage) can be 50k–1M rows. Doing
that inside the admin status-poll would hang the request, so the poll CLAIMS the job
(``status='finalizing'``) and enqueues this task instead.

The task fetches the full per-track results from the media server ONCE (the poll itself fetches
a lightweight, records-omitted snapshot) and applies them in idempotent bulk chunks via
``partner_processing_service.apply_{transcode,embeddings}_result``. Safe to re-run: the apply
is idempotent and the job's terminal status short-circuits a duplicate.
"""

import asyncio
import logging

from app.core.context import set_admin_context, set_current_partner_id
from database.connection import AsyncSessionLocal
from app.models.partner_processing_job import PartnerProcessingJob
from app.services.hetzner_service import HetznerService
from app.services import partner_processing_service as pps
from .celery_app import celery_app

logger = logging.getLogger(__name__)

_TERMINAL = pps.TERMINAL_JOB_STATES
_FETCH_TIMEOUT = 300.0  # the full per-track results can be large for a big batch


async def _async_finalize_processing_job(job_id: int) -> None:
    set_admin_context(True)

    # 1. Load the job; skip if already finalized.
    async with AsyncSessionLocal() as db:
        job = await db.get(PartnerProcessingJob, job_id)
        if job is None or job.status in _TERMINAL:
            return
        partner_id = job.partner_id
        job_type = job.job_type
    set_current_partner_id(partner_id)

    if job_type not in ("transcode", "embeddings", "peaks", "segments"):
        return

    # 2. Fetch the FULL per-track results from the media server (the poll omits them where
    #    supported). transcode/embeddings carry a large records array; peaks/segments are
    #    lighter (uuid+status) but still fetched here so the apply runs off the request.
    svc = HetznerService()
    if job_type == "transcode":
        remote = await svc.get_transcode_status(partner_id, job_id, include_records=True, timeout=_FETCH_TIMEOUT)
    elif job_type == "embeddings":
        remote = await svc.get_embeddings_status(partner_id, job_id, include_records=True, timeout=_FETCH_TIMEOUT)
    elif job_type == "peaks":
        remote = await svc.get_peaks_status(partner_id, job_id, timeout=_FETCH_TIMEOUT)
    else:
        remote = await svc.get_segments_status(partner_id, job_id, timeout=_FETCH_TIMEOUT)
    if not remote.get("success"):
        logger.error("[finalize-task] job %s: could not fetch media results: %s — will retry on next poll",
                     job_id, remote.get("error"))
        return  # leave 'finalizing'; the stale check re-enqueues (idempotent).
    state = remote["data"]
    mstatus = (state.get("status") or "").lower()
    if mstatus not in _TERMINAL:
        logger.warning("[finalize-task] job %s: media status=%s (not terminal); skipping", job_id, mstatus)
        return

    # 3. Apply the per-track results in idempotent bulk chunks + finalize the job.
    async with AsyncSessionLocal() as db:
        set_admin_context(True)
        set_current_partner_id(partner_id)
        job = await db.get(PartnerProcessingJob, job_id)
        if job is None or job.status in _TERMINAL:
            return
        if job_type == "transcode":
            job = await pps.apply_transcode_result(db, job, state)
        elif job_type == "embeddings":
            job = await pps.apply_embeddings_result(db, job, state)
        elif job_type == "peaks":
            job = await pps.apply_peaks_result(db, job, state)
        else:
            job = await pps.apply_segments_result(db, job, state)
    logger.info("[finalize-task] %s job %s finalized: status=%s processed=%s failed=%s",
                job_type, job_id, job.status, job.processed_tracks, job.failed_tracks)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def finalize_processing_job(self, job_id: int) -> None:
    """Apply a terminal transcode/embeddings job's per-track results (bulk) + finalize it."""
    try:
        asyncio.run(_async_finalize_processing_job(int(job_id)))
    except Exception as exc:  # transient (DB blip, media unreachable) → retry
        logger.error("[finalize-task] job %s failed: %s", job_id, exc, exc_info=True)
        raise self.retry(exc=exc)
