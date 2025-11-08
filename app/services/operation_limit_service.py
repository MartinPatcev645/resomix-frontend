"""
Operation Limit Service
=======================

Business logic for admin management of operation types and per-user limits.
Coordinates repositories to provide validated responses for controllers.

Version: 3.0.1
Init Date: November 08, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OperationType, Playlist, User, UserOperationLimit
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.repositories.user_repository import UserRepository


class OperationLimitService:
    """Service layer for admin operation limit management."""

    def __init__(self) -> None:
        self.operation_limit_repository = OperationLimitRepository()
        self.user_repository = UserRepository()

    # ------------------------------------------------------------------
    # Operation types
    # ------------------------------------------------------------------
    async def list_operation_types(
        self, db: AsyncSession
    ) -> Dict[str, object]:
        operation_types = await self.operation_limit_repository.async_list_operation_types(
            db
        )
        data = [
            {
                "id": op.id,
                "code": op.code,
                "description": op.description,
            }
            for op in operation_types
        ]
        return {"success": True, "data": data, "total": len(data)}

    # ------------------------------------------------------------------
    # User limit listings
    # ------------------------------------------------------------------
    async def list_user_operation_limits(
        self,
        db: AsyncSession,
        *,
        page: int,
        page_size: int,
        search: Optional[str],
        operation_code: Optional[str],
    ) -> Dict[str, object]:
        offset = (page - 1) * page_size
        results, total = await self.operation_limit_repository.async_list_user_limits(
            db,
            search=search,
            operation_code=operation_code,
            offset=offset,
            limit=page_size,
        )

        data: List[Dict[str, object]] = [
            self._serialize_limit_bundle(bundle) for bundle in results
        ]

        total_pages = math.ceil(total / page_size) if page_size else 0

        pagination = {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        }

        return {"success": True, "data": data, "pagination": pagination}

    async def get_user_operation_limit(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
        operation_code: str,
    ) -> Dict[str, object]:
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        operation = await self._get_operation_type_by_code(db, operation_code)
        if not operation:
            return {
                "success": False,
                "error": f"Operation type '{operation_code}' not found",
            }

        limit = await self.operation_limit_repository.async_get_limit(
            db, user.id, operation.id
        )
        if not limit:
            return {
                "success": False,
                "error": "User operation limit not configured",
            }

        playlist_count = await self._count_user_playlists(db, user.id)
        data = self._serialize_limit(limit, operation, user, playlist_count)
        return {"success": True, "data": data}

    async def upsert_user_operation_limit(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
        operation_code: str,
        limit_value: int,
        window_seconds: Optional[int],
        created_by: Optional[int],
    ) -> Dict[str, object]:
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        operation = await self._get_operation_type_by_code(db, operation_code)
        if not operation:
            return {
                "success": False,
                "error": f"Operation type '{operation_code}' not found",
            }

        limit = await self.operation_limit_repository.async_upsert_limit(
            db,
            user_id=user.id,
            operation_id=operation.id,
            limit_value=limit_value,
            window_seconds=window_seconds,
            created_by=created_by,
        )

        playlist_count = await self._count_user_playlists(db, user.id)
        data = self._serialize_limit(limit, operation, user, playlist_count)
        return {"success": True, "data": data}

    async def delete_user_operation_limit(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
        operation_code: str,
    ) -> Dict[str, object]:
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        operation = await self._get_operation_type_by_code(db, operation_code)
        if not operation:
            return {
                "success": False,
                "error": f"Operation type '{operation_code}' not found",
            }

        deleted = await self.operation_limit_repository.async_delete_limit(
            db, user.id, operation.id
        )
        if not deleted:
            return {
                "success": False,
                "error": "User operation limit not found",
            }

        return {
            "success": True,
            "message": "User operation limit deleted successfully",
            "user_id": user.id,
            "operation_code": operation.code,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _resolve_user(
        self, db: AsyncSession, identifier: str
    ) -> Optional[User]:
        if not identifier:
            return None

        candidate = identifier.strip()
        if not candidate:
            return None

        if "@" in candidate:
            return await self.user_repository.async_get_by_email(db, candidate.lower())

        # Attempt UUID lookup (36 chars with hyphens)
        if len(candidate) == 36 and candidate.count("-") == 4:
            user = await self.user_repository.async_get_by_uuid(db, candidate)
            if user:
                return user

        # Try numeric ID
        if candidate.isdigit():
            user = await self.user_repository.async_get_by_id(db, int(candidate))
            if user:
                return user

        # Fallback to username search
        return await self.user_repository.async_get_by_username(db, candidate)

    async def _get_operation_type_by_code(
        self, db: AsyncSession, code: str
    ) -> Optional[OperationType]:
        if not code:
            return None
        return await self.operation_limit_repository.async_get_operation_type_by_code(
            db, code.strip()
        )

    async def _count_user_playlists(
        self, db: AsyncSession, user_id: int
    ) -> int:
        stmt = select(func.count(Playlist.id)).where(Playlist.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one() or 0

    def _serialize_limit_bundle(
        self, bundle: Dict[str, object]
    ) -> Dict[str, object]:
        limit: UserOperationLimit = bundle["limit"]
        operation: OperationType = bundle["operation"]
        user: User = bundle["user"]
        playlist_count = bundle.get("playlist_count")
        return self._serialize_limit(limit, operation, user, playlist_count)

    def _serialize_limit(
        self,
        limit: UserOperationLimit,
        operation: OperationType,
        user: User,
        playlist_count: Optional[int],
    ) -> Dict[str, object]:
        return {
            "user_id": user.id,
            "user_uuid": getattr(user, "uuid", None),
            "user_email": getattr(user, "email", None),
            "user_username": getattr(user, "username", None),
            "operation_id": operation.id,
            "operation_code": operation.code,
            "operation_description": operation.description,
            "limit_value": limit.limit_value,
            "window_seconds": limit.window_seconds,
            "playlist_count": playlist_count,
            "created_by": limit.created_by,
            "created_at": limit.created_at.isoformat()
            if getattr(limit, "created_at", None)
            else None,
            "updated_at": limit.updated_at.isoformat()
            if getattr(limit, "updated_at", None)
            else None,
        }

