import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, status
from app.api.dependencies.partner import get_current_partner
from app.models.partner import Partner, PartnerApiKey
from datetime import datetime, timedelta

@pytest.mark.asyncio
async def test_get_current_partner_success():
    # Mock dependencies
    mock_request = MagicMock()
    mock_request.client.host = "127.0.0.1"
    mock_auth = MagicMock()
    mock_auth.credentials = "rmx_live_testkey123"
    mock_db = AsyncMock()
    
    mock_partner = Partner(id=1, display_name="Test Partner", is_active=True)
    mock_api_key = PartnerApiKey(id=10, partner_id=1, is_active=True, expires_at=None)
    
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(mock_partner, mock_api_key))
    
    # Run dependency
    mock_bg = MagicMock()
    with patch("app.api.dependencies.partner.rate_limit_service.check_rate_limits") as mock_rl:
        mock_rl.return_value = (True, "", None)
        result = await get_current_partner(
            request=mock_request,
            background_tasks=mock_bg,
            auth=mock_auth,
            api_key_token=None,
            db=mock_db,
            partner_service=mock_service
        )
    
    # Assertions
    assert result == mock_partner
    assert mock_request.state.partner_id == 1
    assert mock_request.state.api_key_id == 10
    
    # Verify usage update was queued in background
    mock_bg.add_task.assert_called_with(mock_service.update_api_key_usage, 10, "127.0.0.1")

@pytest.mark.asyncio
async def test_get_current_partner_missing_auth():
    mock_request = MagicMock()
    mock_auth = None
    mock_db = AsyncMock()
    mock_service = MagicMock()
    
    with pytest.raises(HTTPException) as excinfo:
        await get_current_partner(
            request=mock_request,
            background_tasks=MagicMock(),
            auth=mock_auth,
            api_key_token=None,
            db=mock_db,
            partner_service=mock_service
        )
    
    assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Authentication required" in excinfo.value.detail

@pytest.mark.asyncio
async def test_get_current_partner_invalid_format():
    mock_request = MagicMock()
    mock_auth = MagicMock()
    mock_auth.credentials = "invalid_key_no_prefix"
    mock_db = AsyncMock()
    mock_service = MagicMock()
    
    with pytest.raises(HTTPException) as excinfo:
        await get_current_partner(
            request=mock_request,
            background_tasks=MagicMock(),
            auth=mock_auth,
            api_key_token=None,
            db=mock_db,
            partner_service=mock_service
        )
    
    assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Could not validate credentials" in excinfo.value.detail

@pytest.mark.asyncio
async def test_get_current_partner_service_error():
    mock_request = MagicMock()
    mock_auth = MagicMock()
    mock_auth.credentials = "rmx_live_badkey"
    mock_db = AsyncMock()
    
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(side_effect=ValueError("API key has been revoked"))
    
    with pytest.raises(HTTPException) as excinfo:
        await get_current_partner(
            request=mock_request,
            background_tasks=MagicMock(),
            auth=mock_auth,
            api_key_token=None,
            db=mock_db,
            partner_service=mock_service
        )
    
    assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "API key has been revoked" in excinfo.value.detail
