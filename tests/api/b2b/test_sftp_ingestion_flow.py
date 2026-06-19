import pytest
import os
import uuid
import tempfile
import csv
import time
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from app.main import app
from app.models.partner import Partner
from app.models.party import Party
from app.models.label import Label
from app.models.sftp_user import SftpUser
from app.models.b2b import IngestLog, IngestionError
from app.models.track import Track
from app.core.security import hash_password
from app.repositories.sftp_user_repository import sftp_user_repo
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
                "partner_uuid": partner.partner_uuid,
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
    # The home dir is now derived from the partner UUID slug (partners/<slug>),
    # not the integer partner id.
    slug = creds["partner_uuid"].split("-")[-1]
    assert slug in data["home_dir"]
    # Lockdown policy: root is list-only; uploads are confined to live/ and test/.
    assert data["permissions"]["/"] == ["list"]
    assert "upload" in data["permissions"]["/live"]
    assert "upload" in data["permissions"]["/test"]
    assert data["permissions"]["/processing"] == ["list"]
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

# A pair of well-formed (but fake) OpenSSH public keys. Only the algorithm + key
# body matter for matching; the trailing comment is intentionally varied to prove
# the hook ignores it.
_PUBKEY_A = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITESTPARTNERKEYBODYAAAAAAAAAAAAAAAAAAAA partner@laptop"
_PUBKEY_A_DIFFERENT_COMMENT = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITESTPARTNERKEYBODYAAAAAAAAAAAAAAAAAAAA someone-else@ci"
_PUBKEY_B = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIFFERENTKEYBODYBBBBBBBBBBBBBBBBBBBBBBBBBB attacker@host"


async def _configure_sftp_user(username, **fields):
    """Mutate the fixture's SFTP user row with the given columns (e.g. allowed_ip,
    use_public_key, public_key) so a single test can exercise a specific scenario."""
    async with AsyncSessionLocal() as db:
        sftp_user = await sftp_user_repo.get_by_username(db, username)
        for key, value in fields.items():
            setattr(sftp_user, key, value)
        db.add(sftp_user)
        await db.commit()


@pytest.mark.asyncio
async def test_sftp_auth_hook_ip_whitelist_allows_listed_ip(setup_sftp_partner, temp_sftp_dir):
    """A connection from a whitelisted IP authenticates and the allowed_ip filter is
    echoed back to SFTPGo."""
    creds = setup_sftp_partner
    await _configure_sftp_user(creds["username"], allowed_ip="203.0.113.5,203.0.113.6")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "password": creds["password"], "ip": "203.0.113.5"},
        )

    data = response.json()
    assert data["status"] == 1
    # The IP whitelist is passed through to SFTPGo for its own enforcement too.
    assert data["filters"]["allowed_ip"] == ["203.0.113.5", "203.0.113.6"]


@pytest.mark.asyncio
async def test_sftp_auth_hook_ip_whitelist_denies_unlisted_ip(setup_sftp_partner, temp_sftp_dir):
    """A correct password from an IP NOT on the whitelist is denied by the hook
    itself (defense in depth), not just by the SFTPGo filter."""
    creds = setup_sftp_partner
    await _configure_sftp_user(creds["username"], allowed_ip="203.0.113.5")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "password": creds["password"], "ip": "198.51.100.9"},
        )

    data = response.json()
    assert data["status"] == 0
    assert data["username"] == ""


@pytest.mark.asyncio
async def test_sftp_auth_hook_public_key_success(setup_sftp_partner, temp_sftp_dir):
    """A key-enabled account authenticates with a matching public key and NO password
    — the partner keeps their private key and logs in with it."""
    creds = setup_sftp_partner
    await _configure_sftp_user(creds["username"], use_public_key=True, public_key=_PUBKEY_A)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "public_key": _PUBKEY_A, "password": "", "ip": "127.0.0.1"},
        )

    data = response.json()
    assert data["status"] == 1
    assert data["username"] == creds["username"]
    # SFTPGo is told which key(s) are authorized for this virtual user.
    assert _PUBKEY_A in data["public_keys"]


@pytest.mark.asyncio
async def test_sftp_auth_hook_public_key_ignores_comment(setup_sftp_partner, temp_sftp_dir):
    """The same key material with a different trailing comment still authenticates."""
    creds = setup_sftp_partner
    await _configure_sftp_user(creds["username"], use_public_key=True, public_key=_PUBKEY_A)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "public_key": _PUBKEY_A_DIFFERENT_COMMENT, "ip": "127.0.0.1"},
        )

    assert response.json()["status"] == 1


@pytest.mark.asyncio
async def test_sftp_auth_hook_public_key_mismatch_denied(setup_sftp_partner, temp_sftp_dir):
    """A different (wrong) public key is denied — and must NOT silently fall through
    to password verification."""
    creds = setup_sftp_partner
    await _configure_sftp_user(creds["username"], use_public_key=True, public_key=_PUBKEY_A)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "public_key": _PUBKEY_B, "ip": "127.0.0.1"},
        )

    data = response.json()
    assert data["status"] == 0
    assert data["username"] == ""


@pytest.mark.asyncio
async def test_sftp_auth_hook_public_key_on_password_only_account_denied(setup_sftp_partner, temp_sftp_dir):
    """A key attempt against a password-only account (use_public_key False) is denied."""
    creds = setup_sftp_partner  # fixture user has use_public_key=False, no public_key

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/internal/sftp/auth",
            json={"username": creds["username"], "public_key": _PUBKEY_A, "ip": "127.0.0.1"},
        )

    assert response.json()["status"] == 0


