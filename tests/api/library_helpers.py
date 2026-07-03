"""
Library Test Helpers
====================

Shared helpers for the user-library API tests (own uploaded tracks + playlist
summary). Not a test module (does not match ``test_*.py``), so pytest does not
collect it.

These helpers talk to the real database via ``AsyncSessionLocal`` and mint real
JWTs via ``create_access_token`` — the tests exercise the actual endpoints
in-process through ``httpx.ASGITransport`` against ``app.main.app``.
"""

import uuid
from contextlib import contextmanager
from typing import Optional

from sqlalchemy import select

from app.core.context import admin_context
from app.core.security import create_access_token, hash_password
from app.models.playlist import Playlist
from app.models.track import Track
from app.models.user import User
from database.connection import AsyncSessionLocal


@contextmanager
def _seed_ctx():
    """Seed partner-scoped rows (Track/Playlist) under an admin context.

    Direct ORM writes/reads on partner-scoped models trip the global multi-tenancy
    failsafe unless a partner or admin context is active. Tests seed data outside of a
    request, so we briefly enter admin context (matching the existing seeding pattern in
    ``tests/test_weekly_gate.py``) and reset it via the ContextVar token afterwards so it
    never leaks into the subsequent endpoint calls under test.
    """
    token = admin_context.set(True)
    try:
        yield
    finally:
        admin_context.reset(token)


async def create_user(*, is_active: bool = True, is_email_verified: bool = True) -> User:
    """Create and persist a standard (non-admin) user; returns the refreshed User."""
    suffix = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        user = User(
            username=f"lib_{suffix}",
            email=f"lib_{suffix}@example.com",
            password_hash=hash_password("StrongPass123!"),
            is_active=is_active,
            is_email_verified=is_email_verified,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


def auth_headers(user: User) -> dict:
    """Bearer header carrying a valid access token for ``user`` (frontend → partner 1)."""
    token = create_access_token(data={"sub": user.uuid})
    return {"Authorization": f"Bearer {token}"}


async def create_track(
    *,
    user_id: Optional[int],
    partner_id: int = 1,
    track_type: str = "upload",
    is_active: bool = True,
    title: str = "Test Upload",
    **overrides,
) -> Track:
    """Create and persist a track row; returns the refreshed Track."""
    suffix = uuid.uuid4().hex[:10]
    fields = dict(
        uuid=str(uuid.uuid4()),
        isrc=f"TEST{suffix[:8].upper()}",
        title=title,
        partner_id=partner_id,
        user_id=user_id,
        track_type=track_type,
        is_active=is_active,
        duration_ms=200000,
        bpm=128,
        musical_key="8A",
        mix_name="Original Mix",
        display_artist="Test Artist",
    )
    fields.update(overrides)
    with _seed_ctx():
        async with AsyncSessionLocal() as db:
            track = Track(**fields)
            db.add(track)
            await db.commit()
            await db.refresh(track)
            return track


async def create_playlist(
    *,
    user_id: Optional[int],
    seed_track_id: Optional[int] = None,
    partner_id: int = 1,
    name: str = "Lib Playlist",
    is_public: bool = False,
    num_tracks: int = 10,
    play_time: int = 3600,
) -> Playlist:
    """Create and persist a playlist row; returns the refreshed Playlist."""
    with _seed_ctx():
        async with AsyncSessionLocal() as db:
            playlist = Playlist(
                uuid=str(uuid.uuid4()),
                user_id=user_id,
                partner_id=partner_id,
                name=name,
                is_public=is_public,
                seed_track_id=seed_track_id,
                num_tracks=num_tracks,
                play_time=play_time,
                type="similarity",
            )
            db.add(playlist)
            await db.commit()
            await db.refresh(playlist)
            return playlist


async def get_track_is_active(track_uuid: str) -> Optional[bool]:
    """Read the raw ``is_active`` flag for a track straight from the DB."""
    with _seed_ctx():
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Track.is_active).where(Track.uuid == track_uuid)
            )
            return res.scalar_one_or_none()


async def get_playlist_state(playlist_uuid: str):
    """Read a playlist's ``(is_public, name)`` straight from the DB."""
    with _seed_ctx():
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Playlist.is_public, Playlist.name).where(
                    Playlist.uuid == playlist_uuid
                )
            )
            return res.first()
