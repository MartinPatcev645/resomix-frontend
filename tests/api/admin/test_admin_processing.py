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

    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})), \
         patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock) as mock_notify:
        async with AsyncSessionLocal() as db:
            tjob = await db.get(PartnerProcessingJob, tjob_id)
            await apply_transcode_result(
                db, tjob,
                {"status": "completed", "results": [{"track_uuid": track_uuid, "status": "error",
                                                     "message": "transcode failed: bad input"}]},
            )

    # partner + admin were notified about the failed track (by filename)
    assert mock_notify.await_count == 1
    args, kwargs = mock_notify.await_args
    assert args[2] == "transcode" and args[3] == "failed"
    assert "song.wav" in kwargs["details"]

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

    with patch("app.tasks.webhooks.dispatch_webhook") as mock_wh, \
         patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock) as mock_notify:
        mock_wh.delay = lambda **kw: None
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_embeddings_result(db, job, {
                "status": "completed", "env": "live",
                "results": [{"track_uuid": track_uuid, "status": "error", "message": "embed failed"}],
            })

    # partner + admin notified about the failed embed (by filename). apply_embeddings_result
    # sends two notifications for a failure — the per-track failure detail AND the overall
    # outcome — so assert the FAILURE-detail call (event=embedding, status=failed, filename) is present.
    fail_calls = [
        c for c in mock_notify.await_args_list
        if len(c.args) >= 4 and c.args[2] == "embedding" and c.args[3] == "failed"
        and "song.wav" in (c.kwargs.get("details") or [])
    ]
    assert len(fail_calls) == 1

    async with AsyncSessionLocal() as db:
        assert (await db.get(Track, seeded["track"].id)).is_active is False
        tps = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.track_id == seeded["track"].id))).scalar_one()
        assert tps.embedding_status == "failed"


@pytest.mark.asyncio
async def test_trigger_embeddings_debounced_when_active(admin_auth_headers, seeded):
    """A second trigger while one is already active returns the existing job (no dup)."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        job = PartnerProcessingJob(partner_id=seeded["partner"].id, ingest_log_id=seeded["log"].id,
                                   job_type="embeddings", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        existing_id = job.id

    async with _client() as ac:
        res = await ac.post(
            "/api/v1/admin/processing/jobs/embeddings",
            headers=admin_auth_headers,
            json={"partner_id": seeded["partner"].id, "ingest_log_id": seeded["log"].id},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "already_running"
    assert body["job_id"] == existing_id


@pytest.mark.asyncio
async def test_stop_tracks_batch_deactivates_and_calls_media_once(admin_auth_headers, seeded):
    """Batch stop deactivates every track and hits the media batch-remove exactly once."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    partner_id = seeded["partner"].id

    async with AsyncSessionLocal() as db:
        t2 = Track(
            uuid=str(uuid.uuid4()),
            isrc=f"US{uuid.uuid4().hex[:3].upper()}{str(uuid.uuid4().int)[:7]}",
            title="T2", display_artist="A", partner_id=partner_id,
            party_id=seeded["party_id"], is_active=True,
        )
        t1 = await db.get(Track, seeded["track"].id)
        t1.is_active = True
        db.add(t2)
        await db.commit()
        await db.refresh(t2)
        ids = [seeded["track"].id, t2.id]

    with patch("app.api.routers.admin.processing.hetzner_service.remove_vectors_batch",
               new_callable=AsyncMock) as mock_rm:
        mock_rm.return_value = {"success": True, "data": {"removed": {"maest": 2}}}
        async with _client() as ac:
            res = await ac.post(
                "/api/v1/admin/tracks/stop-batch",
                headers=admin_auth_headers,
                json={"partner_id": partner_id, "track_ids": ids},
            )
    assert res.status_code == 200
    assert res.json()["stopped"] == 2
    assert mock_rm.await_count == 1  # ONE media call for the whole batch

    async with AsyncSessionLocal() as db:
        for tid in ids:
            assert (await db.get(Track, tid)).is_active is False


