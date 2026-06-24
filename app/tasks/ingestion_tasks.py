"""
Ingestion background tasks
==========================

The DB persist of a validated batch (insert Track/AudioFile/TrackProcessingStatus for
every record) can be 50k–1M rows. Doing it inside the admin status-poll would hang the
request, so ``apply_ingestion_result`` enqueues this Celery task instead and returns
immediately. The task inserts the records in idempotent chunks
(``app.services.ingestion_persist``) and finalizes the ingest log when done; the poll just
reads progress (stage=PERSISTING → COMPLETED, track_count climbing).

Resumable + safe to re-run: ``persist_records_chunked`` skips uuids already inserted, so a
worker that dies mid-run is simply re-enqueued by the next poll (the PERSISTING-stale check).
"""

import logging

from app.core.context import set_admin_context, set_current_partner_id
from database.connection import AsyncSessionLocal
from app.models.b2b import IngestLog
from app.services.hetzner_service import HetznerService
from app.services.ingestion_persist import persist_records_chunked
from .celery_app import celery_app
from .async_runner import run_async_task

logger = logging.getLogger(__name__)


async def _async_persist_and_finalize(log_id: int) -> None:
    set_admin_context(True)

    # 1. Load the log (skip if already terminal).
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, log_id)
        if log is None or log.status in ("COMPLETED", "FAILED"):
            return
        partner_id = log.partner_id
        party_id = log.party_id
    set_current_partner_id(partner_id)

    # 2. Fetch the validated records from Hetzner (not passed through the broker — could be
    #    100MB+). The media server still holds them in the job-state JSON.
    # This is the one place that actually needs the (possibly very large) records array;
    # allow a generous timeout for fetching + transferring it on a big batch.
    remote = await HetznerService().get_ingestion_status(
        partner_id, log_id, include_records=True, timeout=300.0,
    )
    if not remote.get("success"):
        logger.error("[persist-task] log %s: could not fetch media state: %s — will retry on next poll",
                     log_id, remote.get("error"))
        return  # leave PERSISTING; the PERSISTING-stale check re-enqueues (idempotent).
    state = remote["data"]
    if (state.get("status") or "").lower() != "completed":
        logger.warning("[persist-task] log %s: media status=%s (not completed); skipping",
                       log_id, state.get("status"))
        return
    records = state.get("records") or []
    env = (state.get("env") or "live").lower()

    # 3. Insert the whole batch in idempotent chunks (fresh session per chunk).
    result = await persist_records_chunked(
        partner_id=partner_id, party_id=party_id, log_id=log_id, records=records, env=env,
    )
    if not result["done"]:
        logger.warning("[persist-task] log %s incomplete (%s remaining); will resume", log_id, result["remaining"])
        return

    # 4. Finalize: COMPLETED + webhooks + partner notification + auto-spawn transcode.
    async with AsyncSessionLocal() as db:
        set_admin_context(True)
        set_current_partner_id(partner_id)
        log = await db.get(IngestLog, log_id)
        if log is None or log.status in ("COMPLETED", "FAILED"):
            return
        from app.services.ingestion_service import finalize_successful_ingestion
        await finalize_successful_ingestion(db, log, records, env, result)
    logger.info(
        "[persist-task] log %s finalized: %s inserted, %s failed",
        log_id, result["already"] + result["inserted"], len(result["failures"]),
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def persist_and_finalize_ingestion(self, log_id: int) -> None:
    """Insert a validated batch into the DB (idempotent, chunked) then finalize the log."""
    try:
        run_async_task(_async_persist_and_finalize(int(log_id)))
    except Exception as exc:  # transient (DB blip, media unreachable) → retry
        logger.error("[persist-task] log %s failed: %s", log_id, exc, exc_info=True)
        raise self.retry(exc=exc)
