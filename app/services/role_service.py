"""
Role Service
============

Service for administrative RBAC operations including roles and permission management.
Sits between the controller layer and the RBAC repository, ensuring transaction isolation.

Version: 1.0.0
Author: Muhammad Usman Naeem
Date: May 2026
"""

from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.repositories.rbac_repository import RBACRepository
from app.services.admin_operation_log_service import AdminOperationLogService

logger = logging.getLogger(__name__)


class RoleService:
    """Service layer managing RBAC roles and permissions."""

    def __init__(self) -> None:
        self.rbac_repo = RBACRepository()
        self.admin_log_service = AdminOperationLogService()

    async def list_roles(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Retrieve all roles with their basic details and permission count."""
        roles = await self.rbac_repo.get_all_roles(db)
        roles_data = []
        for role in roles:
            role_with_perms = await self.rbac_repo.get_role_with_permissions(db, role.id)
            roles_data.append({
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permission_count": len(role_with_perms.role_permissions) if role_with_perms else 0
            })
        return roles_data

    async def get_role_detail(self, db: AsyncSession, role_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve detailed role info including lists of its permissions."""
        role_base = await self.rbac_repo.get_role_by_name(db, role_name)
        if not role_base:
            return None

        role = await self.rbac_repo.get_role_with_permissions(db, role_base.id)
        if not role:
            return None

        permissions = []
        for rp in role.role_permissions:
            permissions.append({
                "id": rp.permission.id,
                "name": rp.permission.name,
                "description": rp.permission.description
            })

        return {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "permissions": permissions
        }

    async def update_role_permissions(
        self,
        db: AsyncSession,
        role_name: str,
        permission_names: List[str],
        current_admin: Any,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Synchronize permissions assigned to a role, logging the administrative action.
        """
        role = await self.rbac_repo.get_role_by_name(db, role_name)
        if not role:
            return False, "Role not found"

        # Resolve permission names to IDs
        all_perms = await self.rbac_repo.get_all_permissions(db)
        perm_map = {p.name: p.id for p in all_perms}

        permission_ids = []
        for name in permission_names:
            if name in perm_map:
                permission_ids.append(perm_map[name])
            else:
                return False, f"Permission '{name}' does not exist"

        # Get before state for audit logging
        role_before = await self.rbac_repo.get_role_with_permissions(db, role.id)
        before_perms = [rp.permission.name for rp in role_before.role_permissions] if role_before else []

        success = await self.rbac_repo.update_role_permissions(db, role.id, permission_ids)
        if not success:
            return False, "Failed to update role permissions"

        # Log admin operation
        if current_admin:
            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="role.permissions.update",
                target_type="role",
                target_id=role_name,
                before_state={"permissions": before_perms},
                after_state={"permissions": permission_names},
                ip_address=ip_address
            )
        
        await db.commit()
        return True, f"Permissions updated for role '{role_name}'"

    async def list_all_permissions(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Retrieve all permissions in the system."""
        permissions = await self.rbac_repo.get_all_permissions(db)
        return [{
            "id": p.id,
            "name": p.name,
            "description": p.description
        } for p in permissions]
