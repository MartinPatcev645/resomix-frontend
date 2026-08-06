"""
Entitlement Controller (consumer-facing)
========================================

Serves the caller's *own* effective entitlements so the frontend can drive its UI from a single
call — grey dropdown options beyond ``dropdown_max_tracks``, show/hide export/rename/rate, and
render the right login/upgrade CTA. Works for both guests (visitor_id derived server-side) and
logged-in users (JWT). The server-derived ``visitor_id`` is never returned to the client.

Frontend surface only (System Partner 1). B2B partners have their own quota system and get an
``is_frontend: false`` marker with no consumer entitlements.

PRICING v2.1 (D1) — ``limits`` / ``usage`` / ``resets``
-------------------------------------------------------
Added as a **union**, not a replacement: ``plan`` and ``entitlements`` are untouched and every
existing consumer keeps working. ``limits`` is a flattened convenience view of ``entitlements`` — a
second *shape*, never a second source of truth, so it is derived on every request rather than
stored. ``usage`` and ``resets`` are genuinely new; the endpoint reported no usage at all before,
and the header chip cannot be built without it.

NULL MEANS SOMETHING SPECIFIC HERE
----------------------------------
  * ``limits.x is null``  — unlimited. The internal sentinel is ``-1``; sending that to a browser
    invites it to render "3/-1".
  * ``usage.x is null``   — not readable (no identity to count against, or Redis is down). It is
    **not** zero and it is **not** "unlimited": every plan's usage is counted, Pro included, so an
    unlimited feature reports a real number against a ``null`` limit. A plan whose consumption we
    cannot see is a plan we cannot price.

Usage here is a report, never a decision. Enforcement stays in ``EntitlementGate``, where it is
atomic; nothing may be gated on what this endpoint returns.
"""

import logging
from typing import Any, Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.models.user import User
from app.repositories.playlist_repository import PlaylistRepository
from app.services.entitlement_gate import EntitlementGate
from app.services.entitlement_service import EntitlementService
from app.services.guest_identity_service import GuestIdentityService
from app.utils.quota_response import iso_utc
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


def _cap(entitlements: Dict[str, Any], key: str) -> Optional[int]:
    """A numeric entitlement as the API reports it: ``None`` for unlimited, else the number."""
    value = entitlements.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        return None
    return None if value < 0 else value


class EntitlementController:
    def __init__(self) -> None:
        self.entitlements = EntitlementService()
        self.gate = EntitlementGate()
        self.playlist_repository = PlaylistRepository()
        self.guest_identity = GuestIdentityService()

    async def get_my_entitlements(
        self, db: AsyncSession, request: Request,
        current_user: Optional[User], partner_id: Optional[int],
    ) -> JSONResponse:
        is_frontend = partner_id == settings.system_partner_id
        if not is_frontend:
            # B2B: entitlements don't apply here.
            return JSONResponse(
                status_code=200,
                content=format_response(success=True, data={
                    "is_frontend": False, "is_guest": current_user is None,
                    "plan": None, "entitlements": {},
                }),
            )

        visitor_id = None
        if current_user is None:
            visitor_id = self.guest_identity.derive_visitor_id(request)

        plan, entitlements = await self.entitlements.get_effective_map(
            db, user=current_user, visitor_id=visitor_id
        )
        usage, resets = await self._usage_and_resets(db, current_user, visitor_id, entitlements)

        return JSONResponse(
            status_code=200,
            content=format_response(success=True, data={
                "is_frontend": True,
                "is_guest": current_user is None,
                "plan": {"code": plan.code, "name": plan.name, "is_default": plan.is_default},
                "entitlements": entitlements,
                "limits": self._limits(entitlements),
                "usage": usage,
                "resets": resets,
            }),
        )

    # ------------------------------------------------------------------ #
    # pricing v2.1 blocks
    # ------------------------------------------------------------------ #
    @staticmethod
    def _limits(entitlements: Dict[str, Any]) -> Dict[str, Optional[int]]:
        """The numbers the pricing page and the usage chip render.

        ``searches_per_day`` reads ``search_playlists_per_month`` — the key kept its name when the
        window went daily (Q3), because renaming it would have touched every gate call site and
        ``FEATURE_KEYS`` for nothing a user can see. The API name tells the truth even though the
        storage key does not.
        """
        return {
            "searches_per_day": _cap(entitlements, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH),
            "uploads_per_month": _cap(entitlements, FeatureKey.UPLOADS_PER_MONTH),
            # What the caller gets UNLOCKED in a result.
            "top_sk_max": _cap(entitlements, FeatureKey.MAX_TRACKS_PER_PLAYLIST),
            # What they may SELECT in the depth dropdown — a different number on free (50 vs 20
            # unlocked), so folding it into top_sk_max would make the chip and the dropdown disagree.
            "dropdown_max_tracks": _cap(entitlements, FeatureKey.DROPDOWN_MAX_TRACKS),
            "library_playlists_max": _cap(entitlements, FeatureKey.LIBRARY_PLAYLISTS_MAX),
            "exports_per_day": _cap(entitlements, FeatureKey.EXPORTS_PER_DAY),
            "export_track_limit": _cap(entitlements, FeatureKey.EXPORT_TRACK_LIMIT),
        }

    async def _usage_and_resets(
        self,
        db: AsyncSession,
        current_user: Optional[User],
        visitor_id: Optional[str],
        entitlements: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Current-period usage, and when each window rolls over.

        Best-effort throughout. This endpoint is what the frontend fetches to decide what to show,
        so a Redis blip must degrade the chip to "unknown" rather than take the entitlement map —
        and with it the whole UI — down. Every key is present in the response whatever happens;
        only the values go null.
        """
        usage: Dict[str, Any] = {
            "searches_used_today": None,
            "uploads_used_month": None,
            "exports_used_today": None,
            "library_playlists_used": None,
        }
        resets: Dict[str, Any] = {"search_at": None, "upload_at": None, "export_at": None}

        counted = (
            ("searches_used_today", "search_at", FeatureKey.SEARCH_PLAYLISTS_PER_MONTH),
            ("uploads_used_month", "upload_at", FeatureKey.UPLOADS_PER_MONTH),
            ("exports_used_today", "export_at", FeatureKey.EXPORTS_PER_DAY),
        )
        for used_key, reset_key, feature_key in counted:
            try:
                snapshot = await self.gate.usage_snapshot(
                    db, feature_key, user=current_user, visitor_id=visitor_id
                )
                usage[used_key] = snapshot.used
                resets[reset_key] = iso_utc(snapshot.resets_at)
            except Exception as exc:  # pragma: no cover — reporting must never break the map
                logger.warning("ENTITLEMENTS: usage snapshot failed for %s: %s", feature_key, exc)

        # The Library figure is not a Redis counter — it is how many playlists are currently
        # LISTED, so it is counted in the database, through the same helper the visibility decision
        # uses. It never resets: deleting a playlist frees a slot immediately, which is why there is
        # no `library_at` in `resets`.
        #
        # Counted for Pro too. An unlimited plan is not an unmeasured one — "how many playlists do
        # our paying users actually keep" is exactly the number the fair-use position rests on.
        if current_user is not None:
            try:
                usage["library_playlists_used"] = await self.playlist_repository.count_library_visible(
                    db, current_user.id
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("ENTITLEMENTS: library count failed: %s", exc)

        return usage, resets
