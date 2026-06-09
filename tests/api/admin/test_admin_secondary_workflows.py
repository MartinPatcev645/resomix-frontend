import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app
from app.core.config import settings

@pytest.mark.asyncio
async def test_admin_waitlist_secondary():
    from app.controllers.waitlist_controller import WaitlistController
    mock_controller = MagicMock(spec=WaitlistController)
    mock_controller.delete_waitlist_admin = AsyncMock(return_value={"success": True, "data": {"message": "ok"}})
    mock_controller.batch_delete_waitlist_admin = AsyncMock(return_value={"success": True, "deleted_count": 2, "message": "ok"})
    mock_controller.export_waitlist_csv_admin = AsyncMock(return_value={"success": True, "download_url": "/path", "filename": "f.csv", "expires_at": "2025-01-01T00:00:00Z"})

    with patch("app.api.routers.admin.waitlist.waitlist_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.delete("/api/v1/admin/waitlist/1", headers=headers)
            assert res.status_code == 200

            res = await ac.post("/api/v1/admin/waitlist/batch-delete", headers=headers, json={"ids": [1, 2]})
            assert res.status_code == 200
            
            res = await ac.post("/api/v1/admin/waitlist/export", headers=headers, json={"status": "pending", "format": "csv"})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_contact_secondary():
    from app.controllers.contact_controller import ContactController
    mock_controller = MagicMock(spec=ContactController)
    mock_controller.get_contact_by_id = AsyncMock(return_value={"success": True, "data": {"id": 1, "user_id": "1", "name": "n", "email": "e@e.com", "subject": "s", "message": "m", "status": "open", "submitted_at": "2025-01-01T00:00:00Z"}, "message": "ok"})
    mock_controller.delete_contact_admin = AsyncMock(return_value={"success": True, "data": {"message": "ok"}})
    mock_controller.batch_delete_contact_admin = AsyncMock(return_value={"success": True, "deleted_count": 2, "message": "ok"})
    mock_controller.export_contact_csv_admin = AsyncMock(return_value={"success": True, "download_url": "/path", "filename": "f.csv", "expires_at": "2025-01-01T00:00:00Z"})

    with patch("app.api.routers.admin.contact.contact_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.get("/api/v1/admin/contact/1", headers=headers)
            assert res.status_code == 200

            res = await ac.delete("/api/v1/admin/contact/1", headers=headers)
            assert res.status_code == 200

            res = await ac.post("/api/v1/admin/contact/batch-delete", headers=headers, json={"ids": [1, 2]})
            assert res.status_code == 200

            res = await ac.post("/api/v1/admin/contact/export", headers=headers, json={"status": "open", "format": "csv"})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_feedback_secondary():
    from app.controllers.feedback_controller import FeedbackController
    mock_controller = MagicMock(spec=FeedbackController)
    feedback_data = {
        "id": 1, 
        "user_id": "1", 
        "satisfaction": 5, 
        "recommendation": 5, 
        "category": "cat", 
        "message": "msg", 
        "status": "open", 
        "submitted_at": "2025-01-01T00:00:00Z"
    }
    mock_controller.get_feedback_by_id = AsyncMock(return_value={"success": True, "data": feedback_data, "message": "ok"})
    mock_controller.mark_feedback_status_admin = AsyncMock(return_value={"success": True, "data": feedback_data, "message": "ok"})
    mock_controller.delete_feedback_admin = AsyncMock(return_value={"success": True, "message": "ok"})
    mock_controller.batch_delete_feedback_admin = AsyncMock(return_value={"success": True, "deleted_count": 2, "message": "ok"})

    with patch("app.api.routers.admin.feedback.feedback_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.get("/api/v1/admin/feedback/1", headers=headers)
            assert res.status_code == 200

            res = await ac.patch("/api/v1/admin/feedback/1/status", headers=headers, json={"status": "resolved"})
            assert res.status_code == 200

            res = await ac.delete("/api/v1/admin/feedback/1", headers=headers)
            assert res.status_code == 200

            res = await ac.post("/api/v1/admin/feedback/batch-delete", headers=headers, json={"ids": [1, 2]})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_spotify_apps():
    from app.controllers.spotify_app_controller import SpotifyAppController
    mock_controller = MagicMock(spec=SpotifyAppController)
    app_data = {
        "id": 1, 
        "name": "n", 
        "description": "d", 
        "client_id": "c", 
        "client_secret": "s", 
        "is_active": True, 
        "user_count": 0,
        "created_at": "2025-01-01T00:00:00Z", 
        "updated_at": "2025-01-01T00:00:00Z"
    }
    pagination = {"total": 0, "page": 1, "size": 10, "pages": 0, "has_next": False, "has_prev": False}
    mock_controller.list_spotify_apps = AsyncMock(return_value={"success": True, "data": [], "pagination": pagination})
    mock_controller.get_spotify_app = AsyncMock(return_value=app_data)
    mock_controller.create_spotify_app = AsyncMock(return_value=app_data)
    mock_controller.update_spotify_app = AsyncMock(return_value=app_data)
    mock_controller.delete_spotify_app = AsyncMock(return_value={"success": True, "message": "ok"})
    
    user_app = {
        "user_id": 1, 
        "user_email": "e@e.com",
        "user_username": "u",
        "user_uuid": "uuid",
        "spotify_app_id": 1, 
        "spotify_app_name": "n",
        "created_at": "2025-01-01T00:00:00Z", 
        "updated_at": "2025-01-01T00:00:00Z"
    }
    mock_controller.list_user_associations = AsyncMock(return_value={"success": True, "data": [], "pagination": pagination})
    mock_controller.upsert_user_association = AsyncMock(return_value=user_app)
    mock_controller.delete_user_association = AsyncMock(return_value={"success": True, "message": "ok"})

    with patch("app.api.routers.admin.spotify_apps.controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            
            res = await ac.get("/api/v1/admin/spotify-apps/", headers=headers)
            assert res.status_code == 200
            
            res = await ac.get("/api/v1/admin/spotify-apps/1", headers=headers)
            assert res.status_code == 200
            
            res = await ac.post("/api/v1/admin/spotify-apps/", headers=headers, json={"name": "test", "description": "desc", "client_id": "c", "client_secret": "s", "is_active": True})
            assert res.status_code in [200, 201]

            res = await ac.put("/api/v1/admin/spotify-apps/1", headers=headers, json={"name": "test2", "description": "desc", "client_id": "c", "client_secret": "s", "is_active": True})
            assert res.status_code == 200

            res = await ac.delete("/api/v1/admin/spotify-apps/1", headers=headers)
            assert res.status_code == 200
            
            res = await ac.get("/api/v1/admin/spotify-apps/users", headers=headers)
            assert res.status_code == 200
            
            res = await ac.put("/api/v1/admin/spotify-apps/users", headers=headers, json={"user_identifier": "u", "spotify_app_id": 1})
            assert res.status_code == 200
            
            res = await ac.delete("/api/v1/admin/spotify-apps/users/u", headers=headers)
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_playlist_secondary():
    from app.controllers.playlist_controller import PlaylistController
    mock_controller = MagicMock(spec=PlaylistController)
    pl_dict = {
        "id": 1, 
        "uuid": str(uuid.uuid4()), 
        "name": "p", 
        "is_public": True, 
        "type": "custom", 
        "created_at": "2025-01-01T00:00:00Z", 
        "user_id": "1", 
        "seed_track_id": 1,
        "track_count": 0
    }
    seed_track = {
        "id": 1, 
        "uuid": str(uuid.uuid4()), 
        "title": "t", 
        "artists": ["a"], 
        "duration_sec": 120.0, 
        "bpm": 120, 
        "musical_key": "C", 
        "genre": "g", 
        "label": "l", 
        "year": 2020
    }
    
    mock_controller.get_playlist_detail_by_uuid_admin = AsyncMock(return_value={"success": True, "data": {"playlist": pl_dict, "seed_track": seed_track, "tracks": []}})
    mock_controller.delete_playlist_admin = AsyncMock(return_value={"success": True, "data": {"message": "ok"}})
    mock_controller.batch_delete_playlist_admin = AsyncMock(return_value={"success": True, "deleted_count": 2, "message": "ok"})
    mock_controller.export_playlist_csv_admin = AsyncMock(return_value={"success": True, "download_url": "/path", "filename": "f.csv", "expires_at": "2025-01-01T00:00:00Z"})
    mock_controller.change_playlist_visibility_admin = AsyncMock(return_value={"success": True, "message": "ok"})
    mock_controller.batch_change_playlist_visibility_admin = AsyncMock(return_value={"success": True, "updated_count": 2, "message": "ok"})

    with patch("app.api.routers.admin.playlist.playlist_controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            
            res = await ac.get(f"/api/v1/admin/playlist/{str(uuid.uuid4())}", headers=headers)
            assert res.status_code == 200

            res = await ac.delete("/api/v1/admin/playlist/1", headers=headers)
            assert res.status_code == 200

            res = await ac.post("/api/v1/admin/playlist/batch-delete", headers=headers, json={"ids": [1, 2]})
            assert res.status_code == 200
            
            res = await ac.post("/api/v1/admin/playlist/export", headers=headers, json={"format": "csv"})
            assert res.status_code == 200

            res = await ac.patch("/api/v1/admin/playlist/1/visibility", headers=headers, json={"is_public": True})
            assert res.status_code == 200
            
            res = await ac.post("/api/v1/admin/playlist/batch-visibility", headers=headers, json={"ids": [1, 2], "is_public": False})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_users_and_roles_secondary():
    from app.controllers.admin_user_controller import AdminUserController
    from app.controllers.admin_role_controller import AdminRoleController
    mock_user_ctrl = MagicMock(spec=AdminUserController)
    mock_role_ctrl = MagicMock(spec=AdminRoleController)
    
    uid = str(uuid.uuid4())
    mock_user_ctrl.get_user_detail = AsyncMock(return_value={"success": True, "data": {"id": 1, "uuid": uid, "email": "e@e.com", "username": "u", "name": "n", "language": "en", "timezone": "UTC", "is_active": True, "roles": [], "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}})
    mock_user_ctrl.update_user = AsyncMock(return_value={"success": True, "data": {"id": 1, "uuid": uid, "email": "e@e.com", "username": "u", "name": "n", "language": "en", "timezone": "UTC", "is_active": True, "roles": [], "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}})
    mock_user_ctrl.toggle_user_status = AsyncMock(return_value={"success": True, "data": {"id": 1, "uuid": uid, "email": "e@e.com", "username": "u", "name": "n", "language": "en", "timezone": "UTC", "is_active": True, "roles": [], "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}})
    
    mock_role_ctrl.get_role_detail = AsyncMock(return_value={"success": True, "data": {"id": 1, "name": "admin", "description": "admin role", "is_system": True, "permissions": [{"id": 1, "name": "user:read", "description": "read users", "module": "users"}]}})
    mock_role_ctrl.update_role_permissions = AsyncMock(return_value={"success": True, "data": {"id": 1, "name": "admin", "description": "admin role", "is_system": True, "permissions": [{"id": 1, "name": "user:read", "description": "read users", "module": "users"}]}})

    with patch("app.api.routers.admin.users.user_controller", mock_user_ctrl), \
         patch("app.api.routers.admin.roles.role_controller", mock_role_ctrl):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            
            res = await ac.get(f"/api/v1/admin/users/{uid}", headers=headers)
            assert res.status_code == 200
            
            res = await ac.patch(f"/api/v1/admin/users/{uid}", headers=headers, json={"name": "New Name"})
            assert res.status_code == 200

            res = await ac.post(f"/api/v1/admin/users/{uid}/toggle-status", headers=headers, json={"is_active": False})
            assert res.status_code == 200
            
            res = await ac.get("/api/v1/admin/roles/admin", headers=headers)
            assert res.status_code == 200
            
            res = await ac.put("/api/v1/admin/roles/admin/permissions", headers=headers, json={"permission_names": ["user:read"]})
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_promo_codes():
    from app.controllers.admin_controller import AdminController
    mock_ctrl = MagicMock(spec=AdminController)
    mock_ctrl.create_promo_code = AsyncMock(return_value={"success": True, "data": {"code": "TEST", "id": "promo_123"}})

    with patch("app.api.routers.admin.promo.admin_controller", mock_ctrl):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.post("/api/v1/admin/promo/create", headers=headers, json={"code": "TEST", "discount_type": "percentage", "discount_value": 10})
            assert res.status_code in [200, 201]

@pytest.mark.asyncio
async def test_admin_operation_limits():
    from app.controllers.operation_limit_controller import OperationLimitController
    mock_controller = MagicMock(spec=OperationLimitController)
    
    limit_data = {
        "user_id": 1,
        "user_uuid": "uuid",
        "user_email": "e@e.com",
        "user_username": "u",
        "operation_id": 1,
        "operation_code": "playlist_create",
        "operation_description": "desc",
        "limit_value": 10,
        "window_seconds": 3600,
        "usage_count": 0,
        "created_by": 1,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
    }
    pagination = {"total": 0, "page": 1, "size": 30, "pages": 0, "has_next": False, "has_prev": False}
    
    mock_controller.list_operation_types = AsyncMock(return_value={"success": True, "data": [], "total": 0})
    mock_controller.list_user_operation_limits = AsyncMock(return_value={"success": True, "data": [], "pagination": pagination})
    mock_controller.get_user_operation_limit = AsyncMock(return_value={"success": True, "data": limit_data})
    mock_controller.upsert_user_operation_limit = AsyncMock(return_value={"success": True, "data": limit_data})
    mock_controller.delete_user_operation_limit = AsyncMock(return_value={"success": True, "message": "ok"})

    with patch("app.api.routers.admin.operation_limits.controller", mock_controller):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            
            res = await ac.get("/api/v1/admin/operation-limits/operation-types", headers=headers)
            assert res.status_code == 200
            
            res = await ac.get("/api/v1/admin/operation-limits/", headers=headers)
            assert res.status_code == 200
            
            res = await ac.get("/api/v1/admin/operation-limits/u/playlist_create", headers=headers)
            assert res.status_code == 200
            
            res = await ac.put("/api/v1/admin/operation-limits/", headers=headers, json={"user_identifier": "u", "operation_code": "playlist_create", "limit_value": 10})
            assert res.status_code == 200
            
            res = await ac.delete("/api/v1/admin/operation-limits/u/playlist_create", headers=headers)
            assert res.status_code == 200

@pytest.mark.asyncio
async def test_admin_similarity():
    # The rebuild endpoint now delegates to HetznerService.rebuild_index(partner_id=...)
    # and requires a partner_id query param.
    with patch(
        "app.api.routers.admin.similarity.hetzner_service.rebuild_index",
        AsyncMock(return_value={"success": True, "engines": {"maest": "ok", "discogs": "ok"}}),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {"X-API-KEY": settings.api_key}
            res = await ac.post(
                "/api/v1/admin/similarity/rebuild-index?partner_id=1", headers=headers
            )
            assert res.status_code == 202
