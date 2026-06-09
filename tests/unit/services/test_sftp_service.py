"""
Unit Tests for SftpService
==========================

Tests provisioning, retry logic, deactivation, and the new file validation logic (Phase 4).
"""

import pytest
import os
from unittest.mock import AsyncMock, patch
from pathlib import Path

from app.services.sftp_service import SftpService
from app.schemas.partner import SftpProvisionRequest
from app.models.partner import Partner
from app.models.sftp_user import SftpUser

@pytest.fixture
def mock_db():
    return AsyncMock()

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
            password_hash="hash",
            sftp_home_dir="/srv/sftp",
            use_public_key=False,
            public_key=None,
            sftp_provisioned_at=None # NOT provisioned
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)
        sftp_service.partner_repo.async_get_by_id.return_value = Partner(id=42, tier="starter")
        sftp_user_repo.mark_provisioned = AsyncMock(return_value=mock_sftp_user)
        
        with patch.object(sftp_service, '_call_hetzner_provisioning', AsyncMock()) as mock_hetzner:
            result = await sftp_service.retry_provisioning(mock_db, 42)
            mock_hetzner.assert_called_once()
            sftp_user_repo.mark_provisioned.assert_called_once()

    async def test_retry_provisioning_already_provisioned(self, sftp_service, mock_db):
        from app.services.sftp_service import sftp_user_repo
        
        mock_sftp_user = SftpUser(
            id=1, 
            sftp_provisioned_at="2026-05-20" # ALREADY provisioned
        )
        sftp_user_repo.get_by_partner_id = AsyncMock(return_value=mock_sftp_user)
        
        with pytest.raises(ValueError, match="already fully provisioned"):
            await sftp_service.retry_provisioning(mock_db, 42)

    async def test_validate_incoming_batch_no_dir(self, sftp_service):
        res = await sftp_service.validate_incoming_batch(1, "/does_not_exist_folder")
        assert res.valid is False
        assert res.error == "incoming directory not found"

    async def test_validate_incoming_batch_valid_no_checksum(self, sftp_service, tmp_path):
        # Create a temp CSV
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text("isrc,title\n123,Song\n")
        
        # We need to mock asyncio.sleep so we don't delay tests
        with patch("asyncio.sleep", AsyncMock()):
            res = await sftp_service.validate_incoming_batch(1, str(tmp_path))
            
            assert res.valid is True
            assert res.checksum_verified is False
            assert res.csv_path == csv_file

    async def test_validate_incoming_batch_invalid_headers(self, sftp_service, tmp_path):
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text("wrong,headers\n123,Song\n")
        
        with patch("asyncio.sleep", AsyncMock()):
            res = await sftp_service.validate_incoming_batch(1, str(tmp_path))
            
            assert res.valid is False
            assert "invalid CSV headers" in res.error

    async def test_validate_incoming_batch_checksum_mismatch(self, sftp_service, tmp_path):
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text("isrc,title\n123,Song\n")
        
        checksum_file = tmp_path / "manifest.sha256"
        checksum_file.write_text("wronghash  manifest.csv\n")
        
        res = await sftp_service.validate_incoming_batch(1, str(tmp_path))
        
        assert res.valid is False
        assert "checksum mismatch" in res.error

    async def test_validate_incoming_batch_checksum_success(self, sftp_service, tmp_path):
        import hashlib
        content = b"isrc,title\n123,Song\n"
        actual_hash = hashlib.sha256(content).hexdigest()
        
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_bytes(content)
        
        checksum_file = tmp_path / "manifest.sha256"
        checksum_file.write_text(f"{actual_hash}  manifest.csv\n")
        
        res = await sftp_service.validate_incoming_batch(1, str(tmp_path))
        
        assert res.valid is True
        assert res.checksum_verified is True
