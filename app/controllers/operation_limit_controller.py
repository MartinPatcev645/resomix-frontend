"""
Operation Limit Controller
==========================

Handles admin HTTP orchestration for managing operation types and user limits.
"""

from __future__ import annotations

import time
from typing import Dict, Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.logging_service import LoggingService
from app.services.operation_limit_service import OperationLimitService
from app.utils.response_utils import format_response


class OperationLimitController:
    """Controller for admin operation limit endpoints."""

    def __init__(self) -> None:
        self.operation_limit_service = OperationLimitService()
        self.logging_service = LoggingService()

    async def list_operation_types(
        self,
        db: AsyncSession,
        request: Request,
    ) -> JSONResponse:
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.operation_limit_service.list_operation_types(db)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "data": result.get("data", []),
                    "total": result.get("total", 0),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_OPERATION_LIMIT",
                    action="list_operation_types_success",
                    message="Operation types listed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata={"total": response["total"]},
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to retrieve operation types")
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_OPERATION_LIMIT",
                action="list_operation_types_failed",
                message=f"Operation types listing failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=duration_ms,
                metadata={"error": error_message},
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_OPERATION_LIMIT",
                action="list_operation_types_exception",
                message="Operation types listing raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while listing operation types",
                ),
            )

    async def list_user_operation_limits(
        self,
        db: AsyncSession,
        request: Request,
        filters: Dict[str, object],
    ) -> JSONResponse:
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.operation_limit_service.list_user_operation_limits(
                db,
                page=filters.get("page", 1),
                page_size=filters.get("page_size", 30),
                search=filters.get("search"),
                operation_code=filters.get("operation_code"),
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
                    category="ADMIN_OPERATION_LIMIT",
                    action="list_user_operation_limits_success",
                    message="User operation limits listed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata={"filters": filters, "total": response["pagination"].get("total")},
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to retrieve user operation limits")
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_OPERATION_LIMIT",
                action="list_user_operation_limits_failed",
                message=f"User operation limit listing failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=duration_ms,
                metadata={"filters": filters, "error": error_message},
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=error_message),
            )
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_OPERATION_LIMIT",
                action="list_user_operation_limits_exception",
                message="User operation limit listing raised exception",
                correlation_id=correlation_id,
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms=(time.time() - start_time) * 1000,
                error=exc,
                metadata={"filters": filters},
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while listing user operation limits",
                ),
            )

    async def get_user_operation_limit(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
        operation_code: str,
    ) -> JSONResponse:
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "user_identifier": user_identifier,
            "operation_code": operation_code,
        }
        try:
            result = await self.operation_limit_service.get_user_operation_limit(
                db,
                user_identifier=user_identifier,
                operation_code=operation_code,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_OPERATION_LIMIT",
                    action="get_user_operation_limit_success",
                    message="User operation limit retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "User operation limit not found")
            status_code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in error_message.lower()
                else status.HTTP_400_BAD_REQUEST
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_OPERATION_LIMIT",
                action="get_user_operation_limit_failed",
                message=f"User operation limit retrieval failed: {error_message}",
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
                category="ADMIN_OPERATION_LIMIT",
                action="get_user_operation_limit_exception",
                message="User operation limit retrieval raised exception",
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
                    error="An internal server error occurred while retrieving the user operation limit",
                ),
            )

    async def upsert_user_operation_limit(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
        operation_code: str,
        limit_value: int,
        window_seconds: Optional[int],
        created_by: Optional[int],
        force: bool = False,
    ) -> JSONResponse:
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "user_identifier": user_identifier,
            "operation_code": operation_code,
            "limit_value": limit_value,
            "window_seconds": window_seconds,
            "created_by": created_by,
        }
        try:
            result = await self.operation_limit_service.upsert_user_operation_limit(
                db,
                user_identifier=user_identifier,
                operation_code=operation_code,
                limit_value=limit_value,
                window_seconds=window_seconds,
                created_by=created_by,
                force=force,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = format_response(success=True, data=result.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_OPERATION_LIMIT",
                    action="upsert_user_operation_limit_success",
                    message="User operation limit saved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "Failed to save user operation limit")
            lowered_error = error_message.lower()
            if "already has a limit" in lowered_error:
                status_code = status.HTTP_409_CONFLICT
            elif "not found" in lowered_error:
                status_code = status.HTTP_404_NOT_FOUND
            else:
                status_code = status.HTTP_400_BAD_REQUEST
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_OPERATION_LIMIT",
                action="upsert_user_operation_limit_failed",
                message=f"User operation limit save failed: {error_message}",
                correlation_id=correlation_id,
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={**metadata, "error": error_message},
            )
            response_content = format_response(
                success=False,
                error=error_message,
            )
            return JSONResponse(status_code=status_code, content=response_content)
        except Exception as exc:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_OPERATION_LIMIT",
                action="upsert_user_operation_limit_exception",
                message="User operation limit save raised exception",
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
                    error="An internal server error occurred while saving the user operation limit",
                ),
            )

    async def delete_user_operation_limit(
        self,
        db: AsyncSession,
        request: Request,
        *,
        user_identifier: str,
        operation_code: str,
    ) -> JSONResponse:
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        metadata = {
            "user_identifier": user_identifier,
            "operation_code": operation_code,
        }
        try:
            result = await self.operation_limit_service.delete_user_operation_limit(
                db,
                user_identifier=user_identifier,
                operation_code=operation_code,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response = {
                    "success": True,
                    "message": result.get("message", "User operation limit deleted successfully"),
                }
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_OPERATION_LIMIT",
                    action="delete_user_operation_limit_success",
                    message="User operation limit deleted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status.HTTP_200_OK,
                    duration_ms=duration_ms,
                    response_size=len(str(response)),
                    metadata=metadata,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response)

            error_message = result.get("error", "User operation limit not found")
            status_code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in error_message.lower()
                else status.HTTP_400_BAD_REQUEST
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ADMIN_OPERATION_LIMIT",
                action="delete_user_operation_limit_failed",
                message=f"User operation limit deletion failed: {error_message}",
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
                category="ADMIN_OPERATION_LIMIT",
                action="delete_user_operation_limit_exception",
                message="User operation limit deletion raised exception",
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
                    error="An internal server error occurred while deleting the user operation limit",
                ),
            )


