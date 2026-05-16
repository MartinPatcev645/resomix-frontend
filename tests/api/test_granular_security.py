import pytest
import uuid
import asyncio
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.core.config import settings
from app.models.partner import Partner, PartnerApiKey
from app.models.user import User
from app.services.operation_limit_evaluator import OperationLimitResult
@pytest.fixture
def clean_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_rbac_scope_enforcement(clean_overrides):
    """
    Verify that partner API keys strictly respect their defined scopes.
    """
    p1 = Partner(id=1, display_name="Test Partner", is_active=True)
    
    from app.controllers.similarity_controller import SimilarityController
    mock_similarity = MagicMock(spec=SimilarityController)
    mock_similarity.get_similarity_upload = AsyncMock(return_value={
        "success": True, 
        "data": {
            "queried_track": {
                "rank": 0, "score": 1.0, "id": str(uuid.uuid4()), 
                "artist": "A", "title": "T", "label": "L", "duration": 100.0
            },
            "similar_tracks": []
        }
    })
    
    with patch("app.api.routers.similarity.similarity_controller", mock_similarity):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            with patch("app.api.dependencies.partner._get_partner_core", return_value=p1):
                res = await ac.post(
                    "/api/v1/similarity/upload", 
                    headers={"Authorization": "Bearer rmx_valid"},
                    files={"file": ("test.mp3", b"fake", "audio/mpeg")}
                )
                assert res.status_code == 200
            
            with patch("app.api.dependencies.partner._get_partner_core", side_effect=HTTPException(status_code=403, detail="Missing scope")):
                res = await ac.post(
                    "/api/v1/similarity/upload", 
                    headers={"Authorization": "Bearer rmx_invalid"},
                    files={"file": ("test.mp3", b"fake", "audio/mpeg")}
                )
                assert res.status_code == 403

@pytest.mark.asyncio
async def test_user_operation_limits_enforcement(clean_overrides):
    """
    Validate that user-specific limits (e.g., playlist creation) are enforced.
    """
    mock_user = User(id=1, partner_id=1, email="test@test.com")
    mock_user.uuid = str(uuid.uuid4())
    
    from app.services.operation_limit_evaluator import OperationLimitEvaluator
    mock_evaluator = MagicMock(spec=OperationLimitEvaluator)
    mock_evaluator.check = AsyncMock(return_value=OperationLimitResult(
        allowed=False, status_code=403, message="Playlist limit reached (5). Please upgrade."
    ))
    
    from app.api.dependencies.auth import get_current_user, get_api_key
    from app.api.dependencies.partner import get_current_partner
    from app.core.context import set_current_partner_id
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_api_key] = lambda: "dummy"
    # Ensure partner_id is set in context to pass failsafe
    app.dependency_overrides[get_current_partner] = lambda: (set_current_partner_id(1), Partner(id=1))[1]
    
    from app.api.routers.playlists import playlist_controller
    with patch.object(playlist_controller, "operation_limit_evaluator", mock_evaluator):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/playlists/fork/dummy-uuid", headers={"Authorization": "Bearer jwt"})
            assert res.status_code == 403

@pytest.mark.asyncio
async def test_spotify_transfer_limits_enforcement(clean_overrides):
    """
    Validate that spotify transfer limits are enforced.
    """
    mock_user = User(id=1, partner_id=1, email="test@test.com")
    mock_user.uuid = str(uuid.uuid4())
    
    from app.services.operation_limit_evaluator import OperationLimitEvaluator
    mock_evaluator = MagicMock(spec=OperationLimitEvaluator)
    mock_evaluator.check = AsyncMock(return_value=OperationLimitResult(
        allowed=False, status_code=403, message="Spotify transfer limit reached."
    ))
    
    from app.api.dependencies.auth import get_current_user, get_api_key
    from app.api.dependencies.partner import get_current_partner
    from app.core.context import set_current_partner_id
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_api_key] = lambda: "dummy"
    # Ensure partner_id is set in context to pass failsafe
    app.dependency_overrides[get_current_partner] = lambda: (set_current_partner_id(1), Partner(id=1))[1]
    
    from app.api.routers.spotify_transfer import spotify_transfer_controller
    with patch.object(spotify_transfer_controller, "operation_limit_evaluator", mock_evaluator):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Patch the playlist repo call that happens before limit check
            from app.repositories.playlist_repository import PlaylistRepository
            with patch.object(PlaylistRepository, "async_get_playlist_by_uuid", AsyncMock(return_value=MagicMock(id=1))):
                res = await ac.post(
                    "/api/v1/spotify/transfer-playlist/", 
                    headers={"Authorization": "Bearer jwt"},
                    json={"playlist_id": "dummy-uuid", "access_token": "token"}
                )
                assert res.status_code == 403

@pytest.mark.asyncio
async def test_spotify_app_association_isolation(clean_overrides):
    """
    Verify that User A cannot see or manage User B's Spotify app association.
    """
    from app.controllers.spotify_app_controller import SpotifyAppController
    mock_controller = MagicMock(spec=SpotifyAppController)
    mock_controller.get_user_spotify_app_client_id = AsyncMock(side_effect=HTTPException(status_code=404, detail="Association not found"))
    
    from app.api.dependencies.auth import get_current_user
    app.dependency_overrides[get_current_user] = lambda: User(id=1, uuid="user-a-uuid", partner_id=1)
    
    from app.api.routers.spotify_transfer import spotify_app_controller
    with patch("app.api.routers.spotify_transfer.spotify_app_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/spotify/app-client-id", headers={"Authorization": "Bearer jwt"})
            assert res.status_code in [403, 404]

@pytest.mark.asyncio
async def test_spotify_app_association_admin(clean_overrides):
    """
    Verify Spotify app creation and user association via Admin API.
    """
    from app.controllers.spotify_app_controller import SpotifyAppController
    mock_controller = MagicMock(spec=SpotifyAppController)
    now = datetime.utcnow()
    mock_controller.create_spotify_app = AsyncMock(return_value={
        "id": 10, "name": "App", "client_id": "c", "client_secret": "s",
        "is_active": True, "user_count": 0, "created_at": now.isoformat(), "updated_at": now.isoformat()
    })
    mock_controller.upsert_user_association = AsyncMock(return_value={
        "user_id": 1, "spotify_app_id": 10, "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "user_email": "u@t.com", "user_username": "u", "user_uuid": str(uuid.uuid4()), "spotify_app_name": "A"
    })
    
    from app.api.dependencies.auth import get_api_key
    app.dependency_overrides[get_api_key] = lambda: settings.api_key
    
    with patch("app.api.routers.admin.spotify_apps.controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.post("/api/v1/admin/spotify-apps/", headers=headers, json={"name": "A", "client_id": "c", "client_secret": "s"})
            assert res.status_code == 201
            res = await ac.put("/api/v1/admin/spotify-apps/users", headers=headers, json={"user_identifier": "u", "spotify_app_id": 10})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_multi_tenant_failsafe_violation():
    """
    Confirm that the global SQLAlchemy failsafe blocks queries without partner context.
    """
    from app.core.context import set_current_partner_id, set_admin_context
    from app.models.track import Track
    from sqlalchemy import select
    from database.connection import AsyncSessionLocal
    
    set_current_partner_id(None)
    set_admin_context(False)
    
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(Track).limit(1)
            with pytest.raises(RuntimeError) as excinfo:
                await session.execute(stmt)
            assert "Multi-tenancy violation" in str(excinfo.value)
        finally:
            await session.close()
