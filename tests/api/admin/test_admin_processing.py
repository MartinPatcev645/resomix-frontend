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

@pytest.mark.asyncio
async def test_apply_ingestion_result_new_error_codes_critical(admin_auth_headers, seeded):
    from sqlalchemy import select
    from app.models.b2b import IngestionError
    
    # Set the log to PROCESSING so it polls Hetzner
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        await db.commit()

    with patch(
        "app.api.routers.admin.processing.hetzner_service.get_ingestion_status", new_callable=AsyncMock
    ) as mock_status:
        mock_status.return_value = {
            "success": True,
            "data": {
                "status": "failed",
                "errors": [
                    {"code": "ZIP_BOMB", "message": "Zip bomb detected"},
                    {"code": "DISALLOWED_ZIP_ENTRY", "message": "Bad file"},
                    {"code": "WARNING_CODE", "message": "Just a warning"},
                ]
            }
        }
        async with _client() as ac:
            res = await ac.get(
                f"/api/v1/admin/ingestion/logs/{seeded['log'].id}/status", headers=admin_auth_headers
            )
            
    assert res.status_code == 200
    
    async with AsyncSessionLocal() as db:
        errors = (await db.execute(select(IngestionError).where(IngestionError.ingest_log_id == seeded['log'].id))).scalars().all()
    
    assert len(errors) == 3
    critical_errors = [e.error_code for e in errors if e.error_severity == "critical"]
    warning_errors = [e.error_code for e in errors if e.error_severity == "warning"]
    
    assert "ZIP_BOMB" in critical_errors
    assert "DISALLOWED_ZIP_ENTRY" in critical_errors
    assert "WARNING_CODE" in warning_errors


@pytest.mark.asyncio
async def test_apply_ingestion_result_stores_processing_dir(admin_auth_headers, seeded):
    """When Hetzner returns processing_dir in its result JSON, apply_ingestion_result
    stores it on IngestLog.processing_dir, and start_embeddings_job later threads it
    through to hetzner_service.start_embeddings."""
    from app.services.ingestion_service import apply_ingestion_result

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        log.stage = None
        await db.commit()

    expected_dir = "processing/2026-06-19T120000Z"

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        await apply_ingestion_result(
            db,
            log,
            {
                "status": "completed",
                "env": "live",
                "processing_dir": expected_dir,
                "records": [],
            },
        )

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        assert log.processing_dir == expected_dir


@pytest.mark.asyncio
async def test_apply_embeddings_result_advances_ingest_log_stages(admin_auth_headers, seeded):
    """When an embeddings job completes, apply_embeddings_result should stamp
    EMBEDDING→INDEXED→FINALIZING→READY on the linked IngestLog and flip it to
    status=COMPLETED."""
    from app.services.partner_processing_service import apply_embeddings_result
    from app.services.ingestion_stages import Stage
    from app.core.context import set_admin_context

    set_admin_context(True)

    # Seed a PartnerProcessingJob linked to the ingest log.
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        log.stage = Stage.INGESTED
        log.stage_timeline = {Stage.INGESTED: "2026-06-19T10:00:00+00:00"}
        await db.commit()

        job = PartnerProcessingJob(
            partner_id=seeded["partner"].id,
            ingest_log_id=seeded["log"].id,
            job_type="embeddings",
            status="running",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

    with patch("app.tasks.webhooks.dispatch_webhook") as mock_wh:
        mock_wh.delay = lambda **kw: None
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job.id)
            await apply_embeddings_result(
                db,
                job,
                {"status": "completed", "env": "live", "results": []},
            )

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)

    assert log.status == "COMPLETED"
    assert log.stage == Stage.READY
    timeline_stages = set(log.stage_timeline or {})
    assert Stage.EMBEDDING in timeline_stages
    assert Stage.INDEXED in timeline_stages
    assert Stage.FINALIZING in timeline_stages
    assert Stage.READY in timeline_stages


