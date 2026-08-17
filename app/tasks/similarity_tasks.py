"""
Similarity upload tasks
=======================

The worker half of the poll-based similarity upload. ``POST /similarity/upload/async``
validates, stores the track and spools the audio, then hands off here; the client polls
``GET /similarity/upload/{job_id}/status`` for the result.

Why the work moved off the request
----------------------------------
Capacity testing on 2026-08-13: 20 concurrent 40 MB uploads finished on the server at 93 s,
and Cloudflare closes an origin request at 100 s — 15 of 20 completed results were thrown
away as 524s. The GPU embedding step is serialised platform-wide (Essentia's TensorFlow
predictors are not thread-safe, so each worker holds an inference lock), which is what makes
the tail grow with concurrency. Nothing here makes that faster; it stops the answer being
lost when it is slow.

Audio is handed over as a spool file under ``settings.temp_dir`` rather than through the
Redis broker — the API and the Celery worker share a host and filesystem, and this is the
existing pattern for both sibling tasks. This task always deletes its own spool.
"""

import logging
import os
from typing import Optional

from app.core.context import set_admin_context, set_current_partner_id
from app.models.track_artifact_status import (
    ARTIFACT_FAILED,
    ARTIFACT_PROCESSING,
    ARTIFACT_READY,
    ARTIFACT_UNAVAILABLE,
)
from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository
from app.services.similarity_upload_job_service import SimilarityUploadJobService
from database.connection import AsyncSessionLocal
from .async_runner import run_async_task
from .celery_app import celery_app

logger = logging.getLogger(__name__)

# Client-safe failure text. The real cause is always in the log with the job id — never
# surfaced to the caller, since these strings render in the UI.
_GENERIC_FAILURE = "We could not build a playlist for this track. Please try again."

# Shown on the Library capsule when the playlist could not be built. The Redis job record that
# carries `_GENERIC_FAILURE` expires; the Library is read days later, so it needs its own copy.
_PLAYLIST_FAILED_TEXT = "We could not build a Sonic Discovery playlist for this track."
_ANALYSIS_SKIPPED_TEXT = "The analysis was not started because the upload did not complete."
_ANALYSIS_UNAVAILABLE_TEXT = "Analysis is not available for this track."


