"""
Hardened Admin Security Tests
============================

Verifies the strictly JWT-based administrative authentication model, 
defense-in-depth role verification, and query-parameter deprecation.

Version: 1.0.0
Date: May 16, 2026
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.models.user import User, Role, UserRole
from app.core.security import hash_password, create_access_token
from database.connection import AsyncSessionLocal
from app.repositories.rbac_repository import RBACRepository


@pytest.fixture
async def test_user():
    """Create a standard test user."""
    email = f"user_{uuid.uuid4().hex[:6]}@example.com"
    password = "UserPassword123!"
    async with AsyncSessionLocal() as db:
        user = User(
            username=f"user_{uuid.uuid4().hex[:6]}",
            email=email,
            password_hash=hash_password(password),
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user, password


@pytest.fixture
async def test_admin():
    """Create a verified admin user."""
    email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
    password = "AdminPassword123!"
    async with AsyncSessionLocal() as db:
        user = User(
            username=f"admin_{uuid.uuid4().hex[:6]}",
            email=email,
            password_hash=hash_password(password),
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        admin_role = await RBACRepository.get_role_by_name(db, "admin")
        if not admin_role:
            admin_role = Role(name="admin", description="Admin")
            db.add(admin_role)
            await db.commit()
            await db.refresh(admin_role)
        
        await RBACRepository.assign_role_to_user(db, user.id, admin_role.id)
        return user, password


@pytest.mark.asyncio
async def test_admin_login_endpoint_rejects_non_admin(test_user):
    """
    Ensure non-admin users cannot use the dedicated admin login endpoint.
    """
    user, password = test_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/admin/auth/login",
            json={"email": user.email, "password": password}
        )
        assert res.status_code == 403
        assert "Administrative privileges required" in res.json()["error"]


@pytest.mark.asyncio
async def test_admin_route_rejects_standard_user_jwt(test_user):
    """
    Ensure an admin route rejects a valid JWT issued for a standard user (missing admin claim).
    """
    user, _ = test_user
    token = create_access_token(data={"sub": user.uuid})
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/admin/feedback/",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should fail either at get_current_user (if claim required) or require_permission
        assert res.status_code == 403
        assert "Insufficient permissions" in res.json()["error"]


@pytest.mark.asyncio
async def test_admin_defense_in_depth_db_check(test_user):
    """
    Test that even if a JWT has 'role: admin' claim, it is rejected if the 
    user does not have the admin role in the database.
    (Prevents spoofing if secret is leaked or tokens are manually forged)
    """
    user, _ = test_user
    # Forge a token with admin claim for a regular user
    token = create_access_token(
        data={"sub": user.uuid},
        extra_claims={"role": "admin"}
    )
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/admin/feedback/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 403
        # It could be caught by require_permission (permission check) or require_admin (role check)
        # Both are DB-backed and valid for defense-in-depth.
        error_msg = res.json()["error"]
        assert "Insufficient permissions" in error_msg or "Administrative privileges required" in error_msg


@pytest.mark.asyncio
async def test_admin_route_rejects_query_api_key():
    """
    Ensure that the api_key query parameter is no longer accepted.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Pass a would-be admin key as a query param — query-param auth is not accepted at all.
        res = await ac.get(
            "/api/v1/admin/feedback/?api_key=bearer-resomix-api-legacy-static-key"
        )
        # 403 because the query param is ignored and no header/bearer JWT is provided.
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_route_rejects_header_api_key():
    """
    The retired static super-key must NO LONGER grant admin access via the X-API-KEY header.
    Admin routes require a real admin-role JWT (via /admin/auth/login).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/admin/feedback/",
            headers={"X-API-KEY": "bearer-resomix-api-legacy-static-key"}
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_login_rejects_malformed_payload():
    """
    Test that extra fields in login payload are ignored or rejected by Pydantic.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Attempt to pass a 'role' field to see if it causes issues
        res = await ac.post(
            "/api/v1/admin/auth/login",
            json={
                "email": "nonexistent@example.com", 
                "password": "pass",
                "role": "admin" # Extra field
            }
        )
        # Should fail with 401 (invalid credentials) or 403, but not 200 or 500
        assert res.status_code in [401, 403]


@pytest.mark.asyncio
async def test_admin_route_rejects_wrong_bearer_type(test_admin):
    """
    Ensure an admin route rejects a token if it's not an 'access' token (e.g. a refresh token).
    """
    user, _ = test_admin
    # Create a refresh token instead of an access token
    from app.core.security import create_refresh_token
    token = create_refresh_token(data={"sub": user.uuid})
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/admin/feedback/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 401
        assert "Invalid token type" in res.json()["error"]


@pytest.mark.asyncio
async def test_admin_route_rejects_expired_token(test_admin):
    """
    Ensure an admin route rejects an expired token.
    """
    user, _ = test_admin
    from datetime import timedelta
    token = create_access_token(
        data={"sub": user.uuid},
        expires_delta=timedelta(seconds=-1),
        extra_claims={"role": "admin"}
    )
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/admin/feedback/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 401
        assert "validate credentials" in res.json()["error"]
