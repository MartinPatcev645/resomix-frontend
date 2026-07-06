
import pytest
import uuid
import httpx
import os
import asyncio
from database.connection import SessionLocal
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.core.context import set_admin_context
from sqlalchemy import delete, text
from app.core.config import settings
from unittest.mock import patch, MagicMock
from app.main import app

# Test constants
PARTNER_2_API_KEY = "rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
PARTNER_2_ID = 2


@pytest.fixture
async def admin_headers():
    """Admin-role JWT — the internal monthly pipeline is now admin-only (was the static super-key)."""
    from tests.api.library_helpers import create_admin_user, admin_auth_headers
    return admin_auth_headers(await create_admin_user())

# EICAR test string
EICAR_STRING = r"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

@pytest.fixture(scope="session")
async def client():
    """Session-scoped AsyncClient to prevent event loop conflicts."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture(autouse=True)
def cleanup_tracks():
    """Cleanup any tracks created during tests."""
    yield
    set_admin_context(True)
    session = SessionLocal()
    try:
        session.execute(delete(AudioFile).where(AudioFile.stored_path.like("%/test_pipeline/%")))
        session.execute(text("DELETE FROM tracks WHERE title LIKE '%Pipeline Test%'"))
        session.commit()
    except:
        session.rollback()
    finally:
        session.close()
    set_admin_context(False)

@pytest.fixture
def mock_pipeline_services():
    """Mock the entire service layer to decouple from similarity microservice and SCP."""
    patch_monthly_preview = patch("app.services.monthly_pipeline_service.MonthlyPipelineService.generate_embedding_preview")
    patch_monthly_bulk = patch("app.services.monthly_pipeline_service.MonthlyPipelineService.update_embeddings")
    patch_open_preview = patch("app.services.open_tracks_pipeline_service.OpenTracksPipelineService.generate_embedding_preview")
    patch_open_bulk = patch("app.services.open_tracks_pipeline_service.OpenTracksPipelineService.update_embeddings")
    
    with patch_monthly_preview as m1, patch_monthly_bulk as m2, \
         patch_open_preview as o1, patch_open_bulk as o2:
        m1.return_value = {"success": True, "message": "Mocked success"}
        m2.return_value = {"success": True, "message": "Mocked success"}
        o1.return_value = {"success": True, "message": "Mocked success"}
        o2.return_value = {"success": True, "message": "Mocked success"}
        yield {
            "monthly_preview": m1, "monthly_bulk": m2,
            "open_preview": o1, "open_bulk": o2
        }

@pytest.mark.asyncio
async def test_monthly_pipeline_success(client, mock_pipeline_services, admin_headers):
    """Verify Monthly Pipeline ingestion with an admin JWT."""
    if not os.path.exists("prelisten.mp3"):
        pytest.skip("prelisten.mp3 not found")
    headers = admin_headers
    test_path = f"/test_pipeline/monthly_{uuid.uuid4()}.mp3"
    with open("prelisten.mp3", "rb") as f:
        files = {"file": ("test.mp3", f, "audio/mpeg")}
        data = {"path": test_path}
        response = await client.post("/api/v1/ingest/monthly/track", files=files, data=data, headers=headers)
    assert response.status_code == 200
    resp_data = response.json()
    assert resp_data["success"] is True
    track_uuid = resp_data["data"]["track_uuid"]
    set_admin_context(True)
    session = SessionLocal()
    try:
        track = session.execute(text("SELECT type, partner_id FROM tracks WHERE uuid = :uuid"), {"uuid": track_uuid}).fetchone()
        assert track is not None
        assert track[0] == "electrobuzz"
        assert track[1] == 1 
    finally:
        session.close()
    set_admin_context(False)

@pytest.mark.asyncio
async def test_monthly_pipeline_forbidden_for_partner(client):
    """Verify Monthly Pipeline rejects Partner API Key (403)."""
    headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
    response = await client.post("/api/v1/ingest/monthly/track", files={"file": ("test.mp3", b"dummy content", "audio/mpeg")}, data={"path": "/some/path.mp3"}, headers=headers)
    # Admin-only route: a partner key is not a valid admin JWT → denied (401 bad token / 403 not admin).
    assert response.status_code in (401, 403)

@pytest.mark.asyncio
async def test_open_tracks_pipeline_success(client, mock_pipeline_services):
    """Verify Open Tracks Pipeline ingestion with Partner API Key."""
    if not os.path.exists("prelisten.mp3"):
        pytest.skip("prelisten.mp3 not found")
    headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
    test_path = f"/test_pipeline/open_{uuid.uuid4()}.mp3"
    with open("prelisten.mp3", "rb") as f:
        files = {"file": ("test_open.mp3", f, "audio/mpeg")}
        data = {"path": test_path}
        response = await client.post("/api/v1/ingest/open/track", files=files, data=data, headers=headers)
    assert response.status_code == 200
    resp_data = response.json()
    assert resp_data["success"] is True
    track_uuid = resp_data["data"]["track_uuid"]
    set_admin_context(True)
    session = SessionLocal()
    try:
        track = session.execute(text("SELECT type, partner_id FROM tracks WHERE uuid = :uuid"), {"uuid": track_uuid}).fetchone()
        assert track is not None
        assert track[0] == "open"
        assert track[1] == PARTNER_2_ID
    finally:
        session.close()
    set_admin_context(False)

@pytest.mark.asyncio
async def test_open_tracks_pipeline_unauthorized(client):
    """Verify Open Tracks Pipeline requires authentication."""
    response = await client.post("/api/v1/ingest/open/track", files={"file": ("test.mp3", b"dummy content", "audio/mpeg")}, data={"path": "/some/path.mp3"})
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_open_tracks_pipeline_av_check_missing(client, mock_pipeline_services):
    """Verify that an infected file is BLOCKED (expected to fail currently)."""
    headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
    files = {"file": ("virus.mp3", EICAR_STRING.encode(), "audio/mpeg")}
    data = {"path": "/test_pipeline/virus.mp3"}
    response = await client.post("/api/v1/ingest/open/track", files=files, data=data, headers=headers)
    assert response.status_code != 200

@pytest.mark.asyncio
async def test_bulk_embedding_updates(client, mock_pipeline_services, admin_headers):
    """Verify trigger for bulk embedding updates."""
    headers_admin = admin_headers
    response = await client.post("/api/v1/ingest/monthly/update_embeddings", headers=headers_admin)
    assert response.status_code == 200
    headers_partner = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
    response = await client.post("/api/v1/ingest/open/update_embeddings", headers=headers_partner)
    assert response.status_code == 200
