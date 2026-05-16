"""
Unit Tests for RBAC Foundation
==============================

Tests for AdminOperationLogService and RBACRepository.
Verifies that the new schema and models work correctly.

Version: 1.0.0
Date: May 16, 2026
"""

import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, Role, Permission
from app.services.admin_operation_log_service import AdminOperationLogService
from app.repositories.rbac_repository import RBACRepository
from app.models.admin_operation_log import AdminOperationLog


from database.connection import AsyncSessionLocal

@pytest.mark.asyncio
async def test_admin_operation_logging():
    """
    Test that admin operations can be logged.
    """
    async with AsyncSessionLocal() as db_session:
        # Create a test admin user
        admin = User(
            username="test_admin_log_" + str(uuid.uuid4())[:8],
            email=f"admin_log_{uuid.uuid4()}@example.com",
            password_hash="hash"
        )
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)

        # Log an operation
        action = "test.action"
        target_type = "user"
        target_id = "123"
        before = {"status": "old"}
        after = {"status": "new"}

        log = await AdminOperationLogService.log_operation(
            db=db_session,
            admin_user_id=admin.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before,
            after_state=after,
            ip_address="127.0.0.1"
        )

        assert log is not None
        assert log.admin_user_id == admin.id
        assert log.action == action
        assert log.target_type == target_type
        assert log.target_id == target_id
        assert log.before_state == before
        assert log.after_state == after


@pytest.mark.asyncio
async def test_rbac_repository_permissions():
    """
    Test permission retrieval via RBACRepository.
    """
    async with AsyncSessionLocal() as db_session:
        # Create user
        user = User(
            username="rbac_test_user_" + str(uuid.uuid4())[:8],
            email=f"rbac_test_{uuid.uuid4()}@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create role and permission
        role_name = "test_role_" + str(uuid.uuid4())[:8]
        perm_name = "test:perm_" + str(uuid.uuid4())[:8]
        role = Role(name=role_name, description="Test Role")
        perm = Permission(name=perm_name, description="Test Permission")
        db_session.add_all([role, perm])
        await db_session.commit()
        await db_session.refresh(role)
        await db_session.refresh(perm)

        # Assign perm to role
        from app.models.user import RolePermission
        rp = RolePermission(role_id=role.id, permission_id=perm.id)
        db_session.add(rp)
        await db_session.commit()

        # Assign role to user
        await RBACRepository.assign_role_to_user(db_session, user.id, role.id)

        # Check permissions
        permissions = await RBACRepository.get_user_permissions(db_session, user.id)
        assert perm_name in permissions
