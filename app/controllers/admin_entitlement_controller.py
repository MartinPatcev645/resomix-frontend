"""
Admin Entitlement Controller
============================

HTTP orchestration for the Phase-7 admin plan/entitlement editor. Thin: validates + delegates
to ``AdminEntitlementService`` and maps domain errors to HTTP responses
(``KeyError`` → 404, ``ValueError`` → 400) using the standard ``format_response`` envelope.
"""

import logging
from typing import Optional, Union

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.admin_entitlement_service import AdminEntitlementService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class AdminEntitlementController:
    def __init__(self) -> None:
        self.service = AdminEntitlementService()
        self.user_repo = UserRepository()

    @staticmethod
    def _actor_id(current_admin: User) -> Optional[int]:
        # The static super-key resolves to a fabricated system admin (id=0) when no real admin
        # row exists — store NULL rather than a dangling FK in that case.
        return current_admin.id or None

    async def list_plans(self, db: AsyncSession) -> JSONResponse:
        data = await self.service.list_plans(db)
        return JSONResponse(status_code=200, content=format_response(success=True, data={"plans": data}))

    async def list_features(self, db: AsyncSession) -> JSONResponse:
        data = await self.service.list_features(db)
        return JSONResponse(status_code=200, content=format_response(success=True, data={"features": data}))

    async def get_plan(self, db: AsyncSession, code: str) -> JSONResponse:
        plan = await self.service.get_plan(db, code)
        if plan is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error=f"Plan '{code}' not found."),
            )
        return JSONResponse(status_code=200, content=format_response(success=True, data=plan))

    async def set_entitlement(
        self, db: AsyncSession, code: str, feature_key: str,
        value: Union[bool, int, str], current_admin: User,
    ) -> JSONResponse:
        try:
            result = await self.service.set_plan_entitlement(
                db, code=code, feature_key=feature_key, value=value,
                updated_by=self._actor_id(current_admin),
            )
        except KeyError as e:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error=str(e).strip("\"'")),
            )
        except ValueError as e:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=format_response(success=False, error=str(e)),
            )
        logger.info("Entitlement updated: plan=%s feature=%s by=%s", code, feature_key, current_admin.id)
        return JSONResponse(status_code=200, content=format_response(success=True, data=result))

    async def update_plan(
        self, db: AsyncSession, code: str, *,
        name: Optional[str], is_active: Optional[bool], is_default: Optional[bool],
        current_admin: User,
    ) -> JSONResponse:
        try:
            result = await self.service.update_plan(
                db, code=code, name=name, is_active=is_active, is_default=is_default,
                updated_by=self._actor_id(current_admin),
            )
        except KeyError as e:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error=str(e).strip("\"'")),
            )
        logger.info("Plan updated: code=%s by=%s", code, current_admin.id)
        return JSONResponse(status_code=200, content=format_response(success=True, data=result))

    async def get_metrics(self) -> JSONResponse:
        """In-process entitlement observability counters (gate allow/deny, fail-open, cache hit/miss)."""
        from app.services import entitlement_metrics
        return JSONResponse(
            status_code=200,
            content=format_response(success=True, data={"metrics": entitlement_metrics.snapshot()}),
        )

    async def get_user_effective(self, db: AsyncSession, user_uuid: str) -> JSONResponse:
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)
        if user is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="User not found."),
            )
        data = await self.service.get_user_effective(db, user)
        return JSONResponse(status_code=200, content=format_response(success=True, data=data))
