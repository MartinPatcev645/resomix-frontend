"""
Analysis sibling tasks
======================

Every consumer upload yields BOTH a similarity playlist and an analysis result (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md``). The upload endpoint foregrounds the requested
side (similarity, today) and enqueues the OTHER side here as a background job so it runs
before the uploaded audio is discarded. Sibling jobs are internal → they do NOT re-count
against ``uploads_per_month`` (the endpoint already recorded the upload).

The audio is handed off via a short-lived spool file under ``settings.temp_dir`` (the Alwyzon
worker shares the host/filesystem with the API — same pattern as the upload fallback path),
so we don't push large payloads through the Redis broker. The task reads it, ships the bytes
to the analysis microservice under the Alwyzon-owned ``analysis_id``, waits for the result,
and always deletes the spool file.

Phase C wires result persistence (``track_analysis_results`` summary row) into
``_persist_summary``; today the task generates + caches the analysis (the Hetzner served
cache) and logs the outcome.
"""

import logging
import os
from typing import Optional

from app.core.context import set_admin_context, set_current_partner_id
from app.services.analysis_service import AnalysisService
from .async_runner import run_async_task
from .celery_app import celery_app

logger = logging.getLogger(__name__)

# Foreground-generation budget for the sibling. Generous: a full analysis (local DSP + GPU
# semantics) can take a couple of minutes. The task just needs the result cached; it does not
# block any user request.
_ANALYSIS_TIMEOUT_S = 240.0


async def _async_generate_track_analysis(
    *,
    analysis_id: str,
    audio_spool_path: str,
    original_filename: str,
    track_id: Optional[int],
    user_id: Optional[int],
    partner_id: Optional[int],
) -> None:
    client = AnalysisService()
    try:
        if not client.is_configured:
            logger.info(
                "ANALYSIS SIBLING: analysis service not configured — skipping analysis %s (track %s)",
                analysis_id, track_id,
            )
            return

        try:
            with open(audio_spool_path, "rb") as fh:
                audio_bytes = fh.read()
        except OSError as exc:
            logger.error("ANALYSIS SIBLING: could not read spool file %s: %s", audio_spool_path, exc)
            return

        if not audio_bytes:
            logger.error("ANALYSIS SIBLING: spool file %s was empty — aborting analysis %s", audio_spool_path, analysis_id)
            return

        created = await client.create_analysis(
            audio_bytes=audio_bytes,
            original_filename=original_filename,
            analysis_id=analysis_id,
        )
        if created.get("status") == "error":
            logger.error(
                "ANALYSIS SIBLING: create failed for %s (track %s): %s",
                analysis_id, track_id, created.get("message"),
            )
            return

        outcome = await client.wait_for_result(analysis_id, timeout=_ANALYSIS_TIMEOUT_S)
        if outcome.get("status") != "success":
            logger.warning(
                "ANALYSIS SIBLING: analysis %s (track %s) did not complete: %s (%s)",
                analysis_id, track_id, outcome.get("status"), outcome.get("message"),
            )
            return

        # Tenancy context for any DB write in the persistence step (Phase C).
        if partner_id is not None:
            set_current_partner_id(partner_id)
            set_admin_context(False)
        else:
            set_admin_context(True)

        await _persist_summary(
            analysis_id=analysis_id,
            result=outcome.get("result") or {},
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id,
        )
        logger.info("ANALYSIS SIBLING: completed analysis %s for track %s", analysis_id, track_id)
    finally:
        # Always drop the spooled audio — the analysis service now owns its own copy.
        try:
            if audio_spool_path and os.path.exists(audio_spool_path):
                os.remove(audio_spool_path)
        except OSError as exc:
            logger.warning("ANALYSIS SIBLING: could not remove spool file %s: %s", audio_spool_path, exc)


async def _persist_summary(
    *,
    analysis_id: str,
    result: dict,
    track_id: Optional[int],
    user_id: Optional[int],
    partner_id: Optional[int],
) -> None:
    """Persist the single-value analysis summary (Phase C: writes ``track_analysis_results``)."""
    # Phase C hook — the DB table + repository/service land there; wired in that phase.
    logger.debug("ANALYSIS SIBLING: summary persistence pending (Phase C) for %s", analysis_id)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def generate_track_analysis(
    self,
    analysis_id: str,
    audio_spool_path: str,
    original_filename: str,
    track_id: Optional[int] = None,
    user_id: Optional[int] = None,
    partner_id: Optional[int] = None,
) -> None:
    """Generate (and cache) the analysis for an uploaded track, out of the request path."""
    try:
        run_async_task(
            _async_generate_track_analysis(
                analysis_id=analysis_id,
                audio_spool_path=audio_spool_path,
                original_filename=original_filename,
                track_id=track_id,
                user_id=user_id,
                partner_id=partner_id,
            )
        )
    except Exception as exc:  # transient (analysis service blip) → retry a couple of times
        logger.error("ANALYSIS SIBLING: task for %s failed: %s", analysis_id, exc, exc_info=True)
        raise self.retry(exc=exc)
