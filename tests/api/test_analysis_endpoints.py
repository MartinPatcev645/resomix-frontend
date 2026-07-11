"""
Consumer analysis endpoints (Phase C2)
======================================

  * GET  /analysis/{id}         — single-value summary (owner-or-public gate).
  * POST /analysis/{id}/token   — mint the tokenized retrieval boarding pass (owner-or-public).

Exercises the actual endpoints in-process (ASGITransport) with real DB rows + JWTs, like the
other consumer-endpoint tests.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.context import admin_context
from app.services.track_analysis_result_service import TrackAnalysisResultService
from app.utils.edge_auth import decode_edge_token
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_track, create_user


async def _client() -> AsyncClient:
    from app.main import app

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_analysis(*, user_id: int, track_id: int, is_public: bool = False) -> str:
    """Insert a summary row under admin context (reset after, so it never leaks into requests)."""
    analysis_uuid = uuid.uuid4().hex
    canonical = {
        "rhythm": {"bpm": 120.0},
        "tonality": {"key": "A", "camelot": "8A"},
        "semantics": {"genre_top": [{"label": "House", "score": 1.0}]},
    }
    token = admin_context.set(True)
    try:
        async with AsyncSessionLocal() as db:
            row = await TrackAnalysisResultService().record_from_canonical(
                db, analysis_uuid=analysis_uuid, result=canonical,
                track_id=track_id, user_id=user_id, partner_id=1,
            )
            if is_public:
                row.is_public = True
                db.add(row)
                await db.commit()
    finally:
        admin_context.reset(token)
    return analysis_uuid


# --- summary read ----------------------------------------------------------- #
async def test_get_summary_owner_ok() -> None:
    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{aid}", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["top_genre"] == "House" and data["key"] == "A" and data["bpm"] == 120.0


async def test_get_summary_forbidden_for_other_user() -> None:
    owner = await create_user()
    other = await create_user()
    track = await create_track(user_id=owner.id, partner_id=1)
    aid = await _seed_analysis(user_id=owner.id, track_id=track.id)
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{aid}", headers={**auth_headers(other), "X-API-KEY": settings.api_key})
    assert res.status_code == 403, res.text


async def test_get_summary_public_readable_by_guest() -> None:
    owner = await create_user()
    track = await create_track(user_id=owner.id, partner_id=1)
    aid = await _seed_analysis(user_id=owner.id, track_id=track.id, is_public=True)
    async with await _client() as ac:
        res = await ac.get(
            f"/api/v1/analysis/{aid}",
            headers={"X-API-KEY": settings.api_key, "X-Device-Hash": "dev-" + uuid.uuid4().hex},
        )
    assert res.status_code == 200, res.text


async def test_get_summary_404() -> None:
    user = await create_user()
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{uuid.uuid4().hex}", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 404, res.text


# --- token mint ------------------------------------------------------------- #
async def test_mint_token_owner_ok() -> None:
    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)
    async with await _client() as ac:
        res = await ac.post(f"/api/v1/analysis/{aid}/token", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["scope"] == "analysis"
    assert data["retrieval_path"] == f"/analysis/{aid}"
    assert data["expires_in"] > 0
    # The token embeds THIS analysis id (the Hetzner replay guard).
    claims = decode_edge_token(data["token"])
    assert claims.get("analysis") == aid and claims.get("scope") == "analysis"


async def test_mint_token_forbidden_for_other_user() -> None:
    owner = await create_user()
    other = await create_user()
    track = await create_track(user_id=owner.id, partner_id=1)
    aid = await _seed_analysis(user_id=owner.id, track_id=track.id)
    async with await _client() as ac:
        res = await ac.post(f"/api/v1/analysis/{aid}/token", headers={**auth_headers(other), "X-API-KEY": settings.api_key})
    assert res.status_code == 403, res.text
