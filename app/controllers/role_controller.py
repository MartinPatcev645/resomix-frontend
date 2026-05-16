"""
Role Controller
===============

Handles admin HTTP orchestration for managing roles and permissions.
"""

from __future__ import annotations

import time
from typing import Optional, List, Dict, Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.logging_service import LoggingService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.utils.response_utils import format_response
from app.models.user import User, Role, Permission


class RoleController:
    """Controller for admin role and permission endpoints."""

    def __init__(self) -> None:
        self.logging_service = LoggingService()
        self.admin_log_service = AdminOperationLogService()

    async def list_roles(
        self,
        db: AsyncSession,
        request: Request,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """List all roles with their permissions."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        try:
            stmt = select(Role).options(selectinload(Role.permissions))
            result = await db.execute(stmt)
            roles = result.scalars().all()
            
            data = [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "permissions": [
                        {"id": p.id, "name": p.name, "description": p.description}
                        for p in r.permissions
                    ]
                }
                for r in roles
            ]
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=data)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e))
            )

    async def list_permissions(
        self,
        db: AsyncSession,
        request: Request,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """List all available permissions."""
        from sqlalchemy import select
        
        try:
            stmt = select(Permission)
            result = await db.execute(stmt)
            permissions = result.scalars().all()
            
            data = [
                {"id": p.id, "name": p.name, "description": p.description}
                for p in permissions
            ]
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=data)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e))
            )

    async def create_role(
        self,
        db: AsyncSession,
        request: Request,
        name: str,
        description: Optional[str] = None,
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """Create a new role."""
        try:
            role = Role(name=name, description=description)
            db.add(role)
            await db.commit()
            await db.refresh(role)
            
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="role.create",
                    target_type="role",
                    target_id=str(role.id),
                    before_state=None,
                    after_state={"name": name, "description": description},
                    ip_address=request.client.host if request and request.client else None
                )
                
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=format_response(
                    success=True, 
                    data={"id": role.id, "name": role.name, "description": role.description}
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e))
            )

    async def update_role_permissions(
        self,
        db: AsyncSession,
        request: Request,
        role_id: int,
        permission_ids: List[int],
        current_admin: Optional[User] = None,
    ) -> JSONResponse:
        """Update permissions assigned to a role."""
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select
        
        try:
            role = await db.get(Role, role_id, options=[selectinload(Role.permissions)])
            if not role:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="Role not found")
                )
            
            # Fetch permissions
            stmt = select(Permission).where(Permission.id.in_(permission_ids))
            res = await db.execute(stmt)
            permissions = res.scalars().all()
            
            role.permissions = list(permissions)
            await db.commit()
            
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="role.update_permissions",
                    target_type="role",
                    target_id=str(role_id),
                    before_state=None,
                    after_state={"permission_ids": permission_ids},
                    ip_address=request.client.host if request and request.client else None
                )
                
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data={"message": "Permissions updated successfully"})
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=str(e))
            )
