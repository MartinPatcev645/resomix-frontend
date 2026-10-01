"""
Consumer analysis endpoints (Phase C2)
======================================

  * GET  /analysis/{id}         — single-value summary (owner-or-public gate).
  * POST /analysis/{id}/token   (retired, always 410).

Exercises the actual endpoints in-process (ASGITransport) with real DB rows + JWTs, like the
other consumer-endpoint tests.
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.context import admin_context
from app.services.operation_limit_evaluator import OperationLimitResult
from app.services.track_analysis_result_service import TrackAnalysisResultService
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


async def test_status_upstream_404_maps_to_expired_not_502() -> None:
    """An analysis the service has evicted (upstream 404) must surface as 404 "expired", not a 502 —
    502 is reserved for a genuine upstream fault (regression: stale library links used to 502)."""
    from app.api.routers.analysis import controller
    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)
    # Analysis service reports the id gone (its transient store evicted it).
    controller.analysis_client.get_status = AsyncMock(
        return_value={"status": "error", "message": "No analysis with id.", "status_code": 404}
    )
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{aid}/status", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 404, res.text
    assert res.json().get("reason") == "expired"


async def test_status_upstream_fault_still_502() -> None:
    """A real upstream fault (connection error / 5xx) still maps to 502."""
    from app.api.routers.analysis import controller
    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)
    controller.analysis_client.get_status = AsyncMock(
        return_value={"status": "error", "message": "Could not connect to analysis service."}
    )
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{aid}/status", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 502, res.text
    assert res.json().get("reason") == "upstream_error"


# --- token mint ------------------------------------------------------------- #
async def _make_pro(user) -> None:
    """Put `user` on the Pro plan.

    Used to show that even a paying owner gets no retrieval token now that the path is retired.
    """
    from sqlalchemy import select

    from app.core.entitlement_keys import PlanCode
    from app.models.plan import Plan
    from app.models.user import User as UserModel

    token = admin_context.set(True)
    try:
        async with AsyncSessionLocal() as db:
            plan = (await db.execute(select(Plan).where(Plan.code == PlanCode.PRO))).scalar_one()
            row = await db.get(UserModel, user.id)
            row.plan_id = plan.id
            await db.commit()
    finally:
        admin_context.reset(token)


async def test_mint_token_is_retired_even_for_a_pro_owner() -> None:
    """The token bought the analysis service's raw cache, skipping the projection and the public
    view. Retired: every caller gets 410 and no token."""
    user = await create_user()
    await _make_pro(user)
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)
    async with await _client() as ac:
        res = await ac.post(f"/api/v1/analysis/{aid}/token", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 410, res.text
    assert res.json().get("reason") == "retired"
    assert "token" not in (res.json().get("data") or {})


# --- upload front-door + poll proxy ----------------------------------------- #
_FILE = {"file": ("track.mp3", b"fake-audio-bytes", "audio/mpeg")}


async def test_upload_guest_denied() -> None:
    """Guests can't upload for analysis (login-only, can_similarity_upload=False)."""
    async with await _client() as ac:
        res = await ac.post(
            "/api/v1/analysis/upload",
            files=_FILE,
            headers={"X-API-KEY": settings.api_key, "X-Device-Hash": "dev-" + uuid.uuid4().hex},
        )
    assert res.status_code == 403, res.text
    assert res.json().get("reason") == "login_required"


async def test_upload_over_limit_denied(monkeypatch) -> None:
    from app.api.routers.analysis import controller

    user = await create_user()
    monkeypatch.setattr(
        controller.operation_limit_evaluator, "check",
        AsyncMock(return_value=OperationLimitResult(
            allowed=False, status_code=403, message="You've used all your uploads this month.",
            reason="upgrade_required",
        )),
    )
    async with await _client() as ac:
        res = await ac.post("/api/v1/analysis/upload", files=_FILE, headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 403, res.text
    assert res.json().get("reason") == "upgrade_required"


async def test_upload_happy_path_returns_id_and_writes_pending_row(monkeypatch) -> None:
    from app.api.routers.analysis import controller

    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)

    # Isolate the orchestration from AV / metadata extraction / the external analysis service.
    monkeypatch.setattr(controller.antivirus_service, "scan_bytes", lambda *a, **k: {"success": True, "clean": True})
    monkeypatch.setattr(
        controller.track_upload_service, "upload_track_to_database",
        AsyncMock(return_value={"success": True, "uuid": track.uuid, "track_id": track.id}),
    )
    monkeypatch.setattr(controller.analysis_client, "base_url", "http://analysis")  # -> is_configured
    monkeypatch.setattr(controller.analysis_client, "create_analysis", AsyncMock(return_value={"analysis_id": "svc", "status_url": "/x"}))
    monkeypatch.setattr(controller, "_enqueue_background", lambda **k: None)  # no celery

    async with await _client() as ac:
        res = await ac.post("/api/v1/analysis/upload", files=_FILE, headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    analysis_id = data["analysis_id"]
    assert len(analysis_id) == 32 and data["track_uuid"] == track.uuid

    # A pending summary row now links the analysis id to the owner (authorizes polling).
    token = admin_context.set(True)
    try:
        async with AsyncSessionLocal() as db:
            row = await TrackAnalysisResultService().get_by_analysis_uuid(db, analysis_id)
            assert row is not None and row.user_id == user.id and row.track_id == track.id
            assert row.bpm is None  # pending: summary not filled until completion
    finally:
        admin_context.reset(token)


async def test_upload_service_unavailable_when_unconfigured(monkeypatch) -> None:
    from app.api.routers.analysis import controller

    user = await create_user()
    monkeypatch.setattr(controller.antivirus_service, "scan_bytes", lambda *a, **k: {"success": True, "clean": True})
    monkeypatch.setattr(controller.analysis_client, "base_url", None)  # -> not configured
    async with await _client() as ac:
        res = await ac.post("/api/v1/analysis/upload", files=_FILE, headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 503, res.text
    assert res.json().get("reason") == "service_unavailable"


async def test_status_and_result_proxy_owner_ok(monkeypatch) -> None:
    from app.api.routers.analysis import controller

    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    aid = await _seed_analysis(user_id=user.id, track_id=track.id)

    monkeypatch.setattr(controller.analysis_client, "base_url", "http://analysis")
    monkeypatch.setattr(controller.analysis_client, "get_status", AsyncMock(return_value={"state": "running", "part1_ready": False, "progress": {"percent": 40}}))
    monkeypatch.setattr(controller.analysis_client, "get_result", AsyncMock(return_value={"analysis_id": aid, "rhythm": {"bpm": 120}}))

    async with await _client() as ac:
        st = await ac.get(f"/api/v1/analysis/{aid}/status", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
        rs = await ac.get(f"/api/v1/analysis/{aid}/result", headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert st.status_code == 200 and st.json()["data"]["state"] == "running"
    assert rs.status_code == 200 and rs.json()["data"]["rhythm"]["bpm"] == 120


async def test_status_proxy_forbidden_for_other_user(monkeypatch) -> None:
    from app.api.routers.analysis import controller

    owner = await create_user()
    other = await create_user()
    track = await create_track(user_id=owner.id, partner_id=1)
    aid = await _seed_analysis(user_id=owner.id, track_id=track.id)
    monkeypatch.setattr(controller.analysis_client, "base_url", "http://analysis")
    monkeypatch.setattr(controller.analysis_client, "get_status", AsyncMock(return_value={"state": "running"}))
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/analysis/{aid}/status", headers={**auth_headers(other), "X-API-KEY": settings.api_key})
    assert res.status_code == 403, res.text
