"""
Admin Role Controller
=====================

Handles administrative RBAC management including roles and 
permission assignments.

Version: 2.0.0
Date: May 22, 2026
Author: Muhammad Usman Naeem
"""

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.services.role_service import RoleService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class AdminRoleController:
    """Controller for administrative role and permission operations."""

    def __init__(self):
        self.role_service = RoleService()

    async def list_roles(self, db: AsyncSession) -> JSONResponse:
        """List all roles with basic info."""
        try:
            roles_data = await self.role_service.list_roles(db)
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
            role_data = await self.role_service.get_role_detail(db, role_name)
            if not role_data:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="Role not found")
                )

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
            success, message = await self.role_service.update_role_permissions(
                db=db,
                role_name=role_name,
                permission_names=permission_names,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )
            
            if success:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=message)
                )
            else:
                status_code = status.HTTP_404_NOT_FOUND if "not found" in message.lower() else status.HTTP_400_BAD_REQUEST
                return JSONResponse(
                    status_code=status_code,
                    content=format_response(success=False, error=message)
                )

        except Exception as e:
            logger.error(f"Error updating role permissions: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during permission update")
            )

    async def list_all_permissions(self, db: AsyncSession) -> JSONResponse:
        """List all available permissions in the system."""
        try:
            perm_list = await self.role_service.list_all_permissions(db)
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
