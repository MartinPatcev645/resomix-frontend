"""
Playlist Embed Controller
=========================

Mint / revoke an embed token, and serve a playlist to the embed widget. Pricing v2.1, G1.

THE THREE ENDPOINTS AND WHY THEY DIFFER
---------------------------------------
* ``POST   /playlists/{uuid}/embed-token`` — owner + Pro. Mints (or returns) the token.
* ``DELETE /playlists/{uuid}/embed-token`` — owner. Withdraws a live embed.
* ``GET    /playlists/embed/{uuid}?t=``    — public, token-checked. **A dedicated route**, not the
  general public-playlist one: reusing that route would mean any change to its access rules
  silently changes who can embed, which is exactly the coupling that produced this bug.

EVERY FAILURE ON THE PUBLIC ROUTE IS A 404
------------------------------------------
Wrong token, revoked token, playlist made private, playlist deleted — all 404, all with the same
body. Distinguishing them would confirm which UUIDs exist and which tokens are merely stale, which
is a free enumeration oracle on an endpoint with no authentication and no rate limit tied to a user.

Version: 1.0.0
Init Date: August 6, 2026
"""

from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.entitlement_gate import EntitlementGate
from app.services.playlist_embed_service import PlaylistEmbedService
from app.services.playlist_service import PlaylistService
from app.utils.quota_response import plan_required_response
from app.utils.response_utils import format_response

_NOT_FOUND = "This embed is no longer available."


class PlaylistEmbedController:
    def __init__(self) -> None:
        self.playlist_service = PlaylistService()
        self.embed_service = PlaylistEmbedService()
        self.entitlement_gate = EntitlementGate()

    # ------------------------------------------------------------------ owner side
    async def mint_token(
        self, db: AsyncSession, playlist_uuid: str, current_user: User
    ) -> JSONResponse:
        """Mint (or return) the embed token for a playlist the caller owns."""
        gate = await self.entitlement_gate.check_export(db, "embed", user=current_user)
        if not gate.allowed:
            return plan_required_response(
                gate,
                message="Embed sharing is a Pro feature. Upgrade to embed playlists anywhere.",
            )

        playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
            db, playlist_uuid
        )
        # Ownership, not just existence. Minting a token for someone else's playlist would recreate
        # the exact hole this endpoint closes, only with a token attached.
        if playlist is None or playlist.user_id != current_user.id:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Playlist not found."),
            )

        row = await self.embed_service.mint(db, playlist.id, current_user.id)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={
                    "token": row.token,
                    "playlist_uuid": playlist_uuid,
                    # The widget will not render a private playlist, so tell the caller now rather
                    # than letting them paste a snippet that shows nothing.
                    "is_public": bool(playlist.is_public),
                },
            ),
        )

    async def revoke_token(
        self, db: AsyncSession, playlist_uuid: str, current_user: User
    ) -> JSONResponse:
        playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
            db, playlist_uuid
        )
        if playlist is None or playlist.user_id != current_user.id:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Playlist not found."),
            )

        revoked = await self.embed_service.revoke(db, playlist.id)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={"revoked": revoked},
                message=(
                    "Embed withdrawn. Existing copies of the snippet will stop working."
                    if revoked
                    else "There was no active embed for this playlist."
                ),
            ),
        )

    # ------------------------------------------------------------------ public side
    async def get_embedded_playlist(
        self, db: AsyncSession, request: Request, playlist_uuid: str, token: Optional[str]
    ) -> JSONResponse:
        """Serve a playlist to the embed widget, only on a valid (uuid, token) pair."""
        playlist_id = await self.embed_service.resolve_playlist_id(db, token or "")
        if playlist_id is None:
            return self._gone()

        playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
            db, playlist_uuid
        )
        # The token must belong to THIS playlist. Without this check any valid token would unlock
        # any uuid — the same bug, one indirection later.
        if playlist is None or playlist.id != playlist_id:
            return self._gone()

        # The token authorises embedding; it does not publish anything. A playlist turned private
        # after its snippet was pasted stops rendering, which is what the owner just asked for.
        if not playlist.is_public:
            return self._gone()

        partner_id = getattr(getattr(request, "state", None), "partner_id", None)
        result = await self.playlist_service.get_playlist_similarity_data(
            db, playlist_uuid, user_id=None, partner_id=partner_id
        )
        if not result.get("success"):
            return self._gone()

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=result["data"]),
        )

    @staticmethod
    def _gone() -> JSONResponse:
        """One response for every failure — see the module docstring."""
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=format_response(success=False, error=_NOT_FOUND),
        )
