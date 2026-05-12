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
        mock_redis_instance.register_script.return_value = mock_script
        
        with patch("app.services.rate_limit_service._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                api_key_id=1, rps_limit=10, monthly_limit=1000
            )
            
            assert allowed is True
            assert error == ""
            assert retry is None
            assert mock_script.called is True

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
        mock_redis_instance.register_script.return_value = mock_script
        
        with patch("app.services.rate_limit_service._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                api_key_id=1, rps_limit=10, monthly_limit=1000
            )
            
            assert allowed is False
            assert error == "RATE_LIMIT_EXCEEDED"
            assert retry == 0.1
            assert mock_script.called is True

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
        mock_redis_instance.register_script.side_effect = mock_register
        
        with patch("app.services.rate_limit_service._redis_pool", MagicMock()):
            allowed, error, retry = await service.check_rate_limits(
                api_key_id=1, rps_limit=10, monthly_limit=1000
            )
            
            assert allowed is False
            assert error == "QUOTA_EXCEEDED"
            assert retry is None
            assert mock_burst_script.called is True
            assert mock_quota_script.called is True
