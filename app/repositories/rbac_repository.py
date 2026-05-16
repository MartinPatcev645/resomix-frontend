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
    async def get_user_roles(db: AsyncSession, user_id: int) -> List[Role]:
        """
        Retrieves all roles assigned to a user.
        """
        query = (
            select(Role)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(UserRole.user_id == user_id)
        )
        result = await db.execute(query)
        return result.scalars().all()

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
            await db.flush()
            return True
        except Exception as e:
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
            await db.flush()
            return True
        except Exception as e:
            logger.error(f"Failed to remove role {role_id} from user {user_id}: {str(e)}")
            return False

    @staticmethod
    async def get_all_roles(db: AsyncSession) -> List[Role]:
        """Retrieves all roles in the system."""
        result = await db.execute(select(Role).order_by(Role.name))
        return result.scalars().all()

    @staticmethod
    async def get_role_with_permissions(db: AsyncSession, role_id: int) -> Optional[Role]:
        """Retrieves a role with its associated permissions loaded."""
        from sqlalchemy.orm import selectinload
        stmt = select(Role).where(Role.id == role_id).options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_permissions(db: AsyncSession) -> List[Permission]:
        """Retrieves all permissions in the system."""
        result = await db.execute(select(Permission).order_by(Permission.name))
        return result.scalars().all()

    @staticmethod
    async def update_role_permissions(db: AsyncSession, role_id: int, permission_ids: List[int]) -> bool:
        """
        Syncs a role's permissions to the provided list.
        """
        from sqlalchemy import delete
        # 1. Remove existing permissions
        await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        
        # 2. Add new permissions
        for pid in permission_ids:
            rp = RolePermission(role_id=role_id, permission_id=pid)
            db.add(rp)
            
        try:
            await db.flush()
            return True
        except Exception as e:
            logger.error(f"Failed to update permissions for role {role_id}: {str(e)}")
            return False
