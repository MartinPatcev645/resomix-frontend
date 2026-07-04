"""
Guest Context Dependency
========================

Resolves, per request, whether the caller is a logged-in user or an anonymous **guest**, and
for guests derives a server-authoritative ``visitor_id`` and (re)issues the signed guest
cookie. Used by the frontend enforcement paths (Phase 4/5).

  * Logged-in user  → ``GuestContext(is_guest=False, user=<User>, visitor_id=None)``.
  * Anonymous       → ``GuestContext(is_guest=True, user=None, visitor_id=<hash>)`` + cookie set.

B2B partner requests are unaffected — this only classifies the frontend consumer surface.
"""

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Request, Response

from app.api.dependencies.auth import get_current_user_optional
from app.core.config import settings
from app.models.user import User
from app.services.guest_identity_service import GuestIdentityService

_guest_identity = GuestIdentityService()


@dataclass
class GuestContext:
    is_guest: bool
    visitor_id: Optional[str]
    user: Optional[User]


async def get_guest_context(
    request: Request,
    response: Response,
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> GuestContext:
    # Logged-in users are never guests.
    if current_user is not None:
        return GuestContext(is_guest=False, visitor_id=None, user=current_user)

    # Anonymous: ensure a signed guest cookie exists, then derive the visitor_id.
    cookie_val = request.cookies.get(settings.guest_cookie_name)
    guest_id = _guest_identity.verify_guest_cookie(cookie_val)
    if not guest_id:
        guest_id, token = _guest_identity.new_guest_cookie()
        response.set_cookie(
            key=settings.guest_cookie_name,
            value=token,
            max_age=settings.guest_cookie_max_age_days * 86400,
            httponly=True,
            samesite="lax",
            secure=(settings.resomix_env == "production"),
            path="/",
        )

    visitor_id = _guest_identity.derive_visitor_id(request, cookie_gid=guest_id)
    return GuestContext(is_guest=True, visitor_id=visitor_id, user=None)
