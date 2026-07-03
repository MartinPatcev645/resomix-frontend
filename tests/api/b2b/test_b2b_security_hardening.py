import pytest
import os
import uuid
import tempfile
import csv
import asyncio
from pathlib import Path
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.context import set_current_partner_id, set_admin_context
from app.core.security import hash_password
from database.connection import AsyncSessionLocal

from app.models.partner import Partner, PartnerApiKey
from app.models.party import Party
from app.models.label import Label
from app.models.sftp_user import SftpUser
from app.models.track import Track
from app.models.b2b import IngestLog, IngestionError

from app.services.partner_service import PartnerService
from app.schemas.partner import ApiKeyIssueRequest
from app.db.redis import init_redis_pool, close_redis_pool

@pytest.fixture(scope="module")
async def setup_redis():
    """Ensure Redis connection pool is initialized for idempotency tests."""
    await init_redis_pool()
    yield
    await close_redis_pool()

@pytest.fixture(scope="module")
def temp_sftp_dir():
    """Create a temporary directory for SFTP testing and inject it into the environment."""
    with tempfile.TemporaryDirectory() as temp_dir:
        old_val = os.environ.get("SFTP_BASE_PATH")
        os.environ["SFTP_BASE_PATH"] = temp_dir
        
        from app.core.config import settings
        old_setting = settings.sftp_base_path
        settings.sftp_base_path = temp_dir
        
        yield temp_dir
        
        # Teardown
        if old_val is not None:
            os.environ["SFTP_BASE_PATH"] = old_val
        elif "SFTP_BASE_PATH" in os.environ:
            del os.environ["SFTP_BASE_PATH"]
            
        settings.sftp_base_path = old_setting