def _persist_records():
    return [
        {"track_uuid": str(uuid.uuid4()), "isrc": "USAAA1234567", "title": "C1",
         "display_artist": "A", "audio_filename": "c1.mp3", "p_line_year": 12021},  # bad year -> clamped
        {"track_uuid": str(uuid.uuid4()), "isrc": "USBBB1234567", "title": "C2",
         "display_artist": "A", "audio_filename": "c2.mp3"},
    ]


@pytest.mark.asyncio
async def test_apply_ingestion_result_enqueues_background_persist_and_debounces(seeded):
    """On a completed live batch, apply_ingestion_result marks the log PERSISTING and
    enqueues the background task ONCE; a second poll while PERSISTING does not re-enqueue."""
    from app.services.ingestion_service import apply_ingestion_result
    from app.services.ingestion_stages import Stage
    from app.core.context import set_admin_context

    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        log.stage = None
        log.stage_timeline = {}
        await db.commit()

    state = {"status": "completed", "env": "live", "records": _persist_records()}

    with patch("app.tasks.ingestion_tasks.persist_and_finalize_ingestion.delay") as mdelay:
        async with AsyncSessionLocal() as db:
            log = await db.get(IngestLog, seeded["log"].id)
            await apply_ingestion_result(db, log, state)
        assert mdelay.call_count == 1  # enqueued once

        async with AsyncSessionLocal() as db:
            log = await db.get(IngestLog, seeded["log"].id)
            assert log.stage == Stage.PERSISTING
            assert log.status == "PROCESSING"  # not finalized — the task does that

        # Second poll while PERSISTING (fresh) → debounced, no second enqueue.
        async with AsyncSessionLocal() as db:
            log = await db.get(IngestLog, seeded["log"].id)
            await apply_ingestion_result(db, log, state)
        assert mdelay.call_count == 1


@pytest.mark.asyncio
async def test_persist_task_inserts_finalizes_and_is_idempotent(seeded):
    """The background task pulls records from Hetzner, inserts them (chunked, clamping the
    bad year), finalizes the log COMPLETED, auto-spawns transcode AND a concurrent
    (overlap) embeddings job, and a re-run is a no-op."""
    from sqlalchemy import select, func
    from app.tasks.ingestion_tasks import _async_persist_and_finalize
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    records = _persist_records()

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        log.processing_dir = "20260623T000000Z"
        await db.commit()

    remote = {"success": True, "data": {"status": "completed", "env": "live", "records": records}}
    with patch("app.tasks.ingestion_tasks.HetznerService.get_ingestion_status",
               new_callable=AsyncMock, return_value=remote), \
         patch("app.services.ingestion_service.dispatch_webhook.delay", lambda **k: None), \
         patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock), \
         patch("app.services.partner_processing_service.hetzner_service.start_transcode",
               new_callable=AsyncMock) as mstart, \
         patch("app.services.partner_processing_service.hetzner_service.start_embeddings",
               new_callable=AsyncMock) as membed:
        mstart.return_value = {"success": True}
        membed.return_value = {"success": True}
        await _async_persist_and_finalize(seeded["log"].id)
        await _async_persist_and_finalize(seeded["log"].id)  # idempotent re-run

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        assert log.status == "COMPLETED"

        uuids = [r["track_uuid"] for r in records]
        cnt = (await db.execute(
            select(func.count()).select_from(Track).where(
                Track.partner_id == partner_id, Track.uuid.in_(uuids))
        )).scalar()
        assert cnt == 2  # both inserted, no duplicates

        t = (await db.execute(select(Track).where(Track.uuid == uuids[0]))).scalar_one()
        assert t.p_line_year is None  # bad year clamped, not an error

        tj = (await db.execute(select(PartnerProcessingJob).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id,
            PartnerProcessingJob.job_type == "transcode"))).scalars().all()
        assert len(tj) == 1

        # Embeddings job spawned CONCURRENTLY (exactly one), not chained off transcode.
        ej = (await db.execute(select(PartnerProcessingJob).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id,
            PartnerProcessingJob.job_type == "embeddings"))).scalars().all()
        assert len(ej) == 1

    # The embeddings hand-off ran in OVERLAP mode against the transcode job id.
    assert membed.await_count >= 1
    assert membed.await_args.kwargs.get("transcode_job_id") == tj[0].id


