"""
Playlist Export Controller
==========================

The gate for downloading a playlist. Pricing v2.1, phase C2.

WHY A NEW ENDPOINT
------------------
TXT export was a browser-side ``Blob``. The server was never asked, so ``exports_per_day`` had
nothing to count and ``export_track_limit`` was advice the client could ignore. This endpoint is the
prerequisite for both — not a refactor.

ORDER OF OPERATIONS (each step is deliberate)
---------------------------------------------
1. **Validate the target.** An unknown target is a client bug, not a plan denial — 422, and it must
   not look like an upsell.
2. **Check the plan** (``can_export`` + ``export_targets``). Cheap, needs no playlist, and a caller
   who cannot export at all should not have their playlist loaded.
3. **Load the playlist.** Before consuming, so a 404 never costs a credit.
4. **Consume the credit** (``exports_per_day``). Atomic ``try_consume``, not peek-then-record: two
   parallel clicks on a 1/day allowance must not both pass.
5. **Build the file**, refunding if anything after the consume fails.

The subject is only ever a logged-in user. Guests are denied at step 2 (``can_export`` is false for
the guest plan) and get ``login_required``, which is the login wall the spec asks for — so no guest
visitor_id is threaded through here and no guest counter is created.

Version: 1.0.0
Init Date: August 5, 2026
"""

from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entitlement_keys import FeatureKey
from app.models.user import User
from app.services import playlist_export_service as export_service
from app.services.entitlement_gate import EntitlementGate
from app.services.playlist_service import PlaylistService
from app.utils.quota_response import (
    EXPORT_LIMIT_REACHED,
    LOGIN_REQUIRED,
    PLAN_REQUIRED,
    quota_denied_response,
)
from app.utils.response_utils import format_response

# Copy lives here rather than in the frontend so a plan change cannot leave a stale sentence in a
# built bundle. §6.2 of the spec fixes the wording.
_MSG_LOGIN = "Create a free account to export this playlist."
_MSG_PLAN = "Exporting to {target} is not available on your plan."
_MSG_LIMIT = "You've used today's export. Pro exports as often as you like."


class PlaylistExportController:
    def __init__(self) -> None:
        self.playlist_service = PlaylistService()
        self.entitlement_gate = EntitlementGate()

    async def export_playlist(
        self,
        db: AsyncSession,
        request: Request,
        playlist_uuid: str,
        target: str,
        current_user: Optional[User] = None,
        max_tracks: Optional[int] = None,
    ) -> JSONResponse:
        canonical = export_service.canonical_target(target)

        # 1. Unknown target — a client bug. 422, never an upsell: telling someone to upgrade for a
        #    format that does not exist sends them to a checkout that cannot help them.
        if canonical not in export_service.DOWNLOADABLE_TARGETS:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error=f"'{target}' is not a downloadable export format.",
                ),
            )

        # 2. Plan check. `check_export` denies a guest with `login_required` and a logged-in user on
        #    the wrong plan with `upgrade_required`; the codes differ so the frontend can show a
        #    signup wall or an upgrade modal without parsing prose.
        export_gate = await self.entitlement_gate.check_export(db, canonical, user=current_user)
        if not export_gate.allowed:
            is_guest = current_user is None
            return quota_denied_response(
                export_gate,
                code=LOGIN_REQUIRED if is_guest else PLAN_REQUIRED,
                message=_MSG_LOGIN if is_guest else _MSG_PLAN.format(target=canonical),
            )

        # 3. Load first — a 404 must not consume the day's export.
        #
        # `partner_id` is NOT optional here even though the parameter is. The tracks query filters
        # `t.partner_id = :partner_id`, so passing None compares against NULL, matches nothing, and
        # returns a playlist with zero tracks — an empty export that still spent the day's credit.
        # It is resolved from request.state exactly as the similarity endpoint does.
        partner_id = getattr(getattr(request, "state", None), "partner_id", None)
        result = await self.playlist_service.get_playlist_similarity_data(
            db,
            playlist_uuid,
            user_id=current_user.id if current_user else None,
            partner_id=partner_id,
        )
        if not result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error=result.get("error", "Playlist not found")),
            )

        # 4. Consume. Atomic against the allowance — `peek` then `record` would let two concurrent
        #    requests both pass a limit of 1.
        quota = await self.entitlement_gate.try_consume(
            db, FeatureKey.EXPORTS_PER_DAY, user=current_user
        )
        if not quota.allowed:
            return quota_denied_response(quota, code=EXPORT_LIMIT_REACHED, message=_MSG_LIMIT)

        # 5. Build. Anything that fails from here on has already been charged, so refund it — the
        #    user received no file.
        try:
            track_limit = export_service.effective_track_limit(
                await self.entitlement_gate.get_cap(db, FeatureKey.EXPORT_TRACK_LIMIT, user=current_user),
                await self.entitlement_gate.get_cap(db, FeatureKey.MAX_TRACKS_PER_PLAYLIST, user=current_user),
                max_tracks,
            )
            payload = export_service.build_txt(result["data"], track_limit=track_limit)
        except Exception:
            await self.entitlement_gate.refund(db, FeatureKey.EXPORTS_PER_DAY, user=current_user)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False, error="An error occurred while preparing the export."
                ),
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=payload),
        )
