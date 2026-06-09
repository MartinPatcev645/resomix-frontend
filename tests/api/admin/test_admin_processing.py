"""
Admin Processing / Ingestion / Track Control route tests
========================================================

Covers the §C (processing jobs), §F (ingestion control) and §G (track control)
admin endpoints added for the partner ingestion pipeline. Each group exercises a
success path and an intentional-error path.

Auth: the static X-API-KEY bypasses JWT for admin routes (superadmin).
External effects (Hetzner calls + fire-and-forget workers) are mocked so the
tests never hit the media server or run real background work.
"""

import uuid
import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from sqlalchemy import text

from app.main import app
from app.core.config import settings
from database.connection import AsyncSessionLocal
from app.models.partner import Partner
from app.models.track import Track
from app.models.b2b import IngestLog
from app.models.track_processing_status import TrackProcessingStatus
from app.models.partner_processing_job import PartnerProcessingJob


@pytest.fixture
def admin_auth_headers():
    return {"X-API-KEY": settings.api_key}


@pytest.fixture
async def seeded():
    """Create a partner, party, ingest log, track + processing-status row."""
    from app.core.context import set_admin_context, set_current_partner_id

    set_admin_context(True)  # bypass the multi-tenancy failsafe for setup writes
    async with AsyncSessionLocal() as db:
        partner = Partner(
            partner_uuid=str(uuid.uuid4()),
            legal_name=f"P_{uuid.uuid4().hex[:6]}",
            display_name=f"P_{uuid.uuid4().hex[:6]}",
            contact_email=f"c_{uuid.uuid4().hex[:6]}@example.com",
            tier="growth",
        )
        db.add(partner)
        await db.commit()
        await db.refresh(partner)

        party_id = f"PARTY_{uuid.uuid4().hex[:8]}"
        await db.execute(
            text("INSERT IGNORE INTO parties (party_id, party_name) VALUES (:pid, 'Test Party')"),
            {"pid": party_id},
        )
        await db.commit()

        log = IngestLog(
            partner_id=partner.id,
            party_id=party_id,
            package_folder=f"/srv/sftp/partners/{partner.id}/live",
            status="COMPLETED",
            track_count=1,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)

        track = Track(
            uuid=str(uuid.uuid4()),
            isrc=f"US{uuid.uuid4().hex[:3].upper()}{str(uuid.uuid4().int)[:7]}",
            title="Test Track",
            display_artist="Test Artist",
            partner_id=partner.id,
            party_id=party_id,
            is_active=False,
        )
        db.add(track)
        await db.commit()
        await db.refresh(track)

        tps = TrackProcessingStatus(
            track_id=track.id,
            partner_id=partner.id,
            ingest_log_id=log.id,
            audio_filename="song.wav",
            sftp_env="live",
        )
        db.add(tps)
        await db.commit()

        try:
            yield {"partner": partner, "party_id": party_id, "log": log, "track": track}
        finally:
            # Reset context so the admin bypass never leaks into later tests.
            set_admin_context(False)
            set_current_partner_id(None)


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ===========================================================================
# §C Processing jobs
# ===========================================================================
@pytest.mark.asyncio
async def test_trigger_embeddings_job_success(admin_auth_headers, seeded):
    # Mock only the network hand-off to the media server; the real service code
    # (create_job + work-list collection + status transitions) still runs.
    with patch(
        "app.services.partner_processing_service.hetzner_service.start_embeddings",
        new_callable=AsyncMock,
    ) as mock_start:
        mock_start.return_value = {"success": True}
        async with _client() as ac:
            res = await ac.post(
                "/api/v1/admin/processing/jobs/embeddings",
                headers=admin_auth_headers,
                json={"partner_id": seeded["partner"].id, "env": "live"},
            )
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "accepted"
    assert isinstance(body["job_id"], int)


@pytest.mark.asyncio
async def test_get_processing_job_404(admin_auth_headers):
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/processing/jobs/99999999", headers=admin_auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_processing_jobs_success(admin_auth_headers, seeded):
    # Seed a job row directly.
    from app.core.context import set_admin_context
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        db.add(PartnerProcessingJob(partner_id=seeded["partner"].id, job_type="embeddings", status="completed"))
        await db.commit()
    async with _client() as ac:
        res = await ac.get(
            f"/api/v1/admin/processing/jobs?partner_id={seeded['partner'].id}",
            headers=admin_auth_headers,
        )
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert len(res.json()["jobs"]) >= 1


@pytest.mark.asyncio
async def test_processing_jobs_requires_auth():
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/processing/jobs")
    assert res.status_code == 403


