"""
Integration Tests for Admin Authentication
=========================================

Verifies the JWT-based admin login flow and RBAC enforcement.

Version: 1.0.0
Date: May 16, 2026
"""

import pytest
import uuid
from fastapi import Depends
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User, Role, UserRole
from app.core.security import hash_password
from database.connection import AsyncSessionLocal
from app.repositories.rbac_repository import RBACRepository


@pytest.mark.asyncio
async def test_admin_login_success():
    """
    Test successful admin login and token verification.
    """
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
            # Seed if missing (though seed script should have run)
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

    # 3. Perform login
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/v1/admin/auth/login",
            json={"email": email, "password": password}
        )
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["email"] == email

        # 4. Test require_admin dependency using a dummy endpoint or protected admin endpoint
        # We'll use /api/v1/admin/partners/ (we need to migrate it to require_admin first, 
        # but let's just check the login logic for now).
        
        token = data["access_token"]
        
        from app.core.security import decode_token
        payload = decode_token(token)
        assert payload.get("role") == "admin"
        assert payload.get("sub") == user.uuid


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
