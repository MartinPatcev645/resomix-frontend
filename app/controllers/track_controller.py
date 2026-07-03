"""
Track Controller
================

This controller handles HTTP requests for the user library: listing the authenticated
user's own uploaded tracks (paginated), viewing full metadata for a single track, and
deleting (soft delete) a track.

It is a thin HTTP layer — validation, logging, and response formatting only. All
business logic lives in ``TrackService``; ownership and tenant scoping are enforced in
the service/repository using the authenticated user and the request's partner context.

Version: 3.0.1
Init Date: July 3, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import time

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.logging_service import LoggingService
from app.services.track_service import TrackService
from app.utils.response_utils import format_response


class TrackController:
    """Controller for a user's own uploaded tracks (library page)."""

    def __init__(self):
        self.track_service = TrackService()
        self.logging_service = LoggingService()

    async def get_user_tracks(
        self,
        db: AsyncSession,
        request: Request,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
    ) -> JSONResponse:
        """List the authenticated user's own uploaded tracks (paginated)."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        partner_id = getattr(request.state, "partner_id", None)

        result = await self.track_service.get_user_tracks(
            db, current_user.id, page, page_size, partner_id=partner_id
        )
        duration_ms = (time.time() - start_time) * 1000

        if not result.get("success"):
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_user_tracks_failed",
                message="Failed to retrieve user tracks",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                metadata={
                    "user_id": current_user.id,
                    "error": result.get("error"),
                    "operation": "get_user_tracks",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=result.get("error")),
            )

        total = result.get("total", 0)
        total_pages = (total + page_size - 1) // page_size if page_size else 0

        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="USER_ACTION",
            action="get_user_tracks_success",
            message=f"User retrieved uploaded tracks: {len(result.get('data', []))} of {total}",
            correlation_id=correlation_id,
            request=request,
            status_code=200,
            duration_ms=duration_ms,
            metadata={
                "user_uuid": current_user.uuid,
                "user_id": current_user.id,
                "returned": len(result.get("data", [])),
                "total": total,
                "page": page,
                "page_size": page_size,
                "operation": "get_user_tracks",
            },
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data=result.get("data", []),
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
            ),
        )

    async def get_user_track(
        self,
        db: AsyncSession,
        request: Request,
        current_user: User,
        track_uuid: str,
    ) -> JSONResponse:
        """Get full metadata for one of the authenticated user's own uploaded tracks."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        partner_id = getattr(request.state, "partner_id", None)

        result = await self.track_service.get_user_track_detail(
            db, track_uuid, current_user.id, partner_id=partner_id
        )
        duration_ms = (time.time() - start_time) * 1000

        if result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=result.get("data")),
            )

        # Not found (or not owned) — do not distinguish, to avoid leaking existence.
        if result.get("not_found"):
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="get_user_track_not_found",
                message="User track not found or not owned",
                correlation_id=correlation_id,
                request=request,
                status_code=404,
                duration_ms=duration_ms,
                metadata={
                    "user_id": current_user.id,
                    "track_uuid": track_uuid,
                    "operation": "get_user_track",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Track not found"),
            )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error=result.get("error")),
        )

    async def delete_user_track(
        self,
        db: AsyncSession,
        request: Request,
        current_user: User,
        track_uuid: str,
    ) -> JSONResponse:
        """Soft-delete one of the authenticated user's own uploaded tracks."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        partner_id = getattr(request.state, "partner_id", None)

        result = await self.track_service.delete_user_track(
            db, track_uuid, current_user.id, partner_id=partner_id
        )
        duration_ms = (time.time() - start_time) * 1000

        if result.get("success"):
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="USER_ACTION",
                action="delete_user_track_success",
                message="User soft-deleted an uploaded track",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                metadata={
                    "user_uuid": current_user.uuid,
                    "user_id": current_user.id,
                    "track_uuid": track_uuid,
                    "operation": "delete_user_track",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=result.get("data"),
                    message=result.get("message"),
                ),
            )

        if result.get("not_found"):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Track not found"),
            )

        self.logging_service.log(
            async_db=db,
            level="ERROR",
            category="ERROR",
            action="delete_user_track_failed",
            message="Failed to delete user track",
            correlation_id=correlation_id,
            request=request,
            status_code=500,
            duration_ms=duration_ms,
            metadata={
                "user_id": current_user.id,
                "track_uuid": track_uuid,
                "error": result.get("error"),
                "operation": "delete_user_track",
            },
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error=result.get("error")),
        )
