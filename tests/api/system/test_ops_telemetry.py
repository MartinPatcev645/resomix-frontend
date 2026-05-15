"""
Section 9: System, Ops & Telemetry Integration Tests
=====================================================

Tests the /health heartbeat endpoint, the /telemetry/sync
batch ingestion endpoint, and the /admin/operation-limits/
system-wide caps management.

Version: 3.0.1
"""

import pytest
import uuid
import httpx
from app.main import app
from app.core.config import settings
from database.connection import SessionLocal, AsyncSessionLocal
from app.core.context import set_admin_context
from app.models.user import User
from app.models.track import Track
from sqlalchemy import select

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
API_KEY_HEADER = {"X-API-KEY": settings.api_key}


# ──────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def client():
    """Module-scoped AsyncClient for Section 9 tests."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as c:
        yield c


@pytest.fixture(scope="module")
def track_uuid():
    """Fetch a real track UUID from the database for telemetry events."""
    set_admin_context(True)
    session = SessionLocal()
    track = session.execute(select(Track).limit(1)).scalar_one_or_none()
    track_id = str(track.uuid) if track else str(uuid.uuid4())
    session.close()
    set_admin_context(False)
    return track_id


# ──────────────────────────────────────────────────────────────
# Health Endpoint Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client):
    """GET /health should return service status."""
    response = await client.get("/api/v1/health", headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """GET / should return API information."""
    response = await client.get("/", headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "version" in data


@pytest.mark.asyncio
async def test_health_without_api_key(client):
    """GET /health without API key — depends on config."""
    response = await client.get("/api/v1/health")
    # Health may or may not require API key depending on implementation
    assert response.status_code in (200, 401, 403)


# ──────────────────────────────────────────────────────────────
# Telemetry Sync Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_telemetry_sync_valid_batch(client, track_uuid):
    """POST /telemetry/sync should accept a valid batch of events."""
    payload = {
        "events": [
            {
                "tab_id": "test_tab_ops_001",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "stream_start",
                "start_time": 1714000000,
                "duration_seconds": 0,
                "context": "playlist_view",
                "client_ts": 1714000000000,
            },
            {
                "tab_id": "test_tab_ops_001",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "stream_complete",
                "start_time": 1714000000,
                "duration_seconds": 180,
                "context": "playlist_view",
                "client_ts": 1714000180000,
            },
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["accepted"] == 2


@pytest.mark.asyncio
async def test_telemetry_sync_single_event(client, track_uuid):
    """POST /telemetry/sync should handle a single-event batch."""
    payload = {
        "events": [
            {
                "tab_id": "single_tab_002",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "stream_skip",
                "start_time": 1714001000,
                "duration_seconds": 15,
                "context": "search_results",
                "client_ts": 1714001015000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["accepted"] == 1


@pytest.mark.asyncio
async def test_telemetry_sync_download_event(client, track_uuid):
    """POST /telemetry/sync should accept download_success events."""
    payload = {
        "events": [
            {
                "tab_id": "dl_tab_003",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "download_success",
                "start_time": 1714002000,
                "duration_seconds": 0,
                "context": "playlist_view",
                "client_ts": 1714002000000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_telemetry_sync_empty_events(client):
    """POST /telemetry/sync with an empty events array should return 422."""
    payload = {"events": []}
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_sync_invalid_event_type(client, track_uuid):
    """POST /telemetry/sync with an invalid event_type should return 422."""
    payload = {
        "events": [
            {
                "tab_id": "bad_tab_004",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "invalid_event",
                "start_time": 1714003000,
                "duration_seconds": 0,
                "context": "test",
                "client_ts": 1714003000000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_sync_missing_required_field(client):
    """POST /telemetry/sync missing required fields should return 422."""
    payload = {
        "events": [
            {
                "tab_id": "partial_005",
                # Missing track_id, playlist_id, etc.
                "event_type": "stream_start",
                "start_time": 1714004000,
                "duration_seconds": 0,
                "context": "test",
                "client_ts": 1714004000000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_sync_stream_start_nonzero_duration(client, track_uuid):
    """POST /telemetry/sync with stream_start and nonzero duration should return 422."""
    payload = {
        "events": [
            {
                "tab_id": "bad_duration_006",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "stream_start",
                "start_time": 1714005000,
                "duration_seconds": 30,  # Must be 0 for stream_start
                "context": "playlist_view",
                "client_ts": 1714005000000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_requires_api_key(client, track_uuid):
    """POST /telemetry/sync without API key should return 401/403."""
    payload = {
        "events": [
            {
                "tab_id": "nokey_007",
                "track_id": track_uuid,
                "playlist_id": str(uuid.uuid4()),
                "event_type": "stream_start",
                "start_time": 1714006000,
                "duration_seconds": 0,
                "context": "test",
                "client_ts": 1714006000000,
            }
        ]
    }
    response = await client.post("/api/v1/telemetry/sync", json=payload)
    assert response.status_code in (401, 403)


# ──────────────────────────────────────────────────────────────
# Admin Operation Limits Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_operation_types(client):
    """GET /admin/operation-limits/operation-types should return available types."""
    response = await client.get(
        "/api/v1/admin/operation-limits/operation-types", headers=API_KEY_HEADER
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)


@pytest.mark.asyncio
async def test_list_user_operation_limits(client):
    """GET /admin/operation-limits/ should return paginated limits."""
    response = await client.get("/api/v1/admin/operation-limits/", headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_operation_limits_requires_api_key(client):
    """GET /admin/operation-limits/ without API key should be rejected."""
    response = await client.get("/api/v1/admin/operation-limits/")
    assert response.status_code in (401, 403)
