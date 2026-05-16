"""
Admin Authentication Router
===========================

FastAPI router for administrative authentication (login, refresh).

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.controllers.admin_auth_controller import AdminAuthController
from app.schemas.admin_auth import AdminLoginRequest, AdminLoginResponse, AdminTokenRefreshResponse

router = APIRouter(
    prefix="/admin/auth",
    tags=["admin-auth"],
)

admin_auth_controller = AdminAuthController()


@router.post(
    "/login",
    response_model=AdminLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Login",
    description="Authenticates an admin user and returns a JWT with administrative claims."
)
async def admin_login(
    request: Request,
    payload: AdminLoginRequest,
    db: AsyncSession = Depends(get_database_session)
):
    ip_address = request.client.host if request.client else None
    return await admin_auth_controller.login(db, payload.email, payload.password, ip_address=ip_address)
