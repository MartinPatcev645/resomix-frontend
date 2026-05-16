import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings

@pytest.mark.asyncio
async def test_global_routing_sanity():
    """
    Global Sanity Test: Verify that all major routers are correctly 
    registered under /api/v1/ and respond to requests.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # 1. Public Routers
        paths_to_check = [
            ("/api/v1/search_tracks/", "GET"),
            ("/api/v1/playlists/get-all-playlists/", "GET"),
            ("/api/v1/health", "GET"),
            ("/api/v1/auth/login", "OPTIONS"),
            ("/api/v1/waitlist/", "OPTIONS"),
            ("/api/v1/feedback/", "OPTIONS"),
        ]

        # 2. B2B / Partner Routers (Check if they are registered)
        paths_to_check.extend([
            ("/api/v1/similarity/search", "OPTIONS"),
            ("/api/v1/metadata/track", "OPTIONS"),
            ("/api/v1/partner/me", "OPTIONS"),
            ("/api/v1/ingest/monthly/track", "OPTIONS"),
            ("/api/v1/ingest/monthly/update_embeddings", "OPTIONS"),
        ])

        # 3. Admin Routers
        paths_to_check.extend([
            ("/api/v1/admin/partners/", "GET"),
            ("/api/v1/admin/waitlist/", "GET"),
            ("/api/v1/admin/feedback/", "GET"),
            ("/api/v1/admin/operation-limits/", "GET"),
        ])

        for path, method in paths_to_check:
            params = {}
            if "/search_tracks/" in path:
                params = {"query": "test"}
            
            # Use dummy headers/auth to avoid 401 where possible, 
            # but we just want to avoid 404.
            headers = {"X-API-KEY": settings.api_key}
            
            if method == "GET":
                res = await ac.get(path, params=params, headers=headers)
            else:
                res = await ac.request(method, path, headers=headers)
            
            # We don't necessarily expect 200 (could be 401/405/422), 
            # but we definitely DON'T expect 404 (unless intentionally missing).
            assert res.status_code != 404, f"Path {path} is not registered (returned 404)"
            print(f"✅ Verified: {path} [{method}] -> {res.status_code}")

@pytest.mark.asyncio
async def test_legacy_redirect_sanity():
    """
    Verify that root routes still function (backward compatibility).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Legacy health
        res = await ac.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # Legacy search
        res = await ac.get("/search_tracks/", params={"query": "test"})
        assert res.status_code == 200
