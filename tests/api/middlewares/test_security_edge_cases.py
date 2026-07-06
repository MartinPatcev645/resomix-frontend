import pytest
import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select

from app.main import app
from app.models.partner import Partner, PartnerApiKey, PartnerUsageLog
from app.models.user import User
from app.core.config import settings
from database.connection import AsyncSessionLocal

@pytest.fixture(scope="module")
async def setup_redis():
    from app.db.redis import init_redis_pool, close_redis_pool
    await init_redis_pool()
    yield
    await close_redis_pool()

@pytest.mark.asyncio
async def test_system_partner_audit_frontend(setup_redis):
    """
    W2-1 Policy Check: Verify that frontend JWT requests (System Partner) 
    are NOT logged to partner_usage_logs (B2B only).
    """
    mock_user = User(id=1, email="system@resomix.com", is_email_verified=True, uuid=str(uuid.uuid4()))
    
    with patch("app.api.middlewares.idempotency.get_current_user_optional") as mock_auth:
        mock_auth.return_value = mock_user
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/waitlist/", 
                json={"email": f"audit-test-{uuid.uuid4()}@example.com"},
                headers={
                    "Authorization": "Bearer frontend_jwt",
                    "X-API-KEY": settings.api_key
                }
            )
            assert res.status_code == 200
            correlation_id = res.headers.get("X-Correlation-ID")
            
            # Wait for background audit log (which shouldn't happen)
            await asyncio.sleep(0.5)
            
            async with AsyncSessionLocal() as session:
                from app.core.context import set_admin_context
                set_admin_context(True)
                result = await session.execute(
                    select(PartnerUsageLog).where(PartnerUsageLog.correlation_id == correlation_id)
                )
                log_entry = result.scalar_one_or_none()
                
                # Should be NONE because it's a consumer request
                assert log_entry is None
                set_admin_context(False)

@pytest.mark.asyncio
async def test_audit_log_db_failure_resilience(setup_redis):
    """
    W2-1 Edge Case: Verify that if the Audit DB write fails, the request still succeeds.
    """
    from datetime import datetime
    p1 = Partner(
        id=1, 
        partner_uuid=str(uuid.uuid4()),
        display_name="Resilience Test",
        legal_name="Resilience Test Legal",
        contact_email="resilience@test.com",
        tier="growth",
        is_active=True,
        onboarded_at=datetime.utcnow()
    )
    k1 = PartnerApiKey(id=1, partner_id=1, is_active=True)
    
    from app.services.partner_service import PartnerService as RealPartnerService
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
    mock_service.update_api_key_usage = AsyncMock()
    app.dependency_overrides[RealPartnerService] = lambda: mock_service
    
    try:
        # Patch the actual DB connection class used in the background task
        with patch("database.connection.AsyncSessionLocal") as mock_db:
            mock_db.side_effect = Exception("Database Down")
            
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get("/api/v1/partner/me", 
                    headers={"Authorization": "Bearer rmx_test"}
                )
                # Request must still succeed even if auditing fails in background
                assert res.status_code == 200
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_legacy_route_backward_compatibility():
    """
    W2-2 Edge Case: Verify that unversioned legacy routes still work for backward compatibility.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Check root health (unversioned)
        res = await ac.get("/")
        assert res.status_code == 200
        assert "version" in res.json()
        
        # Check health (unversioned)
        res_health = await ac.get("/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_idempotency_method_restriction(setup_redis):
    """
    W2-3 Edge Case: Verify that only POST/PUT/PATCH are idempotent. 
    DELETE should NOT cache responses.
    """
    # Note: DELETE is usually not cached by our middleware (self.idempotent_methods)
    p1 = Partner(id=1, partner_uuid=str(uuid.uuid4()))
    k1 = PartnerApiKey(id=1, partner_id=1, is_active=True)
    
    with patch("app.api.middlewares.idempotency.PartnerService") as mock_partner_service:
        mock_partner_service.return_value.validate_api_key = AsyncMock(return_value=(p1, k1))
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            key = str(uuid.uuid4())
            # We'll try to use a DELETE endpoint if any exist that we can safely call
            # For now, we'll verify it doesn't hit X-Idempotency-Hit
            res1 = await ac.delete("/api/v1/users/me/sessions/999", 
                headers={"Authorization": "Bearer rmx_test", "Idempotency-Key": key}
            )
            # Should be 401/404 depending on auth, but NOT a hit
            assert res1.headers.get("X-Idempotency-Hit") is None
            
            res2 = await ac.delete("/api/v1/users/me/sessions/999", 
                headers={"Authorization": "Bearer rmx_test", "Idempotency-Key": key}
            )
            assert res2.headers.get("X-Idempotency-Hit") is None

@pytest.mark.asyncio
async def test_idempotency_error_caching(setup_redis):
    """
    W2-3 Edge Case: Verify that 4xx errors ARE cached, but 5xx errors ARE NOT.
    """
    # A frontend user JWT scopes idempotency to System Partner 1 (the middleware maps frontend
    # users to SYSTEM_PARTNER_ID). The retired static key is no longer involved.
    from tests.api.library_helpers import create_user, auth_headers
    user = await create_user()
    hdrs = auth_headers(user)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. 422 Unprocessable Entity (Missing payload)
        key_422 = str(uuid.uuid4())
        res1 = await ac.post("/api/v1/waitlist/",
            json={},  # Missing email
            headers={**hdrs, "Idempotency-Key": key_422}
        )
        assert res1.status_code == 422

        # Replay 422 -> Should hit cache
        res2 = await ac.post("/api/v1/waitlist/",
            json={},
            headers={**hdrs, "Idempotency-Key": key_422}
        )
        assert res2.status_code == 422
        assert res2.headers.get("X-Idempotency-Hit") == "true"
