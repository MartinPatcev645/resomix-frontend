"""
Admin Role Controller
=====================

Handles administrative RBAC management including roles and 
permission assignments.

Version: 1.0.0
Date: May 16, 2026
Author: Muhammad Usman Naeem
"""

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.repositories.rbac_repository import RBACRepository
from app.services.admin_operation_log_service import AdminOperationLogService
from app.utils.response_utils import format_response
from app.models.user import Role, Permission

logger = logging.getLogger(__name__)


class AdminRoleController:
    """Controller for administrative role and permission operations."""

    def __init__(self):
        self.rbac_repo = RBACRepository()
        self.admin_log_service = AdminOperationLogService()

    async def list_roles(self, db: AsyncSession) -> JSONResponse:
        """List all roles with basic info."""
        try:
            roles = await self.rbac_repo.get_all_roles(db)
            
            # Fetch permission counts for each role
            # (In a real app we might do this in one query, but for now we loop)
            roles_data = []
            for role in roles:
                # We need to load permissions to count them
                role_with_perms = await self.rbac_repo.get_role_with_permissions(db, role.id)
                roles_data.append({
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "permission_count": len(role_with_perms.role_permissions) if role_with_perms else 0
                })

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=roles_data)
            )
        except Exception as e:
            logger.error(f"Error listing roles: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve roles list")
            )

    async def get_role_detail(self, db: AsyncSession, role_name: str) -> JSONResponse:
        """Get role details including full permission list."""
        try:
            role_base = await self.rbac_repo.get_role_by_name(db, role_name)
            if not role_base:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="Role not found")
                )

            role = await self.rbac_repo.get_role_with_permissions(db, role_base.id)
            
            permissions = []
            for rp in role.role_permissions:
                permissions.append({
                    "id": rp.permission.id,
                    "name": rp.permission.name,
                    "description": rp.permission.description
                })

            role_data = {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": permissions
            }

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=role_data)
            )
        except Exception as e:
            logger.error(f"Error getting role detail: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve role details")
            )

    async def update_role_permissions(
        self,
        db: AsyncSession,
        request: Request,
        role_name: str,
        permission_names: List[str],
        current_admin: Any
    ) -> JSONResponse:
        """Sync a role's permissions."""
        try:
            role = await self.rbac_repo.get_role_by_name(db, role_name)
            if not role:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="Role not found")
                )

            # Protect system roles
            if role_name in ["admin", "user"] and role_name != "admin": # Wait, 'admin' role permissions CAN be updated by super-admin?
                # Usually we protect the 'admin' role from losing 'role:manage' or 'admin:access'
                pass

            # Resolve permission names to IDs
            all_perms = await self.rbac_repo.get_all_permissions(db)
            perm_map = {p.name: p.id for p in all_perms}
            
            permission_ids = []
            for name in permission_names:
                if name in perm_map:
                    permission_ids.append(perm_map[name])
                else:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content=format_response(success=False, error=f"Permission '{name}' does not exist")
                    )

            # Get before state for logging
            role_before = await self.rbac_repo.get_role_with_permissions(db, role.id)
            before_perms = [rp.permission.name for rp in role_before.role_permissions]

            success = await self.rbac_repo.update_role_permissions(db, role.id, permission_ids)
            
            if success:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="role.permissions.update",
                    target_type="role",
                    target_id=role_name,
                    before_state={"permissions": before_perms},
                    after_state={"permissions": permission_names},
                    ip_address=request.client.host if request.client else None
                )
                await db.commit()
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=f"Permissions updated for role '{role_name}'")
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error="Failed to update role permissions")
                )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating role permissions: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during permission update")
            )

    async def list_all_permissions(self, db: AsyncSession) -> JSONResponse:
        """List all available permissions in the system."""
        try:
            permissions = await self.rbac_repo.get_all_permissions(db)
            perm_list = [{
                "id": p.id,
                "name": p.name,
                "description": p.description
            } for p in permissions]

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=perm_list)
            )
        except Exception as e:
            logger.error(f"Error listing permissions: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve permissions list")
            )
