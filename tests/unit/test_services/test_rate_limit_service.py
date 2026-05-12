import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.rate_limit_service import RateLimitService

class MockScript:
    """Mock for redis-py Script object."""
    def __init__(self, result):
        self.result = result
        self.called = False
    async def __call__(self, *args, **kwargs):
        self.called = True
        return self.result

@pytest.mark.asyncio
async def test_burst_rate_limit_allowed():
    """Verify that a request within RPS limits is allowed."""
    service = RateLimitService()
    
    mock_script = MockScript([1, 9])
    
    with patch("app.services.rate_limit_service.aioredis.Redis") as mock_redis_cls:
        mock_redis_instance = MagicMock()
        mock_redis_cls.return_value = mock_redis_instance
        mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
        mock_redis_instance.__aexit__ = AsyncMock()
        mock_redis_instance.eval = AsyncMock(return_value=[1, 9, 0.0])
        mock_redis_instance.exists = AsyncMock(return_value=True)
        
        with patch("app.db.redis._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                db=AsyncMock(),
                api_key_id=1,
                partner_id=1,
                rps_limit=10,
                monthly_limit=1000
            )
            
            assert allowed is True
            assert error == ""
            assert retry is None

@pytest.mark.asyncio
async def test_burst_rate_limit_exceeded():
    """Verify that exceeding RPS limit triggers RATE_LIMIT_EXCEEDED."""
    service = RateLimitService()
    
    mock_script = MockScript([0, 0])
    
    with patch("app.services.rate_limit_service.aioredis.Redis") as mock_redis_cls:
        mock_redis_instance = MagicMock()
        mock_redis_cls.return_value = mock_redis_instance
        mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
        mock_redis_instance.__aexit__ = AsyncMock()
        mock_redis_instance.eval = AsyncMock(return_value=[0, 0, 0.1])
        mock_redis_instance.exists = AsyncMock(return_value=True)
        
        with patch("app.db.redis._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                db=AsyncMock(),
                api_key_id=1,
                partner_id=1,
                rps_limit=10,
                monthly_limit=1000
            )
            
            assert allowed is False
            assert error == "RATE_LIMIT_EXCEEDED"
            assert retry == 0.1

@pytest.mark.asyncio
async def test_monthly_quota_exceeded():
    """Verify that exceeding monthly quota triggers QUOTA_EXCEEDED."""
    service = RateLimitService()
    
    mock_burst_script = MockScript([1, 10])
    mock_quota_script = MockScript([0, 1000])
    
    def mock_register(script):
        if "HMGET" in script:
            return mock_burst_script
        else:
            return mock_quota_script
            
    with patch("app.services.rate_limit_service.aioredis.Redis") as mock_redis_cls:
        mock_redis_instance = MagicMock()
        mock_redis_cls.return_value = mock_redis_instance
        mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
        mock_redis_instance.__aexit__ = AsyncMock()
        
        # mock_register replacement: 
        # First call (burst) succeeds, second call (quota) fails
        mock_redis_instance.eval = AsyncMock(side_effect=[
            [1, 10, 0.0], # Burst success
            [0, 1000]     # Quota failure
        ])
        mock_redis_instance.exists = AsyncMock(return_value=True)
        
        with patch("app.db.redis._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                db=AsyncMock(),
                api_key_id=1,
                partner_id=1,
                rps_limit=10,
                monthly_limit=1000
            )
            
            assert allowed is False
            assert error == "QUOTA_EXCEEDED"
            assert retry is None
