"""
Track Background Tasks
======================

Celery tasks for user/uploaded-track maintenance. Currently: purging a deleted uploaded
track's media-server assets (peaks, segments, embeddings for both indexes, preview, cover,
raw) off the similarity/media server.

Runs off the request path so a slow or unreachable media server never fails (or delays) the
user's delete — the DB soft-delete has already committed by the time this runs. Retries on
transient media-server failures.

Version: 3.0.1
Init Date: July 3, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import logging
from typing import Optional

from app.services.hetzner_service import HetznerService
from .async_runner import run_async_task
from .celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=5, default_retry_delay=60)
def purge_uploaded_track_assets(self, partner_id: Optional[int], track_uuid: str) -> None:
    """Wipe a deleted uploaded track's assets on the media server.

    Delegates to the media server's ``DELETE /delete-track/{uuid}`` (via
    ``HetznerService.delete_track_on_hetzner``), which removes the embeddings (both engines),
    segments, peaks, preview, cover, and raw audio. Idempotent — a track already absent on
    the media server returns success. Retries (up to 5×, 60s apart) if the server is
    unreachable so a transient outage doesn't leave assets orphaned.
    """
    try:
        result = run_async_task(
            HetznerService().delete_track_on_hetzner(track_uuid, partner_id)
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error") or "media server reported delete failure")
        logger.info(
            "[purge-task] wiped media assets for track %s (partner %s)",
            track_uuid, partner_id,
        )
    except Exception as exc:  # transient (media server down/timeout) → retry
        logger.error("[purge-task] track %s asset purge failed: %s", track_uuid, exc)
        raise self.retry(exc=exc)
