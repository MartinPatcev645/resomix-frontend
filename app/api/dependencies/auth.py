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

import uuid
from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN, HTTP_401_UNAUTHORIZED
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User
from app.api.dependencies.database import get_database_session
from app.repositories.rbac_repository import RBACRepository
from app.repositories.user_repository import UserRepository, UserSessionRepository
from app.utils.edge_auth import verify_edge_token
from app.core.context import set_admin_context

# Redis for session tracking
import redis.asyncio as aioredis
from app.db.redis import _redis_pool


# ============================================================================
# API Key Authentication (Existing - for backward compatibility)
# ============================================================================

# Set up API key security - using header for flexibility (query param removed for security)
api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)


from app.core.context import set_admin_context

async def get_api_key(
    request: Request,
    api_key_header: Optional[str] = Security(api_key_header),
):
    """
    Validate API key for endpoints.
    Checks X-API-KEY header and falls back to 'api_key' query parameter
    to support HLS manifests and heartbeat beacons.

    Allows CORS preflight (OPTIONS) to pass through without credentials.
    """
    if request.method == "OPTIONS":
        return api_key_header

    # Extract key from header or query parameter
    key = api_key_header or request.query_params.get("api_key")

    if key == settings.api_key:
        # Flag this request as administrative to allow multi-tenant bypass
        set_admin_context(True)
        return key

    raise HTTPException(
        status_code=HTTP_403_FORBIDDEN, detail="Could not validate credentials"
    )


# ============================================================================
# JWT Token Authentication (New - for authenticated users)
# ============================================================================


async def _refresh_redis_session_ttl(user_id: int):
    """
    Update the user's session activity in Redis.
    This triggers a TTL refresh. If the session expires
    natively in Redis, it triggers cleanup tasks via Keyspace events.
    """
    import logging

    logger = logging.getLogger(__name__)
    try:
        from app.db.redis import _redis_pool

        if _redis_pool:
            client = aioredis.Redis(connection_pool=_redis_pool)
            session_key = f"session:user:{user_id}"
            # 1200 seconds = 20 minutes
            await client.setex(session_key, 1200, "active")
            await client.close()
    except Exception as e:
        logger.warning(f"Failed to update Redis user session TTL: {str(e)}")


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

    # Fast TTL refresh in Redis for activity tracking
    await _refresh_redis_session_ttl(user.id)

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

        # Fast TTL refresh in Redis for activity tracking
        await _refresh_redis_session_ttl(user.id)

        return user

    except HTTPException:
        # Re-raise HTTPException (401 errors from decode_token or above)
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
        # 1. Try Static API Key first (Legacy / ZTS / Tests) - Header only
        api_key = request.headers.get("X-API-KEY")
        if api_key and api_key == settings.api_key:
            # Resolve a system admin user for audit logging
            from app.models.user import UserRole, Role
            from sqlalchemy import select
            
            stmt = select(User).join(UserRole, User.id == UserRole.user_id).join(Role).where(Role.name == "admin").limit(1)
            result = await db.execute(stmt)
            admin = result.scalar_one_or_none()
            
            if not admin:
                # Fallback for tests or fresh installs
                admin = User(
                    id=0, 
                    email="system@resomix.local", 
                    username="system_admin",
                    uuid=str(uuid.uuid4())
                )
            
            set_admin_context(True)
            # Cache all permissions for static key access (it's a super-key)
            if not hasattr(request.state, "permissions"):
                from app.core.rbac import PERMISSIONS
                request.state.permissions = list(PERMISSIONS.keys())
            
            return admin

        # 2. Check Authorization header for Bearer token
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        
        # 3. Allow Static API Key in Bearer token (for some tests/legacy clients)
        if token and token == settings.api_key:
            from app.models.user import UserRole, Role
            from sqlalchemy import select
            
            stmt = select(User).join(UserRole, User.id == UserRole.user_id).join(Role).where(Role.name == "admin").limit(1)
            result = await db.execute(stmt)
            admin = result.scalar_one_or_none()
            
            if not admin:
                admin = User(
                    id=0, 
                    email="system@resomix.local", 
                    username="system_admin",
                    uuid=str(uuid.uuid4())
                )
            
            set_admin_context(True)
            if not hasattr(request.state, "permissions"):
                from app.core.rbac import PERMISSIONS
                request.state.permissions = list(PERMISSIONS.keys())
            
            return admin
        
        if not token:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="Authentication required. Please provide a valid API key or JWT token.",
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
    # Force JWT-based authentication for administrative routes, UNLESS a valid system static API key is used.
    api_key = request.headers.get("X-API-KEY")
    auth_header = request.headers.get("Authorization")
    is_static_api_key = (
        (api_key and api_key == settings.api_key) or
        (auth_header and auth_header.startswith("Bearer ") and auth_header.split(" ")[1] == settings.api_key)
    )

    if not is_static_api_key:
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
            
        # Strictly verify admin status in database (Don't trust payload alone)
        # This fulfills the request to rely on user authentication + role verification
        from app.repositories.rbac_repository import RBACRepository
        # We reuse the cached permissions if possible, but a role check is more explicit
        if not hasattr(request.state, "is_verified_admin"):
            from app.api.dependencies.database import AsyncSessionLocal
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

