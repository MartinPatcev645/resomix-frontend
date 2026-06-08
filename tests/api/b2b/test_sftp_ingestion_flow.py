import pytest
import os
import uuid
import tempfile
import csv
import time
import asyncio
from pathlib import Path
from httpx import AsyncClient

from app.main import app
from app.models.partner import Partner
from app.models.party import Party
from app.models.label import Label
from app.models.sftp_user import SftpUser
from app.models.b2b import IngestLog, IngestionError
from app.models.track import Track
from app.core.security import hash_password
from database.connection import AsyncSessionLocal

@pytest.fixture(scope="module")
def temp_sftp_dir():
    with tempfile.TemporaryDirectory() as temp_dir:
        os.environ["SFTP_BASE_PATH"] = temp_dir
        
        # Also patch the global settings object used by the app
        from app.core.config import settings
        original_base_path = settings.sftp_base_path
        settings.sftp_base_path = temp_dir
        
        yield temp_dir
        
        if "SFTP_BASE_PATH" in os.environ:
            del os.environ["SFTP_BASE_PATH"]
        settings.sftp_base_path = original_base_path

@pytest.fixture
async def setup_sftp_partner():
    """Fixture to create a partner, label, and SFTP user in the database."""
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    async with AsyncSessionLocal() as db:
        # Create partner
        partner = Partner(
            partner_uuid=str(uuid.uuid4()),
            display_name="SFTP Test Partner",
            legal_name="SFTP Test Partner Inc",
            contact_email=f"test_{uuid.uuid4().hex[:8]}@sftp-partner.com",
            tier="growth",
            is_active=True
        )
        db.add(partner)
        await db.flush()

        # Create Party
        party = Party(
            party_id=f"SFTP-PARTY-{partner.id}",
            partner_id=partner.id,
            party_name="SFTP Test Party"
        )
        db.add(party)
        await db.flush()

        # Create label
        label = Label(label_name="SFTP Test Label", partner_id=partner.id, party_id=party.party_id)
        db.add(label)
        await db.flush()

        # Create SFTP User with a completely unique username per fixture call
        username = f"test_sftp_{uuid.uuid4().hex[:10]}"
        plain_password = "sftp_secure_password"
        
        sftp_user = SftpUser(
            label_id=label.id,
            partner_id=partner.id,
            username=username,
            password_hash=hash_password(plain_password),
            home_directory=f"/srv/sftp/partners/{partner.id}",
            is_active=True
        )
        db.add(sftp_user)
        await db.commit()
        await db.refresh(sftp_user)
        
        try:
            yield {
                "partner_id": partner.id,
                "username": username,
                "password": plain_password,
                "sftp_user_id": sftp_user.id
            }
        finally:
            # Teardown in reverse order
            async with AsyncSessionLocal() as cleanup_db:
                # We need a new session or fresh transaction to ensure cleanup runs even if transaction failed
                import sqlalchemy as sa
                # Delete any generated data for this partner first to avoid FK constraints
                await cleanup_db.execute(sa.delete(Track).where(Track.partner_id == partner.id))
                await cleanup_db.execute(sa.delete(IngestionError).where(IngestionError.partner_id == partner.id))
                await cleanup_db.execute(sa.delete(IngestLog).where(IngestLog.partner_id == partner.id))
                
                # Delete fixture objects
                await cleanup_db.execute(sa.delete(SftpUser).where(SftpUser.id == sftp_user.id))
                await cleanup_db.execute(sa.delete(Label).where(Label.id == label.id))
                await cleanup_db.execute(sa.delete(Party).where(Party.id == party.id))
                await cleanup_db.execute(sa.delete(Partner).where(Partner.id == partner.id))
                await cleanup_db.commit()

