"""
Analysis Result Controller (consumer-facing)
============================================

Reads for the single-value analysis summary + minting the tokenized retrieval "boarding pass"
for the full cached JSON on the Hetzner served cache (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4-5).

Authorization: an analysis is owned by the uploading user (``user_id``) and may later be made
public (``is_public``). The token mint is the security boundary — Alwyzon signs a retrieval token
ONLY for the owner or a public analysis; the Hetzner node then enforces that the requested id
equals the id embedded in the token. We apply the same owner-or-public check to the summary read
so a per-id endpoint can't enumerate other users' analyses.

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import logging
import os
from typing import Optional

from fastapi import Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.models.track_analysis_result import TrackAnalysisResult
from app.models.user import User
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.services.analysis_service import AnalysisService
from app.services.antivirus_service import AntivirusService
from app.services.entitlement_gate import EntitlementGate
from app.services.operation_limit_evaluator import OperationLimitEvaluator
from app.services.track_analysis_result_service import TrackAnalysisResultService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.utils.edge_auth import generate_analysis_token
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


def _client_ip(request: Request) -> str:
    """Resolve the originating client IP, honouring upstream proxy headers (token IP-lock)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class AnalysisResultController:
    def __init__(self) -> None:
        self.service = TrackAnalysisResultService()
        self.analysis_client = AnalysisService()
        self.entitlement_gate = EntitlementGate()
        self.operation_limit_evaluator = OperationLimitEvaluator()
        self.antivirus_service = AntivirusService()
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
        client already polls avoids a second lookup round-trip. Best-effort: never fails the response;
        ``playlist_uuid`` is simply absent until the (async, best-effort) sibling playlist exists.
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
        except Exception as exc:  # pragma: no cover — enrichment must never break the proxy
            logger.warning(
                "ANALYSIS: could not attach playback refs for %s: %s", row.analysis_uuid, exc
            )
        return doc

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
        """Mint a short-lived retrieval token for the full cached JSON (owner-or-public).

        The token embeds this ``analysis_uuid`` + ``scope="analysis"`` + ip + exp; the frontend
        calls ``{hetzner_media_base}/analysis/{analysis_uuid}?token=…`` and Hetzner enforces the
        id match. Refusing to mint (not owner / not public) is what withholds access.
        """
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

        token_data = generate_analysis_token(analysis_uuid, _client_ip(request))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={
                    "token": token_data["token"],
                    "expires_in": token_data["expires_in"],
                    "analysis_uuid": analysis_uuid,
                    "scope": "analysis",
                    # Frontend composes {hetzner_media_base}{retrieval_path}?token=<token>.
                    "retrieval_path": f"/analysis/{analysis_uuid}",
                },
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

        # 2) Monthly upload allowance (peek; recorded on success below).
        limit_check = await self.operation_limit_evaluator.check(
            db, user_id=user_id, operation_code="upload_create"
        )
        if not limit_check.allowed:
            return JSONResponse(
                status_code=limit_check.status_code,
                content=format_response(
                    success=False,
                    error=limit_check.message or "Upload not permitted.",
                    reason=limit_check.reason,
                ),
            )

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
        scan = self.antivirus_service.scan_bytes(audio_bytes, f"upload_{track_uuid}.tmp")
        if not scan.get("success"):
            return self._reject(500, "An internal error occurred during antivirus scan.")
        if not scan.get("clean"):
            return self._reject(415, "The uploaded file was rejected for security reasons.")

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
            original_filename=file.filename or "upload.mp3",
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
                user_id=user_id, partner_id=partner_id, fields={},
            )
            await db.commit()

        # 9) Count the upload (once), then enqueue the background persist + similarity sibling.
        await self.operation_limit_evaluator.record_success(
            db, user_id=user_id, operation_code="upload_create"
        )
        self._enqueue_background(
            analysis_id=analysis_id, track_id=track_id, track_uuid=track_uuid,
            audio_bytes=audio_bytes, original_filename=file.filename or "upload.mp3",
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
            return self._reject(502, status_doc.get("message") or "Status check failed.", reason="upstream_error")
        status_doc = await self._attach_playback_refs(db, row, status_doc)
        return JSONResponse(status_code=200, content=format_response(success=True, data=status_doc))

    async def get_result(
        self, db: AsyncSession, analysis_id: str, current_user: Optional[User]
    ) -> JSONResponse:
        """Proxy the (partial or full) canonical result (owner-or-public via the summary row)."""
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
            return self._reject(502, result.get("message") or "Result fetch failed.", reason="upstream_error")
        result = await self._attach_playback_refs(db, row, result)
        return JSONResponse(status_code=200, content=format_response(success=True, data=result))

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

            _, ext = os.path.splitext(original_filename or "")
            if not ext:
                ext = ".mp3"
            os.makedirs(settings.temp_dir, exist_ok=True)
            spool_path = os.path.join(settings.temp_dir, f"simsib_{analysis_id}{ext}")
            with open(spool_path, "wb") as fh:
                fh.write(audio_bytes)
            generate_similarity_sibling.delay(
                audio_spool_path=spool_path,
                track_uuid=track_uuid,
                original_filename=original_filename,
                user_id=user_id,
                partner_id=partner_id,
            )
        except Exception as exc:  # pragma: no cover — metering/sibling must not fail the upload
            logger.error("ANALYSIS UPLOAD: failed to enqueue background jobs for %s: %s", analysis_id, exc)
