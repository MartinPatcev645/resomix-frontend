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

from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.api_key import APIKeyQuery
from starlette.status import HTTP_403_FORBIDDEN, HTTP_401_UNAUTHORIZED
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User
from app.repositories.user_repository import UserRepository, UserSessionRepository
from app.api.dependencies.database import get_database_session

# Redis for session tracking
import redis.asyncio as aioredis
from app.db.redis import _redis_pool


# ============================================================================
# API Key Authentication (Existing - for backward compatibility)
# ============================================================================

# Set up API key security - using query parameter as specified in frontend
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


async def get_api_key(
    request: Request,
    api_key_query: str = Security(api_key_query),
):
    """
    Validate API key for admin endpoints.

    Allows CORS preflight (OPTIONS) to pass through without credentials.
    """
    if request.method == "OPTIONS":
        return api_key_query

    if api_key_query == settings.api_key:
        return api_key_query

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
