import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.models.partner import Partner, PartnerApiKey
from app.services.partner_service import PartnerService

client = TestClient(app)

@pytest.mark.asyncio
async def test_partner_me_endpoint_success():
    # Mock data
    mock_partner = Partner(
        id=1, 
        partner_uuid="test-uuid-123",
        display_name="Test Partner", 
        legal_name="Test Legal Name",
        contact_email="test@partner.com",
        tier="growth",
        is_active=True
    )
    mock_api_key = PartnerApiKey(id=10, partner_id=1, is_active=True)
    
    # Mock service
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(mock_partner, mock_api_key))
    mock_service.api_key_repo = MagicMock()
    mock_service.api_key_repo.async_touch_last_used = AsyncMock()
    
    # Override dependency
    app.dependency_overrides[PartnerService] = lambda: mock_service
    
    try:
        response = client.get(
            "/partner/me",
            headers={"Authorization": "Bearer rmx_growth_testkey"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "Test Partner"
        assert data["partner_uuid"] == "test-uuid-123"
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_partner_me_endpoint_unauthorized():
    # No header
    response = client.get("/partner/me")
    assert response.status_code == 401
    assert "Missing API Key" in response.json()["detail"]
