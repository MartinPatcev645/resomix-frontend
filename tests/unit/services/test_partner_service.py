"""
Unit Tests for PartnerService
=============================

Isolated testing for partner management and API key lifecycle logic.
Mocks repository and logging dependencies.

Version: 1.0.0
Date: May 09, 2026
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.partner_service import PartnerService
from app.schemas.partner import PartnerCreateRequest, ApiKeyIssueRequest, ApiKeyRotateRequest, PartnerTier
from app.models.partner import Partner, PartnerApiKey

@pytest.mark.asyncio
class TestPartnerService:
    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def partner_service(self):
        with patch('app.services.partner_service.PartnerRepository') as mock_repo_class, \
             patch('app.services.partner_service.PartnerApiKeyRepository') as mock_api_repo_class, \
             patch('app.services.partner_service.LoggingService') as mock_logging_class:
            
            service = PartnerService()
            # Configure repository mocks to have AsyncMock for async methods
            partner_repo = mock_repo_class.return_value
            partner_repo.async_create = AsyncMock()
            partner_repo.async_get_by_id = AsyncMock()
            partner_repo.async_list_partners = AsyncMock()
            
            api_key_repo = mock_api_repo_class.return_value
            api_key_repo.async_create = AsyncMock()
            api_key_repo.async_get_by_id = AsyncMock()
            api_key_repo.async_revoke_key = AsyncMock()
            api_key_repo.async_list_keys_for_partner = AsyncMock()
            
            service.partner_repo = partner_repo
            service.api_key_repo = api_key_repo
            service.logging_service = mock_logging_class.return_value
            return service

    async def test_generate_api_key(self, partner_service):
        """Test key generation entropy and format."""
        plaintext, key_hash, prefix = partner_service.generate_api_key("live")
        
        assert plaintext.startswith("rmx_live_")
        assert len(plaintext) > 40
        assert len(key_hash) == 64  # SHA-256 hex digest
        assert prefix == plaintext[:16]

    async def test_create_partner(self, partner_service, mock_db):
        """Test partner creation logic."""
        request = PartnerCreateRequest(
            legal_name="Acme Corp",
            display_name="Acme",
            contact_email="admin@acme.com",
            tier=PartnerTier.GROWTH
        )
        
        mock_partner = Partner(id=1, partner_uuid="uuid-123", display_name="Acme", tier="growth")
        partner_service.partner_repo.async_create.return_value = mock_partner
        
        result = await partner_service.create_partner(mock_db, request)
        
        assert result.display_name == "Acme"
        partner_service.partner_repo.async_create.assert_called_once()
        partner_service.logging_service.log.assert_called_once()

    async def test_issue_api_key(self, partner_service, mock_db):
        """Test API key issuance logic."""
        partner_id = 42
        request = ApiKeyIssueRequest(
            partner_id=partner_id,
            label="Dev Key",
            scopes=["search:read"]
        )
        
        mock_partner = Partner(id=partner_id, tier="starter")
        partner_service.partner_repo.async_get_by_id.return_value = mock_partner
        
        mock_key = PartnerApiKey(id=1, partner_id=partner_id, key_prefix="rmx_starter_...", is_active=True)
        partner_service.api_key_repo.async_create.return_value = mock_key
        
        key_obj, plaintext = await partner_service.issue_api_key(mock_db, request)
        
        assert plaintext.startswith("rmx_starter_")
        assert key_obj.id == 1
        partner_service.api_key_repo.async_create.assert_called_once()
        
    async def test_issue_api_key_partner_not_found(self, partner_service, mock_db):
        """Test issuance fails when partner doesn't exist."""
        request = ApiKeyIssueRequest(partner_id=999, label="Test")
        partner_service.partner_repo.async_get_by_id.return_value = None
        
        with pytest.raises(ValueError, match="Partner with ID 999 not found"):
            await partner_service.issue_api_key(mock_db, request)

    async def test_revoke_api_key(self, partner_service, mock_db):
        """Test key revocation logic."""
        api_key_id = 100
        mock_key = PartnerApiKey(id=api_key_id, partner_id=1, key_prefix="rmx_...")
        partner_service.api_key_repo.async_revoke_key.return_value = mock_key
        
        success = await partner_service.revoke_api_key(mock_db, api_key_id, "Security breach")
        
        assert success is True
        partner_service.api_key_repo.async_revoke_key.assert_called_once_with(mock_db, api_key_id, "Security breach", commit=False)

    async def test_rotate_api_key(self, partner_service, mock_db):
        """Test key rotation (atomic revoke + issue)."""
        old_key_id = 5
        mock_old_key = PartnerApiKey(
            id=old_key_id, 
            partner_id=10, 
            label="Old Label",
            scopes=["search:read"],
            rate_limit_rps=10,
            rate_limit_monthly=1000,
            is_active=True
        )
        partner_service.api_key_repo.async_get_by_id.return_value = mock_old_key
        
        # Mocking issue_api_key behavior within rotation
        mock_new_key = PartnerApiKey(id=6, partner_id=10)
        
        # We need to mock both async_revoke_key and the issue_api_key call
        with patch.object(partner_service, 'issue_api_key', AsyncMock(return_value=(mock_new_key, "new-plaintext"))):
            result_key, plaintext = await partner_service.rotate_api_key(mock_db, ApiKeyRotateRequest(api_key_id=old_key_id))
            
            assert plaintext == "new-plaintext"
            assert result_key.id == 6
            partner_service.api_key_repo.async_revoke_key.assert_called_once()
            partner_service.issue_api_key.assert_called_once()

    async def test_rotate_api_key_inactive(self, partner_service, mock_db):
        """Test rotation fails for already inactive key."""
        old_key_id = 7
        mock_old_key = PartnerApiKey(id=old_key_id, is_active=False)
        partner_service.api_key_repo.async_get_by_id.return_value = mock_old_key
        
        with pytest.raises(ValueError, match="Cannot rotate an inactive or already revoked API key"):
            await partner_service.rotate_api_key(mock_db, ApiKeyRotateRequest(api_key_id=old_key_id))