@pytest.fixture
async def setup_two_partners():
    """
    Sets up two isolated test partners:
    Partner 2 (Starter tier) and Partner 3 (Growth tier)
    complete with API Keys, Labels, Parties, and SFTP Users.
    """
    set_admin_context(True)
    
    async with AsyncSessionLocal() as db:
        # 1. Partner 2 Setup (Starter tier)
        p2 = Partner(
            partner_uuid=str(uuid.uuid4()),
            display_name="Hardening Partner 2",
            legal_name="Partner 2 Corp",
            contact_email=f"p2_{uuid.uuid4().hex[:6]}@hardening.com",
            tier="starter",
            is_active=True
        )
        db.add(p2)
        await db.flush()
        
        party2 = Party(
            party_id=f"HARD-PARTY-2-{p2.id}",
            partner_id=p2.id,
            party_name="Party 2"
        )
        db.add(party2)
        await db.flush()
        
        label2 = Label(label_name="Label 2", partner_id=p2.id, party_id=party2.party_id)
        db.add(label2)
        await db.flush()
        
        # 2. Partner 3 Setup (Growth tier)
        p3 = Partner(
            partner_uuid=str(uuid.uuid4()),
            display_name="Hardening Partner 3",
            legal_name="Partner 3 Corp",
            contact_email=f"p3_{uuid.uuid4().hex[:6]}@hardening.com",
            tier="growth",
            is_active=True
        )
        db.add(p3)
        await db.flush()
        
        party3 = Party(
            party_id=f"HARD-PARTY-3-{p3.id}",
            partner_id=p3.id,
            party_name="Party 3"
        )
        db.add(party3)
        await db.flush()
        
        label3 = Label(label_name="Label 3", partner_id=p3.id, party_id=party3.party_id)
        db.add(label3)
        await db.flush()
        
        # 3. Create SFTP Users
        sftp_user2 = SftpUser(
            label_id=label2.id,
            partner_id=p2.id,
            username=f"sftp_hard_2_{uuid.uuid4().hex[:6]}",
            password_hash=hash_password("password222!"),
            home_directory=f"/srv/sftp/partners/{p2.id}",
            is_active=True
        )
        db.add(sftp_user2)
        
        sftp_user3 = SftpUser(
            label_id=label3.id,
            partner_id=p3.id,
            username=f"sftp_hard_3_{uuid.uuid4().hex[:6]}",
            password_hash=hash_password("password333!"),
            home_directory=f"/srv/sftp/partners/{p3.id}",
            is_active=True
        )
        db.add(sftp_user3)
        await db.flush()
        
        # 4. Issue API Keys using PartnerService to ensure correct encryption/hashing
        service = PartnerService()
        req2 = ApiKeyIssueRequest(
            partner_id=p2.id,
            label="Partner 2 Hardening Key",
            scopes=["similarity:read", "search", "search:read", "metadata", "similarity"]
        )
        key_record2, plaintext_key2 = await service.issue_api_key(db, req2)
        
        req3 = ApiKeyIssueRequest(
            partner_id=p3.id,
            label="Partner 3 Hardening Key",
            scopes=["similarity:read", "search", "search:read", "metadata", "similarity"]
        )
        key_record3, plaintext_key3 = await service.issue_api_key(db, req3)
        
        await db.commit()
        await db.refresh(p2)
        await db.refresh(p3)
        await db.refresh(key_record2)
        await db.refresh(key_record3)
        
        try:
            yield {
                "p2": {
                    "partner_id": p2.id,
                    "uuid": p2.partner_uuid,
                    "plaintext_key": plaintext_key2,
                    "key_id": key_record2.id,
                    "sftp_username": sftp_user2.username,
                    "sftp_password": "password222!",
                },
                "p3": {
                    "partner_id": p3.id,
                    "uuid": p3.partner_uuid,
                    "plaintext_key": plaintext_key3,
                    "key_id": key_record3.id,
                    "sftp_username": sftp_user3.username,
                    "sftp_password": "password333!",
                }
            }
        finally:
            # Cleanup in reverse order
            set_admin_context(True)
            async with AsyncSessionLocal() as cleanup_db:
                import sqlalchemy as sa
                for pid in [p2.id, p3.id]:
                    # Purge dependency data
                    await cleanup_db.execute(sa.delete(Track).where(Track.partner_id == pid))
                    await cleanup_db.execute(sa.delete(IngestionError).where(IngestionError.partner_id == pid))
                    await cleanup_db.execute(sa.delete(IngestLog).where(IngestLog.partner_id == pid))
                    # Purge setup entities
                    await cleanup_db.execute(sa.delete(PartnerApiKey).where(PartnerApiKey.partner_id == pid))
                    await cleanup_db.execute(sa.delete(SftpUser).where(SftpUser.partner_id == pid))
                    await cleanup_db.execute(sa.delete(Label).where(Label.partner_id == pid))
                    await cleanup_db.execute(sa.delete(Party).where(Party.partner_id == pid))
                    await cleanup_db.execute(sa.delete(Partner).where(Partner.id == pid))
                await cleanup_db.commit()
            set_admin_context(False)

@pytest.mark.asyncio
async def test_idempotency_cross_tenant_collision(setup_redis, setup_two_partners):
    """
    Ensure that identical Idempotency-Key values from different partners
    are completely isolated and do not lead to cross-tenant response leaks.
    """
    data = setup_two_partners
    p2 = data["p2"]
    p3 = data["p3"]
    
    idempotency_key = f"hardening-key-{uuid.uuid4()}"
    track_uuid = str(uuid.uuid4())
    payload = {"track_id": track_uuid, "top_sk": 10}
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Partner 2 makes first request
        res1 = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={
                "Authorization": f"Bearer {p2['plaintext_key']}",
                "Idempotency-Key": idempotency_key
            }
        )
        assert res1.status_code == 404  # Not found is cached as part of client response range
        assert "X-Idempotency-Hit" not in res1.headers
        
        # 2. Partner 3 makes request with EXACT same Idempotency-Key
        res2 = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={
                "Authorization": f"Bearer {p3['plaintext_key']}",
                "Idempotency-Key": idempotency_key
            }
        )
        assert res2.status_code == 404
        # Critically: should NOT be an idempotency hit from Partner 2's cache!
        assert "X-Idempotency-Hit" not in res2.headers
        
        # 3. Partner 2 replays the original request
        res3 = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={
                "Authorization": f"Bearer {p2['plaintext_key']}",
                "Idempotency-Key": idempotency_key
            }
        )
        assert res3.status_code == 404
        # Partner 2's replay SHOULD hit Partner 2's own cache!
        assert res3.headers.get("X-Idempotency-Hit") == "true"