async def _async_run_similarity_upload(
    *,
    job_id: str,
    audio_spool_path: str,
    track_uuid: str,
    original_filename: str,
    top_k: int,
    duplication_threshold: int,
    user_id: Optional[int],
    partner_id: Optional[int],
    track_id: Optional[int],
    visible_count: Optional[int],
) -> None:
    from app.services.similarity_service import SimilarityService
    from app.utils.demo_mode_utils import apply_demo_mode_redaction

    jobs = SimilarityUploadJobService()
    await jobs.mark_running(job_id)
    await TrackArtifactStatusRepository.set_playlist_state(track_id, ARTIFACT_PROCESSING)

    # Assume failure until a branch proves otherwise, so no early return can leave a client
    # polling a job that is stuck on `running` forever.
    failed_reason = "processing_failed"
    succeeded = False
    try:
        try:
            with open(audio_spool_path, "rb") as fh:
                audio_bytes = fh.read()
        except OSError as exc:
            logger.error("SIMILARITY UPLOAD JOB %s: could not read spool %s: %s",
                         job_id, audio_spool_path, exc)
            failed_reason = "audio_unavailable"
            return
        if not audio_bytes:
            logger.error("SIMILARITY UPLOAD JOB %s: spool %s was empty", job_id, audio_spool_path)
            failed_reason = "audio_unavailable"
            return

        # Partner scoping is request-scoped context the worker does not inherit; set it
        # explicitly or the query runs against the wrong catalogue.
        if partner_id is not None:
            set_current_partner_id(partner_id)
            set_admin_context(False)
        else:
            set_admin_context(True)

        async with AsyncSessionLocal() as db:
            result = await SimilarityService().calculate_similarity_for_upload(
                db=db,
                audio_bytes=audio_bytes,
                original_filename=original_filename,
                track_uuid=track_uuid,
                top_k=top_k,
                similarity_duplication_threshold=duplication_threshold,
                user_id=user_id,
                partner_id=partner_id,
            )

            if not isinstance(result, dict) or result.get("success") is False:
                logger.warning("SIMILARITY UPLOAD JOB %s: similarity failed: %s", job_id,
                               (result or {}).get("error") if isinstance(result, dict) else result)
                failed_reason = "similarity_failed"
                return

            # Record the upload against the monthly allowance only now — the submit endpoint
            # peeked at the cap but deliberately did not charge, so a pipeline failure never
            # leaves the user having paid for nothing. Same record-on-success rule the
            # analysis path follows.
            if user_id:
                from app.services.operation_limit_evaluator import OperationLimitEvaluator

                await OperationLimitEvaluator().record_success(
                    db, user_id=user_id, operation_code="upload_create"
                )

        # Server-authoritative teasing, exactly as the blocking endpoint applied it. The cap was
        # resolved at submit time from the caller's plan; `None` means "no redaction" (B2B).
        if visible_count is not None:
            apply_demo_mode_redaction(result, visible_count=visible_count)

        await jobs.mark_done(job_id, result)
        succeeded = True
        logger.info("SIMILARITY UPLOAD JOB %s: done (track %s)", job_id, track_uuid)

        # The Redis job record answers "did the upload I am waiting on finish?" and then expires.
        # The Library asks the same question days later, so the outcome is recorded durably here
        # too. `success` without a playlist row is a real outcome, not a failure: it means nothing
        # in the catalogue was close enough, and it needs different copy.
        await TrackArtifactStatusRepository.set_playlist_state(
            track_id,
            ARTIFACT_READY if (result or {}).get("playlist") else ARTIFACT_UNAVAILABLE,
        )

        # The upload also yields an analysis (the sibling artifact) — enqueue it before the audio
        # is discarded. Fire-and-forget: it must never affect the playlist the user is waiting on,
        # which is why it runs after the job is already marked done.
        if not _enqueue_analysis_sibling(
            audio_bytes=audio_bytes,
            original_filename=original_filename,
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id,
        ):
            # Nothing was enqueued (service unconfigured, or the spool/broker refused), so no task
            # will ever move this off `pending`.
            await TrackArtifactStatusRepository.set_analysis_state(
                track_id, ARTIFACT_UNAVAILABLE, error=_ANALYSIS_UNAVAILABLE_TEXT
            )
    except Exception as exc:
        logger.error("SIMILARITY UPLOAD JOB %s: unhandled failure: %s", job_id, exc, exc_info=True)
        failed_reason = "processing_failed"
    finally:
        if not succeeded:
            await jobs.mark_failed(job_id, _GENERIC_FAILURE, reason=failed_reason)
            await TrackArtifactStatusRepository.set_playlist_state(
                track_id, ARTIFACT_FAILED, error=_PLAYLIST_FAILED_TEXT
            )
            # The analysis is enqueued only on the success path above, so a failed upload means it
            # will never run. Without this the analysis capsule would sit on `pending` and spin
            # forever, waiting for a task nobody is ever going to send.
            await TrackArtifactStatusRepository.set_analysis_state(
                track_id, ARTIFACT_UNAVAILABLE, error=_ANALYSIS_SKIPPED_TEXT
            )
            # Telemetry LAST, after everything the user can see has been recorded. A background
            # job failing is otherwise invisible — no status code, no user-facing error, nothing
            # in the access log — so a run of them would go unnoticed exactly as the 524s did.
            try:
                from app.services.watchdog_service import record_job_failure

                await record_job_failure("similarity_upload")
            except Exception:  # pragma: no cover — counting must not affect the job
                pass
        try:
            if audio_spool_path and os.path.exists(audio_spool_path):
                os.remove(audio_spool_path)
        except OSError as exc:
            logger.warning("SIMILARITY UPLOAD JOB %s: could not remove spool %s: %s",
                           job_id, audio_spool_path, exc)


