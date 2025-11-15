"""
Spotify App Controller
======================

Handles admin HTTP orchestration for managing Spotify apps and user associations.
"""

from __future__ import annotations

import time
from typing import Dict, Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.logging_service import LoggingService
from app.services.spotify_app_service import SpotifyAppService
from app.utils.response_utils import format_response


class SpotifyAppController:
    """Controller for admin Spotify app endpoints."""

    def __init__(self) -> None:
        self.spotify_app_service = SpotifyAppService()
        self.logging_service = LoggingService()

    # ------------------------------------------------------------------
    # Spotify App CRUD Operations
    # ------------------------------------------------------------------

    async def list_spotify_apps(
        self,
        db: AsyncSession,
        request: Request,
        *,
        page: int = 1,
        page_size: int = 100,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> JSONResponse:
        """List Spotify apps with optional filters."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "page": page,
            "page_size": page_size,
            "is_active": is_active,
            "search": search,
        }
        try:
            result = await self.spotify_app_service.list_spotify_apps(
                db,
                page=page,
                page_size=page_size,
                is_active=is_active,
                search=search,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "data": result.get("data", []),
                    "pagination": result.get("pagination", {}),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="list_spotify_apps_success",
                    message="Spotify apps listed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata={**metadata, "total": response["pagination"].get("total")},
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to retrieve Spotify apps")
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="list_spotify_apps_failed",
                message=f"Spotify apps listing failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="list_spotify_apps_exception",
                message="Spotify apps listing raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while listing Spotify apps",
                ),
            )

    async def get_spotify_app(
        self,
        db: AsyncSession,
        request: Request,
        *,
        app_id: int,
        include_secret: bool = False,
    ) -> JSONResponse:
        """Get single Spotify app by ID."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {"app_id": app_id, "include_secret": include_secret}
        try:
            result = await self.spotify_app_service.get_spotify_app(
                db, app_id=app_id, include_secret=include_secret
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                # Redact client_secret from logs if present
                log_metadata = metadata.copy()
                if include_secret and result.get("data", {}).get("client_secret"):
                    log_metadata["client_secret"] = "[REDACTED]"
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="get_spotify_app_success",
                    message="Spotify app retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=log_metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Spotify app not found")
            status_code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in error_message.lower()
                else status.HTTP_400_BAD_REQUEST
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="get_spotify_app_failed",
                message=f"Spotify app retrieval failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="get_spotify_app_exception",
                message="Spotify app retrieval raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving the Spotify app",
                ),
            )

    async def create_spotify_app(
        self,
        db: AsyncSession,
        request: Request,
        *,
        name: str,
        description: Optional[str],
        client_id: str,
        client_secret: str,
        is_active: bool = True,
    ) -> JSONResponse:
        """Create a new Spotify app."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "name": name,
            "description": description,
            "client_id": client_id,
            "client_secret": "[REDACTED]",  # Never log actual secret
            "is_active": is_active,
        }
        try:
            result = await self.spotify_app_service.create_spotify_app(
                db,
                name=name,
                description=description,
                client_id=client_id,
                client_secret=client_secret,
                is_active=is_active,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="create_spotify_app_success",
                    message="Spotify app created successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_201_CREATED,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata={**metadata, "app_id": result.get("data", {}).get("id")},
                )
                return JSONResponse(
                    status_code=status.HTTP_201_CREATED, content=response
                )

            error_message = result.get("error", "Failed to create Spotify app")
            lowered_error = error_message.lower()
            if "already exists" in lowered_error:
                status_code = status.HTTP_409_CONFLICT
            else:
                status_code = status.HTTP_400_BAD_REQUEST
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="create_spotify_app_failed",
                message=f"Spotify app creation failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="create_spotify_app_exception",
                message="Spotify app creation raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while creating the Spotify app",
                ),
            )

    async def update_spotify_app(
        self,
        db: AsyncSession,
        request: Request,
        *,
        app_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> JSONResponse:
        """Update a Spotify app."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "app_id": app_id,
            "name": name,
            "description": description,
            "client_id": client_id,
            "client_secret": "[REDACTED]" if client_secret else None,
            "is_active": is_active,
        }
        try:
            result = await self.spotify_app_service.update_spotify_app(
                db,
                app_id=app_id,
                name=name,
                description=description,
                client_id=client_id,
                client_secret=client_secret,
                is_active=is_active,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="update_spotify_app_success",
                    message="Spotify app updated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to update Spotify app")
            lowered_error = error_message.lower()
            if "not found" in lowered_error:
                status_code = status.HTTP_404_NOT_FOUND
            elif "already exists" in lowered_error:
                status_code = status.HTTP_409_CONFLICT
            else:
                status_code = status.HTTP_400_BAD_REQUEST
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="update_spotify_app_failed",
                message=f"Spotify app update failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="update_spotify_app_exception",
                message="Spotify app update raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while updating the Spotify app",
                ),
            )

    async def delete_spotify_app(
        self,
        db: AsyncSession,
        request: Request,
        *,
        app_id: int,
        cascade: bool = False,
    ) -> JSONResponse:
        """Delete a Spotify app."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {"app_id": app_id, "cascade": cascade}
        try:
            result = await self.spotify_app_service.delete_spotify_app(
                db, app_id=app_id, cascade=cascade
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "message": result.get("message", "Spotify app deleted successfully"),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="delete_spotify_app_success",
                    message="Spotify app deleted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to delete Spotify app")
            lowered_error = error_message.lower()
            if "not found" in lowered_error:
                status_code = status.HTTP_404_NOT_FOUND
            elif "cannot delete" in lowered_error or "associated" in lowered_error:
                status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            else:
                status_code = status.HTTP_400_BAD_REQUEST
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="delete_spotify_app_failed",
                message=f"Spotify app deletion failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="delete_spotify_app_exception",
                message="Spotify app deletion raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while deleting the Spotify app",
                ),
            )

    # ------------------------------------------------------------------
    # User Association Operations
    # ------------------------------------------------------------------

    async def list_user_associations(
        self,
        db: AsyncSession,
        request: Request,
        *,
        page: int = 1,
        page_size: int = 30,
        search: Optional[str] = None,
        spotify_app_id: Optional[int] = None,
    ) -> JSONResponse:
        """List user-Spotify app associations with filters."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "page": page,
            "page_size": page_size,
            "search": search,
            "spotify_app_id": spotify_app_id,
        }
        try:
            result = await self.spotify_app_service.list_user_associations(
                db,
                page=page,
                page_size=page_size,
                search=search,
                spotify_app_id=spotify_app_id,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "data": result.get("data", []),
                    "pagination": result.get("pagination", {}),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="list_user_associations_success",
                    message="User associations listed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata={**metadata, "total": response["pagination"].get("total")},
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to retrieve user associations")
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="list_user_associations_failed",
                message=f"User associations listing failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="list_user_associations_exception",
                message="User associations listing raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while listing user associations",
                ),
            )

    async def get_user_association(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
    ) -> JSONResponse:
        """Get user association by user identifier."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {"user_identifier": user_identifier}
        try:
            result = await self.spotify_app_service.get_user_association(
                db, user_identifier=user_identifier
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="get_user_association_success",
                    message="User association retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "User association not found")
            status_code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in error_message.lower()
                or "not associated" in error_message.lower()
                else status.HTTP_400_BAD_REQUEST
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="get_user_association_failed",
                message=f"User association retrieval failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="get_user_association_exception",
                message="User association retrieval raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving the user association",
                ),
            )

    async def upsert_user_association(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
        spotify_app_id: int,
        created_by: Optional[int] = None,
    ) -> JSONResponse:
        """Create or update user-Spotify app association."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "user_identifier": user_identifier,
            "spotify_app_id": spotify_app_id,
            "created_by": created_by,
        }
        try:
            result = await self.spotify_app_service.upsert_user_association(
                db,
                user_identifier=user_identifier,
                spotify_app_id=spotify_app_id,
                created_by=created_by,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="upsert_user_association_success",
                    message="User association saved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to save user association")
            lowered_error = error_message.lower()
            if "not found" in lowered_error:
                status_code = status.HTTP_404_NOT_FOUND
            elif "inactive" in lowered_error or "maximum limit" in lowered_error or "reached" in lowered_error:
                status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            else:
                status_code = status.HTTP_400_BAD_REQUEST
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="upsert_user_association_failed",
                message=f"User association save failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="upsert_user_association_exception",
                message="User association save raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while saving the user association",
                ),
            )

    async def delete_user_association(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
    ) -> JSONResponse:
        """Delete user-Spotify app association."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {"user_identifier": user_identifier}
        try:
            result = await self.spotify_app_service.delete_user_association(
                db, user_identifier=user_identifier
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "message": result.get("message", "User association deleted successfully"),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_SPOTIFY_APP",
                    action="delete_user_association_success",
                    message="User association deleted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "User association not found")
            status_code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in error_message.lower()
                or "not associated" in error_message.lower()
                else status.HTTP_400_BAD_REQUEST
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_SPOTIFY_APP",
                action="delete_user_association_failed",
                message=f"User association deletion failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="delete_user_association_exception",
                message="User association deletion raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while deleting the user association",
                ),
            )

    async def get_user_spotify_app_client_id(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
    ) -> JSONResponse:
        """Get user's associated Spotify app client_id for OAuth flow."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {"user_identifier": user_identifier}
        try:
            result = await self.spotify_app_service.get_user_spotify_app_client_id(
                db, user_identifier=user_identifier
            )
            duration_ms = (time.time() - start_time) * 1000

            # This endpoint returns success even if no association (for frontend to handle)
            response = {
                "success": result.get("success", False),
                "client_id": result.get("client_id"),
                "app_name": result.get("app_name"),
                "message": result.get("message"),
            }
            action = (
                "get_user_spotify_app_client_id_success"
                if result.get("success")
                else "get_user_spotify_app_client_id_not_found"
            )
            status_code = (
                status.HTTP_200_OK if result.get("success") else status.HTTP_404_NOT_FOUND
            )
            self.logging_service.log(
                async_db=db,
                level="INFO" if result.get("success") else "WARNING",
                category="ADMIN_SPOTIFY_APP",
                action=action,
                message=result.get("message", "Client ID retrieved"),
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                response_size=len(str(response)),
                metadata=metadata,
            )
            return JSONResponse(status_code=status_code, content=response)
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_SPOTIFY_APP",
                action="get_user_spotify_app_client_id_exception",
                message="Client ID retrieval raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata=metadata,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving the client ID",
                ),
            )

