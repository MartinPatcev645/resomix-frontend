"""
RBAC Repository
===============

Repository layer for managing roles and permissions.
Handles role assignment, permission checks, and RBAC seeding.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import List, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, Role, Permission, UserRole, RolePermission
import logging

logger = logging.getLogger(__name__)


class RBACRepository:
    """
    Data access layer for RBAC entities.
    """

    @staticmethod
    async def get_role_by_name(db: AsyncSession, name: str) -> Optional[Role]:
        result = await db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_permissions(db: AsyncSession, user_id: int) -> Set[str]:
        """
        Retrieves all unique permission names for a user across all their roles.
        """
        query = (
            select(Permission.name)
            .join(RolePermission, Permission.id == RolePermission.permission_id)
            .join(UserRole, RolePermission.role_id == UserRole.role_id)
            .where(UserRole.user_id == user_id)
        )
        result = await db.execute(query)
        return set(result.scalars().all())

    @staticmethod
    async def assign_role_to_user(
        db: AsyncSession, user_id: int, role_id: int, granted_by: Optional[int] = None
    ) -> bool:
        """
        Assigns a role to a user. Idempotent.
        """
        # Check if already assigned
        existing = await db.get(UserRole, {"user_id": user_id, "role_id": role_id})
        if existing:
            return True

        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            granted_by=granted_by
        )
        db.add(user_role)
        try:
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to assign role {role_id} to user {user_id}: {str(e)}")
            return False

    @staticmethod
    async def remove_role_from_user(db: AsyncSession, user_id: int, role_id: int) -> bool:
        """
        Removes a role from a user.
        """
        user_role = await db.get(UserRole, {"user_id": user_id, "role_id": role_id})
        if not user_role:
            return True

        await db.delete(user_role)
        try:
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to remove role {role_id} from user {user_id}: {str(e)}")
            return False