@pytest.mark.asyncio
async def test_partner_subscribes_gate(seeded):
    """The per-track webhook fan-out is gated on a real subscription so a huge batch
    doesn't enqueue millions of no-op webhook tasks."""
    from app.services.ingestion_service import _partner_subscribes
    from app.models.partner import PartnerWebhook
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id

    async with AsyncSessionLocal() as db:
        # No webhooks yet → not subscribed.
        assert await _partner_subscribes(db, partner_id, "track.indexed") is False

        # Active webhook subscribed to a different event → still not subscribed.
        db.add(PartnerWebhook(
            partner_id=partner_id, url="https://example.com/hook",
            secret_hash="x" * 64, events=["ingestion.completed"], is_active=True,
        ))
        await db.commit()
        assert await _partner_subscribes(db, partner_id, "track.indexed") is False

        # Active webhook subscribed to track.indexed → subscribed.
        db.add(PartnerWebhook(
            partner_id=partner_id, url="https://example.com/hook2",
            secret_hash="y" * 64, events=["track.indexed"], is_active=True,
        ))
        await db.commit()
        assert await _partner_subscribes(db, partner_id, "track.indexed") is True

        # Inactive subscription does not count.
        await db.execute(text("UPDATE partner_webhooks SET is_active = 0 WHERE partner_id = :p"),
                         {"p": partner_id})
        await db.commit()
        assert await _partner_subscribes(db, partner_id, "track.indexed") is False


# ===========================================================================
# Background terminal result-apply (bulk, off the poll request)
# ===========================================================================
@pytest.mark.asyncio
async def test_claim_and_enqueue_finalize_debounces(seeded):
    """When the media job is terminal, the poll claims the job (status=finalizing +
    finalizing_at) and enqueues the finalize task ONCE; a second poll while finalizing
    (fresh) does not re-enqueue."""
    from app.services.partner_processing_service import claim_and_enqueue_finalize
    from app.core.context import set_admin_context

    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        job = PartnerProcessingJob(partner_id=seeded["partner"].id, ingest_log_id=seeded["log"].id,
                                   job_type="transcode", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch("app.tasks.processing_tasks.finalize_processing_job.delay") as mdelay:
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await claim_and_enqueue_finalize(db, job)
        assert mdelay.call_count == 1

        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            assert job.status == "finalizing"
            assert job.finalizing_at is not None

        # Second poll while finalizing (fresh) → debounced, no second enqueue.
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await claim_and_enqueue_finalize(db, job)
        assert mdelay.call_count == 1


@pytest.mark.asyncio
async def test_finalize_task_applies_bulk_and_is_idempotent(seeded):
    """The finalize task fetches the full results from media, applies them in bulk
    (per-track transcode_status), finalizes the job, auto-spawns embeddings, and a
    re-run is a no-op."""
    from sqlalchemy import select
    from datetime import datetime as _dt
    from app.tasks.processing_tasks import _async_finalize_processing_job
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="transcode", status="finalizing", finalizing_at=_dt.utcnow())
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    remote = {"success": True, "data": {"status": "completed",
                                        "results": [{"track_uuid": track_uuid, "status": "ok"}]}}
    with patch("app.tasks.processing_tasks.HetznerService.get_transcode_status",
               new_callable=AsyncMock, return_value=remote), \
         patch("app.services.partner_processing_service.hetzner_service.start_embeddings",
               new_callable=AsyncMock, return_value={"success": True}):
        await _async_finalize_processing_job(job_id)
        await _async_finalize_processing_job(job_id)  # idempotent re-run

    async with AsyncSessionLocal() as db:
        tps = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.ingest_log_id == seeded["log"].id))).scalar_one()
        assert tps.transcode_status == "completed"

        job = await db.get(PartnerProcessingJob, job_id)
        assert job.status == "completed"
        assert job.finalizing_at is None  # cleared on finalize

        emb = (await db.execute(select(PartnerProcessingJob).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id,
            PartnerProcessingJob.job_type == "embeddings"))).scalars().all()
        assert len(emb) == 1  # auto-spawned once, not duplicated by the re-run


