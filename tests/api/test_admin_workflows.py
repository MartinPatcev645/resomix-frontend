import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.main import app
from app.core.config import settings
from app.models.partner import Partner

@pytest.mark.asyncio
async def test_admin_waitlist_workflow():
    """
    Verify admin waitlist listing and status update.
    """
    from app.controllers.waitlist_controller import WaitlistController
    mock_controller = MagicMock(spec=WaitlistController)
    
    # Mock listing matching AdminWaitlistListResponse schema
    mock_controller.get_waitlist_list_admin = AsyncMock(return_value={
        "success": True,
        "data": [
            {
                "id": 1, 
                "email": "test@test.com", 
                "status": "pending",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 30,
            "total": 1,
            "total_pages": 1
        }
    })
    
    # Mock status update matching AdminWaitlistDetailResponse schema
    mock_controller.update_waitlist_status_admin = AsyncMock(return_value={
        "success": True,
        "data": {
            "id": 1, 
            "email": "test@test.com", 
            "status": "approved",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z"
        },
        "message": "Status updated successfully"
    })
    
    # Apply override
    with patch("app.api.routers.admin.waitlist.waitlist_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            
            # 1. List waitlist
            res = await ac.get("/api/v1/admin/waitlist/", headers=headers)
            assert res.status_code == 200
            assert res.json()["pagination"]["total"] == 1
            
            # 2. Update status
            res = await ac.post(
                "/api/v1/admin/waitlist/update-status/1",
                headers=headers,
                json={"status": "approved"}
            )
            assert res.status_code == 200
            assert res.json()["data"]["status"] == "approved"
            
            # 3. Verify 403 for missing key
            res = await ac.get("/api/v1/admin/waitlist/")
            assert res.status_code == 403

@pytest.mark.asyncio
async def test_admin_feedback_workflow():
    """
    Verify admin feedback listing and stats.
    """
    from app.controllers.feedback_controller import FeedbackController
    mock_controller = MagicMock(spec=FeedbackController)
    
    mock_controller.get_feedback_list_admin = AsyncMock(return_value={
        "success": True,
        "data": [],
        "pagination": {
            "page": 1, "page_size": 30, "total": 0, "total_pages": 0
        }
    })
    
    mock_controller.get_feedback_statistics_admin = AsyncMock(return_value={
        "success": True,
        "stats": {
            "total": 10, "open": 5, "resolved": 5,
            "avg_satisfaction": 4.5, "avg_recommendation": 4.7,
            "by_category": {"general": 10}
        }
    })
    
    from app.services.partner_service import PartnerService
    mock_p_svc = MagicMock()
    p1 = Partner(id=1, partner_uuid=str(uuid.uuid4()), display_name="System", is_active=True)
    mock_p_svc.partner_repo.async_get_by_id = AsyncMock(return_value=p1)
    
    app.dependency_overrides[PartnerService] = lambda: mock_p_svc
    
    with patch("app.api.routers.admin.feedback.feedback_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"Authorization": f"Bearer {settings.api_key}"}
            res = await ac.get("/api/v1/admin/feedback/", headers=headers)
            assert res.status_code == 200
            res = await ac.get("/api/v1/admin/feedback/stats", headers=headers)
            assert res.status_code == 200

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_admin_partner_management():
    """
    Verify partner CRUD and API key management via Admin API.
    """
    from app.controllers.partner_controller import PartnerController
    mock_controller = MagicMock(spec=PartnerController)
    
    # Matching PartnerResponse -> { "success": bool, "data": PartnerBaseResponse }
    mock_controller.create_partner = AsyncMock(return_value={
        "success": True,
        "data": {
            "id": 100, "partner_uuid": str(uuid.uuid4()), "display_name": "New Partner",
            "legal_name": "Legal", "contact_email": "p@test.com", "tier": "sandbox",
            "is_active": True, "onboarded_at": datetime.utcnow().isoformat()
        }
    })
    
    # Matching ApiKeyIssueSuccessResponse -> { "success": bool, "data": ApiKeyIssueResponse }
    mock_controller.issue_api_key = AsyncMock(return_value={
        "success": True,
        "data": {
            "plaintext_key": "rmx_test_secret_123",
            "key_prefix": "rmx_test",
            "label": "Test Key",
            "scopes": ["similarity:read"],
            "expires_at": None
        }
    })
    
    # Matching PartnerResponse for GET /{partner_id}
    mock_controller.get_partner = AsyncMock(return_value={
        "success": True,
        "data": {
            "id": 100, "partner_uuid": str(uuid.uuid4()), "display_name": "New Partner",
            "legal_name": "Legal", "contact_email": "p@test.com", "tier": "sandbox",
            "is_active": True, "onboarded_at": datetime.utcnow().isoformat()
        }
    })
    
    with patch("app.api.routers.admin.partners.partner_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.post("/api/v1/admin/partners/", headers=headers, json={
                "display_name": "New Partner", "legal_name": "Legal", "contact_email": "p@test.com", "tier": "sandbox"
            })
            assert res.status_code == 201
            assert res.json()["data"]["id"] == 100
            
            res = await ac.post("/api/v1/admin/partners/api-keys/issue", headers=headers, json={
                "partner_id": 100, "label": "Key", "tier": "sandbox", "scopes": ["similarity:read"]
            })
            assert res.status_code == 201
            assert "plaintext_key" in res.json()["data"]

            # Test GET /api/v1/admin/partners/{partner_id}
            res = await ac.get("/api/v1/admin/partners/100", headers=headers)
            assert res.status_code == 200
            assert res.json()["success"] is True
            assert res.json()["data"]["id"] == 100
            assert res.json()["data"]["display_name"] == "New Partner"


@pytest.mark.asyncio
async def test_admin_contact_management():
    """
    Verify contact inquiry management via Admin API.
    """
    from app.controllers.contact_controller import ContactController
    mock_controller = MagicMock(spec=ContactController)
    
    mock_controller.get_contact_list_admin = AsyncMock(return_value={
        "success": True,
        "data": [{"id": 1, "name": "U", "email": "u@t.com", "message": "Hi", "status": "open"}],
        "pagination": {"page": 1, "page_size": 30, "total": 1, "total_pages": 1}
    })
    
    mock_controller.mark_contact_status_admin = AsyncMock(return_value={
        "success": True,
        "message": "Status updated",
        "data": {"id": 1, "status": "resolved", "name": "U", "email": "u@t.com"}
    })
    
    with patch("app.api.routers.admin.contact.contact_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.get("/api/v1/admin/contact/", headers=headers)
            assert res.status_code == 200
            res = await ac.post("/api/v1/admin/contact/mark-status/1", headers=headers, json={"status": "resolved"})
            assert res.status_code == 200
            assert res.json()["data"]["status"] == "resolved"

@pytest.mark.asyncio
async def test_admin_security_enforcement():
    """
    Ensure admin endpoints block regular B2B keys or invalid keys.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/admin/waitlist/")
        assert res.status_code in [401, 403]
        res = await ac.get("/api/v1/admin/waitlist/", headers={"X-API-KEY": "wrong"})
        assert res.status_code == 403
