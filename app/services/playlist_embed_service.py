"""
Playlist Embed Tokens
=====================

Mint, validate and revoke the token that authorises embedding a playlist (pricing v2.1, G1).

WHY THIS EXISTS
---------------
``apps/embed/src/api.ts`` fetched a playlist by UUID from the general public route with "no auth, no
API key, no cookies". Embedding is sold as a Pro feature, but the gate was on the **button**, not on
the data — anyone could put someone else's public playlist UUID into an embed URL and render it.

WHAT THE TOKEN IS, AND IS NOT
-----------------------------
It is **not** an authentication credential and it does not grant access to anything private. It
records that *the owner authorised this playlist to be embedded*. The playlist must still be public
to be served, so the token can never widen access beyond what the owner already published:

    is_public → who may see it.       token → whether it may be embedded.

Two independent conditions. Keeping them separate is what makes the feature safe to reason about:
revoking a token withdraws an embed without unpublishing anything, and making a playlist private
kills every embed of it regardless of tokens.

Version: 1.0.0
Init Date: August 6, 2026
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.playlist import PlaylistEmbedToken

TOKEN_LENGTH = 16

# Deliberately excludes look-alikes (0/O, 1/l/I). These tokens end up in HTML snippets that people
# copy, paste, and occasionally retype from a screenshot; an ambiguous character turns a working
# embed into a silent 404 nobody can debug.
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def generate_token() -> str:
    """A 16-character token from a 31-symbol alphabet — ~79 bits.

    ``secrets``, not ``random``: this is guessed-at from the open internet, and the default RNG is
    seeded predictably enough to enumerate.
    """
    return "".join(secrets.choice(_ALPHABET) for _ in range(TOKEN_LENGTH))


class PlaylistEmbedService:
    async def get_active_token(
        self, db: AsyncSession, playlist_id: int
    ) -> Optional[PlaylistEmbedToken]:
        return (
            await db.execute(
                select(PlaylistEmbedToken).where(
                    PlaylistEmbedToken.playlist_id == playlist_id,
                    PlaylistEmbedToken.revoked_at.is_(None),
                )
            )
        ).scalars().first()

    async def mint(self, db: AsyncSession, playlist_id: int, user_id: int) -> PlaylistEmbedToken:
        """Return this playlist's active token, creating one only if it has none.

        **Idempotent on purpose.** Re-opening the Embed modal must not invalidate a snippet already
        pasted into a live page — minting a fresh token every time would silently break every embed
        the owner had published. Withdrawing an embed is an explicit ``revoke``.
        """
        existing = await self.get_active_token(db, playlist_id)
        if existing is not None:
            return existing

        row = PlaylistEmbedToken(
            playlist_id=playlist_id, token=generate_token(), created_by=user_id
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row

    async def revoke(self, db: AsyncSession, playlist_id: int) -> bool:
        """Withdraw the active embed. Returns False when there was nothing to withdraw."""
        row = await self.get_active_token(db, playlist_id)
        if row is None:
            return False
        row.revoked_at = datetime.utcnow()
        await db.commit()
        return True

    async def resolve_playlist_id(self, db: AsyncSession, token: str) -> Optional[int]:
        """The playlist a token authorises, or ``None``.

        Deliberately returns only the id: the caller re-loads the playlist through the normal
        access-checked path, so a valid token can never be a shortcut around the public/private
        rule.
        """
        if not token or len(token) != TOKEN_LENGTH:
            # Cheap shape check — avoids a database round-trip for the noise that arrives on any
            # public endpoint.
            return None
        row = (
            await db.execute(
                select(PlaylistEmbedToken).where(
                    PlaylistEmbedToken.token == token,
                    PlaylistEmbedToken.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        return row.playlist_id if row else None