@pytest.mark.asyncio
async def test_bulk_apply_mixed_ok_and_failed(seeded):
    """_apply_track_results_bulk processes many tracks in one pass: ok→completed,
    error→failed + the failed track is deactivated. (No per-track N+1.)"""
    from sqlalchemy import select
    from app.services.partner_processing_service import _apply_track_results_bulk
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    ok_uuid = seeded["track"].uuid

    # Add a second track (will fail) so the chunk has a mix.
    async with AsyncSessionLocal() as db:
        bad_uuid = str(uuid.uuid4())
        t2 = Track(uuid=bad_uuid, isrc=f"US{uuid.uuid4().hex[:3].upper()}{str(uuid.uuid4().int)[:7]}",
                   title="T2", display_artist="A", partner_id=partner_id,
                   party_id=seeded["party_id"], is_active=True)
        db.add(t2)
        await db.commit()
        await db.refresh(t2)
        db.add(TrackProcessingStatus(track_id=t2.id, partner_id=partner_id,
                                     ingest_log_id=seeded["log"].id, audio_filename="t2.wav", sftp_env="live"))
        # ok track starts active too
        (await db.get(Track, seeded["track"].id)).is_active = True
        await db.commit()
        bad_track_id = t2.id

    summary = await _apply_track_results_bulk(
        partner_id, "transcode",
        [{"track_uuid": ok_uuid, "status": "ok"},
         {"track_uuid": bad_uuid, "status": "error", "message": "transcode failed: x"}],
        ingest_log_id=seeded["log"].id,
    )

    assert summary["processed"] == 1 and summary["failed"] == 1
    assert "t2.wav" in summary["failed_files"]

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.ingest_log_id == seeded["log"].id))).scalars().all()
        by_fn = {r.audio_filename: r for r in rows}
        assert by_fn["song.wav"].transcode_status == "completed"
        assert by_fn["t2.wav"].transcode_status == "failed"
        assert "transcode failed" in (by_fn["t2.wav"].transcode_error or "")
        # ok track stays active; failed track is deactivated.
        assert (await db.get(Track, seeded["track"].id)).is_active is True
        assert (await db.get(Track, bad_track_id)).is_active is False


# ===========================================================================
# Phase-2 playback jobs: peaks + segments
# ===========================================================================
@pytest.mark.asyncio
async def test_apply_peaks_result_marks_status_without_deactivating(seeded):
    """A peaks failure sets peaks_status=failed but must NOT deactivate the track — it's
    still searchable, only playback is degraded (per the failure matrix)."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_peaks_result
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        (await db.get(Track, seeded["track"].id)).is_active = True
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="peaks", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock):
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_peaks_result(db, job, {
                "status": "completed",
                "results": [{"track_uuid": track_uuid, "status": "error", "message": "peaks boom"}],
            })

    async with AsyncSessionLocal() as db:
        tps = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.ingest_log_id == seeded["log"].id))).scalar_one()
        assert tps.peaks_status == "failed"
        assert "peaks boom" in (tps.peaks_error or "")
        # Playback failure must NOT take the track out of the catalog.
        assert (await db.get(Track, seeded["track"].id)).is_active is True
        assert (await db.get(PartnerProcessingJob, job_id)).status == "failed"


@pytest.mark.asyncio
async def test_transcode_autospawns_peaks_segments_for_playback_partner(seeded):
    """A completed transcode for a similarity_playback partner auto-spawns BOTH peaks and
    segments jobs (in addition to embeddings)."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_transcode_result, hetzner_service
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"
        p = await db.get(Partner, partner_id)
        p.service_mode = "similarity_playback"
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="transcode", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})), \
         patch.object(hetzner_service, "start_peaks", new=AsyncMock(return_value={"success": True})) as mpeaks, \
         patch.object(hetzner_service, "start_segments", new=AsyncMock(return_value={"success": True})) as msegs:
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_transcode_result(db, job, {
                "status": "completed", "results": [{"track_uuid": track_uuid, "status": "ok"}]})

    assert mpeaks.await_count == 1 and msegs.await_count == 1
    async with AsyncSessionLocal() as db:
        types = (await db.execute(select(PartnerProcessingJob.job_type).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id))).scalars().all()
        assert "peaks" in types and "segments" in types


