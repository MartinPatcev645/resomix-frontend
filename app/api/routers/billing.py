"""
Consumer Billing Router
=======================

Consumer subscription endpoints (Stripe hosted Checkout + Customer Portal). Subscription state is
written back by the Stripe webhooks; these endpoints only *start* the hosted flows + list plans.
See docs/CONSUMER_BILLING_PLAN.md.
"""

import logging

import stripe
from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user, get_current_user_optional
from app.api.middlewares.rate_limit import limiter
from app.models.user import User
from app.services.billing_service import BillingService
from app.services.entitlement_service import EntitlementService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])
billing_service = BillingService()
entitlement_service = EntitlementService()


class CheckoutRequest(BaseModel):
    plan_code: str = Field(..., description="Plan code to subscribe to, e.g. 'pro'")
    # EU 14-day withdrawal waiver (§5.5). Defaults to False so a caller that does not send it is
    # refused rather than silently consented on the user's behalf — which is the entire point.
    consent: bool = Field(
        False,
        description=(
            "The buyer agrees their subscription starts immediately, waiving the 14-day right of "
            "withdrawal for the part already delivered. Required — no consent, no session."
        ),
    )


def _client_ip(request: Request) -> str | None:
    """Originating IP for the consent record, honouring the proxy chain.

    Recorded because a consent nobody can locate in time and place is not much of a record — this
    is the same reasoning as storing the document versions alongside it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else None)


def _country(request: Request) -> str | None:
    # Cloudflare sets CF-IPCountry; fall back to an explicit header if a different proxy is used.
    return request.headers.get("cf-ipcountry") or request.headers.get("x-country")


async def _hosted_flow(coro) -> JSONResponse:
    """Run a Stripe-session creation, mapping errors to clean responses."""
    try:
        url = await coro
        return JSONResponse(status_code=200, content=format_response(success=True, data={"url": url}))
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content=format_response(success=False, error=e.detail))
    except stripe.error.StripeError as e:  # payment provider issue
        logger.error("Stripe error in billing flow: %s", e)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=format_response(success=False, error="Payment provider error. Please try again."),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected billing error: %s", e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="Something went wrong. Please try again."),
        )


@router.post("/checkout", summary="Start a subscription checkout")
@limiter.limit("20/minute")
async def checkout(
    request: Request,
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe hosted Checkout session for a plan and return its URL (frontend redirects).

    Refuses without `consent` — the withdrawal waiver is recorded server-side before Stripe is
    called, so a session cannot exist without an audit row behind it.
    """
    return await _hosted_flow(
        billing_service.create_checkout_session(
            db,
            current_user,
            body.plan_code,
            _country(request),
            consent=body.consent,
            client_ip=_client_ip(request),
        )
    )


@router.post("/portal", summary="Open the Stripe Customer Portal")
@limiter.limit("20/minute")
async def portal(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session (manage/upgrade/downgrade/cancel/card/invoices)."""
    return await _hosted_flow(billing_service.create_portal_session(db, current_user))


@router.get("/plans", summary="List consumer plans for display")
async def plans(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Assignable plans with resolved-currency price + purchasable/coming-soon flags, and (if logged
    in) which one is the viewer's current plan. Works for anonymous visitors too (pricing page)."""
    current_code = None
    if current_user is not None:
        plan = await entitlement_service.get_effective_plan(db, current_user)
        current_code = plan.code if plan else None
    data = await billing_service.get_plans_for_display(db, _country(request), current_code)
    return JSONResponse(status_code=200, content=format_response(success=True, data=data))


@router.get("/subscription", summary="Current plan, subscription status + this period's usage")
@limiter.limit("60/minute")
async def subscription(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    data = await billing_service.get_subscription_summary(db, current_user)
    return JSONResponse(status_code=200, content=format_response(success=True, data=data))


@router.get("/invoices", summary="Billing history (Stripe invoices)")
@limiter.limit("60/minute")
async def invoices(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    data = await billing_service.list_invoices(db, current_user)
    return JSONResponse(status_code=200, content=format_response(success=True, data={"invoices": data}))


@router.get("/usage", summary="Usage history per billing period")
@limiter.limit("60/minute")
async def usage(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    data = await billing_service.get_usage_history(db, current_user)
    return JSONResponse(status_code=200, content=format_response(success=True, data={"history": data}))
