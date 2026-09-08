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
from app.models.track_artifact_status import (
    ARTIFACT_FAILED,
    ARTIFACT_PROCESSING,
    ARTIFACT_READY,
    ARTIFACT_UNAVAILABLE,
)
from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository
from app.services.analysis_service import AnalysisService
from database.connection import AsyncSessionLocal
from .async_runner import run_async_task
from .celery_app import celery_app

logger = logging.getLogger(__name__)

# Capsule text for the Library. Deliberately about what the user can do next, not about which
# internal stage broke — the specific cause is always in the log, keyed by analysis id.
_ANALYSIS_UNAVAILABLE_TEXT = "Analysis is not available for this track."
_ANALYSIS_FAILED_TEXT = "We could not analyse this track."

# `sibling_playlist_state` (on the analysis row) and `playlist_state` (on the artifact row) are the
# same fact recorded for two different screens. Mapped in one place so they cannot drift.
_SIBLING_TO_ARTIFACT = {
    SIBLING_READY: ARTIFACT_READY,
    SIBLING_UNAVAILABLE: ARTIFACT_UNAVAILABLE,
    SIBLING_FAILED: ARTIFACT_FAILED,
}
_PLAYLIST_SIBLING_TEXT = {
    SIBLING_UNAVAILABLE: "We could not find close enough matches for this track.",
    SIBLING_FAILED: "We could not build a Sonic Discovery playlist for this track.",
}

# Foreground-generation budget for the sibling. Generous: a full analysis (local DSP + GPU
# semantics) can take a couple of minutes. The task just needs the result cached; it does not
# block any user request.
_ANALYSIS_TIMEOUT_S = 240.0


def _bind_tenancy(partner_id: Optional[int]) -> None:
    """Bind the tenancy context a Celery task cannot inherit from a request.

    MUST be the first statement of any task body that touches a partner-scoped
    model. The SQL failsafe in ``database/connection.py`` **raises** when
    ``partner_id`` is None, so without this every ``TrackArtifactStatus`` write
    fails with "Multi-tenancy violation" — and the task still reports success.
    The effect is the worst kind of silent failure: the analysis is produced and
    committed, the sibling playlist is created, and the two rows that tell the
    Library so are lost, so the screen spins until its timeout with all the work
    already done.

    This idiom already existed in each of these tasks, but **after** the long
    call to the analysis service, which is exactly why the terminal state writes
    landed and the `processing` ones did not. Measured on production 2026-09-08:
    72 occurrences in 7 days, one per upload. ``app/tasks/webhooks.py`` had it
    in the right place from the start.
    """
    if partner_id is not None:
        set_current_partner_id(partner_id)
        set_admin_context(False)
    else:
        # No partner: an internally initiated job. Admin context satisfies the
        # failsafe without narrowing to a tenant that does not apply.
        set_admin_context(True)