@pytest.mark.asyncio
async def test_transcode_skips_peaks_segments_for_similarity_only(seeded):
    """The default similarity_only partner gets NO peaks/segments jobs."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_transcode_result, hetzner_service
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id  # service_mode defaults to similarity_only
    track_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="transcode", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})), \
         patch.object(hetzner_service, "start_peaks", new=AsyncMock(return_value={"success": True})) as mpeaks, \
         patch.object(hetzner_service, "start_segments", new=AsyncMock(return_value={"success": True})) as msegs:
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_transcode_result(db, job, {
                "status": "completed", "results": [{"track_uuid": track_uuid, "status": "ok"}]})

    assert mpeaks.await_count == 0 and msegs.await_count == 0
    async with AsyncSessionLocal() as db:
        types = (await db.execute(select(PartnerProcessingJob.job_type).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id))).scalars().all()
        assert "peaks" not in types and "segments" not in types


# ===========================================================================
# API-response shape: new pipeline fields exposed to the admin UI
# (added 2026-06-24 alongside the frontend_api_integration_guide update)
# ===========================================================================
@pytest.mark.asyncio
async def test_get_processing_job_exposes_finalizing_and_job_type(admin_auth_headers, seeded):
    """GET /processing/jobs/{id} exposes job_type, the transient 'finalizing' status, and finalizing_at."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        job = PartnerProcessingJob(partner_id=seeded["partner"].id, ingest_log_id=seeded["log"].id,
                                   job_type="peaks", status="finalizing", finalizing_at=datetime.utcnow())
        db.add(job)
        await db.commit()
        await db.refresh(job)
        jid = job.id
    async with _client() as ac:
        res = await ac.get(f"/api/v1/admin/processing/jobs/{jid}", headers=admin_auth_headers)
    assert res.status_code == 200
    j = res.json()["job"]
    assert j["job_type"] == "peaks"
    assert j["status"] == "finalizing"
    assert "finalizing_at" in j and j["finalizing_at"] is not None


@pytest.mark.asyncio
async def test_list_tracks_exposes_all_pipeline_stage_fields(admin_auth_headers, seeded):
    """The /tracks 'processing' object exposes transcode + every per-stage status/error/completed_at."""
    async with _client() as ac:
        res = await ac.get(f"/api/v1/admin/tracks?partner_id={seeded['partner'].id}",
                           headers=admin_auth_headers)
    assert res.status_code == 200
    track = next(t for t in res.json()["tracks"] if t["id"] == seeded["track"].id)
    proc = track["processing"]
    for f in ("transcode_status", "embedding_status", "peaks_status", "segments_status", "faiss_indexed",
              "transcode_error", "embedding_error", "peaks_error", "segments_error",
              "transcode_completed_at", "embedding_completed_at", "peaks_completed_at",
              "segments_completed_at", "faiss_indexed_at", "sftp_env", "audio_filename"):
        assert f in proc, f"missing field: {f}"
    assert proc["transcode_status"] == "pending"