def _enqueue_analysis_sibling(
    *,
    audio_bytes: bytes,
    original_filename: str,
    track_id: Optional[int],
    user_id: Optional[int],
    partner_id: Optional[int],
) -> bool:
    """Reuse the controller's sibling wiring so both upload paths enqueue identically.

    Imported lazily — the controller pulls in most of the service layer, and this module is
    loaded by the Celery worker at startup.

    Returns whether a task was actually enqueued, so the caller can close out the analysis state
    when one was not. An import failure counts as "not enqueued" for the same reason.
    """
    try:
        from app.controllers.similarity_controller import SimilarityController

        return bool(
            SimilarityController()._maybe_enqueue_analysis_sibling(
                audio_bytes=audio_bytes,
                original_filename=original_filename,
                track_id=track_id,
                user_id=user_id,
                partner_id=partner_id,
            )
        )
    except Exception as exc:  # never let analysis wiring affect a completed similarity job
        logger.error("SIMILARITY UPLOAD JOB: failed to enqueue analysis sibling: %s", exc)
        return False


async def _mark_crashed(job_id: str, track_id: Optional[int]) -> None:
    """Record a worker-level crash on both the job record and the track.

    One coroutine so a single ``run_async_task`` covers both — the crash path runs outside the
    inner handler's event loop, and starting two of them is how one of the writes gets lost.
    """
    await SimilarityUploadJobService().mark_failed(
        job_id, _GENERIC_FAILURE, reason="worker_error"
    )
    await TrackArtifactStatusRepository.set_playlist_state(
        track_id, ARTIFACT_FAILED, error=_PLAYLIST_FAILED_TEXT
    )
    await TrackArtifactStatusRepository.set_analysis_state(
        track_id, ARTIFACT_UNAVAILABLE, error=_ANALYSIS_SKIPPED_TEXT
    )


@celery_app.task(bind=True, max_retries=0)
def run_similarity_upload(
    self,
    job_id: str,
    audio_spool_path: str,
    track_uuid: str,
    original_filename: str,
    top_k: int,
    duplication_threshold: int,
    user_id: Optional[int] = None,
    partner_id: Optional[int] = None,
    track_id: Optional[int] = None,
    visible_count: Optional[int] = None,
) -> None:
    """Run one accepted similarity upload to completion and record the outcome on the job.

    ``max_retries=0`` on purpose: the spool is deleted in the task's ``finally``, so a retry
    would have no audio to work from. A failed job is reported to the client as failed, and
    the client re-uploads — which is honest, and cheaper than keeping 40 MB spools alive for
    a retry that usually cannot help.
    """
    try:
        run_async_task(
            _async_run_similarity_upload(
                job_id=job_id,
                audio_spool_path=audio_spool_path,
                track_uuid=track_uuid,
                original_filename=original_filename,
                top_k=top_k,
                duplication_threshold=duplication_threshold,
                user_id=user_id,
                partner_id=partner_id,
                track_id=track_id,
                visible_count=visible_count,
            )
        )
    except Exception as exc:
        logger.error("SIMILARITY UPLOAD JOB %s: task crashed: %s", job_id, exc, exc_info=True)
        # The inner handler could not run, so the job is still `queued`/`running`. Mark it
        # failed in its own loop, or the client polls a job that will never move — and record the
        # same outcome on the track, or the Library capsules spin forever for the same reason.
        try:
            run_async_task(_mark_crashed(job_id, track_id))
        except Exception:  # pragma: no cover — nothing further we can do
            logger.error("SIMILARITY UPLOAD JOB %s: could not mark failed after crash", job_id)
