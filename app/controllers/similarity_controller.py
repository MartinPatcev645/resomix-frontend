"""
Similarity Controller
====================

This controller handles HTTP requests for audio similarity functionality.
It processes uploaded audio files and track ID requests, validates inputs,
and coordinates with similarity and audio services to return similar tracks.

Manages file upload validation, audio format checking, and response formatting
for both upload-based and ID-based similarity queries.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Similarity controller
import os
from typing import Optional
from fastapi import UploadFile, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import traceback
from app.models.user import User
from app.services.playlist_service import PlaylistService
from app.services.operation_limit_evaluator import OperationLimitEvaluator
from app.core.config import settings
from app.services.similarity_service import SimilarityService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.services.antivirus_service import AntivirusService
from app.utils.demo_mode_utils import apply_demo_mode_redaction
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService
from app.services.entitlement_gate import EntitlementGate
from app.services.guest_identity_service import GuestIdentityService
from app.core.entitlement_keys import FeatureKey
import time
import redis.asyncio as aioredis
from app.db.redis import _redis_pool

logger = logging.getLogger(__name__)


class SimilarityController:
    def __init__(self):
        self.similarity_service = SimilarityService()
        self.playlist_service = PlaylistService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()
        self.antivirus_service = AntivirusService()
        self.logging_service = LoggingService()
        self.operation_limit_evaluator = OperationLimitEvaluator()
        self.entitlement_gate = EntitlementGate()
        self.guest_identity = GuestIdentityService()

    def _clamp_top_sk(self, top_sk, cap: int):
        """Clamp the requested track count to the caller's dropdown cap (server-side guard)."""
        if not cap or cap <= 0:
            return top_sk
        if top_sk is None:
            return top_sk
        try:
            return min(int(top_sk), int(cap))
        except (TypeError, ValueError):
            return top_sk

    async def _frontend_rate_ok(self, request) -> bool:
        """Per-IP burst brake for the FRONTEND surface only (System Partner 1 — guests + logged-in).

        B2B partners are NEVER checked here: they have their own DB-backed per-second/monthly quotas
        (partner rate limits), so frontend abuse protection must not be mixed with theirs. Keyed by
        client IP per UTC minute; catches one-IP hammering with rotating visitor_ids (which the
        per-visitor monthly cap can't stop). Fails **open** if Redis is down (a soft brake must not
        block users on an infra outage)."""
        limit = int(getattr(settings, "frontend_similarity_burst_per_min", 0) or 0)
        if limit <= 0:
            return True
        from datetime import datetime as _dt
        from app.services import redis_counter
        ip = self.guest_identity.client_ip(request)
        minute = _dt.utcnow().strftime("%Y%m%d%H%M")
        count = await redis_counter.incr_with_ttl(f"rate:fe:sim:{ip}:{minute}", 70)
        if count is None:  # Redis down → fail open
            return True
        return count <= limit

    def _rate_limited_response(self) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=format_response(
                success=False,
                error="Too many requests — please slow down and try again in a moment.",
                reason="rate_limited",
            ),
        )

    async def _apply_frontend_unlock_redaction(
        self, db, similarity_results, *, request, current_user, partner_id
    ) -> None:
        """Server-authoritative result teasing for the frontend surface.

        Scrambles every result track beyond the caller's ``max_tracks_per_playlist`` entitlement
        (guest 10 / free 20 / basic 50 / pro 100). This makes the "unlock N, tease the rest" UI
        non-bypassable — the locked tracks' real metadata never leaves the server. B2B partners
        (``partner_id != system_partner_id``) are never redacted; they have their own quota system.
        """
        if partner_id != settings.system_partner_id:
            return
        visitor_id = None if current_user else self.guest_identity.derive_visitor_id(request)
        visible = await self.entitlement_gate.get_cap(
            db, FeatureKey.MAX_TRACKS_PER_PLAYLIST, user=current_user, visitor_id=visitor_id
        )
        apply_demo_mode_redaction(similarity_results, visible_count=visible)

    async def get_similarity_upload(
        self,
        db: AsyncSession,
        request: Request,
        file: UploadFile,
        current_user: Optional[User] = None,
        top_sk: Optional[int] = None,
        engine: Optional[str] = None,
        partner_id: Optional[int] = None,
    ) -> JSONResponse:
        """
        Process an audio file: first upload to database, then return similar tracks.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Entitlement gate (frontend consumer surface only — never B2B partners): similarity by
        # upload is a plan feature. A guest (System Partner 1, no JWT) is denied and nudged to
        # log in, before any processing / external call.
        if partner_id == settings.system_partner_id:
            gate = await self.entitlement_gate.check_boolean(
                db, FeatureKey.CAN_SIMILARITY_UPLOAD, user=current_user
            )
            if not gate.allowed:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=format_response(
                        success=False,
                        error="Similarity by upload requires an account. Please log in.",
                        reason=gate.reason,
                    ),
                )

        # Log authentication status for debugging
        if current_user:
            logger.info(
                f"SIMILARITY UPLOAD AUTH: User authenticated - ID={current_user.id}, UUID={current_user.uuid}, Email={current_user.email}"
            )
        else:
            logger.info("SIMILARITY UPLOAD AUTH: Anonymous user processing")

        # Anonymous frontend users are ALLOWED here, but get a degraded preview (first
        # ANON_VISIBLE_COUNT real, rest scrambled) — see the redaction below. We do not block.

        # Enforce authentication if required by settings.
        # Auth is satisfied by EITHER a logged-in user (JWT) OR a validated partner
        # API key (partner_id is set only after the scoped partner dependency passes).
        # Only reject when neither is present.
        if settings.similarity_auth_required and not current_user and not partner_id:
            logger.warning("SIMILARITY UPLOAD: Authentication required but neither user nor partner provided")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=format_response(
                    success=False,
                    error="Authentication required to access similarity features.",
                ),
            )

        # Frontend-only per-IP burst brake (B2B exempt — see _frontend_rate_ok).
        if partner_id == settings.system_partner_id:
            if not await self._frontend_rate_ok(request):
                return self._rate_limited_response()

        # Check operation limits before processing - only if user is logged in
        user_id = current_user.id if current_user else None
        if user_id:
            limit_check = await self.operation_limit_evaluator.check(
                db,
                user_id=user_id,
                operation_code="playlist_create",
            )
            if not limit_check.allowed:
                response_content = format_response(
                    success=False,
                    error=limit_check.message or "Operation not permitted",
                    reason=limit_check.reason,
                )
                return JSONResponse(
                    status_code=limit_check.status_code,
                    content=response_content,
                )
        else:
            logger.info("SIMILARITY UPLOAD: Skipping limit check for anonymous user")

        # Frontend: clamp the requested depth to the caller's plan cap (server-side guard — the UI
        # greys these options, but a hand-crafted request must not exceed the plan). Guests are
        # already blocked from upload above, so this governs the logged-in tiers.
        if partner_id == settings.system_partner_id and current_user is not None:
            upload_cap = await self.entitlement_gate.get_cap(
                db, FeatureKey.DROPDOWN_MAX_TRACKS, user=current_user
            )
            top_sk = self._clamp_top_sk(top_sk, upload_cap)

        # Validate and get the TOP_SK value using global settings
        validated_top_sk = settings.validate_and_get_top_sk(top_sk)
        actual_top_k = settings.calculate_actual_top_k(validated_top_sk)
        duplication_threshold = settings.get_duplication_threshold_for_top_sk(
            validated_top_sk
        )

        # Log operation start (complex upload)
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="SIMILARITY",
            action="upload_start",
            message="Starting similarity upload processing",
            correlation_id=correlation_id,
            request=request,
            method=request.method,
            endpoint=str(request.url.path),
            path=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
            duration_ms=duration_ms,
            context="Similarity upload processing pipeline",
            metadata={
                "requested_top_sk": top_sk,
                "validated_top_sk": validated_top_sk,
                "file_size": file.size,
                "engine": engine,
            },
            filename=file.filename,
            file_size=file.size,
            operation="similarity_upload",
        )

        # File Size Check using settings
        if file.size > settings.max_file_size:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="file_size_validation_failed",
                message="File too large for similarity processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="File validation during similarity upload",
                metadata={
                    "error": "File too large",
                    "file_size": file.size,
                    "max_allowed_size": settings.max_file_size,
                    "validation_step": "file_size_check",
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload",
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error=f"File too large. Maximum size is {settings.max_file_size // (1024 * 1024)}MB.",
                ),
            )

        # Check if the file is empty
        if file.size == 0:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="file_empty_validation_failed",
                message="Empty file uploaded for similarity processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="File validation during similarity upload",
                metadata={
                    "error": "File is empty",
                    "file_size": file.size,
                    "validation_step": "empty_file_check",
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload",
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="File is empty. Please upload a valid audio file.",
                ),
            )

        # Read audio bytes for processing
        audio_bytes = await file.read()

        # Generate secure temporary filename for processing (NEVER trust uploaded filename)
        track_uuid = generate_track_uuid()
        secure_filename = f"upload_{track_uuid}.tmp"

        # SECURITY: Antivirus scan before any file operations
        av_scan_result = self.antivirus_service.scan_bytes(audio_bytes, secure_filename)

        if not av_scan_result.get("success"):
            # Scan failed - log error
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="SECURITY",
                action="antivirus_scan_failed",
                message="Antivirus scan failed during similarity upload",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                duration_ms=duration_ms,
                context="Antivirus scan during similarity upload",
                metadata={
                    "error": av_scan_result.get("error"),
                    "validation_step": "antivirus_scan",
                    "scan_method": av_scan_result.get("method"),
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload",
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal error occurred during antivirus scan",
                ),
            )

        if not av_scan_result.get("clean"):
            # Threat detected - log and reject
            threat_name = av_scan_result.get("threat", "Unknown threat")
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SECURITY",
                action="malware_detected",
                message=f"Malware detected during similarity upload: {threat_name}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=415,
                duration_ms=duration_ms,
                context="Malware detection during similarity upload",
                metadata={
                    "threat_name": threat_name,
                    "validation_step": "antivirus_scan",
                    "scan_method": av_scan_result.get("method"),
                    "scan_result": av_scan_result,
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload",
            )
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content=format_response(
                    success=False,
                    error="The uploaded file contains malicious content and has been rejected for security reasons.",
                ),
            )

        # File is clean - log success and continue
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="SECURITY",
            action="antivirus_scan_passed",
            message="File passed antivirus scan during similarity upload",
            correlation_id=correlation_id,
            request=request,
            method=request.method,
            endpoint=str(request.url.path),
            path=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
            duration_ms=duration_ms,
            context="Antivirus scan during similarity upload",
            metadata={
                "validation_step": "antivirus_scan",
                "scan_method": av_scan_result.get("method"),
                "scan_result": "clean",
            },
            filename=file.filename,
            file_size=file.size,
            operation="similarity_upload",
        )

        # Use audio service to validate file
        is_ffmpeg_available = self.audio_service.is_ffmpeg_available()

        if is_ffmpeg_available:
            is_valid_audio = self.audio_service.validate_audio_format(
                audio_bytes, secure_filename
            )
            if not is_valid_audio:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="audio_format_validation_failed",
                    message="Invalid audio format detected during similarity upload",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=415,
                    duration_ms=duration_ms,
                    context="Audio format validation during similarity upload",
                    metadata={
                        "error": "File is not valid audio",
                        "ffmpeg_available": is_ffmpeg_available,
                        "validation_step": "audio_format_check",
                        "file_content_type": file.content_type,
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(
                        success=False,
                        error="The uploaded file does not contain valid audio streams according to our analysis.",
                    ),
                )

            # Audio validation passed, now upload to database first
            try:
                # Reset file pointer for track upload service
                await file.seek(0)

                # Extract user_id if user is logged in
                user_id = current_user.id if current_user else None

                # STEP 1: Upload track to database with metadata extraction
                upload_result = (
                    await self.track_upload_service.upload_track_to_database(
                        db, file, audio_bytes, partner_id=partner_id, user_id=user_id
                    )
                )

                if not upload_result.get("success", False):
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="track_upload_failed",
                        message="Failed to upload track to database during similarity processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=500,
                        duration_ms=duration_ms,
                        context="Track upload phase of similarity processing",
                        metadata={
                            "error": "Failed to upload track to database",
                            "upload_result": upload_result,
                            "processing_step": "track_upload",
                            "ffmpeg_available": True,
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=format_response(
                            success=False,
                            error="An internal error occurred while uploading track",
                        ),
                    )

                # STEP 2: Now perform similarity analysis
                # Extract user_id if user is logged in
                user_id = current_user.id if current_user else None

                # Pass original filename (not secure_filename) so similarity service can extract proper extension
                original_filename = file.filename if file.filename else "upload.mp3"

                similarity_results = (
                    await self.similarity_service.calculate_similarity_for_upload(
                        db=db,
                        audio_bytes=audio_bytes,
                        original_filename=original_filename,
                        track_uuid=upload_result["uuid"],
                        top_k=actual_top_k,
                        similarity_duplication_threshold=duplication_threshold,
                        user_id=user_id,
                        partner_id=partner_id,
                    )
                )

                if similarity_results.get("success") is False:
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="similarity_processing_failed",
                        message="Similarity analysis failed during upload processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=503,
                        duration_ms=duration_ms,
                        track_id=(
                            int(upload_result.get("track_id"))
                            if upload_result.get("track_id")
                            else None
                        ),
                        context="Similarity analysis phase of upload processing",
                        metadata={
                            "error": "Similarity processing failed",
                            "similarity_error": similarity_results.get("error"),
                            "processing_step": "similarity_analysis",
                            "track_uuid": upload_result.get("uuid"),
                            "ffmpeg_available": True,
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False,
                            error="Similarity service is currently unavailable. Please try again later.",
                        ),
                    )

                playlist_data = similarity_results.get("playlist")
                generated_playlist_uuid = playlist_data.get("id") if playlist_data else None
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, generated_playlist_uuid
                )
                playlist_int_id = playlist.id if playlist else None

                # NEW: For anonymous users, set a Redis TTL key for automated track cleanup
                if not current_user and _redis_pool:
                    try:
                        client = aioredis.Redis(connection_pool=_redis_pool)
                        anon_key = f"session:anon:upload:{upload_result['uuid']}"
                        await client.setex(anon_key, settings.anonymous_track_ttl, "active")
                        await client.close()
                        logger.info(f"SIMILARITY UPLOAD (Anon): Set cleanup TTL for track {upload_result['uuid']} ({settings.anonymous_track_ttl}s)")
                    except Exception as redis_err:
                        logger.error(f"SIMILARITY UPLOAD (Anon): Failed to set Redis cleanup key: {str(redis_err)}")

                # STEP 3: Return response in same format as similarity by ID
                duration_ms = (time.time() - start_time) * 1000
                await self._apply_frontend_unlock_redaction(
                    db, similarity_results, request=request, current_user=current_user, partner_id=partner_id
                )
                response_content = format_response(
                    success=True, data=similarity_results
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SIMILARITY",
                    action="upload_success",
                    message="Similarity upload processing completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    track_id=(
                        int(upload_result.get("track_id"))
                        if upload_result.get("track_id")
                        else None
                    ),
                    context="Successful completion of similarity upload processing",
                    metadata={
                        "similarity_results": similarity_results,
                        "track_uuid": upload_result.get("uuid"),
                        "processing_steps": [
                            "file_validation",
                            "track_upload",
                            "similarity_analysis",
                        ],
                        "ffmpeg_available": True,
                        "response": response_content,
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="upload_exception",
                    message="Unexpected error during similarity upload processing",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    stack_trace=traceback.format_exc(),
                    context="Similarity upload with database processing",
                    metadata={
                        "error": "An internal server error occurred.",
                        "exception_type": type(e).__name__,
                        "ffmpeg_available": is_ffmpeg_available,
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(
                        success=False, error="An internal server error occurred."
                    ),
                )

        else:  # FFmpeg not available, fall back to saving file and basic content type check
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SYSTEM",
                action="ffmpeg_unavailable",
                message="FFmpeg not available during similarity upload, falling back to basic validation",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                context="Similarity upload fallback processing",
                metadata={
                    "ffmpeg_available": False,
                    "validation_method": "content_type_only",
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload",
            )
            if not file.content_type or not file.content_type.startswith("audio/"):
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="content_type_validation_failed",
                    message="Content-Type validation failed during fallback similarity upload",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=415,
                    duration_ms=duration_ms,
                    context="Content-Type validation during fallback similarity upload",
                    metadata={
                        "error": "Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis.",
                        "file_content_type": file.content_type,
                        "ffmpeg_available": False,
                        "validation_method": "content_type_only",
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(
                        success=False,
                        error="Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis.",
                    ),
                )

            temp_file_path = ""
            try:
                # Use secure filename instead of original filename
                unique_filename = f"upload_{track_uuid}.tmp"
                temp_file_path = os.path.join(settings.temp_dir, unique_filename)
                with open(temp_file_path, "wb") as buffer:
                    buffer.write(audio_bytes)

                # STEP 1: Upload track to database first (even without FFmpeg)
                await file.seek(0)

                # Extract user_id if user is logged in
                user_id = current_user.id if current_user else None

                upload_result = (
                    await self.track_upload_service.upload_track_to_database(
                        db, file, audio_bytes, partner_id=partner_id, user_id=user_id
                    )
                )

                if not upload_result.get("success", False):
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="track_upload_failed",
                        message="Failed to upload track to database during fallback similarity processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=500,
                        duration_ms=duration_ms,
                        context="Track upload phase of fallback similarity processing",
                        metadata={
                            "error": "Failed to upload track to database",
                            "upload_result": upload_result,
                            "processing_step": "track_upload",
                            "ffmpeg_available": False,
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=format_response(
                            success=False,
                            error="An internal error occurred while uploading track",
                        ),
                    )

                # STEP 2: Perform similarity analysis
                # Log fallback warning
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="fallback_processing",
                    message="Processing similarity upload using fallback method without FFmpeg",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    context="Fallback similarity processing without FFmpeg",
                    metadata={
                        "ffmpeg_available": False,
                        "processing_method": "fallback",
                        "track_uuid": upload_result.get("uuid"),
                    },
                    filename=secure_filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )

                # Extract user_id if user is logged in
                user_id = current_user.id if current_user else None

                similarity_results = (
                    await self.similarity_service.calculate_similarity_for_upload(
                        db=db,
                        audio_bytes=audio_bytes,
                        original_filename=secure_filename,
                        track_uuid=upload_result["uuid"],
                        top_k=actual_top_k,
                        similarity_duplication_threshold=duplication_threshold,
                        user_id=user_id,
                        partner_id=partner_id,
                    )
                )

                if similarity_results.get("success") is False:
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="similarity_processing_failed",
                        message="Similarity analysis failed during fallback upload processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=503,
                        duration_ms=duration_ms,
                        track_id=(
                            int(upload_result.get("track_id"))
                            if upload_result.get("track_id")
                            else None
                        ),
                        context="Similarity analysis phase of fallback upload processing",
                        metadata={
                            "error": "Similarity processing failed",
                            "similarity_error": similarity_results.get("error"),
                            "processing_step": "similarity_analysis",
                            "track_uuid": upload_result.get("uuid"),
                            "ffmpeg_available": False,
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False,
                            error="Similarity service is currently unavailable. Please try again later.",
                        ),
                    )

                playlist_data = similarity_results.get("playlist")
                generated_playlist_uuid = playlist_data.get("id") if playlist_data else None
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, generated_playlist_uuid
                )
                playlist_int_id = playlist.id if playlist else None

                # NEW: For anonymous users, set a Redis TTL key for automated track cleanup
                if not current_user and _redis_pool:
                    try:
                        client = aioredis.Redis(connection_pool=_redis_pool)
                        anon_key = f"session:anon:upload:{upload_result['uuid']}"
                        await client.setex(anon_key, settings.anonymous_track_ttl, "active")
                        await client.close()
                        logger.info(f"SIMILARITY UPLOAD (Fallback-Anon): Set cleanup TTL for track {upload_result['uuid']} ({settings.anonymous_track_ttl}s)")
                    except Exception as redis_err:
                        logger.error(f"SIMILARITY UPLOAD (Fallback-Anon): Failed to set Redis cleanup key: {str(redis_err)}")

                # STEP 3: Return response in same format as similarity by ID
                duration_ms = (time.time() - start_time) * 1000
                await self._apply_frontend_unlock_redaction(
                    db, similarity_results, request=request, current_user=current_user, partner_id=partner_id
                )
                response_content = format_response(
                    success=True, data=similarity_results
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SIMILARITY",
                    action="upload_success",
                    message="Similarity fallback upload processing completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    track_id=(
                        int(upload_result.get("track_id"))
                        if upload_result.get("track_id")
                        else None
                    ),
                    playlist_id=playlist_int_id,
                    context="Successful completion of fallback similarity upload processing",
                    metadata={
                        "similarity_results": similarity_results,
                        "track_uuid": upload_result.get("uuid"),
                        "processing_steps": [
                            "file_validation",
                            "track_upload",
                            "similarity_analysis",
                        ],
                        "ffmpeg_available": False,
                        "response": response_content,
                    },
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="upload_exception",
                    message="Unexpected error during fallback similarity upload processing",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    stack_trace=traceback.format_exc(),
                    context="Fallback similarity upload processing",
                    metadata={
                        "error": "An internal server error occurred.",
                        "exception_type": type(e).__name__,
                        "ffmpeg_available": False,
                        "temp_file_path": temp_file_path,
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload",
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(
                        success=False, error="An internal server error occurred."
                    ),
                )
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.remove(temp_file_path)

    async def get_similarity_by_id(
        self,
        db: AsyncSession,
        request: Request,
        track_id: str,
        current_user: Optional[User] = None,
        top_sk: Optional[int] = None,
        engine: Optional[str] = None,
        partner_id: Optional[int] = None,
    ) -> JSONResponse:
        """
        Get similar tracks for a track identified by its UUID.

        Args:
            db: Database session
            track_id: The track UUID to find similar tracks for
            top_sk: Number of similar tracks to return
            engine: Similarity engine (E1-E6)

        Returns:
            JSON response with similar tracks
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Log authentication status for debugging
        if current_user:
            logger.info(
                f"SIMILARITY BY ID AUTH: User authenticated - ID={current_user.id}, UUID={current_user.uuid}, Email={current_user.email}"
            )
        else:
            logger.info("SIMILARITY BY ID AUTH: Anonymous user processing")

        # Anonymous frontend users are ALLOWED here, but get a degraded preview (first
        # ANON_VISIBLE_COUNT real, rest scrambled) — see the redaction below. We do not block.

        # Enforce authentication if required by settings.
        # Auth is satisfied by EITHER a logged-in user (JWT) OR a validated partner
        # API key (partner_id is set only after the scoped partner dependency passes).
        # Only reject when neither is present.
        if settings.similarity_auth_required and not current_user and not partner_id:
            logger.warning("SIMILARITY BY ID: Authentication required but neither user nor partner provided")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=format_response(
                    success=False,
                    error="Authentication required to access similarity features.",
                ),
            )

        # --- Frontend entitlement gate (System Partner 1 only; B2B partners are exempt) ---
        is_frontend = partner_id == settings.system_partner_id
        gate_visitor_id = None
        if is_frontend:
            # Frontend-only per-IP burst brake (B2B has its own quotas — see _frontend_rate_ok).
            if not await self._frontend_rate_ok(request):
                return self._rate_limited_response()
            gate_visitor_id = None if current_user else self.guest_identity.derive_visitor_id(request)
            # Clamp the requested track count to the caller's dropdown cap (server-side guard;
            # the frontend greys the rest). Guest = 20, free = 50, etc.
            cap = await self.entitlement_gate.get_cap(
                db, FeatureKey.DROPDOWN_MAX_TRACKS, user=current_user, visitor_id=gate_visitor_id
            )
            top_sk = self._clamp_top_sk(top_sk, cap)
            # Guests: enforce the monthly playlist limit (peek now, record on success below).
            if current_user is None:
                pg = await self.entitlement_gate.peek_allowed(
                    db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, visitor_id=gate_visitor_id
                )
                if not pg.allowed:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content=format_response(
                            success=False,
                            error="You've reached this month's free playlist limit. Log in to create more.",
                            reason=pg.reason,
                        ),
                    )

        # Check operation limits before processing - only if user is logged in
        user_id = current_user.id if current_user else None
        if user_id:
            limit_check = await self.operation_limit_evaluator.check(
                db,
                user_id=user_id,
                operation_code="playlist_create",
            )
            if not limit_check.allowed:
                response_content = format_response(
                    success=False,
                    error=limit_check.message or "Operation not permitted",
                    reason=limit_check.reason,
                )
                return JSONResponse(
                    status_code=limit_check.status_code,
                    content=response_content,
                )
        else:
            logger.info("SIMILARITY BY ID: Skipping limit check for anonymous user")

        track = await self.playlist_service.track_repository.async_get_by_uuid(
            db, track_id, partner_id=partner_id
        )
        track_int_id = track.id if track else None

        # Validate track_id
        if not track_id or not track_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="track_id_validation_failed",
                message="Empty track_id provided for similarity by ID",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                track_id=track_int_id,
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="Track ID validation for similarity by ID",
                metadata={
                    "error": "track_id cannot be empty",
                    "provided_track_id": track_id,
                    "validation_step": "track_id_check",
                },
                operation="similarity_by_id",
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False, error="track_id cannot be empty"
                ),
            )
        try:
            # Get file path from MariaDB using track UUID
            server_track_path = await self.similarity_service.track_repository.async_get_track_path_by_uuid(
                db, track_id, partner_id=partner_id
            )
            duration_ms = (time.time() - start_time) * 1000
            if server_track_path is None:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="track_not_found",
                    message=f"Track not found or path missing for similarity by ID: {track_id}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    track_id=track_int_id,
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    duration_ms=duration_ms,
                    context="Track lookup for similarity by ID",
                    metadata={
                        "error": "track_not_found",
                        "requested_track_id": track_id,
                        "lookup_step": "track_path_retrieval",
                    },
                    operation="similarity_by_id",
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=f"Track with ID '{track_id}' not found or path is missing",
                    ),
                )

            # Validate and get the TOP_SK value using settings
            validated_top_sk = settings.validate_and_get_top_sk(top_sk)
            actual_top_k = settings.calculate_actual_top_k(validated_top_sk)
            duplication_threshold = settings.get_duplication_threshold_for_top_sk(
                validated_top_sk
            )

            # Extract user_id if user is logged in
            user_id = current_user.id if current_user else None

            # Call similarity service with the file path
            similarity_results = await self.similarity_service.get_similarity_by_path(
                db=db,
                server_track_path=server_track_path,
                queried_track_uuid=track_id,
                top_k=actual_top_k,
                similarity_duplication_threshold=duplication_threshold,
                user_id=user_id,
                engine=engine,
                partner_id=partner_id,
            )
            duration_ms = (time.time() - start_time) * 1000
            # Check if similarity processing failed
            if similarity_results.get("success") is False:
                # Extract track_id from database lookup if available
                if track_int_id is None:
                    try:
                        track_int_id = int(track_id) if track_id.isdigit() else None
                    except Exception:
                        track_int_id = None

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="similarity_processing_failed",
                    message="Similarity processing failed for track by ID",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    track_id=track_int_id,
                    status_code=503,
                    duration_ms=duration_ms,
                    context="Similarity processing by track ID",
                    metadata={
                        "error": similarity_results.get("error"),
                        "requested_track_id": track_id,
                        "server_track_path": server_track_path,
                        "processing_step": "similarity_analysis",
                    },
                    operation="similarity_by_id",
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=format_response(
                        success=False,
                        error=similarity_results.get(
                            "error", "Similarity processing failed"
                        ),
                    ),
                )

            # Log success once result is ready
            # Extract track_id from database lookup if available
            if track_int_id is None:
                try:
                    track_int_id = int(track_id) if track_id.isdigit() else None
                except Exception:
                    track_int_id = None

            # Safely get playlist ID
            playlist_data = similarity_results.get("playlist")
            generated_playlist_uuid = playlist_data.get("id") if playlist_data else None
            playlist_int_id = None
            
            if generated_playlist_uuid:
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, generated_playlist_uuid
                )
                playlist_int_id = playlist.id if playlist else None

            # Guest success: record the monthly playlist use and tag the playlist with the
            # visitor_id so it can be reparented to the user on login (and counted).
            if is_frontend and current_user is None and generated_playlist_uuid and gate_visitor_id:
                await self.entitlement_gate.record_use(
                    db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, visitor_id=gate_visitor_id
                )
                try:
                    from sqlalchemy import text as _sql_text
                    await db.execute(
                        _sql_text(
                            "UPDATE playlists SET guest_visitor_id = :vid "
                            "WHERE uuid = :u AND user_id IS NULL AND partner_id = :pid"
                        ),
                        {"vid": gate_visitor_id, "u": generated_playlist_uuid, "pid": partner_id},
                    )
                    await db.commit()
                except Exception as _tag_exc:
                    logger.warning(f"Guest playlist tag failed for {generated_playlist_uuid}: {_tag_exc}")

            duration_ms = (time.time() - start_time) * 1000
            await self._apply_frontend_unlock_redaction(
                db, similarity_results, request=request, current_user=current_user, partner_id=partner_id
            )
            response_content = format_response(success=True, data=similarity_results)
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="SIMILARITY",
                action="by_id_success",
                message=f"Similarity by ID processing completed successfully for track {track_id}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                track_id=track_int_id,
                playlist_id=playlist_int_id,
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=200,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                context="Successful similarity processing by track ID",
                metadata={
                    "similarity_results": similarity_results,
                    "requested_track_id": track_id,
                    "server_track_path": server_track_path,
                    "processing_steps": ["track_lookup", "similarity_analysis"],
                    "response": response_content,
                },
                operation="similarity_by_id",
            )

            return JSONResponse(
                status_code=status.HTTP_200_OK, content=response_content
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            # Extract track_id from database lookup if available
            if track_int_id is None:
                try:
                    track_int_id = int(track_id) if track_id.isdigit() else None
                except Exception:
                    track_int_id = None

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="SIMILARITY",
                action="by_id_exception",
                message="Unexpected error during similarity by ID processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                track_id=track_int_id,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Similarity by ID processing",
                metadata={
                    "error": "An internal server error occurred while processing similarity by ID",
                    "exception_type": type(e).__name__,
                    "requested_track_id": track_id,
                },
                operation="similarity_by_id",
            )
            print(e)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing similarity by ID",
                ),
            )
