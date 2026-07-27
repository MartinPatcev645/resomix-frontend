"""
Admin single-track detail endpoint (GET /admin/tracks/{id}).

Backs the shared Track Details modal used by both the Tracks panel and the playlist
tracks table — must return the full metadata shape (base + Apple/in-house enrichment),
and a clean 404 for a missing track.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from tests.api.library_helpers import create_admin_user, admin_auth_headers, create_user, create_track


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_track_detail_returns_full_shape():
    hdr = admin_auth_headers(await create_admin_user())
    user = await create_user()
    track = await create_track(
        user_id=user.id, title="Alone (Sax Ambient)", track_type="electrobuzz",
        display_artist="Some Artist", isrc="USABC1234567", bpm=124, musical_key="Am",
        p_line_year=2021,
    )
    async with _client() as ac:
        res = await ac.get(f"/api/v1/admin/tracks/{track.id}", headers=hdr)
    assert res.status_code == 200, res.text
    t = res.json()["track"]
    # Base + enrichment keys the shared modal renders.
    for key in (
        "id", "uuid", "title", "display_artist", "isrc", "type", "duration_seconds",
        "bpm", "musical_key", "ingestion_source", "is_active", "partner_id", "processing",
        "artists", "album", "release", "year", "genre", "label", "file_size", "audio_filename",
    ):
        assert key in t, f"missing key: {key}"
    assert t["id"] == track.id
    assert t["display_artist"] == "Some Artist"
    assert t["isrc"] == "USABC1234567"
    assert t["bpm"] == 124
    assert t["musical_key"] == "Am"
    assert t["year"] == 2021
    assert isinstance(t["artists"], list)


@pytest.mark.asyncio
async def test_track_detail_missing_returns_404():
    hdr = admin_auth_headers(await create_admin_user())
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/tracks/999999999", headers=hdr)
    assert res.status_code == 404, res.text