@pytest.mark.asyncio
async def test_get_ingestion_log_exposes_stage_timeline(admin_auth_headers, seeded):
    """The ingest log object exposes the granular `stage` + `stage_timeline`."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.stage = "PERSISTING"
        log.stage_timeline = {"VALIDATING": "2026-06-24T00:00:00+00:00",
                              "PERSISTING": "2026-06-24T00:01:00+00:00"}
        await db.commit()
    async with _client() as ac:
        res = await ac.get(f"/api/v1/admin/ingestion/logs/{seeded['log'].id}", headers=admin_auth_headers)
    assert res.status_code == 200
    log = res.json()["log"]
    assert log["stage"] == "PERSISTING"
    assert log["stage_timeline"].get("PERSISTING")


@pytest.mark.asyncio
async def test_trigger_peaks_job_via_http(admin_auth_headers, seeded):
    """POST /processing/jobs/peaks creates a peaks job and hands it to the media server."""
    with patch("app.services.partner_processing_service.hetzner_service.start_peaks",
               new_callable=AsyncMock) as mock_start:
        mock_start.return_value = {"success": True}
        async with _client() as ac:
            res = await ac.post("/api/v1/admin/processing/jobs/peaks", headers=admin_auth_headers,
                                json={"partner_id": seeded["partner"].id, "env": "live"})
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "accepted" and body["job_type"] == "peaks"
    assert isinstance(body["job_id"], int)
    assert mock_start.await_count == 1


@pytest.mark.asyncio
async def test_trigger_stage_job_invalid_stage_404(admin_auth_headers, seeded):
    """An unknown {stage} (not peaks/segments) is rejected with 404."""
    async with _client() as ac:
        res = await ac.post("/api/v1/admin/processing/jobs/foobar", headers=admin_auth_headers,
                            json={"partner_id": seeded["partner"].id})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_pause_peaks_job_via_http(admin_auth_headers, seeded):
    """Pause now works for non-embeddings jobs too (here: a peaks job)."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        job = PartnerProcessingJob(partner_id=seeded["partner"].id, job_type="peaks", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        jid = job.id
    with patch("app.services.partner_processing_service.hetzner_service.pause_peaks",
               new_callable=AsyncMock) as mock_pause:
        mock_pause.return_value = {"success": True}
        async with _client() as ac:
            res = await ac.post(f"/api/v1/admin/processing/jobs/{jid}/pause", headers=admin_auth_headers)
    assert res.status_code == 200
    assert res.json()["job_status"] == "paused"
    assert mock_pause.await_count == 1


@pytest.mark.asyncio
async def test_embedding_artifacts_skipped_when_knob_off(seeded, monkeypatch):
    """REGISTER_EMBEDDING_ARTIFACTS=false → embeddings apply sets status but writes NO
    document_files artifact rows (the per-track-row cap knob for very large partners)."""
    from sqlalchemy import select, func
    from app.services import partner_processing_service as pps
    from app.models.document_file import DocumentFile
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    monkeypatch.setattr(pps, "_REGISTER_EMBED_ARTIFACTS", False)

    await pps._apply_track_results_bulk(
        partner_id, "embeddings",
        [{"track_uuid": seeded["track"].uuid, "status": "ok"}],
        ingest_log_id=seeded["log"].id,
    )

    async with AsyncSessionLocal() as db:
        n = (await db.execute(select(func.count()).select_from(DocumentFile).where(
            DocumentFile.track_id == seeded["track"].id))).scalar()
        assert n == 0  # knob off → no artifact rows created
        tps = (await db.execute(select(TrackProcessingStatus).where(
            TrackProcessingStatus.track_id == seeded["track"].id))).scalar_one()
        assert tps.embedding_status == "completed"  # status still applied