@pytest.mark.asyncio
async def test_csv_ingestion_malicious_payloads(setup_two_partners, temp_sftp_dir):
    """
    Verify that SQL Injection and Path Traversal strings in an ingestion result are
    treated strictly as literals, inserted safely, and do not lead to privilege escalation.

    CSV parsing/validation now runs on the (DB-less) Hetzner media server, which POSTs a
    validated record set back. In v2, ``apply_ingestion_result`` does NOT persist inline for a
    completed+live batch — it claims the batch (stage=PERSISTING, status stays PROCESSING) and
    hands the insert to a background task, which persists every record through
    ``persist_records_chunked`` using the ORM (fully parameterized). That chunked persist is the
    layer where injection safety matters, so we drive it directly with a malicious record set and
    assert literal storage (tables intact, strings stored verbatim).
    """
    from app.services.ingestion_service import apply_ingestion_result
    from app.services.ingestion_persist import persist_records_chunked
    from app.services.ingestion_stages import Stage

    data = setup_two_partners
    p2 = data["p2"]
    partner_id = p2["partner_id"]

    set_admin_context(True)
    set_current_partner_id(partner_id)

    # Open a PROCESSING ingest_log, mirroring what the SFTP event hand-off creates.
    party_id = f"HARD-PARTY-2-{partner_id}"
    async with AsyncSessionLocal() as db:
        log = IngestLog(
            partner_id=partner_id,
            party_id=party_id,
            package_folder=f"/srv/sftp/partners/{partner_id}/live",
            status="PROCESSING",
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        log_id = log.id

    # Simulate the media server's "completed" result carrying hostile literals.
    records = [
        {
            "track_uuid": str(uuid.uuid4()),
            "isrc": "USSQL2600001",
            "title": "'; DROP TABLE tracks; --",
            "audio_filename": "track1.wav",
            "display_artist": "Artist 1",
        },
        {
            "track_uuid": str(uuid.uuid4()),
            "isrc": "USPAT2600002",
            "title": "../../../../etc/passwd",
            "audio_filename": "track2.wav",
            "display_artist": "Artist 2",
        },
    ]
    state = {"status": "completed", "env": "live", "records": records}

    # v2 claim step: applying the result marks the batch PERSISTING and enqueues the
    # background persist ONCE — it does not finalize or persist inline (that is the task's job).
    with patch("app.tasks.ingestion_tasks.persist_and_finalize_ingestion.delay") as mock_delay:
        async with AsyncSessionLocal() as db:
            log = await db.get(IngestLog, log_id)
            log = await apply_ingestion_result(db, log, state)
        assert log.stage == Stage.PERSISTING
        assert log.status == "PROCESSING"  # not finalized inline — the task does that
        mock_delay.assert_called_once_with(log_id)

    # Run the persistence the background task would run, in-process, over the hostile records.
    # This is the ORM insert path where injection safety must hold.
    result = await persist_records_chunked(
        partner_id=partner_id,
        party_id=party_id,
        log_id=log_id,
        records=records,
        env="live",
    )
    assert result["inserted"] == 2
    assert result["failures"] == []

    # Assert database is safe and strings are inserted literally (tables intact).
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        tracks = (
            await db.execute(
                select(Track).where(Track.partner_id == partner_id).order_by(Track.id)
            )
        ).scalars().all()

        assert len(tracks) == 2
        # SQL injection title stored exactly as a literal string (tables intact).
        assert tracks[0].isrc == "USSQL2600001"
        assert tracks[0].title == "'; DROP TABLE tracks; --"
        # Path traversal title stored exactly as a literal string.
        assert tracks[1].isrc == "USPAT2600002"
        assert tracks[1].title == "../../../../etc/passwd"

    set_admin_context(False)

@pytest.mark.asyncio
async def test_sftp_impersonation_attempts(setup_two_partners):
    """
    Verify authentication reject scenarios, and prove that sending fake webhook
    event payloads resolved usernames securely via DB check, preventing impersonation.
    """
    data = setup_two_partners
    p2 = data["p2"]
    p3 = data["p3"]
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Verification of invalid credentials hook
        bad_auth = await client.post(
            "/internal/sftp/auth",
            json={
                "username": p2["sftp_username"],
                "password": "wrong_password_attempt",
                "ip": "127.0.0.1"
            }
        )
        assert bad_auth.status_code == 200
        assert bad_auth.json()["status"] == 0
        assert bad_auth.json()["username"] == ""
        
        # 2. Impersonation on Event Hook with non-existent user
        fake_event = await client.post(
            "/internal/sftp/event",
            json={
                "action": "upload",
                "name": ".done",
                "username": "impersonator_non_existent",
                "virtual_target_path": "/incoming/.done"
            }
        )
        assert fake_event.status_code == 200
        # Should gracefully return ok status but do nothing since username lookup fails safely
        assert fake_event.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_api_key_lifecycle_and_enumeration(setup_two_partners):
    """
    Verify that revoked/inactive keys are strictly rejected, and querying assets belonging
    to another partner strictly returns 404 (not found) instead of leakage or bypasses.
    """
    data = setup_two_partners
    p2 = data["p2"]
    p3 = data["p3"]
    
    set_admin_context(True)
    
    # Inject a private track under Partner 3
    p3_track_uuid = str(uuid.uuid4())
    p3_title = f"Secret Partner 3 Asset {p3_track_uuid[:6]}"
    async with AsyncSessionLocal() as db:
        new_track = Track(
            uuid=p3_track_uuid,
            title=p3_title,
            isrc=f"P3-{p3_track_uuid[:6]}",
            partner_id=p3["partner_id"],
            ingestion_source="csv",
            is_active=True
        )
        db.add(new_track)
        
        # Deactivate Partner 2 key for lifecycle verification
        from sqlalchemy import update
        await db.execute(
            update(PartnerApiKey)
            .where(PartnerApiKey.id == p2["key_id"])
            .values(is_active=False)
        )
        await db.commit()
        
    set_admin_context(False)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Request with Revoked/Inactive key of Partner 2
        payload = {"track_id": p3_track_uuid, "top_sk": 10}
        res_revoked = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={"Authorization": f"Bearer {p2['plaintext_key']}"}
        )
        # Should be rejected with 401/403
        assert res_revoked.status_code in [401, 403]
        
        # 2. Request Partner 3's private asset using Partner 3's own key
        res_p3 = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={"Authorization": f"Bearer {p3['plaintext_key']}"}
        )
        # Verify Partner 3 can query their own track (returns 404/200 depending on similarity server, but is not unauthorized)
        assert res_p3.status_code != 401
        assert res_p3.status_code != 403
        
        # 3. Cross-Tenant Enumeration Attempt:
        # We temporarily reactivate Partner 2's key to test cross-tenant boundary verification
        set_admin_context(True)
        async with AsyncSessionLocal() as db:
            from sqlalchemy import update
            await db.execute(
                update(PartnerApiKey)
                .where(PartnerApiKey.id == p2["key_id"])
                .values(is_active=True)
            )
            await db.commit()
        set_admin_context(False)
        
        # Partner 2 attempts to query Partner 3's secret track
        res_cross = await client.post(
            "/api/v1/similarity/search",
            json=payload,
            headers={"Authorization": f"Bearer {p2['plaintext_key']}"}
        )
        # If tenant isolation works, this must return 404 Not Found (behaving as if the track doesn't exist)
        assert res_cross.status_code == 404
        
        # Partner 2 attempts to search for Partner 3's secret track title
        res_search = await client.get(
            f"/api/v1/search_tracks/?query={p3_title}",
            headers={"Authorization": f"Bearer {p2['plaintext_key']}"}
        )
        assert res_search.status_code == 200
        search_data = res_search.json()
        # Must return empty results
        assert len(search_data["data"]["tracks"]) == 0
