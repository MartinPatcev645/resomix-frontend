"""
Admin Authentication Router
===========================

FastAPI router for administrative authentication (login, refresh, logout, session check).

The admin session is kept SEPARATE from the main site: the refresh token lives in a distinctly
named HttpOnly cookie (``admin_refresh_token``, not the main ``refresh_token``), so admin and
end-user sessions can never clobber each other on the shared API host.

Version: 2.0.0
Date: 2026-07-27
"""

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import require_admin
from app.controllers.admin_auth_controller import AdminAuthController
from app.models.user import User
from app.schemas.admin_auth import AdminLoginRequest, AdminLoginResponse
from app.core.config import settings
from app.utils.response_utils import format_response

router = APIRouter(
    prefix="/admin/auth",
    tags=["admin-auth"],
)

admin_auth_controller = AdminAuthController()

# Distinct from the main site's ``refresh_token`` cookie so the two sessions never collide.
ADMIN_REFRESH_COOKIE = "admin_refresh_token"


def _set_admin_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ADMIN_REFRESH_COOKIE,
        value=token,
        max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.safe_cookie_domain,
        path="/",
    )


def _clear_admin_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=ADMIN_REFRESH_COOKIE,
        domain=settings.safe_cookie_domain,
        path="/",
    )


@router.post(
    "/login",
    response_model=AdminLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Login",
    description="Authenticates an admin and returns an admin JWT; the refresh token is set as an HttpOnly cookie.",
)
async def admin_login(
    request: Request,
    payload: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_database_session),
):
    ip_address = request.client.host if request.client else None
    result = await admin_auth_controller.login(db, payload.email, payload.password, ip_address=ip_address)
    # Refresh token → HttpOnly cookie (admin-scoped), never in the response body.
    _set_admin_refresh_cookie(response, result.pop("refresh_token"))
    return result


@router.post(
    "/refresh",
    status_code=status.HTTP_200_OK,
    summary="Admin Token Refresh",
    description="Issues a fresh admin access token from the admin refresh cookie (re-checks admin:access).",
)
async def admin_refresh(
    db: AsyncSession = Depends(get_database_session),
    admin_refresh_token: str = Cookie(default=None),
):
    if not admin_refresh_token:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=format_response(success=False, error="No admin session. Please log in."),
        )
    result = await admin_auth_controller.refresh(db, admin_refresh_token)
    new_refresh = result.pop("refresh_token")
    # Envelope shape the shared auth client expects: { success, data: { access_token } }.
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=jsonable_encoder(format_response(success=True, data=result)),
    )
    _set_admin_refresh_cookie(response, new_refresh)
    return response


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Admin Logout",
    description="Clears the admin refresh cookie.",
)
async def admin_logout(response: Response):
    _clear_admin_refresh_cookie(response)
    return format_response(success=True, data={"message": "Logged out."})


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Current Admin",
    description="Validates the admin session (admin JWT + admin:access) and returns the current admin.",
)
async def admin_me(current_user: User = Depends(require_admin)):
    # `require_admin` already enforces the admin JWT claim + admin:access; a 401/403 here means the
    # session is invalid, which the frontend treats as "log in again".
    return format_response(success=True, data={"user": AdminAuthController._user_payload(current_user)})
