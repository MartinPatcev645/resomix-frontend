"""
Frontend-only similarity burst brake (Point 1)
=============================================

The per-IP burst brake applies ONLY to the frontend surface (System Partner 1). B2B partners are
never checked here — they have their own DB-backed per-second/monthly quotas. Tested directly on
`SimilarityController._frontend_rate_ok` (deterministic; a fresh random IP per run avoids Redis
accumulation). Requires Redis; fails open (allows) without it.
"""

import random

import pytest

from app.core.config import settings
from app.controllers.similarity_controller import SimilarityController
from app.db.redis import get_redis_or_none


class _FakeRequest:
    """Minimal stand-in: client_ip() reads CF-Connecting-IP first."""
    def __init__(self, ip: str):
        self.headers = {"cf-connecting-ip": ip}
        self.client = None


async def _redis_up() -> bool:
    try:
        r = await get_redis_or_none()
        if r is None:
            return False
        await r.ping()
        return True
    except Exception:
        return False


@pytest.mark.asyncio
async def test_frontend_burst_brake_allows_then_blocks():
    if not await _redis_up():
        pytest.skip("Redis unavailable — brake fails open without it")
    ctrl = SimilarityController()
    req = _FakeRequest(".".join(str(random.randint(1, 254)) for _ in range(4)))  # fresh IP bucket

    original = settings.frontend_similarity_burst_per_min
    settings.frontend_similarity_burst_per_min = 3
    try:
        results = [await ctrl._frontend_rate_ok(req) for _ in range(4)]
    finally:
        settings.frontend_similarity_burst_per_min = original

    assert results == [True, True, True, False]  # first 3 allowed, 4th over the burst


@pytest.mark.asyncio
async def test_frontend_brake_disabled_when_zero():
    ctrl = SimilarityController()
    req = _FakeRequest("203.0.113.7")
    original = settings.frontend_similarity_burst_per_min
    settings.frontend_similarity_burst_per_min = 0
    try:
        assert all([await ctrl._frontend_rate_ok(req) for _ in range(10)])  # 0 = disabled → all allowed
    finally:
        settings.frontend_similarity_burst_per_min = original
