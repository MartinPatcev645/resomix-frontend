"""
Entitlement Controller (consumer-facing)
========================================

Serves the caller's *own* effective entitlements so the frontend can drive its UI from a single
call — grey dropdown options beyond ``dropdown_max_tracks``, show/hide export/rename/rate, and
render the right login/upgrade CTA. Works for both guests (visitor_id derived server-side) and
logged-in users (JWT). The server-derived ``visitor_id`` is never returned to the client.

Frontend surface only (System Partner 1). B2B partners have their own quota system and get an
``is_frontend: false`` marker with no consumer entitlements.
"""

import logging
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.services.entitlement_service import EntitlementService
from app.services.guest_identity_service import GuestIdentityService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class EntitlementController:
    def __init__(self) -> None:
        self.entitlements = EntitlementService()
        self.guest_identity = GuestIdentityService()

    async def get_my_entitlements(
        self, db: AsyncSession, request: Request,
        current_user: Optional[User], partner_id: Optional[int],
    ) -> JSONResponse:
        is_frontend = partner_id == settings.system_partner_id
        if not is_frontend:
            # B2B: entitlements don't apply here.
            return JSONResponse(
                status_code=200,
                content=format_response(success=True, data={
                    "is_frontend": False, "is_guest": current_user is None,
                    "plan": None, "entitlements": {},
                }),
            )

        visitor_id = None
        if current_user is None:
            visitor_id = self.guest_identity.derive_visitor_id(request)

        plan, entitlements = await self.entitlements.get_effective_map(
            db, user=current_user, visitor_id=visitor_id
        )
        return JSONResponse(
            status_code=200,
            content=format_response(success=True, data={
                "is_frontend": True,
                "is_guest": current_user is None,
                "plan": {"code": plan.code, "name": plan.name, "is_default": plan.is_default},
                "entitlements": entitlements,
            }),
        )