# ===========================================================================
# §F Ingestion control
# ===========================================================================
@pytest.mark.asyncio
async def test_list_ingestion_logs_success(admin_auth_headers, seeded):
    async with _client() as ac:
        res = await ac.get(
            f"/api/v1/admin/ingestion/logs?partner_id={seeded['partner'].id}",
            headers=admin_auth_headers,
        )
    assert res.status_code == 200
    logs = res.json()["logs"]
    assert any(l["id"] == seeded["log"].id for l in logs)


@pytest.mark.asyncio
async def test_get_ingestion_log_detail_success(admin_auth_headers, seeded):
    async with _client() as ac:
        res = await ac.get(
            f"/api/v1/admin/ingestion/logs/{seeded['log'].id}", headers=admin_auth_headers
        )
    assert res.status_code == 200
    assert res.json()["log"]["id"] == seeded["log"].id
    assert "errors" in res.json()


@pytest.mark.asyncio
async def test_get_ingestion_log_404(admin_auth_headers):
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/ingestion/logs/99999999", headers=admin_auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_trigger_ingestion_success(admin_auth_headers, seeded):
    # Mock only the media-server hand-off and the Celery webhook dispatch; the real
    # start_ingestion_job code (ingest_logs row creation + status) still runs.
    with patch(
        "app.services.hetzner_service.HetznerService.start_ingestion",
        new_callable=AsyncMock,
    ) as mock_start, patch(
        "app.services.ingestion_service.dispatch_webhook.delay"
    ):
        mock_start.return_value = {"success": True}
        async with _client() as ac:
            res = await ac.post(
                "/api/v1/admin/ingestion/trigger",
                headers=admin_auth_headers,
                json={"partner_id": seeded["partner"].id, "env": "test"},
            )
    assert res.status_code == 202
    assert res.json()["env"] == "test"


@pytest.mark.asyncio
async def test_trigger_ingestion_invalid_env(admin_auth_headers, seeded):
    async with _client() as ac:
        res = await ac.post(
            "/api/v1/admin/ingestion/trigger",
            headers=admin_auth_headers,
            json={"partner_id": seeded["partner"].id, "env": "staging"},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_retry_ingestion_404(admin_auth_headers):
    async with _client() as ac:
        res = await ac.post(
            "/api/v1/admin/ingestion/logs/99999999/retry", headers=admin_auth_headers
        )
    assert res.status_code == 404


# ===========================================================================
# §G Track control
# ===========================================================================
@pytest.mark.asyncio
async def test_list_tracks_success(admin_auth_headers, seeded):
    async with _client() as ac:
        res = await ac.get(
            f"/api/v1/admin/tracks?partner_id={seeded['partner'].id}", headers=admin_auth_headers
        )
    assert res.status_code == 200
    tracks = res.json()["tracks"]
    assert any(t["id"] == seeded["track"].id for t in tracks)


@pytest.mark.asyncio
async def test_set_track_live_success(admin_auth_headers, seeded):
    with patch(
        "app.api.routers.admin.processing.hetzner_service.add_vector", new_callable=AsyncMock
    ) as mock_add:
        mock_add.return_value = {"success": True, "data": {"index_size": 1}}
        async with _client() as ac:
            res = await ac.post(
                f"/api/v1/admin/tracks/{seeded['track'].id}/set-live", headers=admin_auth_headers
            )
    assert res.status_code == 200
    assert res.json()["is_active"] is True
    assert res.json()["faiss_indexed"] is True


@pytest.mark.asyncio
async def test_stop_track_success(admin_auth_headers, seeded):
    with patch(
        "app.api.routers.admin.processing.hetzner_service.remove_vector", new_callable=AsyncMock
    ) as mock_rm:
        mock_rm.return_value = {"success": True, "data": {"removed": 2}}
        async with _client() as ac:
            res = await ac.post(
                f"/api/v1/admin/tracks/{seeded['track'].id}/stop", headers=admin_auth_headers
            )
    assert res.status_code == 200
    assert res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_set_track_live_404(admin_auth_headers):
    async with _client() as ac:
        res = await ac.post("/api/v1/admin/tracks/99999999/set-live", headers=admin_auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_stop_track_404(admin_auth_headers):
    with patch(
        "app.api.routers.admin.processing.hetzner_service.remove_vector", new_callable=AsyncMock
    ) as mock_rm:
        mock_rm.return_value = {"success": True}
        async with _client() as ac:
            res = await ac.post("/api/v1/admin/tracks/99999999/stop", headers=admin_auth_headers)
    assert res.status_code == 404
