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

from sqlalchemy import update

from app.core.context import set_admin_context, set_current_partner_id
from app.models.track_analysis_result import (
    SIBLING_FAILED,
    SIBLING_READY,
    SIBLING_UNAVAILABLE,
)
from app.services.analysis_service import AnalysisService
from database.connection import AsyncSessionLocal
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
    """Persist the single-value analysis summary into ``track_analysis_results`` (idempotent)."""
    if track_id is None:
        logger.warning("ANALYSIS SIBLING: no track_id for %s — skipping summary persistence", analysis_id)
        return
    from app.services.track_analysis_result_service import TrackAnalysisResultService

    async with AsyncSessionLocal() as db:
        # Re-assert tenancy context for THIS session's failsafe (contextvars set by the caller
        # cover the same coroutine, but re-setting is cheap and explicit).
        if partner_id is not None:
            set_current_partner_id(partner_id)
            set_admin_context(False)
        else:
            set_admin_context(True)
        await TrackAnalysisResultService().record_from_canonical(
            db,
            analysis_uuid=analysis_id,
            result=result,
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id if partner_id is not None else 1,
        )
    logger.info("ANALYSIS SIBLING: persisted analysis summary for %s (track %s)", analysis_id, track_id)


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


# --------------------------------------------------------------------------- #
# Foreground-analysis path (the analysis-upload endpoint): the analysis was already
# CREATED foreground under `analysis_id`, so here we only wait for completion + persist the
# summary row (no create, no audio).
# --------------------------------------------------------------------------- #
async def _async_persist_analysis_summary(
    *,
    analysis_id: str,
    track_id: Optional[int],
    user_id: Optional[int],
    partner_id: Optional[int],
) -> None:
    client = AnalysisService()
    if not client.is_configured:
        logger.info("ANALYSIS PERSIST: analysis service not configured — skipping %s", analysis_id)
        return
    outcome = await client.wait_for_result(analysis_id, timeout=_ANALYSIS_TIMEOUT_S)
    if outcome.get("status") != "success":
        logger.warning(
            "ANALYSIS PERSIST: %s did not complete: %s (%s)",
            analysis_id, outcome.get("status"), outcome.get("message"),
        )
        return
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

    # Count the upload only now that a result exists — record-on-success, matching the
    # similarity-upload path. Every early return above (service unconfigured, timed out, upstream
    # failure) leaves the caller uncharged, which is why no refund path is needed anywhere.
    #
    # Best-effort: a counter that fails to increment must never turn a delivered analysis into a
    # failed task. The evaluator already swallows its own errors; the guard is belt and braces.
    if user_id:
        try:
            from app.services.operation_limit_evaluator import OperationLimitEvaluator

            async with AsyncSessionLocal() as db:
                await OperationLimitEvaluator().record_success(
                    db, user_id=user_id, operation_code="upload_create"
                )
        except Exception as exc:
            logger.warning("ANALYSIS PERSIST: could not count upload for %s: %s", analysis_id, exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def persist_analysis_summary(
    self,
    analysis_id: str,
    track_id: Optional[int] = None,
    user_id: Optional[int] = None,
    partner_id: Optional[int] = None,
) -> None:
    """Wait for a foreground-created analysis to finish, then fill in its summary row."""
    try:
        run_async_task(
            _async_persist_analysis_summary(
                analysis_id=analysis_id, track_id=track_id, user_id=user_id, partner_id=partner_id
            )
        )
    except Exception as exc:
        logger.error("ANALYSIS PERSIST: task for %s failed: %s", analysis_id, exc, exc_info=True)
        raise self.retry(exc=exc)


# --------------------------------------------------------------------------- #
# The similarity sibling for the analysis-upload path: generate the similarity playlist for a
# just-uploaded track in the background (best-effort; needs the similarity server configured).
# --------------------------------------------------------------------------- #
async def _record_sibling_state(analysis_id: Optional[str], state: str) -> None:
    """Persist the sibling's outcome on the analysis row.

    The client cannot infer this from the playlist's absence alone, so a missing write would leave
    the analysis screen waiting forever. Best-effort and self-contained (its own session): failing to
    record the outcome must never turn a generated playlist into a failed task.
    """
    if not analysis_id:
        return
    try:
        from app.models.track_analysis_result import TrackAnalysisResult

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(TrackAnalysisResult)
                .where(TrackAnalysisResult.analysis_uuid == analysis_id)
                .values(sibling_playlist_state=state)
            )
            await db.commit()
    except Exception as exc:  # pragma: no cover — bookkeeping must not fail the task
        logger.warning(
            "SIMILARITY SIBLING: could not record state '%s' for %s: %s", state, analysis_id, exc
        )


