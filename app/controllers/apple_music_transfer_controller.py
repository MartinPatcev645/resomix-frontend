"""
Apple Music Transfer Controller
================================

This controller handles HTTP requests for Apple Music playlist transfer functionality.
It processes transfer requests, validates input data, and coordinates with the
Apple Music transfer service for business logic execution.

Manages Apple Music-related API endpoints and provides proper validation,
error handling, and response formatting.

Version: 3.0.1
Init Date: December 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import time

from typing import Optional

from app.services.apple_music_transfer_service import AppleMusicTransferService
from app.services.logging_service import LoggingService
from app.services.playlist_service import PlaylistService
from app.services.entitlement_gate import EntitlementGate
from app.core.entitlement_keys import FeatureKey
from app.models.user import User
from app.utils.quota_response import EXPORT_LIMIT_REACHED, quota_denied_response
from app.utils.response_utils import format_response

# Set up logger for controller
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────────────────────
# GOOD-TO-KNOWS — Apple Music export gating (read before touching this / wiring Apple export)
# ─────────────────────────────────────────────────────────────────────────────────────────────
# * Apple export is a PLAN feature. It is gated on the `export_targets` entitlement (a CSV like
#   "txt,apple,spotify"). A plan may transfer to Apple Music only if "apple" is in its
#   export_targets. Under pricing v2.1 free gains Apple export ("txt,apple"); pro is
#   "txt,apple,spotify,embed". Admin-editable, so treat those as today's values, not constants.
# * "apple" and "apple_music" are the SAME target — `check_export` canonicalises both sides. The
#   pricing spec writes apple_music; production and the frontend use apple. Neither had to move.
# * The gate is `EntitlementGate.check_export(db, "apple", user=current_user)` — identical to the
#   Spotify controller. It runs BEFORE any Apple API call.
# * SECOND gate (pricing v2.1 C2): `exports_per_day`. Peeked before the transfer and recorded after
#   it succeeds, so a failed transfer never spends a free user's one export for the day.
# * AUTH UPLIFT (done): this endpoint now REQUIRES `get_current_user` (was api-key-only). A logged-in
#   user is needed to resolve which plan to gate on. The frontend must send the JWT.
# * Tokens: the Apple *developer* token is backend-generated (get_or_create_dev_token); the
#   *music_user_token* comes from the frontend (MusicKit.authorize()). Gating is orthogonal to both.
# * FRONTEND (when the Apple export button is built): show/enable it only when the caller's
#   `export_targets` (from `useEntitlements`) contains "apple"; otherwise show an upgrade CTA.
# * TIDAL is intentionally NOT gated yet (still api-key-only). When Tidal export is activated, do the
#   same auth uplift + `check_export(db, "tidal", user=…)` here's Apple pattern.
# ─────────────────────────────────────────────────────────────────────────────────────────────


class AppleMusicTransferController:
    """Controller for handling Apple Music playlist transfer requests"""

    def __init__(self):
        """Initialize the Apple Music transfer controller"""
        self.apple_music_service = AppleMusicTransferService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
        self.entitlement_gate = EntitlementGate()
        logger.info("AppleMusicTransferController initialized")

    async def get_developer_token(self) -> JSONResponse:
        """
        Get or generate Apple Music developer token

        Returns:
            JSONResponse with token and expiration
        """
        try:
            token, exp_ms = self.apple_music_service.get_or_create_dev_token()
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"token": token, "expires_at": exp_ms},
            )
        except Exception as e:
            logger.error("Failed to generate developer token: %s", str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while generating developer token",
                ),
            )

    async def transfer_playlist_to_apple_music(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        music_user_token: str,
        custom_playlist_name: str = None,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
        """
        Handle playlist transfer to Apple Music request

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Resomix playlist UUID
            music_user_token: Apple Music User Token
            custom_playlist_name: Optional custom name for Apple Music playlist

        Returns:
            JSONResponse with transfer results
        """
        logger.info(
            "Processing Apple Music transfer request for playlist: %s", playlist_id
        )
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Export gate: only plans whose export_targets include "apple" may transfer to Apple Music
        # (see the GOOD-TO-KNOWS block at the top of this file). Runs before any Apple API call.
        export_gate = await self.entitlement_gate.check_export(db, "apple", user=current_user)
        if not export_gate.allowed:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content=format_response(
                    success=False,
                    error="Exporting to Apple Music is not available on your plan.",
                    reason=export_gate.reason,
                ),
            )

        # Daily export allowance (pricing v2.1 C2). Every export counts, whichever target it uses —
        # a free account gets one per day whether that is a TXT download or an Apple transfer.
        #
        # PEEK now, RECORD on success — not `try_consume`. A transfer is long and fails routinely
        # (expired Music User Token, Apple API outage) and there are three separate exits below.
        # Consuming up front would mean charging someone's single daily export for a transfer that
        # never happened, and a refund on every failure path leaves a window where a crash keeps the
        # charge. Record-on-success has no such window — the same reasoning as the upload credit.
        quota_gate = await self.entitlement_gate.peek_allowed(
            db, FeatureKey.EXPORTS_PER_DAY, user=current_user
        )
        if not quota_gate.allowed:
            return quota_denied_response(
                quota_gate,
                code=EXPORT_LIMIT_REACHED,
                message="You've used today's export. Pro exports as often as you like.",
            )

        # Resolve playlist int ID early for logging
        playlist_obj = (
            await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                db, playlist_id
            )
        )
        playlist_int_id = playlist_obj.id if playlist_obj else None

        # Initial start log
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="TRANSFER",
            action="playlist_transfer_start",
            message="Starting playlist transfer to Apple Music",
            correlation_id=correlation_id,
            request=request,
            method=request.method,
            endpoint=str(request.url.path),
            path=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
            duration_ms=(time.time() - start_time) * 1000,
            playlist_id=playlist_int_id,
            context="Apple Music playlist transfer initiation",
            metadata={
                "playlist_uuid": playlist_id,
                "custom_name": custom_playlist_name,
            },
            platform="APPLE_MUSIC",
            operation="playlist_transfer",
            transfer_status="start",
        )

        try:
            # Call the service to perform the transfer. music_user_token may be None — the service
            # then uses the user's saved connection (resolved by user_id).
            result = await self.apple_music_service.transfer_playlist_to_apple_music(
                db=db,
                playlist_id=playlist_id,
                music_user_token=music_user_token,
                custom_playlist_name=custom_playlist_name,
                user_id=current_user.id if current_user else None,
            )

            # The transfer landed — charge the export now (see the peek above). Best-effort by
            # design: a counter write must never turn a completed transfer into an error response.
            if current_user:
                await self.entitlement_gate.record_use(
                    db, FeatureKey.EXPORTS_PER_DAY, user=current_user
                )

            # Report what LANDED, not what matched.
            #
            # `matched` is how many Apple catalogue ids we resolved; `tracks_added` is how many
            # Apple accepted; `verified_tracks` is how many it confirms it holds. The old message
            # quoted `matched` alone, so an export where every add failed still read "Successfully
            # transferred — 40 tracks matched". Those three numbers can legitimately differ, and
            # the one the user cares about is the last.
            added = result.get("tracks_added", 0)
            verified = result.get("verified_tracks")
            landed = verified if verified is not None else added

            if landed == 0:
                # The playlist exists but is empty. Saying "successfully transferred" here is what
                # made a broken export look fine — and is why nobody knew to investigate.
                success_message = (
                    "The playlist was created in Apple Music but no tracks could be added. "
                    f"{result['unmatched']} of {result['total_tracks']} tracks were not found in "
                    "Apple's catalogue for your region."
                )
            else:
                success_message = (
                    f"Transferred {landed} of {result['total_tracks']} tracks to Apple Music."
                )
                if result.get("unmatched"):
                    success_message += f" {result['unmatched']} not found in Apple's catalogue."
                if verified is not None and verified < added:
                    # Apple accepted more than it kept — worth saying rather than quietly rounding
                    # down, because it usually means a storefront mismatch.
                    success_message += (
                        f" ({added} were accepted but Apple kept {verified}.)"
                    )

            result["message"] = success_message

            # Log success with comprehensive details
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=True, data=result)

            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="TRANSFER",
                action="playlist_transfer_success",
                message="Apple Music playlist transferred successfully",
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
                context="Apple Music playlist transfer completion",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "total_tracks": result.get("total_tracks", 0),
                    "matched": result.get("matched", 0),
                    "unmatched": result.get("unmatched", 0),
                    "created_playlist_id": result.get("created_playlist_id"),
                    "created_playlist_name": result.get("created_playlist_name"),
                    "transfer_time_seconds": result.get("transfer_time_seconds", 0),
                    "success_message": success_message,
                    "response": response_content,
                },
                platform="APPLE_MUSIC",
                operation="playlist_transfer",
                transfer_status="success",
                transfer_details=result,
            )

            logger.info(
                "Transfer completed: %d/%d tracks added in %.1fs",
                result["tracks_added"],
                result["total_tracks"],
                result.get("transfer_time_seconds", 0),
            )

            return JSONResponse(
                status_code=status.HTTP_200_OK, content=response_content
            )

        except ValueError as e:
            # Handle validation errors (playlist not found, no tracks, etc.)
            error_message = str(e)
            logger.warning("Validation error: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000

            # Determine status code
            is_not_found = "not found" in error_message.lower()
            error_status_code = (
                status.HTTP_404_NOT_FOUND
                if is_not_found
                else status.HTTP_422_UNPROCESSABLE_ENTITY
            )
            error_response = format_response(success=False, error=error_message)

            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="TRANSFER",
                action="playlist_transfer_validation_error",
                message=f"Apple Music playlist transfer validation failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=error_status_code,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                context="Apple Music playlist transfer validation",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "error": error_message,
                    "error_type": "not_found" if is_not_found else "validation_error",
                    "validation_step": "playlist_validation",
                    "response": error_response,
                },
                platform="APPLE_MUSIC",
                operation="playlist_transfer",
                transfer_status="validation_error",
            )

            return JSONResponse(status_code=error_status_code, content=error_response)

        except Exception as e:
            # Handle Apple Music API errors and other exceptions
            error_message = str(e)
            logger.error("Transfer failed: %s", error_message)
            duration_ms = (time.time() - start_time) * 1000

            # Determine error type and status code
            is_auth_error = any(
                keyword in error_message.lower()
                for keyword in ["token", "auth", "unauthorized", "forbidden"]
            )

            if is_auth_error:
                error_status_code = status.HTTP_401_UNAUTHORIZED
                final_error_message = "Invalid or expired Apple Music user token"
                error_type = "authentication_error"
                # The stored token is no longer valid (expired / revoked in Apple ID) — drop the
                # saved connection so the UI prompts a fresh reconnect instead of failing again.
                if current_user:
                    try:
                        await self.apple_music_service.delete_connection(db, current_user.id)
                    except Exception:  # noqa: BLE001 — best-effort cleanup
                        pass
            else:
                error_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                final_error_message = (
                    "An internal error occurred during playlist transfer"
                )
                error_type = "server_error"

            error_response = format_response(success=False, error=final_error_message)

            import traceback

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="TRANSFER",
                action="playlist_transfer_exception",
                message="Unexpected error during Apple Music playlist transfer",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=error_status_code,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Apple Music playlist transfer processing",
                metadata={
                    "playlist_uuid": playlist_id,
                    "custom_name": custom_playlist_name,
                    "error": error_message,
                    "error_type": error_type,
                    "exception_type": type(e).__name__,
                    "is_auth_error": is_auth_error,
                    "response": error_response,
                },
                platform="APPLE_MUSIC",
                operation="playlist_transfer",
                transfer_status="failed",
            )

            return JSONResponse(status_code=error_status_code, content=error_response)

    # ----------------------------------------------------------------- connection (persisted link)

    async def get_connection_status(self, db: AsyncSession, current_user: User) -> JSONResponse:
        """Return whether the user has a saved Apple Music connection."""
        try:
            data = await self.apple_music_service.get_connection_status(db, current_user.id)
            return JSONResponse(status_code=status.HTTP_200_OK, content=format_response(success=True, data=data))
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to get Apple connection status: %s", str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Could not check your Apple Music connection."),
            )

    async def save_connection(self, db: AsyncSession, current_user: User, music_user_token: str) -> JSONResponse:
        """Validate + persist the user's Apple Music connection."""
        try:
            data = await self.apple_music_service.save_connection(db, current_user.id, music_user_token)
            return JSONResponse(status_code=status.HTTP_200_OK, content=format_response(success=True, data=data))
        except ValueError as e:
            # Token could not be verified with Apple.
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(success=False, error=str(e)),
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to save Apple connection: %s", str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Could not connect your Apple Music account."),
            )

    async def disconnect(self, db: AsyncSession, current_user: User) -> JSONResponse:
        """Remove the user's saved Apple Music connection."""
        try:
            await self.apple_music_service.delete_connection(db, current_user.id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data={"connected": False}),
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to disconnect Apple: %s", str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Could not disconnect your Apple Music account."),
            )
