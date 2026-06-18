"""
Unit Tests for SftpService
==========================

Tests provisioning, retry logic (incl. re-supplied password), per-account limit
resolution (plan defaults + admin overrides), and deactivation.
"""

import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from app.services.sftp_service import SftpService
from app.schemas.partner import SftpProvisionRequest
from app.core.security import verify_password
from app.models.partner import Partner
from app.models.sftp_user import SftpUser

@pytest.fixture
def mock_db():
    db = AsyncMock()
    # SQLAlchemy's Session.add is synchronous — keep it a plain mock so it does
    # not return an un-awaited coroutine.
    db.add = MagicMock()
    return db

@pytest.fixture
def sftp_service():
    with patch('app.services.sftp_service.PartnerRepository') as mock_partner_repo_class, \
         patch('app.services.sftp_service.sftp_user_repo') as mock_sftp_user_repo:
        
        service = SftpService()
        
        partner_repo = mock_partner_repo_class.return_value
        partner_repo.async_get_by_id = AsyncMock()
        service.partner_repo = partner_repo
        
        return service

@pytest.mark.asyncio
class TestSftpService:
    
    async def test_get_quota_bytes(self, sftp_service):
        assert sftp_service.get_quota_bytes("sandbox") == 1073741824
        assert sftp_service.get_quota_bytes("enterprise") == 0
        assert sftp_service.get_quota_bytes("unknown") == 1073741824 # fallback
        
    async def test_provision_partner_sftp_success(self, sftp_service, mock_db):
        request = SftpProvisionRequest(
            partner_id=42,
            username="testuser",
            password="testpassword123",
            use_public_key=False
        )
        
        mock_partner = Partner(id=42, tier="starter", partner_uuid="ec150000-0000-0000-0000-65c20f1c06df")
        sftp_service.partner_repo.async_get_by_id.return_value = mock_partner
        
        from app.services.sftp_service import sftp_user_repo
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=None)
        sftp_user_repo.get_by_username = AsyncMock(return_value=None)

        mock_created_sftp_user = SftpUser(id=1, partner_id=42, username="testuser")
        sftp_user_repo.async_create = AsyncMock(return_value=mock_created_sftp_user)
        sftp_user_repo.mark_provisioned = AsyncMock(return_value=mock_created_sftp_user)
        
        with patch.object(
            sftp_service,
            '_call_hetzner_provisioning',
            AsyncMock(return_value={"status": "ok"}),
        ) as mock_hetzner:
            result = await sftp_service.provision_partner_sftp(mock_db, request)

            assert result.id == 1
            sftp_user_repo.async_create.assert_called_once()
            mock_hetzner.assert_called_once()
            sftp_user_repo.mark_provisioned.assert_called_once()

    async def test_provision_partner_already_exists(self, sftp_service, mock_db):
        request = SftpProvisionRequest(
            partner_id=42,
            username="testuser",
            password="testpassword123"
        )
        sftp_service.partner_repo.async_get_by_id.return_value = Partner(id=42, tier="starter")
        
        from app.services.sftp_service import sftp_user_repo
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=SftpUser(id=1))
        
        with pytest.raises(ValueError, match="SFTP account already provisioned"):
            await sftp_service.provision_partner_sftp(mock_db, request)

    async def test_retry_provisioning_success(self, sftp_service, mock_db):
        from app.services.sftp_service import sftp_user_repo

        mock_sftp_user = SftpUser(
            id=1,
            partner_id=42,
            username="testuser",
            password_hash="oldhash",
            sftp_home_dir="/srv/sftp",
            use_public_key=False,
            public_key=None,
            quota_bytes=None,
            sftp_provisioned_at=None  # NOT provisioned
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)
        sftp_service.partner_repo.async_get_by_id.return_value = Partner(id=42, tier="starter")
        sftp_user_repo.mark_provisioned = AsyncMock(return_value=mock_sftp_user)

        with patch.object(sftp_service, '_call_hetzner_provisioning', AsyncMock()) as mock_hetzner:
            # The admin re-supplies the password on retry (it is never stored in plaintext).
            await sftp_service.retry_provisioning(mock_db, 42, password="freshpassword123")
            mock_hetzner.assert_called_once()
            sftp_user_repo.mark_provisioned.assert_called_once()

    async def test_retry_provisioning_requires_password_for_password_account(self, sftp_service, mock_db):
        """A password-auth account cannot be retried without re-supplying the password."""
        from app.services.sftp_service import sftp_user_repo

        mock_sftp_user = SftpUser(
            id=1, partner_id=42, username="testuser", password_hash="oldhash",
            use_public_key=False, sftp_provisioned_at=None,
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)

        with pytest.raises(ValueError, match="Password is required"):
            await sftp_service.retry_provisioning(mock_db, 42)  # no password

    async def test_retry_provisioning_updates_stored_hash(self, sftp_service, mock_db):
        """On a successful retry, the stored bcrypt hash is replaced with the hash of
        the newly supplied password, AND that exact plaintext is sent to SFTPGo."""
        from app.services.sftp_service import sftp_user_repo

        mock_sftp_user = SftpUser(
            id=1, partner_id=42, username="testuser", password_hash="oldhash",
            sftp_home_dir="/srv/sftp", use_public_key=False, public_key=None,
            quota_bytes=None, sftp_provisioned_at=None,
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)
        sftp_service.partner_repo.async_get_by_id.return_value = Partner(id=42, tier="starter")
        sftp_user_repo.mark_provisioned = AsyncMock(return_value=mock_sftp_user)

        with patch.object(sftp_service, '_call_hetzner_provisioning', AsyncMock()) as mock_hetzner:
            await sftp_service.retry_provisioning(mock_db, 42, password="brandnewpass99")

        # Stored hash now verifies against the new password (not the old "oldhash").
        assert mock_sftp_user.password_hash != "oldhash"
        assert verify_password("brandnewpass99", mock_sftp_user.password_hash)
        # The PLAINTEXT password (what SFTPGo actually hashes) was forwarded.
        _, kwargs = mock_hetzner.call_args
        assert kwargs.get("password") == "brandnewpass99"

    async def test_retry_public_key_account_without_password_ok(self, sftp_service, mock_db):
        """A public-key account can be retried without a password."""
        from app.services.sftp_service import sftp_user_repo

        mock_sftp_user = SftpUser(
            id=1, partner_id=42, username="testuser", password_hash=None,
            sftp_home_dir="/srv/sftp", use_public_key=True, public_key="ssh-ed25519 AAAA key",
            quota_bytes=None, sftp_provisioned_at=None,
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)
        sftp_service.partner_repo.async_get_by_id.return_value = Partner(id=42, tier="starter")
        sftp_user_repo.mark_provisioned = AsyncMock(return_value=mock_sftp_user)

        with patch.object(sftp_service, '_call_hetzner_provisioning', AsyncMock()) as mock_hetzner:
            await sftp_service.retry_provisioning(mock_db, 42)  # no password, key account
            mock_hetzner.assert_called_once()

    async def test_retry_provisioning_already_provisioned(self, sftp_service, mock_db):
        from app.services.sftp_service import sftp_user_repo

        mock_sftp_user = SftpUser(
            id=1,
            sftp_provisioned_at="2026-05-20" # ALREADY provisioned
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)

        with pytest.raises(ValueError, match="already fully provisioned"):
            await sftp_service.retry_provisioning(mock_db, 42, password="whatever123")

    # ── Per-account SFTP limit resolution (plan defaults + admin overrides) ──────

    async def test_plan_defaults_quota_per_tier(self, sftp_service):
        assert sftp_service.plan_defaults("sandbox")["quota_bytes"] == 1073741824
        assert sftp_service.plan_defaults("enterprise")["quota_bytes"] == 0
        # Sandbox ships with throttled bandwidth + a low session cap by default.
        assert sftp_service.plan_defaults("sandbox")["max_sessions"] == 2
        assert sftp_service.plan_defaults("sandbox")["upload_bandwidth"] == 2048

    async def test_resolve_sftp_limits_uses_plan_defaults_when_no_override(self, sftp_service):
        req = SftpProvisionRequest(partner_id=1, password="testpassword123")
        resolved = sftp_service.resolve_sftp_limits("sandbox", req)
        assert resolved["quota_bytes"] == 1073741824       # sandbox default
        assert resolved["max_sessions"] == 2               # sandbox default
        assert resolved["download_bandwidth"] == 4096       # sandbox default

    async def test_resolve_sftp_limits_override_wins(self, sftp_service):
        req = SftpProvisionRequest(
            partner_id=1, password="testpassword123",
            quota_bytes=12884901888,   # 12 GB override
            max_sessions=7,
            upload_bandwidth=0,        # 0 = unlimited, explicit override
        )
        resolved = sftp_service.resolve_sftp_limits("sandbox", req)
        assert resolved["quota_bytes"] == 12884901888       # override
        assert resolved["max_sessions"] == 7                # override
        assert resolved["upload_bandwidth"] == 0            # explicit 0 override honored
        # Untouched field still falls back to the tier default.
        assert resolved["download_bandwidth"] == 4096

    async def test_effective_limits_quota_falls_back_for_legacy_row(self, sftp_service):
        """Legacy rows (NULL quota_bytes) fall back to the tier default; other NULL
        caps are simply omitted so SFTPGo applies no limit."""
        legacy = SftpUser(id=1, partner_id=1, quota_bytes=None)
        partner = Partner(id=1, tier="starter")
        out = sftp_service.effective_limits(legacy, partner)
        assert out["quota_size"] == 10737418240   # starter tier default
        assert "max_sessions" not in out          # NULL → omitted