async def _async_generate_track_analysis(
    *,
    analysis_id: str,
    audio_spool_path: str,
    original_filename: str,
    track_id: Optional[int],
    user_id: Optional[int],
    partner_id: Optional[int],
) -> None:
    _bind_tenancy(partner_id)
    client = AnalysisService()
    # Assume the worst until a branch proves otherwise. Every `return` below used to leave the
    # Library with no state at all, which it rendered as "Analysis coming soon" — a message about
    # an unbuilt feature, for an analysis that had just failed. The state is now always written.
    state, state_error = ARTIFACT_FAILED, _ANALYSIS_FAILED_TEXT
    try:
        if not client.is_configured:
            logger.info(
                "ANALYSIS SIBLING: analysis service not configured — skipping analysis %s (track %s)",
                analysis_id, track_id,
            )
            # Nothing broke — the feature is simply not running here. Distinct from `failed` so the
            # user is not shown an error for a service that was never asked to do anything.
            state, state_error = ARTIFACT_UNAVAILABLE, _ANALYSIS_UNAVAILABLE_TEXT
            return

        await TrackArtifactStatusRepository.set_analysis_state(track_id, ARTIFACT_PROCESSING)

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

        # Tenancy was bound at the top of this task, so nothing is needed here.
        await _persist_summary(
            analysis_id=analysis_id,
            result=outcome.get("result") or {},
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id,
        )
        state, state_error = ARTIFACT_READY, None
        logger.info("ANALYSIS SIBLING: completed analysis %s for track %s", analysis_id, track_id)
    finally:
        # `ready` is only reached after the summary row is committed, so the state can never claim
        # an analysis the Library would then fail to open.
        await TrackArtifactStatusRepository.set_analysis_state(track_id, state, error=state_error)
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
        # Re-assert for THIS session's failsafe. The callers bind it at the top of their
        # task, but this helper is shared and must not depend on that.
        _bind_tenancy(partner_id)
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
    _bind_tenancy(partner_id)
    client = AnalysisService()
    if not client.is_configured:
        logger.info("ANALYSIS PERSIST: analysis service not configured — skipping %s", analysis_id)
        await TrackArtifactStatusRepository.set_analysis_state(
            track_id, ARTIFACT_UNAVAILABLE, error=_ANALYSIS_UNAVAILABLE_TEXT
        )
        return

    await TrackArtifactStatusRepository.set_analysis_state(track_id, ARTIFACT_PROCESSING)

    outcome = await client.wait_for_result(analysis_id, timeout=_ANALYSIS_TIMEOUT_S)
    if outcome.get("status") != "success":
        logger.warning(
            "ANALYSIS PERSIST: %s did not complete: %s (%s)",
            analysis_id, outcome.get("status"), outcome.get("message"),
        )
        await TrackArtifactStatusRepository.set_analysis_state(
            track_id, ARTIFACT_FAILED, error=_ANALYSIS_FAILED_TEXT
        )
        return
    # Tenancy bound at the top of this task.
    await _persist_summary(
        analysis_id=analysis_id,
        result=outcome.get("result") or {},
        track_id=track_id,
        user_id=user_id,
        partner_id=partner_id,
    )
    # After the summary is committed, never before — the state is a promise the Library will be
    # able to open the analysis, and a promise made too early is a 404.
    await TrackArtifactStatusRepository.set_analysis_state(track_id, ARTIFACT_READY)

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
async def _record_sibling_state(
    analysis_id: Optional[str], state: str, track_id: Optional[int] = None
) -> None:
    """Persist the sibling's outcome for both screens that ask about it.

    The client cannot infer this from the playlist's absence alone, so a missing write would leave
    the analysis screen waiting forever. Two rows carry the same fact — ``sibling_playlist_state``
    for the analysis screen, ``playlist_state`` for the Library — and they are written here,
    together, so there is no path that updates one and not the other.

    Best-effort and self-contained (its own session): failing to record the outcome must never turn
    a generated playlist into a failed task.
    """
    if track_id:
        await TrackArtifactStatusRepository.set_playlist_state(
            track_id,
            _SIBLING_TO_ARTIFACT.get(state, ARTIFACT_FAILED),
            error=None if state == SIBLING_READY else _PLAYLIST_SIBLING_TEXT.get(state),
        )
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
    track_id: Optional[int] = None,
    top_k: int = 20,
) -> None:
    _bind_tenancy(partner_id)
    # Assume the worst until a branch below proves otherwise, so an early return can never leave the
    # row stuck on 'pending' (which the client reads as "keep waiting").
    outcome = SIBLING_FAILED
    await TrackArtifactStatusRepository.set_playlist_state(track_id, ARTIFACT_PROCESSING)
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

        # Tenancy bound at the top of this task.

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
        await _record_sibling_state(analysis_id, outcome, track_id)
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
    track_id: Optional[int] = None,
) -> None:
    """Generate the similarity playlist for an analysis-uploaded track (best-effort sibling).

    ``track_id`` defaults to None so messages already on the broker when this deploys still
    execute — they simply skip the Library-side state write, which the next upload restores.
    """
    try:
        run_async_task(
            _async_generate_similarity_sibling(
                audio_spool_path=audio_spool_path,
                track_uuid=track_uuid,
                original_filename=original_filename,
                user_id=user_id,
                partner_id=partner_id,
                analysis_id=analysis_id,
                track_id=track_id,
            )
        )
    except Exception as exc:
        logger.error("SIMILARITY SIBLING: task for %s failed: %s", track_uuid, exc, exc_info=True)
        raise self.retry(exc=exc)