@pytest.mark.asyncio
async def test_apply_transcode_result_marks_status_and_autospawns_embeddings(seeded):
    """A completed transcode job sets transcode_status on its tracks AND auto-spawns
    the embeddings job for the batch (no admin click)."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_transcode_result, hetzner_service
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"  # so the auto-spawned embed job resolves sources
        await db.commit()
        job = PartnerProcessingJob(
            partner_id=partner_id, ingest_log_id=seeded["log"].id,
            job_type="transcode", status="running",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    # Stub the embeddings hand-off so no real media call happens during auto-spawn.
    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})):
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_transcode_result(
                db, job,
                {"status": "completed", "results": [{"track_uuid": track_uuid, "status": "ok"}]},
            )

    async with AsyncSessionLocal() as db:
        tps = (await db.execute(
            select(TrackProcessingStatus).where(
                TrackProcessingStatus.ingest_log_id == seeded["log"].id)
        )).scalar_one()
        assert tps.transcode_status == "completed"

        job = await db.get(PartnerProcessingJob, job_id)
        assert job.status == "completed"

        emb = (await db.execute(
            select(PartnerProcessingJob).where(
                PartnerProcessingJob.ingest_log_id == seeded["log"].id,
                PartnerProcessingJob.job_type == "embeddings",
            )
        )).scalars().all()
        assert len(emb) == 1  # exactly one embeddings job auto-spawned


@pytest.mark.asyncio
async def test_apply_transcode_result_failed_track_marks_failed_no_double_embed(seeded):
    """A failed track gets transcode_status=failed; and if an embeddings job already
    exists for the batch, the auto-spawn does NOT create a duplicate."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_transcode_result, hetzner_service
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"
        t = await db.get(Track, seeded["track"].id)
        t.is_active = True  # start active so we can prove the failure deactivates it
        await db.commit()
        tjob = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                    job_type="transcode", status="running")
        # Pre-existing embeddings job for the same batch → auto-spawn must skip.
        ejob = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                    job_type="embeddings", status="completed")
        db.add_all([tjob, ejob])
        await db.commit()
        await db.refresh(tjob)
        tjob_id = tjob.id

    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})):
        async with AsyncSessionLocal() as db:
            tjob = await db.get(PartnerProcessingJob, tjob_id)
            await apply_transcode_result(
                db, tjob,
                {"status": "completed", "results": [{"track_uuid": track_uuid, "status": "error",
                                                     "message": "transcode failed: bad input"}]},
            )

    async with AsyncSessionLocal() as db:
        tps = (await db.execute(
            select(TrackProcessingStatus).where(
                TrackProcessingStatus.ingest_log_id == seeded["log"].id)
        )).scalar_one()
        assert tps.transcode_status == "failed"
        assert "bad input" in (tps.transcode_error or "")

        # failed transcode → no mp3 → track deactivated (excluded from catalog/search)
        assert (await db.get(Track, seeded["track"].id)).is_active is False

        tjob = await db.get(PartnerProcessingJob, tjob_id)
        assert tjob.status == "failed"  # the only track failed

        emb = (await db.execute(
            select(PartnerProcessingJob).where(
                PartnerProcessingJob.ingest_log_id == seeded["log"].id,
                PartnerProcessingJob.job_type == "embeddings",
            )
        )).scalars().all()
        assert len(emb) == 1  # still just the pre-existing one (no duplicate)


@pytest.mark.asyncio
async def test_embedding_failure_deactivates_track(seeded):
    """A failed embedding marks transcode's downstream track is_active=False so a
    vector-less track leaves the usable catalog (can't be picked as a reference)."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_embeddings_result
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        t = await db.get(Track, seeded["track"].id)
        t.is_active = True  # start active
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="embeddings", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch("app.tasks.webhooks.dispatch_webhook") as mock_wh:
        mock_wh.delay = lambda **kw: None
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_embeddings_result(db, job, {
                "status": "completed", "env": "live",
                "results": [{"track_uuid": track_uuid, "status": "error", "message": "embed failed"}],
            })

    async with AsyncSessionLocal() as db:
        assert (await db.get(Track, seeded["track"].id)).is_active is False
        tps = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.track_id == seeded["track"].id))).scalar_one()
        assert tps.embedding_status == "failed"
