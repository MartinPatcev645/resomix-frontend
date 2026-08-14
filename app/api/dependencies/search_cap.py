"""
Search result cap — resolved without slowing the anonymous path
===============================================================

`/search` is the hottest endpoint on the frontend and it runs for every keystroke's debounce. The
plan for this item was to add `get_current_user_optional` and resolve entitlements on every
request; that would put a token decode, a user read and a plan resolution in front of every search
a guest ever runs, to answer a question that has the same answer for all of them.

So the cap is resolved the other way round, and the shape is deliberate:

* **No ``Authorization`` header → the default, with literally no work.** No decode, no query, no
  session use. This is the path guests and free users take, and it is byte-for-byte the behaviour
  they have today apart from the number.
* **A bearer token → resolve it.** Only paying users' clients send one (the frontend attaches it
  only when the plan warrants), so only they pay for the lookup.
* **Never raises.** `get_current_user_optional` returns 401 for a token that is present but expired
  or invalid — correct for an endpoint that needs identity, wrong for this one. A Pro user whose
  token went stale mid-session should get the default number of results, not a broken search box.
  Every failure here degrades to "no opinion".

The value itself is an entitlement (``search_results_max``), not a hard-coded branch on plan code.
Which plans get the larger number is then a data question the admin can change, rather than
something spelled `if plan == "pro"` in a dependency.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import oauth2_scheme
from app.api.dependencies.database import get_database_session
from app.core.entitlement_keys import FeatureKey

logger = logging.getLogger(__name__)


async def resolve_authenticated_search_limit(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_database_session),
) -> Optional[int]:
    """The caller's ``search_results_max``, or ``None`` when there is no bearer to resolve.

    ``None`` means "this request expressed no opinion" — the caller decides what the default is.
    It is not the same as zero, and it is not an error.
    """
    # The fast path, and the one almost every request takes. Deliberately before any import or
    # query: a guest's search must not touch the database to learn something that never varies.
    if not token:
        return None

    # A B2B partner key is not a user JWT. It is handled by the partner dependency, and decoding it
    # here would just be a guaranteed failure.
    if token.startswith("rmx_"):
        return None

    try:
        from sqlalchemy import select

        from app.core.security import decode_token
        from app.models.user import User
        from app.services.entitlement_gate import EntitlementGate

        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub") or payload.get("user_id")
        if user_id is None:
            return None

        user = (await db.execute(select(User).where(User.id == int(user_id)))).scalar_one_or_none()
        # A deactivated or scrubbed account resolves to the default rather than to an error. The
        # plan flagged this exact case as a risk of the `get_current_user_optional` approach — a
        # stale token turning search into a 403 on a public endpoint. Here it cannot.
        if user is None or not getattr(user, "is_active", True):
            return None

        return await EntitlementGate().get_cap(db, FeatureKey.SEARCH_RESULTS_MAX, user=user)
    except Exception as exc:  # noqa: BLE001 — a cap lookup must never break search
        logger.debug("SEARCH CAP: could not resolve from token, falling back to default: %s", exc)
        return None