async def _async_generate_similarity_sibling(
    *,
    audio_spool_path: str,
    track_uuid: str,
    original_filename: str,
    user_id: Optional[int],
    partner_id: Optional[int],
    analysis_id: Optional[str] = None,
    top_k: int = 20,
) -> None:
    # Assume the worst until a branch below proves otherwise, so an early return can never leave the
    # row stuck on 'pending' (which the client reads as "keep waiting").
    outcome = SIBLING_FAILED
    try:
        try:
            with open(audio_spool_path, "rb") as fh:
                audio_bytes = fh.read()
        except OSError as exc:
            logger.error("SIMILARITY SIBLING: could not read spool %s: %s", audio_spool_path, exc)
            return
        if not audio_bytes:
            outcome = SIBLING_UNAVAILABLE
            return

        from app.services.similarity_service import SimilarityService

        if partner_id is not None:
            set_current_partner_id(partner_id)
            set_admin_context(False)
        else:
            set_admin_context(True)

        # Over-fetch + de-dup exactly like the interactive similarity-by-upload path so the sibling
        # playlist lands on a solid `top_k` (e.g. 20) instead of however few survive de-dup. The
        # similarity server returns `actual_top_k` (= top_k + cushion, e.g. 50) candidates and we
        # keep `top_k` after removing duplicate Apple matches. Previously it fetched exactly `top_k`
        # with no cushion → thin 2–15-track playlists (see the `[upload-sim] raw=/dedup=` logs).
        from app.core.config import settings
        actual_top_k = settings.calculate_actual_top_k(top_k)
        duplication_threshold = settings.get_duplication_threshold_for_top_sk(top_k)
        async with AsyncSessionLocal() as db:
            result = await SimilarityService().calculate_similarity_for_upload(
                db=db,
                audio_bytes=audio_bytes,
                original_filename=original_filename,
                track_uuid=track_uuid,
                top_k=actual_top_k,
                similarity_duplication_threshold=duplication_threshold,
                user_id=user_id,
                partner_id=partner_id,
            )
        if isinstance(result, dict) and result.get("success") is False:
            outcome = SIBLING_FAILED
            logger.warning("SIMILARITY SIBLING: %s failed: %s", track_uuid, result.get("error"))
        elif isinstance(result, dict) and result.get("playlist"):
            outcome = SIBLING_READY
            logger.info(
                "SIMILARITY SIBLING: created similarity playlist %s for track %s",
                (result.get("playlist") or {}).get("id"), track_uuid,
            )
        else:
            # The similarity query succeeded but no playlist row was written (no resolvable
            # similar catalog tracks, or the seed couldn't be resolved). Do NOT claim success —
            # the [upload-sim] line in the similarity_service logs has the exact counts/reason.
            outcome = SIBLING_UNAVAILABLE
            logger.warning(
                "SIMILARITY SIBLING: no playlist created for track %s — see the '[upload-sim]' "
                "log line for the reason (usually: the partner has no searchable catalog/index).",
                track_uuid,
            )
    finally:
        await _record_sibling_state(analysis_id, outcome)
        try:
            if audio_spool_path and os.path.exists(audio_spool_path):
                os.remove(audio_spool_path)
        except OSError as exc:
            logger.warning("SIMILARITY SIBLING: could not remove spool %s: %s", audio_spool_path, exc)


@celery_app.task(bind=True, max_retries=1, default_retry_delay=60)
def generate_similarity_sibling(
    self,
    audio_spool_path: str,
    track_uuid: str,
    original_filename: str,
    user_id: Optional[int] = None,
    partner_id: Optional[int] = None,
    analysis_id: Optional[str] = None,
) -> None:
    """Generate the similarity playlist for an analysis-uploaded track (best-effort sibling)."""
    try:
        run_async_task(
            _async_generate_similarity_sibling(
                audio_spool_path=audio_spool_path,
                track_uuid=track_uuid,
                original_filename=original_filename,
                user_id=user_id,
                partner_id=partner_id,
                analysis_id=analysis_id,
            )
        )
    except Exception as exc:
        logger.error("SIMILARITY SIBLING: task for %s failed: %s", track_uuid, exc, exc_info=True)
        raise self.retry(exc=exc)
