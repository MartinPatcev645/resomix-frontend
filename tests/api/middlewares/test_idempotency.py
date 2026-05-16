import pytest
import uuid
import asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.db.redis import init_redis_pool, close_redis_pool
from app.models.partner import Partner, PartnerApiKey
from app.core.config import settings

@pytest.fixture(scope="module")
async def setup_redis():
    await init_redis_pool()
    yield
    await close_redis_pool()

@pytest.fixture
def mock_partner_data():
    p = Partner(id=1, partner_uuid=str(uuid.uuid4()), display_name="Test Partner")
    k = PartnerApiKey(id=1, partner_id=1, is_active=True)
    return p, k

@pytest.mark.asyncio
async def test_idempotency_replay_success(setup_redis, mock_partner_data):
    """Verify that replaying a request with the same key returns the cached response."""
    partner, api_key = mock_partner_data
    
    with patch("app.api.middlewares.idempotency.PartnerService") as mock_service_class:
        mock_service = mock_service_class.return_value
        mock_service.validate_api_key = AsyncMock(return_value=(partner, api_key))
        
        # Also mock it for the router dependency
        from app.services.partner_service import PartnerService as RealPartnerService
        app.dependency_overrides[RealPartnerService] = lambda: mock_service
        
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                idempotency_key = str(uuid.uuid4())
                headers = {
                    "Authorization": "Bearer rmx_test_key",
                    "Idempotency-Key": idempotency_key,
                    "Content-Type": "application/json"
                }
                
                payload = {"track_id": str(uuid.uuid4()), "top_sk": 20}
                
                # 1. First request
                res1 = await ac.post("/api/v1/similarity/search", json=payload, headers=headers)
                assert res1.status_code in [200, 404]
                assert res1.headers.get("X-Idempotency-Hit") is None
                data1 = res1.json()
                
                # 2. Replay request
                res2 = await ac.post("/api/v1/similarity/search", json=payload, headers=headers)
                assert res2.status_code == res1.status_code
                assert res2.headers.get("X-Idempotency-Hit") == "true"
                data2 = res2.json()
                
                assert data1 == data2
        finally:
            app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_idempotency_partner_scoping(setup_redis):
    """Verify that keys are scoped to partners."""
    p1 = Partner(id=1, partner_uuid=str(uuid.uuid4()))
    k1 = PartnerApiKey(id=1, partner_id=1, is_active=True)
    
    p2 = Partner(id=2, partner_uuid=str(uuid.uuid4()))
    k2 = PartnerApiKey(id=2, partner_id=2, is_active=True)
    
    shared_key = "shared-key-" + str(uuid.uuid4())
    payload = {"track_id": str(uuid.uuid4()), "top_sk": 20}

    with patch("app.api.middlewares.idempotency.PartnerService") as mock_service_class:
        mock_service = mock_service_class.return_value
        
        from app.services.partner_service import PartnerService as RealPartnerService
        app.dependency_overrides[RealPartnerService] = lambda: mock_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Request 1 (Partner 1)
            mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
            res1 = await ac.post("/api/v1/similarity/search", json=payload, headers={
                "Authorization": "Bearer rmx_k1", "Idempotency-Key": shared_key
            })
            assert res1.status_code in [200, 404]
            assert res1.headers.get("X-Idempotency-Hit") is None
            
            # Request 2 (Partner 2) - SAME KEY
            mock_service.validate_api_key = AsyncMock(return_value=(p2, k2))
            res2 = await ac.post("/api/v1/similarity/search", json=payload, headers={
                "Authorization": "Bearer rmx_k2", "Idempotency-Key": shared_key
            })
            assert res2.status_code in [200, 404]
            assert res2.headers.get("X-Idempotency-Hit") is None
            
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_idempotency_jwt_success(setup_redis):
    """Verify that frontend users with JWT also get idempotency support."""
    from app.models.user import User
    # User model doesn't have is_active, use is_email_verified
    mock_user = User(id=1, email="test@example.com", is_email_verified=True, uuid=str(uuid.uuid4()))
    
    with patch("app.api.middlewares.idempotency.get_current_user_optional") as mock_auth:
        mock_auth.return_value = mock_user
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            key = str(uuid.uuid4())
            # Waitlist needs X-API-KEY for auth, plus Bearer for our JWT test
            headers = {
                "Authorization": "Bearer valid_jwt", 
                "Idempotency-Key": key,
                "X-API-KEY": settings.api_key
            }
            payload = {"email": f"test-{uuid.uuid4()}@example.com"}
            
            # 1. First request to waitlist (POST)
            res1 = await ac.post("/api/v1/waitlist/", json=payload, headers=headers)
            assert res1.status_code == 200
            assert res1.headers.get("X-Idempotency-Hit") is None
            
            # 2. Replay
            res2 = await ac.post("/api/v1/waitlist/", json=payload, headers=headers)
            assert res2.status_code == 200
            assert res2.headers.get("X-Idempotency-Hit") == "true"
            assert res1.json() == res2.json()

@pytest.mark.asyncio
async def test_idempotency_security_invalid_token(setup_redis):
    """Security: Verify that invalid tokens never trigger a cache hit."""
    # We'll use a key that DEFINITELY exists for Partner 1
    p1 = Partner(id=1, partner_uuid=str(uuid.uuid4()))
    k1 = PartnerApiKey(id=1, partner_id=1, is_active=True)
    
    shared_key = "security-test-" + str(uuid.uuid4())
    payload = {"email": "test@example.com"}

    with patch("app.api.middlewares.idempotency.PartnerService") as mock_service_class:
        mock_service = mock_service_class.return_value
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Seed the cache with a valid request
            mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
            await ac.post("/api/v1/waitlist/", json=payload, headers={
                "Authorization": "Bearer rmx_valid", "Idempotency-Key": shared_key
            })
            
            # 2. Try to hit that cache with an INVALID token
            # Middleware should fail auth and NOT check Redis
            mock_service.validate_api_key.side_effect = ValueError("Invalid token")
            
            res_bad = await ac.post("/api/v1/waitlist/", json=payload, headers={
                "Authorization": "Bearer rmx_invalid", "Idempotency-Key": shared_key
            })
            
            # Should be 403 (from router's get_api_key) and NO idempotency hit
            assert res_bad.status_code == 403
            assert res_bad.headers.get("X-Idempotency-Hit") is None

@pytest.mark.asyncio
async def test_idempotency_ignore_get(setup_redis):
    """Verify that GET requests ignore the idempotency key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        key = str(uuid.uuid4())
        # Health check is a GET
        res1 = await ac.get("/health", headers={"Idempotency-Key": key})
        assert res1.status_code == 200
        assert res1.headers.get("X-Idempotency-Hit") is None
        
        # Second GET should still not be a "hit"
        res2 = await ac.get("/health", headers={"Idempotency-Key": key})
        assert res2.status_code == 200
        assert res2.headers.get("X-Idempotency-Hit") is None
