"""
Authentication Dependencies
===========================

This module provides FastAPI dependency functions for authentication including
API key validation and JWT token authentication.

Supports dual authentication modes:
- API Key: For public/anonymous access (existing)
- JWT Bearer Token: For authenticated users (new)

Version: 3.2.0
Date: October 23, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from datetime import datetime
from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN, HTTP_401_UNAUTHORIZED
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from database.connection import AsyncSessionLocal

from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User
from app.api.dependencies.database import get_database_session
from app.repositories.rbac_repository import RBACRepository
from app.repositories.user_repository import UserRepository, UserSessionRepository
from app.utils.edge_auth import verify_edge_token
from app.core.context import set_admin_context
from app.core.rbac import PERMISSIONS
import logging

# Redis for session tracking
import redis.asyncio as aioredis
from app.db.redis import _redis_pool


# ============================================================================
# API Key Authentication (Existing - for backward compatibility)
# ============================================================================

# APIKeyHeader kept only so the partner dependencies can read an X-API-KEY header if a B2B client
# sends its ``rmx_…`` key that way. The old static-super-key ``get_api_key`` dependency was removed
# entirely: no endpoint accepts a static key anymore (frontend = anonymous/JWT → Partner 1;
# admin = admin-role JWT via /admin/auth/login).
api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)


from app.core.context import set_admin_context


# ============================================================================
# JWT Token Authentication (New - for authenticated users)
# ============================================================================


async def _refresh_redis_session_ttl(user_id: int):
    """
    Update the user's session activity in Redis.
    This triggers a TTL refresh. If the session expires
    natively in Redis, it triggers cleanup tasks via Keyspace events.
    """
    logger = logging.getLogger(__name__)
    try:
        if _redis_pool:
            client = aioredis.Redis(connection_pool=_redis_pool)
            session_key = f"session:user:{user_id}"
            # 1200 seconds = 20 minutes
            await client.setex(session_key, 1200, "active")
            await client.close()
    except Exception as e:
        logger.warning(f"Failed to update Redis user session TTL: {str(e)}")


# How stale `users.last_seen_at` is allowed to get. Five minutes is precise enough to answer
# "when was this account last used?" on an admin screen, and coarse enough that a busy session
# writes a handful of rows a day instead of one per request.
_LAST_SEEN_THROTTLE_SECONDS = 300


def assert_active(user: User) -> None:
    """Refuse a deactivated account. Call from EVERY path that resolves a token to a user.

    Deliberately a shared helper rather than an inline check. There are two token-resolving
    dependencies — `get_current_user` and `get_current_user_optional` — and the optional one was
    missed the first time round. That left 17 endpoints, including similarity search, still
    recognising a deactivated user and granting their full entitlements while the admin screen
    reported them as inactive.

    403 with a machine-readable code, never a bare 401: the frontend's 401 interceptor would try to
    refresh the token and loop. `ACCOUNT_DEACTIVATED` is what lets the client explain rather than
    show a generic failure.

    Optional auth refuses too rather than degrading to guest — a token that identifies a blocked
    account is not the same as no token, and silently downgrading someone to guest limits while
    they still look signed in is more confusing than telling them.
    """
    if not user.is_active:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_DEACTIVATED",
                "error": "This account is deactivated. Contact support to restore access.",
            },
        )


async def _touch_last_seen(db: AsyncSession, user: User) -> None:
    """Record that this user did something, at most once per throttle window.

    Nothing else in the schema can answer this. `system_logs` records `client_ip` and endpoints but
    has **no user_id**, so a request cannot be attributed to a person; `user_sessions.created_at`
    records logins, which is a different question — a session opened in January and used daily
    since would still report January.

    Best-effort by design: this runs on the hot path of every authenticated request, and a
    telemetry write must never be the reason a real request fails.
    """
    try:
        now = datetime.utcnow()
        last = user.last_seen_at
        if last is not None and (now - last).total_seconds() < _LAST_SEEN_THROTTLE_SECONDS:
            return
        # Targeted UPDATE rather than mutating the ORM object: the caller's session may be used for
        # a request that later rolls back, and losing a real change to save a timestamp would be a
        # bad trade in the other direction.
        await db.execute(
            update(User).where(User.id == user.id).values(last_seen_at=now)
        )
        await db.commit()
        user.last_seen_at = now
    except Exception as exc:  # noqa: BLE001 — see the docstring
        logging.getLogger(__name__).warning("Failed to update last_seen_at: %s", exc)


# OAuth2 scheme for JWT tokens
# auto_error=False allows optional authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_database_session),
) -> User:
    """
    Get current authenticated user from JWT token.
    REQUIRED auth - raises 401 if no valid token.

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        User object

    Raises:
        HTTPException: If token is invalid, expired, or user not found
    """
    if not token:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode token
    try:
        payload = decode_token(token)
        request.state.token_payload = payload
    except HTTPException:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user UUID from token
    user_uuid: str = payload.get("sub")
    if not user_uuid:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    user_repo = UserRepository()
    user = await user_repo.async_get_by_uuid(db, user_uuid)

    if not user:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Deactivated accounts stop here. Blocking at login alone is not enough — a live session
    # outlives it by however long the access token has left (30 minutes by default).
    assert_active(user)

    # Fast TTL refresh in Redis for activity tracking
    await _refresh_redis_session_ttl(user.id)

    # "When did this user last do anything?" — throttled to at most one write per user per
    # interval, so an active session costs a handful of UPDATEs a day rather than one per request.
    await _touch_last_seen(db, user)

    return user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_database_session),
) -> Optional[User]:
    """
    Get current user if authenticated, None if anonymous.
    OPTIONAL auth - returns None only when NO token is provided.

    Returns 401 if token is provided but invalid/expired.

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        User object or None if not authenticated (no token provided)

    Raises:
        HTTPException: 401 if token is provided but invalid/expired
    """
    # No token provided - treat as anonymous (this is OK)
    if not token:
        return None
        
    # If this is a B2B Partner API key (rmx_...), ignore it here.
    # It will be handled by the get_current_partner dependency.
    if token.startswith("rmx_"):
        return None

    try:
        # Decode token - will raise HTTPException if expired/invalid
        payload = decode_token(token)

        # Verify token type
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected access token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user UUID
        user_uuid: str = payload.get("sub")
        if not user_uuid:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user identifier",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Fetch user
        user_repo = UserRepository()
        user = await user_repo.async_get_by_uuid(db, user_uuid)

        if not user:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Same gate as the required path. Missing here, "optional auth" meant a deactivated user
        # kept full entitlements on the 17 endpoints that use this dependency — similarity search
        # among them — while the admin screen showed them as inactive.
        assert_active(user)

        # Fast TTL refresh in Redis for activity tracking
        await _refresh_redis_session_ttl(user.id)

        await _touch_last_seen(db, user)

        return user

    except HTTPException:
        # Re-raise HTTPException (401 errors from decode_token or above), including the 403 from
        # `assert_active` — the generic `except Exception` below must not turn it into a 401.
        raise
    except Exception:
        # Unexpected error - treat as invalid token
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# RBAC & Permission Enforcement (New - Part 1)
# ============================================================================

def require_permission(permission_name: str):
    """
    Dependency factory to enforce a specific RBAC permission.
    Loads permissions from DB and caches them in request.state.
    Supports both JWT and static API key (for legacy/ZTS/testing).
    """
    async def _require_permission(
        request: Request,
        db: AsyncSession = Depends(get_database_session),
    ) -> User:
        # A Bearer JWT is the only accepted credential for permission-gated routes. The static
        # super-key was retired: administrative access now flows through a real login
        # (/admin/auth/login) that mints an admin-role JWT, and permissions are resolved from RBAC.
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="Authentication required. Please provide a valid JWT token.",
            )

        current_user = await get_current_user(request, token, db)

        # Check if the user is active
        if hasattr(current_user, 'is_active') and not current_user.is_active:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="User account is deactivated"
            )

        # Resolve and cache permissions for the lifecycle of this request
        if not hasattr(request.state, "permissions"):
            permissions = await RBACRepository.get_user_permissions(db, current_user.id)
            request.state.permissions = permissions
        
        if permission_name not in request.state.permissions:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission_name}"
            )
        
        return current_user
    
    return _require_permission


async def require_admin(
    request: Request,
    current_user: User = Depends(require_permission("admin:access")),
) -> User:
    """
    Convenience dependency for admin-only routes.
    Enforces 'admin:access' permission and verifies admin JWT claim.
    Administrative routes strictly require a valid JWT with 'role' set to 'admin'.
    """
    # Administrative routes strictly require a valid admin JWT: the token must carry a
    # 'role': 'admin' claim AND the user must actually hold the admin role in the database
    # (defence-in-depth against a forged/leaked token). The static super-key was retired.
    payload = getattr(request.state, "token_payload", None)
    if not payload:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Administrative routes strictly require a valid JWT token authentication."
        )

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Admin JWT claim missing. Please login via the admin portal."
        )

    # Strictly verify admin status in database (don't trust the payload alone).
    if not hasattr(request.state, "is_verified_admin"):
        async with AsyncSessionLocal() as db:
            roles = await RBACRepository.get_user_roles(db, current_user.id)
            if not any(r.name == "admin" for r in roles):
                raise HTTPException(
                    status_code=HTTP_403_FORBIDDEN,
                    detail="Administrative privileges required (Verified)."
                )
            request.state.is_verified_admin = True

    # Enable multi-tenant bypass for this admin request
    set_admin_context(True)
    return current_user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current authenticated user (no email verification required).
    """
    return current_user


async def verify_session_active(
    token: Optional[str] = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session),
) -> User:
    """
    Verify that the session associated with the token is still active.

    Args:
        token: JWT refresh token
        current_user: Current authenticated user
        db: Database session

    Returns:
        User object if session is active

    Raises:
        HTTPException: If session is revoked or expired
    """
    if not token:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="No token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if any active session exists for this user
    session_repo = UserSessionRepository()
    sessions = await session_repo.async_get_active_sessions(db, current_user.id)

    if not sessions:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="No active sessions found. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user

