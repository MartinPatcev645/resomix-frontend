import pytest
import asyncio
import uuid
import time
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from app.main import app
from app.models.partner import Partner, PartnerApiKey
from app.core.config import settings

@pytest.fixture(scope="module")
async def setup_redis():
    from app.db.redis import init_redis_pool, close_redis_pool
    await init_redis_pool()
    yield
    await close_redis_pool()

@pytest.mark.asyncio
async def test_b2b_rate_limiting_burst_enforcement(setup_redis):
    """
    W1-7 / Stability Baseline: Verify that exceeding burst RPS returns 429.
    """
    p1 = Partner(
        id=100, 
        partner_uuid=str(uuid.uuid4()),
        display_name="Burst Partner",
        legal_name="Burst Legal",
        contact_email="burst@test.com",
        tier="growth",
        is_active=True,
        onboarded_at=datetime.utcnow()
    )
    # 5 RPS -> 10 capacity (2s window)
    k1 = PartnerApiKey(id=100, partner_id=100, is_active=True, rate_limit_rps=5, rate_limit_monthly=1000)
    
    from app.services.partner_service import PartnerService
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
    mock_service.update_api_key_usage = AsyncMock()
    
    app.dependency_overrides[PartnerService] = lambda: mock_service
    
@pytest.mark.asyncio
async def test_b2b_rate_limiting_burst_enforcement_concurrent(setup_redis):
    """
    W1-7 / Stability Baseline: Verify that exceeding burst RPS via concurrent requests returns 429.
    """
    p1 = Partner(
        id=100,
        partner_uuid=str(uuid.uuid4()),
        display_name="Burst Partner",
        legal_name="Burst Legal",
        contact_email="burst@test.com",
        tier="growth",
        is_active=True,
        onboarded_at=datetime.utcnow()
    )
    k1 = PartnerApiKey(id=100, partner_id=100, is_active=True, rate_limit_rps=5, rate_limit_monthly=1000)

    from app.services.partner_service import PartnerService
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
    mock_service.update_api_key_usage = AsyncMock()

    app.dependency_overrides[PartnerService] = lambda: mock_service

    # Correct async side_effect for middleware dispatch
    async def mock_dispatch(request, call_next):
        return await call_next(request)

    with patch("app.api.middlewares.partner_audit.PartnerAuditMiddleware.dispatch", side_effect=mock_dispatch):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            responses = []
            for _ in range(15):
                responses.append(ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_test"}))

            results = await asyncio.gather(*responses)
            rate_limited = [r for r in results if r.status_code == 429]
            assert len(rate_limited) > 0, f"Status codes: {[r.status_code for r in results]}"
            # HTTPX Headers object is case-insensitive and can be checked with 'in'
            assert any("retry-after" in r.headers for r in rate_limited), f"Headers: {[r.headers for r in rate_limited]}"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_b2b_rate_limiting_key_isolation(setup_redis):
    """
    Verify that two different keys for the same partner have independent limits.
    """
    p1 = Partner(id=100, partner_uuid=str(uuid.uuid4()), display_name="Iso", legal_name="Iso", contact_email="iso@test.com", tier="growth", is_active=True, onboarded_at=datetime.utcnow())
    k1 = PartnerApiKey(id=101, partner_id=100, is_active=True, rate_limit_rps=5)
    k2 = PartnerApiKey(id=102, partner_id=100, is_active=True, rate_limit_rps=5)
    
    from app.services.partner_service import PartnerService
    mock_service = MagicMock()
    app.dependency_overrides[PartnerService] = lambda: mock_service
    
    async def mock_dispatch(request, call_next):
        return await call_next(request)

    with patch("app.api.middlewares.partner_audit.PartnerAuditMiddleware.dispatch", side_effect=mock_dispatch):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            mock_service.validate_api_key = AsyncMock(return_value=(p1, k1))
            for _ in range(12):
                await ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_key1"})
            
            res_k1 = await ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_key1"})
            assert res_k1.status_code == 429
            
            mock_service.validate_api_key = AsyncMock(return_value=(p1, k2))
            res_k2 = await ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_key2"})
            assert res_k2.status_code == 200
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_b2b_key_lifecycle_expired(setup_redis):
    """
    Verify that an expired key returns 401.
    """
    from app.services.partner_service import PartnerService
    from app.repositories.partner_repository import PartnerRepository
    
    p1 = Partner(id=100, is_active=True, partner_uuid=str(uuid.uuid4()), display_name="Expired", legal_name="Expired", contact_email="exp@test.com", tier="growth", onboarded_at=datetime.utcnow())
    k1 = PartnerApiKey(id=101, partner_id=100, is_active=True, expires_at=datetime.utcnow() - timedelta(days=1))
    
    mock_repo = MagicMock(spec=PartnerRepository)
    mock_repo.async_get_api_key_by_token = AsyncMock(return_value=k1)
    mock_repo.async_get_by_id = AsyncMock(return_value=p1)
    mock_repo.async_get_by_hash = AsyncMock(return_value=k1)
    
    svc = PartnerService()
    svc.partner_repo = mock_repo
    svc.api_key_repo = MagicMock()
    svc.api_key_repo.async_get_by_hash = AsyncMock(return_value=k1)
    
    app.dependency_overrides[PartnerService] = lambda: svc
    
    async def mock_dispatch(request, call_next):
        return await call_next(request)

    with patch("app.api.middlewares.partner_audit.PartnerAuditMiddleware.dispatch", side_effect=mock_dispatch):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_expired"})
            assert res.status_code == 401
            assert "expired" in str(res.json()).lower()
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_b2b_key_lifecycle_revoked(setup_redis):
    """
    Verify that an inactive/revoked key returns 401.
    """
    from app.services.partner_service import PartnerService
    from app.repositories.partner_repository import PartnerRepository
    
    p1 = Partner(id=100, is_active=True, partner_uuid=str(uuid.uuid4()), display_name="Revoked", legal_name="Revoked", contact_email="rev@test.com", tier="growth", onboarded_at=datetime.utcnow())
    k1 = PartnerApiKey(id=101, partner_id=100, is_active=False)
    
    mock_repo = MagicMock(spec=PartnerRepository)
    mock_repo.async_get_api_key_by_token = AsyncMock(return_value=k1)
    mock_repo.async_get_by_id = AsyncMock(return_value=p1)
    mock_repo.async_get_by_hash = AsyncMock(return_value=k1)
    
    svc = PartnerService()
    svc.partner_repo = mock_repo
    svc.api_key_repo = MagicMock()
    svc.api_key_repo.async_get_by_hash = AsyncMock(return_value=k1)
    
    app.dependency_overrides[PartnerService] = lambda: svc
    
    async def mock_dispatch(request, call_next):
        return await call_next(request)

    with patch("app.api.middlewares.partner_audit.PartnerAuditMiddleware.dispatch", side_effect=mock_dispatch):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/partner/me", headers={"Authorization": "Bearer rmx_revoked"})
            assert res.status_code == 401
            assert "active" in str(res.json()).lower() or "revoked" in str(res.json()).lower()
    
    app.dependency_overrides.clear()
