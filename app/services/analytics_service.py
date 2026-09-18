"""
Analytics Service (PostHog, server-side capture)
================================================

For the handful of facts a browser cannot be trusted to report. ``subscription_started`` is the
first of them: a subscription becomes real when STRIPE confirms the money moved, which reaches us
in a webhook long after the customer has closed the tab, so no browser event can honestly claim it.

IDENTITY IS THE POINT OF THIS FILE
----------------------------------
The frontend never calls PostHog directly. It pushes ``user.uuid`` onto the GTM dataLayer and the
container's tag calls ``posthog.identify()`` with it, so a server event carrying that SAME uuid as
``distinct_id`` lands on the person who has been browsing all along. Send anything else — an email,
a numeric id, a Stripe customer id — and PostHog creates a second, empty person and the funnel
breaks exactly where the money is.

FAILURE POLICY
--------------
Nothing here raises, and every call is short. This runs inside the Stripe webhook, where an
exception means a 500, which means Stripe replays an event we have already applied. Analytics must
never be able to do that. An unset ``POSTHOG_API_KEY`` disables capture entirely, which is how
local and staging run until someone opts them in.

Version: 1.0.0
Init Date: September 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Deliberately short. The webhook has already committed and emailed by the time we get here, and
# Stripe is waiting on the response; a slow analytics host must cost us seconds, not the request.
_TIMEOUT_SECONDS = 3.0


class AnalyticsService:
    """Fire-and-forget PostHog capture. Best-effort by design."""

    def __init__(self) -> None:
        self.api_key: Optional[str] = settings.posthog_api_key
        self.host: str = (settings.posthog_host or "").rstrip("/")

    @property
    def is_configured(self) -> bool:
        """True once a project key is present. False makes every capture a silent no-op."""
        return bool(self.api_key and self.host)

    async def capture(
        self,
        *,
        distinct_id: Optional[str],
        event: str,
        properties: Optional[Dict[str, Any]] = None,
        set_properties: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Send one event. Returns True only when PostHog accepted it.

        ``set_properties`` become ``$set`` on the person, which is how a server event can update
        who someone IS (their plan) as well as record what happened.
        """
        if not self.is_configured:
            logger.debug("PostHog not configured — skipping %s", event)
            return False
        if not distinct_id:
            # An event with no identity would land on a random anonymous person, which is worse
            # than no event: it inflates the counts and attaches revenue to nobody.
            logger.warning("PostHog: refusing to capture %s without a distinct_id", event)
            return False

        props: Dict[str, Any] = dict(properties or {})
        # Staging and production can point at the same PostHog project without staging's test
        # purchases quietly inflating real revenue — every server event says which box sent it,
        # so an insight can exclude anything that is not production.
        props.setdefault("environment", settings.resomix_env)
        if set_properties:
            props["$set"] = set_properties

        payload = {
            "api_key": self.api_key,
            "event": event,
            "distinct_id": distinct_id,
            "properties": props,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(f"{self.host}/capture/", json=payload)
            if response.status_code >= 300:
                logger.error(
                    "PostHog rejected %s for %s: HTTP %s %s",
                    event, distinct_id, response.status_code, response.text[:200],
                )
                return False
            logger.info("PostHog captured %s for %s", event, distinct_id)
            return True
        except Exception as exc:  # noqa: BLE001 — see the module docstring
            logger.error("PostHog capture failed for %s (%s): %s", event, distinct_id, exc)
            return False

    async def subscription_started(
        self,
        *,
        user_uuid: Optional[str],
        plan_name: Optional[str],
        amount_cents: Optional[int] = None,
        currency: Optional[str] = None,
        interval: Optional[str] = None,
        subscription_id: Optional[str] = None,
        is_founding: bool = False,
    ) -> bool:
        """The paid conversion, from the moment Stripe's confirmation is written to our database.

        The amount is the price the customer ACTUALLY bought at, not the plan's list price, so a
        founding subscriber is reported at their locked rate. ``amount`` is in major units because
        that is what revenue reporting expects; ``amount_cents`` is kept alongside it so nobody has
        to trust a float for reconciliation.
        """
        properties: Dict[str, Any] = {
            "plan": plan_name,
            "interval": interval,
            "currency": currency,
            "amount": round(amount_cents / 100, 2) if amount_cents is not None else None,
            "amount_cents": amount_cents,
            "is_founding": is_founding,
            "subscription_id": subscription_id,
            # Says where the event came from, so a browser-side duplicate would be obvious rather
            # than silently double-counting a sale.
            "source": "backend",
        }
        return await self.capture(
            distinct_id=user_uuid,
            event="subscription_started",
            properties={k: v for k, v in properties.items() if v is not None},
            # Mirrors `user_status` on the frontend's signup event, so one property answers "free
            # or paying?" for every person in the project.
            set_properties={"user_status": "paid", "plan": plan_name} if plan_name else {"user_status": "paid"},
        )


# Module-level singleton, same pattern as the other service clients.
analytics_service = AnalyticsService()
