"""
Analysis Result Controller (consumer-facing)
============================================

Reads for the single-value analysis summary and the proxied analysis result (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4-5). The tokenized direct-from-cache fetch is
retired; ``mint_retrieval_token`` explains why.

Authorization: an analysis is owned by the uploading user (``user_id``) and may later be made
public (``is_public``). Every read applies the owner-or-public check, so a per-id endpoint
can't enumerate other users' analyses.

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import logging
import os
from typing import Optional

from fastapi import Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.models.track_analysis_result import (
    SIBLING_FAILED,
    SIBLING_PENDING,
    SIBLING_READY,
    SIBLING_UNAVAILABLE,
    TrackAnalysisResult,
)
from app.models.user import User
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.services.analysis_projection import project_summary, public_analysis
from app.services.analysis_readings_service import attach_readings
from app.services.analysis_service import AnalysisService
from app.services.antivirus_service import AntivirusService
from app.services.audio_service import AudioService
from app.services.entitlement_gate import EntitlementGate
from app.services.operation_limit_evaluator import OperationLimitEvaluator
from app.services.track_analysis_result_service import TrackAnalysisResultService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.utils.public_names import scrub_text
from app.utils.quota_response import operation_limit_response
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


def _public_message(upstream: dict, fallback: str) -> str:
    """An upstream error message, safe to show. The analysis service may name what failed inside it."""
    return scrub_text(upstream.get("message") or fallback, everything=True)


class AnalysisResultController:
    def __init__(self) -> None:
        self.service = TrackAnalysisResultService()
        self.analysis_client = AnalysisService()
        self.entitlement_gate = EntitlementGate()
        self.operation_limit_evaluator = OperationLimitEvaluator()
        self.antivirus_service = AntivirusService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()

    @staticmethod
    def _authorized(row: TrackAnalysisResult, current_user: Optional[User]) -> bool:
        """Owner (logged-in, ids match) or a public analysis may read/retrieve it."""
        if row.is_public:
            return True
        return bool(current_user and row.user_id and row.user_id == current_user.id)

    async def _attach_playback_refs(
        self, db: AsyncSession, row: TrackAnalysisResult, doc: object
    ) -> object:
        """Enrich a status/result doc with the uploaded track's ``track_uuid`` and its sibling
        similarity playlist's ``playlist_uuid``.

        The analysis screen plays the uploaded track over HLS by reusing that sibling playlist's
        seed-only manifest (same media-server segments) — carrying both ids on the status/result the
        client already polls avoids a second lookup round-trip. Best-effort: never fails the response.

        Also reports ``sibling_playlist_state`` so the client can distinguish "the playlist is still
        being generated" from "there will never be one". A missing ``playlist_uuid`` alone cannot say
        which, and the analysis screen needs to either keep waiting or stop.
        """
        if not isinstance(doc, dict) or row is None:
            return doc
        try:
            track_uuid = await self.track_repository.async_get_uuid_by_id(db, row.track_id)
            if track_uuid:
                doc["track_uuid"] = track_uuid
            playlist_uuid = await self.playlist_repository.async_get_latest_similarity_playlist_uuid_by_seed(
                db, row.track_id, partner_id=row.partner_id
            )
            if playlist_uuid:
                doc["playlist_uuid"] = playlist_uuid
            doc["sibling_playlist_state"] = self._sibling_state(row, playlist_uuid)
        except Exception as exc:  # pragma: no cover — enrichment must never break the proxy
            logger.warning(
                "ANALYSIS: could not attach playback refs for %s: %s", row.analysis_uuid, exc
            )
        return doc

    @staticmethod
    def _sibling_state(row: TrackAnalysisResult, playlist_uuid: Optional[str]) -> str:
        """Resolve the sibling playlist's state for the client.

        An existing playlist always wins — the recorded value can lag (the task writes it after the
        playlist row) and a playlist we can actually open is the ground truth. Rows written before
        the state column existed have nothing recorded, so they fall back to inferring from the
        playlist's presence rather than being reported as forever-pending.
        """
        if playlist_uuid:
            return SIBLING_READY
        recorded = getattr(row, "sibling_playlist_state", None)
        if recorded in (SIBLING_PENDING, SIBLING_READY, SIBLING_UNAVAILABLE, SIBLING_FAILED):
            # 'ready' without a playlist means it was deleted since — nothing left to wait for.
            return SIBLING_UNAVAILABLE if recorded == SIBLING_READY else recorded
        return SIBLING_UNAVAILABLE

    async def get_summary(
        self,
        db: AsyncSession,
        analysis_uuid: str,
        current_user: Optional[User],
    ) -> JSONResponse:
        """Return the single-value analysis summary (owner-or-public)."""
        row = await self.service.get_by_analysis_uuid(db, analysis_uuid)
        if row is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Analysis not found."),
            )
        if not self._authorized(row, current_user):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content=format_response(
                    success=False,
                    error="You don't have access to this analysis.",
                    reason="forbidden",
                ),
            )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=self.service.to_dict(row)),
        )

    async def mint_retrieval_token(
        self,
        db: AsyncSession,
        request: Request,
        analysis_uuid: str,
        current_user: Optional[User],
    ) -> JSONResponse:
        """RETIRED. Always 410; no token is minted.

        The token let the client fetch the full result straight from the analysis service's cache,
        skipping this proxy. That copy is the service's raw document, with every field that says
        how the result was produced, so it cannot be offered to a caller. The full result is served
        by ``get_result`` instead, which applies ``public_analysis`` on every plan.

        The route stays so an old client gets a clean refusal. The frontend fell back to
        ``/result`` on any failed mint, so a client that still calls this keeps working.
        """
        return JSONResponse(
            status_code=status.HTTP_410_GONE,
            content=format_response(
                success=False,
                error=f"Retired. Fetch the result from /analysis/{analysis_uuid}/result.",
                reason="retired",
            ),
        )

    # ------------------------------------------------------------------ #
    # Upload front-door (fresh analysis) — Alwyzon is the only caller of the
    # analysis service, and the upload is gated by uploads_per_month here.
    # ------------------------------------------------------------------ #
    async def upload_and_analyze(
        self,
        db: AsyncSession,
        request: Request,
        file: UploadFile,
        current_user: Optional[User],
        partner_id: int,
    ) -> JSONResponse:
        """Upload a track, foreground its analysis on the analysis service, and enqueue the
        similarity sibling. Login-only + gated by ``can_similarity_upload`` and
        ``uploads_per_month`` (counted ONCE here; the sibling never re-counts).

        Returns ``{analysis_id, track_uuid}``; the client then polls
        ``GET /analysis/{id}/status`` + ``/result`` for progressive delivery.
        """
        # 1) Consumer surface: login-only + upload capability.
        if partner_id == settings.system_partner_id:
            gate = await self.entitlement_gate.check_boolean(
                db, FeatureKey.CAN_SIMILARITY_UPLOAD, user=current_user
            )
            if not gate.allowed:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=format_response(
                        success=False,
                        error="Uploading a track for analysis requires an account. Please log in.",
                        reason=gate.reason,
                    ),
                )
        if current_user is None:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=format_response(
                    success=False, error="Authentication required to upload for analysis.",
                    reason="login_required",
                ),
            )
        user_id = current_user.id

        # 2) Monthly upload allowance — PEEK only. The credit is recorded when the result is
        #    persisted, in analysis_tasks._async_persist_analysis_summary (record-on-success).
        limit_check = await self.operation_limit_evaluator.check(
            db, user_id=user_id, operation_code="upload_create"
        )
        if not limit_check.allowed:
            # 402 + the quota body when the monthly upload allowance is spent; the legacy 403 for
            # a permission refusal. Same shape as every other metered endpoint.
            return operation_limit_response(limit_check)

        # 3) The analysis service must be plugged in (URL configured).
        if not self.analysis_client.is_configured:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=format_response(
                    success=False,
                    error="Analysis is temporarily unavailable. Please try again later.",
                    reason="service_unavailable",
                ),
            )

        # 4) Read + validate the file.
        audio_bytes = await file.read()
        if not audio_bytes:
            return self._reject(422, "File is empty. Please upload a valid audio file.")
        if len(audio_bytes) > settings.max_file_size:
            mb = settings.max_file_size // (1024 * 1024)
            return self._reject(422, f"File too large. Maximum size is {mb}MB.")

        # 5) Antivirus scan (never trust the uploaded filename).
        track_uuid = generate_track_uuid()
        # Off the event loop: ClamAV is synchronous and CPU-bound, and Alwyzon is a single uvicorn
        # process — a blocking scan here stalls every other request on the box. Measured under the
        # 2026-08-13 mixed load, this path and the similarity upload path degraded in lockstep
        # (79.3s vs 75.1s medians) precisely because they share this call.
        scan = await run_in_threadpool(
            self.antivirus_service.scan_bytes, audio_bytes, f"upload_{track_uuid}.tmp"
        )
        if not scan.get("success"):
            return self._reject(500, "An internal error occurred during antivirus scan.")
        if not scan.get("clean"):
            return self._reject(415, "The uploaded file was rejected for security reasons.")

        # 5b) Is it actually audio, and short enough to be worth the pipeline?
        #
        # This path had no such check. A renamed PDF, a video, or a four-hour DJ set all passed
        # here and failed somewhere deeper, after the upload was stored and an analysis row
        # existed. The similarity path has always probed; both now answer the same way, from the
        # file's content rather than its name.
        probe_info = None
        if self.audio_service.is_ffmpeg_available():
            probe_info, probe_error = await run_in_threadpool(
                self.audio_service.inspect_upload, audio_bytes, settings.max_audio_duration_seconds
            )
            if probe_error:
                return self._reject(415, probe_error)

        # The name this file travels under. The stem stays the user's, because the analysis page
        # prints it, but the extension comes from the probe so nothing downstream is misled by a
        # WhatsApp `.mpeg` that actually holds Opus.
        upload_name = file.filename or "upload"
        probe_ext = (probe_info or {}).get("extension") or ""
        stem = os.path.splitext(upload_name)[0] or "upload"
        send_filename = f"{stem}{probe_ext}" if probe_ext else (
            upload_name if os.path.splitext(upload_name)[1] else f"{upload_name}.audio"
        )

        # 6) Persist the track (library-owned), then mint the Alwyzon-owned analysis id.
        await file.seek(0)
        upload = await self.track_upload_service.upload_track_to_database(
            db, file, audio_bytes, partner_id=partner_id, user_id=user_id
        )
        if not upload.get("success"):
            return self._reject(500, "An internal error occurred while uploading the track.")
        track_id = int(upload["track_id"]) if upload.get("track_id") else None
        track_uuid = upload.get("uuid") or track_uuid
        analysis_id = self.analysis_client.new_analysis_id()

        # 7) Foreground: enqueue the analysis on the analysis service under our id. Do this BEFORE
        #    writing the summary row, so a failed create leaves NO orphan row (which would make the
        #    library show "Get analysis" for a track whose analysis was never created).
        created = await self.analysis_client.create_analysis(
            audio_bytes=audio_bytes,
            original_filename=send_filename,
            analysis_id=analysis_id,
        )
        if created.get("status") == "error":
            logger.error("ANALYSIS UPLOAD: create failed for %s: %s", analysis_id, created.get("message"))
            return JSONResponse(
                status_code=status.HTTP_502_BAD_GATEWAY,
                content=format_response(
                    success=False,
                    error="Could not start the analysis. Please try again.",
                    reason="upstream_error",
                ),
            )

        # 8) Pending summary row (owner-links the analysis id → authorizes polling + shows in the
        #    library while it computes). The background task fills in the values on completion.
        if track_id is not None:
            await self.service.repo.async_upsert(
                db, analysis_uuid=analysis_id, track_id=track_id,
                user_id=user_id, partner_id=partner_id,
                # The sibling is enqueued a few lines below and reports its own outcome. Recording
                # 'pending' up-front is what lets the client tell "still coming" from "never".
                fields={"sibling_playlist_state": SIBLING_PENDING},
            )
            await db.commit()

        # 9) Enqueue the background persist + similarity sibling.
        #
        # The upload is NOT counted here. At this point the analysis has only been ACCEPTED by the
        # analysis service — it has not produced anything. Charging now means a hard pipeline
        # failure leaves the user having paid for nothing.
        #
        # The credit is recorded where the result is actually persisted
        # (`analysis_tasks._async_persist_analysis_summary`), which is the same record-on-success
        # rule the similarity-upload path already follows. The peek in step 2 still stops anyone
        # exceeding their cap; this only moves WHEN the counter ticks, by a few seconds.
        self._enqueue_background(
            analysis_id=analysis_id, track_id=track_id, track_uuid=track_uuid,
            audio_bytes=audio_bytes, original_filename=send_filename,
            user_id=user_id, partner_id=partner_id,
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={"analysis_id": analysis_id, "track_uuid": track_uuid},
            ),
        )

    async def get_status(
        self, db: AsyncSession, analysis_id: str, current_user: Optional[User]
    ) -> JSONResponse:
        """Proxy the analysis job status (owner-or-public via the summary row)."""
        row = await self.service.get_by_analysis_uuid(db, analysis_id)
        if row is None:
            return self._reject(404, "Analysis not found.")
        if not self._authorized(row, current_user):
            return self._reject(403, "You don't have access to this analysis.", reason="forbidden")
        status_doc = await self.analysis_client.get_status(analysis_id)
        if status_doc.get("status") == "error":
            # The analysis service only retains a job/result transiently. Once it evicts one, its
            # /v1/analyses/{id} returns 404 — but OUR summary row (and the library's Analysis link)
            # live forever. That's expected data expiry, NOT a bad gateway: report it as 404 "expired"
            # so the UI can show "no longer available", and reserve 502 for a genuine upstream fault.
            if status_doc.get("status_code") == 404:
                return self._reject(404, "This analysis is no longer available.", reason="expired")
            return self._reject(502, _public_message(status_doc, "Status check failed."), reason="upstream_error")
        if isinstance(status_doc.get("error"), str):
            # Shown to the user when a job fails, and worded by the analysis service.
            status_doc["error"] = scrub_text(status_doc["error"], everything=True)
        status_doc = await self._attach_playback_refs(db, row, status_doc)
        return JSONResponse(status_code=200, content=format_response(success=True, data=status_doc))

    async def get_result(
        self, db: AsyncSession, analysis_id: str, current_user: Optional[User]
    ) -> JSONResponse:
        """Proxy the canonical result (owner-or-public), projected to the caller's plan.

        ``can_view_full_analysis`` is a page boundary, not an on/off switch for this endpoint. The
        summary card and the full dashboard are both built from this payload, so REFUSING the
        request would take the card away from the free user who is entitled to it. A caller without
        the entitlement gets the card's fields and nothing else — withheld in the payload, not
        hidden in the UI.
        """
        row = await self.service.get_by_analysis_uuid(db, analysis_id)
        if row is None:
            return self._reject(404, "Analysis not found.")
        if not self._authorized(row, current_user):
            return self._reject(403, "You don't have access to this analysis.", reason="forbidden")
        result = await self.analysis_client.get_result(analysis_id)
        if isinstance(result, dict) and result.get("status") == "error":
            # Same as get_status: an evicted analysis 404s upstream → report "expired", not 502.
            if result.get("status_code") == 404:
                return self._reject(404, "This analysis is no longer available.", reason="expired")
            return self._reject(502, _public_message(result, "Result fetch failed."), reason="upstream_error")

        # Before the projection, not after: `readings` is an allow-listed summary-card field, so
        # attaching it first means the free card and the Pro dashboard show the same sentences.
        result = attach_readings(result, analysis_id)

        if not await self._may_view_full_analysis(db, current_user):
            result = project_summary(result)

        # After the projection, never before — the playback ids are plumbing the client needs on
        # every plan, and the allow-list would drop them if they were attached first.
        result = await self._attach_playback_refs(db, row, result)
        # Every plan, last: drop how the result was produced and use the public field names.
        result = public_analysis(result)
        return JSONResponse(status_code=200, content=format_response(success=True, data=result))

    async def _may_view_full_analysis(
        self, db: AsyncSession, current_user: Optional[User]
    ) -> bool:
        """Whether this caller gets the whole dashboard.

        Fails **open** on an entitlement lookup error, matching the rest of the gate layer: this is
        an upsell boundary, not a security one, and the alternative is silently serving a paying
        subscriber a stripped result with no error anywhere to explain it.
        """
        try:
            gate = await self.entitlement_gate.check_boolean(
                db, FeatureKey.CAN_VIEW_FULL_ANALYSIS, user=current_user
            )
            return gate.allowed
        except Exception as exc:  # pragma: no cover — never fail a result on the gate
            logger.warning("ANALYSIS: full-analysis entitlement lookup failed: %s", exc)
            return True

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _reject(code: int, error: str, *, reason: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=code, content=format_response(success=False, error=error, reason=reason)
        )

    def _enqueue_background(
        self,
        *,
        analysis_id: str,
        track_id: Optional[int],
        track_uuid: str,
        audio_bytes: bytes,
        original_filename: str,
        user_id: int,
        partner_id: int,
    ) -> None:
        """Fire the background jobs: fill the summary on completion, and generate the similarity
        sibling playlist. Best-effort — never raises into the request."""
        try:
            from app.tasks.analysis_tasks import generate_similarity_sibling, persist_analysis_summary

            persist_analysis_summary.delay(
                analysis_id=analysis_id, track_id=track_id, user_id=user_id, partner_id=partner_id
            )

            # `original_filename` already carries the probed extension (see the caller).
            _, ext = os.path.splitext(original_filename or "")
            if not ext:
                ext = ".audio"
            os.makedirs(settings.temp_dir, exist_ok=True)
            spool_path = os.path.join(settings.temp_dir, f"simsib_{analysis_id}{ext}")
            with open(spool_path, "wb") as fh:
                fh.write(audio_bytes)
            generate_similarity_sibling.delay(
                audio_spool_path=spool_path,
                analysis_id=analysis_id,
                track_uuid=track_uuid,
                track_id=track_id,
                original_filename=original_filename,
                user_id=user_id,
                partner_id=partner_id,
            )
        except Exception as exc:  # pragma: no cover — metering/sibling must not fail the upload
            logger.error("ANALYSIS UPLOAD: failed to enqueue background jobs for %s: %s", analysis_id, exc)
