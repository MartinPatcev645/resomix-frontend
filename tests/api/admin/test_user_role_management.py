"""
Admin User and Role Management Tests
====================================

Verifies CRUD operations for users and roles, and role assignment logic.
Ensures audit logs are correctly generated for all mutations.

Version: 1.0.0
Date: May 16, 2026
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.main import app
from app.core.config import settings
from app.models.user import User, Role
from app.models.admin_operation_log import AdminOperationLog
from app.core.security import hash_password, create_access_token
from database.connection import AsyncSessionLocal
from app.repositories.rbac_repository import RBACRepository


@pytest.fixture
async def admin_auth_headers():
    """Create a super admin and return auth headers."""
    email = f"superadmin_{uuid.uuid4().hex[:6]}@example.com"
    async with AsyncSessionLocal() as db:
        user = User(
            username=f"admin_{uuid.uuid4().hex[:6]}",
            email=email,
            password_hash=hash_password("AdminPass123!"),
            is_active=True
        )
        db.add(user)
        await db.flush()

        admin_role = await RBACRepository.get_role_by_name(db, "admin")
        await RBACRepository.assign_role_to_user(db, user.id, admin_role.id)
        await db.commit()
        await db.refresh(user)

        token = create_access_token(
            data={"sub": user.uuid},
            extra_claims={"role": "admin"}
        )
        return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_users_admin(admin_auth_headers):
    """Test that admin can list users."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["data"]) >= 1


@pytest.mark.asyncio
async def test_create_user_admin(admin_auth_headers):
    """Test manual user creation and audit log generation."""
    email = f"newuser_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": email,
        "username": f"user_{uuid.uuid4().hex[:6]}",
        "password": "TemporaryPass123!",
        "name": "Admin Created User",
        "is_active": True
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/admin/users", json=payload, headers=admin_auth_headers)
        assert res.status_code == 201
        user_uuid = res.json()["data"]["uuid"]

        # Verify Audit Log
        async with AsyncSessionLocal() as db:
            stmt = select(AdminOperationLog).where(AdminOperationLog.target_id == user_uuid).order_by(AdminOperationLog.created_at.desc())
            result = await db.execute(stmt)
            log = result.scalars().first()
            assert log is not None
            assert log.action == "user.create"
            assert log.target_type == "user"


@pytest.mark.asyncio
async def test_assign_and_remove_role(admin_auth_headers):
    """Test assigning and removing a role from a user."""
    # 1. Create a user first
    email = f"roleuser_{uuid.uuid4().hex[:6]}@example.com"
    async with AsyncSessionLocal() as db:
        user = User(
            username=f"roleuser_{uuid.uuid4().hex[:6]}",
            email=email,
            password_hash=hash_password("Pass123!"),
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_uuid = user.uuid

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 2. Assign 'user' role
        res = await ac.post(
            f"/api/v1/admin/users/{user_uuid}/roles",
            json={"role_name": "user"},
            headers=admin_auth_headers
        )
        assert res.status_code == 200

        # 3. Verify in DB
        async with AsyncSessionLocal() as db:
            from app.models.user import UserRole
            stmt = select(User).where(User.uuid == user_uuid).options(selectinload(User.roles).selectinload(UserRole.role))
            result = await db.execute(stmt)
            updated_user = result.scalar_one()
            role_names = [r.role.name for r in updated_user.roles]
            assert "user" in role_names

        # 4. Remove 'user' role
        res = await ac.delete(
            f"/api/v1/admin/users/{user_uuid}/roles/user",
            headers=admin_auth_headers
        )
        assert res.status_code == 200

        # 5. Verify in DB
        async with AsyncSessionLocal() as db:
            from app.models.user import UserRole
            stmt = select(User).where(User.uuid == user_uuid).options(selectinload(User.roles).selectinload(UserRole.role))
            result = await db.execute(stmt)
            updated_user = result.scalar_one()
            role_names = [r.role.name for r in updated_user.roles]
            assert "user" not in role_names


@pytest.mark.asyncio
async def test_list_roles_and_permissions(admin_auth_headers):
    """Test listing roles and system permissions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # List Roles
        res = await ac.get("/api/v1/admin/roles", headers=admin_auth_headers)
        assert res.status_code == 200
        assert len(res.json()["data"]) >= 3  # admin, partner_admin, user

        # List Permissions
        res = await ac.get("/api/v1/admin/roles/permissions", headers=admin_auth_headers)
        assert res.status_code == 200
        assert len(res.json()["data"]) > 10