# ===========================================================================
# Auto-progression failure gate (<5% → auto-start next; else halt + admin-notify)
# ===========================================================================
@pytest.mark.asyncio
async def test_transcode_high_failure_rate_halts_peaks_segments(seeded):
    """Transcode failure rate >= threshold → peaks/segments are NOT auto-started, and an
    ADMIN-ONLY escalation fires (search/embeddings is never gated)."""
    from sqlalchemy import select
    from app.services.partner_processing_service import apply_transcode_result, hetzner_service
    from app.core.context import set_admin_context

    set_admin_context(True)
    partner_id = seeded["partner"].id
    ok_uuid = seeded["track"].uuid

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.processing_dir = "20260623T000000Z"
        (await db.get(Partner, partner_id)).service_mode = "similarity_playback"
        bad_uuid = str(uuid.uuid4())
        t2 = Track(uuid=bad_uuid, isrc=f"US{uuid.uuid4().hex[:3].upper()}{str(uuid.uuid4().int)[:7]}",
                   title="T2", display_artist="A", partner_id=partner_id,
                   party_id=seeded["party_id"], is_active=True)
        db.add(t2)
        await db.commit()
        await db.refresh(t2)
        db.add(TrackProcessingStatus(track_id=t2.id, partner_id=partner_id,
                                     ingest_log_id=seeded["log"].id, audio_filename="t2.wav", sftp_env="live"))
        job = PartnerProcessingJob(partner_id=partner_id, ingest_log_id=seeded["log"].id,
                                   job_type="transcode", status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch.object(hetzner_service, "start_embeddings", new=AsyncMock(return_value={"success": True})), \
         patch.object(hetzner_service, "start_peaks", new=AsyncMock(return_value={"success": True})) as mpeaks, \
         patch.object(hetzner_service, "start_segments", new=AsyncMock(return_value={"success": True})) as msegs, \
         patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock) as mnotify:
        async with AsyncSessionLocal() as db:
            job = await db.get(PartnerProcessingJob, job_id)
            await apply_transcode_result(db, job, {"status": "completed", "results": [
                {"track_uuid": ok_uuid, "status": "ok"},
                {"track_uuid": bad_uuid, "status": "error", "message": "transcode failed"}]})  # 50% fail

    assert mpeaks.await_count == 0 and msegs.await_count == 0       # halted
    assert any(c.kwargs.get("admin_only") is True for c in mnotify.await_args_list)  # admin-only escalation
    async with AsyncSessionLocal() as db:
        types = (await db.execute(select(PartnerProcessingJob.job_type).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id))).scalars().all()
        assert "peaks" not in types and "segments" not in types


@pytest.mark.asyncio
async def test_ingestion_high_persist_failure_halts_transcode(seeded):
    """Persist failure rate >= threshold → transcode/embeddings NOT auto-started; admin-only notify.
    (Ingestion itself is still finalized COMPLETED.)"""
    from sqlalchemy import select, func
    from app.services.ingestion_service import finalize_successful_ingestion
    from app.core.context import set_admin_context

    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, seeded["log"].id)
        log.status = "PROCESSING"
        await db.commit()

    result = {"total": 10, "already": 0, "inserted": 8, "remaining": 0, "done": True,
              "failures": [{"audio_filename": "a.mp3"}, {"audio_filename": "b.mp3"}]}  # 20% fail

    with patch("app.services.ingestion_service.dispatch_webhook.delay", lambda **k: None), \
         patch("app.services.notification_service.NotificationService.notify_partner_operation",
               new_callable=AsyncMock) as mnotify, \
         patch("app.services.partner_processing_service.hetzner_service.start_transcode",
               new_callable=AsyncMock) as mtrans:
        async with AsyncSessionLocal() as db:
            log = await db.get(IngestLog, seeded["log"].id)
            await finalize_successful_ingestion(db, log, [], "live", result)

    assert mtrans.await_count == 0  # transcode NOT handed off
    assert any(c.kwargs.get("admin_only") is True for c in mnotify.await_args_list)
    async with AsyncSessionLocal() as db:
        n = (await db.execute(select(func.count()).select_from(PartnerProcessingJob).where(
            PartnerProcessingJob.ingest_log_id == seeded["log"].id,
            PartnerProcessingJob.job_type == "transcode"))).scalar()
        assert n == 0
        assert (await db.get(IngestLog, seeded["log"].id)).status == "COMPLETED"  # ingestion still succeeded


@pytest.mark.asyncio
async def test_notify_admin_only_skips_partner(seeded):
    """notify_partner_operation(admin_only=True) must NOT send/log the partner copy."""
    from app.services.notification_service import NotificationService
    from app.core.context import set_admin_context

    set_admin_context(True)
    audiences = []

    async def _fake_send(self, db, pid, ev, st, audience, *a, **k):
        audiences.append(audience)

    with patch.object(NotificationService, "_send_and_log", new=_fake_send):
        async with AsyncSessionLocal() as db:
            await NotificationService().notify_partner_operation(
                db, seeded["partner"].id, "transcode", "warning", "x", admin_only=True, commit=False)
    assert "partner" not in audiences  # partner copy skipped
