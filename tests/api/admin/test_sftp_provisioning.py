import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from database.connection import AsyncSessionLocal
from app.models.user import User, Role
from app.models.partner import Partner
from app.core.security import hash_password, create_access_token
from app.repositories.rbac_repository import RBACRepository
from sqlalchemy import text
from unittest.mock import patch, AsyncMock

@pytest.fixture
async def admin_auth_headers():
    """Admin-role JWT (replaces the retired static super-key) for admin routes."""
    from tests.api.library_helpers import create_admin_user, admin_auth_headers as _hdrs
    return _hdrs(await create_admin_user())

@pytest.fixture
async def sample_partner():
    """Create a sample partner to provision SFTP for."""
    async with AsyncSessionLocal() as db:
        partner = Partner(
            partner_uuid=str(uuid.uuid4()),
            legal_name=f"Partner_{uuid.uuid4().hex[:6]}",
            display_name=f"Partner_{uuid.uuid4().hex[:6]}",
            contact_email=f"contact_{uuid.uuid4().hex[:6]}@example.com",
            tier="growth"
        )
        db.add(partner)
        await db.commit()
        await db.refresh(partner)
        
        # Ensure party exists
        await db.execute(text("INSERT IGNORE INTO parties (party_id, party_name) VALUES ('ARGO_01', 'Test Party')"))
        await db.commit()
        
        yield partner

@pytest.mark.asyncio
async def test_provision_sftp_success(admin_auth_headers, sample_partner):
    """Test provisioning SFTP for a partner successfully."""
    transport = ASGITransport(app=app)
    
    # Mock the sftp service call so we don't actually hit the external Hetzner API
    from app.models.sftp_user import SftpUser
    with patch("app.services.sftp_service.SftpService.provision_partner_sftp", new_callable=AsyncMock) as mock_provision:
        from datetime import datetime, timezone
        mock_user = SftpUser(
            id=999,
            partner_id=sample_partner.id,
            username="test_sftp_user",
            home_directory=f"/srv/sftp/partners/{sample_partner.id}",
            sftp_home_dir=f"/srv/sftp/partners/{sample_partner.id}",
            sftp_provisioned_at=datetime.now(timezone.utc),
            use_public_key=False
        )
        mock_provision.return_value = mock_user
        
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "partner_id": sample_partner.id,
                "username": "test_sftp_user",
                "password": "SecurePassword123!",
                "use_public_key": False
            }
            res = await ac.post("/api/v1/admin/partners/sftp/provision", json=payload, headers=admin_auth_headers)
            
            if res.status_code != 201:
                print(res.json())
            assert res.status_code == 201
            data = res.json()
            assert data["success"] is True
            assert "data" in data
            assert data["data"]["partner_id"] == sample_partner.id
            assert data["data"]["username"] == "test_sftp_user"

@pytest.mark.asyncio
async def test_provision_sftp_failure(admin_auth_headers, sample_partner):
    """Test provisioning SFTP handles failures correctly."""
    transport = ASGITransport(app=app)
    
    with patch("app.services.sftp_service.SftpService.provision_partner_sftp", new_callable=AsyncMock) as mock_provision:
        mock_provision.side_effect = Exception("Failed to connect to SFTPGo admin API")
        
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "partner_id": sample_partner.id,
                "username": "test_sftp_user_2",
                "password": "SecurePassword123!",
                "use_public_key": False
            }
            res = await ac.post("/api/v1/admin/partners/sftp/provision", json=payload, headers=admin_auth_headers)
            
            assert res.status_code == 500
            data = res.json()
            assert data["success"] is False
            assert "error" in data