async def _wait_for_log(partner_id, max_wait=5.0, wait_interval=0.25):
    """Poll for the ingest_log row the background hand-off task creates."""
    from sqlalchemy import select
    elapsed = 0.0
    while elapsed < max_wait:
        async with AsyncSessionLocal() as db:
            log = (
                await db.execute(select(IngestLog).where(IngestLog.partner_id == partner_id))
            ).scalar_one_or_none()
        if log is not None:
            return log
        await asyncio.sleep(wait_interval)
        elapsed += wait_interval
    return None


@pytest.mark.asyncio
async def test_sftp_ingestion_event_hands_off_to_media_server(setup_sftp_partner, temp_sftp_dir):
    """A .done upload event hands the batch off to the Hetzner media server.

    Alwyzon no longer parses the CSV or creates tracks locally — the files live on
    the media server. The event hook only opens an ingest_log (PROCESSING) and POSTs
    the job to Hetzner; the admin status poll later persists the result. The actual
    CSV validation + track creation is exercised by the Hetzner ingestion_runner suite.
    """
    creds = setup_sftp_partner
    partner_id = creds["partner_id"]

    from app.core.context import set_current_partner_id
    set_current_partner_id(partner_id)

    with patch(
        "app.services.hetzner_service.HetznerService.start_ingestion",
        new_callable=AsyncMock,
    ) as mock_start, patch(
        "app.services.ingestion_service.dispatch_webhook.delay"
    ):
        mock_start.return_value = {"success": True}
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post(
                "/internal/sftp/event",
                json={
                    "action": "upload",
                    "name": ".done",
                    "username": creds["username"],
                    "virtual_target_path": "/live/.done",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        ingest_log = await _wait_for_log(partner_id)

    assert ingest_log is not None
    # The hand-off opens the log in PROCESSING; it is only advanced to a terminal
    # state later when the admin polls Hetzner for the result.
    assert ingest_log.status == "PROCESSING"
    # The media server was actually asked to run the ingestion for this partner/env.
    mock_start.assert_awaited_once()
    _, kwargs = mock_start.call_args
    assert kwargs["partner_id"] == partner_id
    assert kwargs["env"] == "live"


@pytest.mark.asyncio
async def test_sftp_event_rejects_done_when_batch_active(setup_sftp_partner, temp_sftp_dir):
    """A .done that arrives while the partner already has an ACTIVE batch is
    rejected: the media box is asked to delete only the marker, the partner is
    notified, and NO second ingestion is started (no new ingest_logs row)."""
    from sqlalchemy import select, func
    from app.models.b2b import IngestLog
    from app.models.party import Party
    from app.services.ingestion_stages import Stage, advance_stage

    creds = setup_sftp_partner
    partner_id = creds["partner_id"]

    # Seed one ACTIVE batch (INGESTED is non-terminal → blocks new uploads).
    async with AsyncSessionLocal() as db:
        party_id = (await db.execute(
            select(Party.party_id).where(Party.partner_id == partner_id).limit(1)
        )).scalar_one()
        active = IngestLog(
            partner_id=partner_id, party_id=party_id,
            package_folder="x/live", status="PROCESSING",
        )
        advance_stage(active, Stage.INGESTED)
        db.add(active)
        await db.commit()

    from app.core.context import set_current_partner_id
    set_current_partner_id(partner_id)

    with patch(
        "app.services.hetzner_service.HetznerService.reject_done", new_callable=AsyncMock
    ) as mock_reject, patch(
        "app.services.hetzner_service.HetznerService.start_ingestion", new_callable=AsyncMock
    ) as mock_start, patch(
        "app.services.ingestion_service.dispatch_webhook.delay"
    ):
        mock_reject.return_value = {"success": True, "data": {"deleted": True}}
        async with AsyncClient(app=app, base_url="http://test") as ac:
            resp = await ac.post(
                "/internal/sftp/event",
                json={
                    "action": "upload", "name": ".done",
                    "username": creds["username"], "virtual_target_path": "/live/.done",
                },
            )

    assert resp.status_code == 200
    # Reject path taken synchronously; no ingestion handed off.
    mock_reject.assert_awaited_once()
    mock_start.assert_not_awaited()

    # Still exactly one batch for this partner — no duplicate was created.
    async with AsyncSessionLocal() as db:
        count = (await db.execute(
            select(func.count(IngestLog.id)).where(IngestLog.partner_id == partner_id)
        )).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_sftp_ingestion_handoff_failure_marks_log_failed(setup_sftp_partner, temp_sftp_dir):
    """If the media-server hand-off fails, the ingest_log is marked FAILED with the error."""
    creds = setup_sftp_partner
    partner_id = creds["partner_id"]

    from app.core.context import set_current_partner_id
    set_current_partner_id(partner_id)

    with patch(
        "app.services.hetzner_service.HetznerService.start_ingestion",
        new_callable=AsyncMock,
    ) as mock_start, patch(
        "app.services.ingestion_service.dispatch_webhook.delay"
    ):
        mock_start.return_value = {"success": False, "error": "media server unreachable"}
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post(
                "/internal/sftp/event",
                json={
                    "action": "upload",
                    "name": ".done",
                    "username": creds["username"],
                    "virtual_target_path": "/live/.done",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        # Poll until the hand-off task flips the log to FAILED.
        from sqlalchemy import select
        ingest_log = None
        for _ in range(20):
            async with AsyncSessionLocal() as db:
                ingest_log = (
                    await db.execute(select(IngestLog).where(IngestLog.partner_id == partner_id))
                ).scalar_one_or_none()
            if ingest_log is not None and ingest_log.status == "FAILED":
                break
            await asyncio.sleep(0.25)

    assert ingest_log is not None
    assert ingest_log.status == "FAILED"
    assert "media server unreachable" in (ingest_log.error_message or "")