@pytest.mark.asyncio
async def test_sftp_auth_hook_success(setup_sftp_partner, temp_sftp_dir):
    """Test SFTPGo authentication hook with valid credentials."""
    creds = setup_sftp_partner
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={
                "username": creds["username"],
                "password": creds["password"],
                "ip": "127.0.0.1"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == 1
    assert data["username"] == creds["username"]
    assert str(creds["partner_id"]) in data["home_dir"]
    assert "upload" in data["permissions"]["/"]
    assert data["quota_size"] == 53687091200

@pytest.mark.asyncio
async def test_sftp_auth_hook_invalid_password(setup_sftp_partner, temp_sftp_dir):
    """Test SFTPGo authentication hook with invalid password."""
    creds = setup_sftp_partner
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={
                "username": creds["username"],
                "password": "wrong_password",
                "ip": "127.0.0.1"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == 0
    assert data["username"] == ""

@pytest.mark.asyncio
async def test_sftp_ingestion_flow_failed(setup_sftp_partner, temp_sftp_dir):
    """Test that a single row failure rejects and rolls back the entire batch."""
    creds = setup_sftp_partner
    partner_id = creds["partner_id"]
    
    # Establish partner context in the test thread to satisfy the multi-tenancy global failsafe
    from app.core.context import set_current_partner_id
    set_current_partner_id(partner_id)
    
    incoming_path = Path(temp_sftp_dir) / "partners" / str(partner_id) / "live"
    incoming_path.mkdir(parents=True, exist_ok=True)

    # Write physical audio files
    (incoming_path / "track1.wav").write_text("audio data")
    (incoming_path / "track2.wav").write_text("audio data")
    
    csv_file = incoming_path / "metadata.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["isrc", "title", "audio_filename", "display_artist"])
        writer.writeheader()
        writer.writerow({"isrc": "USXXX2600001", "title": "Test Track 1", "audio_filename": "track1.wav", "display_artist": "Artist One"})
        writer.writerow({"isrc": "", "title": "Test Track 2", "audio_filename": "track2.wav", "display_artist": "Artist Two"}) # Invalid: missing ISRC
    
    # 1. Trigger the event hook
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/event",
            json={
                "action": "upload",
                "name": ".done",
                "username": creds["username"],
                "virtual_target_path": "/live/.done"
            }
        )
    
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # 2. Wait for BackgroundTask to complete in the background loop
    max_wait = 5.0
    wait_interval = 0.5
    elapsed = 0.0
    
    ingest_log = None
    async with AsyncSessionLocal() as db:
        while elapsed < max_wait:
            from sqlalchemy import select
            log_stmt = select(IngestLog).where(IngestLog.partner_id == partner_id)
            log_res = await db.execute(log_stmt)
            ingest_log = log_res.scalar_one_or_none()
            if ingest_log and ingest_log.status in ["COMPLETED", "FAILED"]:
                break
            await asyncio.sleep(wait_interval)
            elapsed += wait_interval
    
    # 3. Verify Database state - Atomic Rollback
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        log_stmt = select(IngestLog).where(IngestLog.partner_id == partner_id)
        log_res = await db.execute(log_stmt)
        ingest_log = log_res.scalar_one_or_none()
        
        assert ingest_log is not None
        assert ingest_log.status == "FAILED" # Because row 2 had an error
        assert ingest_log.track_count == 0 # 0 ingested tracks because of rollback!
        
        # Check Track table is empty for this partner
        track_stmt = select(Track).where(Track.partner_id == partner_id)
        track_res = await db.execute(track_stmt)
        tracks = track_res.scalars().all()
        assert len(tracks) == 0
        
        # Check IngestionError
        err_stmt = select(IngestionError).where(IngestionError.ingest_log_id == ingest_log.id)
        err_res = await db.execute(err_stmt)
        errors = err_res.scalars().all()
        
        assert len(errors) == 1
        assert "Missing required field 'isrc'" in errors[0].error_message


@pytest.mark.asyncio
async def test_sftp_ingestion_flow_success(setup_sftp_partner, temp_sftp_dir):
    """Test successful ingestion when all rows are valid and physical files exist."""
    creds = setup_sftp_partner
    partner_id = creds["partner_id"]
    
    from app.core.context import set_current_partner_id
    set_current_partner_id(partner_id)
    
    incoming_path = Path(temp_sftp_dir) / "partners" / str(partner_id) / "live"
    incoming_path.mkdir(parents=True, exist_ok=True)

    # Write physical files
    (incoming_path / "track1.wav").write_text("audio data 1")
    (incoming_path / "track2.wav").write_text("audio data 2")
    
    csv_file = incoming_path / "metadata.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["isrc", "title", "audio_filename", "display_artist", "bpm"])
        writer.writeheader()
        writer.writerow({"isrc": "USXXX2600001", "title": "Test Track 1", "audio_filename": "track1.wav", "display_artist": "Artist One", "bpm": "128"})
        writer.writerow({"isrc": "GBBGD1987654", "title": "Test Track 2", "audio_filename": "track2.wav", "display_artist": "Artist Two", "bpm": "120"})
        
    # Trigger the event hook
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/event",
            json={
                "action": "upload",
                "name": ".done",
                "username": creds["username"],
                "virtual_target_path": "/live/.done"
            }
        )
    
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    max_wait = 5.0
    wait_interval = 0.5
    elapsed = 0.0
    
    ingest_log = None
    async with AsyncSessionLocal() as db:
        while elapsed < max_wait:
            from sqlalchemy import select
            log_stmt = select(IngestLog).where(IngestLog.partner_id == partner_id)
            log_res = await db.execute(log_stmt)
            ingest_log = log_res.scalar_one_or_none()
            if ingest_log and ingest_log.status in ["COMPLETED", "FAILED"]:
                break
            await asyncio.sleep(wait_interval)
            elapsed += wait_interval
            
    # Verify Database state - Successful Commit
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        log_stmt = select(IngestLog).where(IngestLog.partner_id == partner_id)
        log_res = await db.execute(log_stmt)
        ingest_log = log_res.scalar_one_or_none()
        
        assert ingest_log is not None
        assert ingest_log.status == "COMPLETED"
        assert ingest_log.track_count == 2
        
        # Check Tracks exist
        track_stmt = select(Track).where(Track.partner_id == partner_id).order_by(Track.id)
        track_res = await db.execute(track_stmt)
        tracks = track_res.scalars().all()
        
        assert len(tracks) == 2
        assert tracks[0].isrc == "USXXX2600001"
        assert tracks[0].bpm == 128
        assert tracks[1].isrc == "GBBGD1987654"
        assert tracks[1].bpm == 120
        
        # Check Audio files exist and are associated
        from app.models.audio_file import AudioFile
        audio_stmt = select(AudioFile).where(AudioFile.partner_id == partner_id).order_by(AudioFile.id)
        audio_res = await db.execute(audio_stmt)
        audios = audio_res.scalars().all()
        
        assert len(audios) == 2
        assert audios[0].track_id == tracks[0].id
        assert audios[0].original_filename == "track1.wav"
        assert audios[1].track_id == tracks[1].id
        assert audios[1].original_filename == "track2.wav"
