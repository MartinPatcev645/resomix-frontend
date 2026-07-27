"""
Integration Tests for Admin Authentication
=========================================

Verifies the JWT-based admin login flow and RBAC enforcement.

Version: 1.0.0
Date: May 16, 2026
"""

import pytest
import uuid
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.models.user import User, Role, UserToken
from app.core.security import hash_password
from database.connection import AsyncSessionLocal
from app.repositories.rbac_repository import RBACRepository


@pytest.mark.asyncio
async def test_admin_login_success():
    """Admin login is a 2-step (mandatory 2FA) flow: /login emails a code, /verify-2fa issues tokens."""
    email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
    password = "AdminPassword123!"

    async with AsyncSessionLocal() as db:
        # 1. Create user
        user = User(
            username=f"admin_{uuid.uuid4().hex[:6]}",
            email=email,
            password_hash=hash_password(password),
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # 2. Grant admin role
        admin_role = await RBACRepository.get_role_by_name(db, "admin")
        if not admin_role:
            admin_role = Role(name="admin", description="Admin")
            db.add(admin_role)
            await db.commit()
            await db.refresh(admin_role)

            from app.models.user import Permission, RolePermission
            access_perm = Permission(name="admin:access", description="Access")
            db.add(access_perm)
            await db.commit()
            await db.refresh(access_perm)

            rp = RolePermission(role_id=admin_role.id, permission_id=access_perm.id)
            db.add(rp)
            await db.commit()

        await RBACRepository.assign_role_to_user(db, user.id, admin_role.id)
        await db.commit()

    transport = ASGITransport(app=app)
    with patch("app.services.email_service.EmailService.send_2fa_code_email", new=AsyncMock(return_value=True)):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Step 1: credentials -> a 2FA code is emailed, no tokens yet.
            step1 = await ac.post("/api/v1/admin/auth/login", json={"email": email, "password": password})
            assert step1.status_code == 200
            assert step1.json().get("requires_2fa") is True
            assert "access_token" not in step1.json()

            # Pull the emailed code out of the DB.
            async with AsyncSessionLocal() as db:
                code = (await db.execute(
                    select(UserToken).where(UserToken.user_id == user.id, UserToken.token_type == "2fa")
                )).scalar_one().token

            # Step 2: email + password + code -> tokens + admin refresh cookie.
            step2 = await ac.post(
                "/api/v1/admin/auth/verify-2fa",
                json={"email": email, "password": password, "code": code},
            )
            assert step2.status_code == 200, step2.text
            data = step2.json()
            assert "access_token" in data
            assert data["user"]["email"] == email
            assert "admin_refresh_token" in step2.headers.get("set-cookie", "")

            from app.core.security import decode_token
            payload = decode_token(data["access_token"])
            assert payload.get("role") == "admin"
            assert payload.get("sub") == user.uuid


@pytest.mark.asyncio
async def test_admin_verify_2fa_rejects_bad_code():
    """A wrong/absent 2FA code must not issue a session."""
    from tests.api.library_helpers import create_admin_user
    admin = await create_admin_user()
    with patch("app.services.email_service.EmailService.send_2fa_code_email", new=AsyncMock(return_value=True)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post("/api/v1/admin/auth/login", json={"email": admin.email, "password": "StrongPass123!"})
            bad = await ac.post(
                "/api/v1/admin/auth/verify-2fa",
                json={"email": admin.email, "password": "StrongPass123!", "code": "000000"},
            )
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_admin_login_no_privileges():
    """
    Test that a regular user cannot login via admin endpoint.
    """
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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/v1/admin/auth/login",
            json={"email": email, "password": password}
        )
        assert login_res.status_code == 403
        data = login_res.json()
        assert "error" in data, f"Response body missing error: {data}"
        assert "Administrative privileges required" in data["error"]
