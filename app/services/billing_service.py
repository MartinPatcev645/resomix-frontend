"""
Consumer Billing Service
========================

Consumer subscription billing via **Stripe hosted Checkout + Customer Portal** (separate from the
B2B partner Stripe flow). Prices are data (``plan_prices``), not code. See
docs/CONSUMER_BILLING_PLAN.md.

This service owns the *initiation* side (Checkout session, Portal session, plan display + the
price→plan map). Stripe state is written back by the webhook handlers (billing_sync_service).
"""

import calendar
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import (
    ACTIVE_SUBSCRIPTION_STATUSES,
    FOUNDING_LOCK_ITERATIONS,
    FeatureKey,
    PlanCode,
    PriceKind,
)
from app.models.billing import BillingConsent, BillingInvoice, UsagePeriodHistory
from app.models.plan import Plan, PlanPrice
from app.models.purchase import UserSubscription
from app.models.user import User
from app.services.entitlement_service import EntitlementService
from app.services.entitlement_gate import EntitlementGate

logger = logging.getLogger(__name__)

# Plans the public pricing page may advertise. GUEST is excluded because it is not something a
# visitor can buy or be assigned by choice — it is the logged-out state.
PUBLIC_PLAN_CODES = (PlanCode.FREE, PlanCode.BASIC, PlanCode.PRO, PlanCode.MAX)

# Counted features surfaced in the "Plan & Billing" usage meters — the same set the workspace
# usage chip shows, so the two never disagree about what someone has spent.
_USAGE_FEATURES = (
    FeatureKey.SEARCH_PLAYLISTS_PER_MONTH,
    FeatureKey.UPLOADS_PER_MONTH,
    FeatureKey.EXPORTS_PER_DAY,
)

# Countries billed in USD (everything else → EUR). Extend as needed; USD prices must exist in
# plan_prices for these to actually resolve to USD (otherwise we fall back to EUR).
USD_COUNTRIES = {"US"}

# The consent required before a Checkout session (§5.5): the buyer agrees their subscription starts
# immediately, which waives the EU 14-day right of withdrawal for the part already delivered.
CONSENT_WITHDRAWAL_WAIVER = "withdrawal_waiver"


class BillingService:
    """Consumer subscription checkout + portal + plan display."""

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_secret_key
        self.entitlements = EntitlementService()
        self.gate = EntitlementGate()

    # ------------------------------------------------------------------ #
    # currency
    # ------------------------------------------------------------------ #
    def resolve_currency(self, country_code: Optional[str]) -> str:
        """Resolve the buyer's billing currency from their country (default EUR; US → USD)."""
        cc = (country_code or "").strip().upper()
        return "USD" if cc in USD_COUNTRIES else "EUR"

    # ------------------------------------------------------------------ #
    # lookups
    # ------------------------------------------------------------------ #
    async def _plan_by_code(self, db: AsyncSession, code: str) -> Optional[Plan]:
        return (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()

    async def _active_price(
        self,
        db: AsyncSession,
        plan_id: int,
        currency: str,
        interval: str = "month",
        price_kind: str = PriceKind.LIST,
    ) -> Optional[PlanPrice]:
        return (
            await db.execute(
                select(PlanPrice).where(
                    PlanPrice.plan_id == plan_id,
                    PlanPrice.interval == interval,
                    PlanPrice.currency == currency,
                    PlanPrice.price_kind == price_kind,
                    PlanPrice.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()

    async def resolve_offer_price(
        self, db: AsyncSession, plan_id: int, currency: str, interval: str = "month"
    ) -> Optional[PlanPrice]:
        """The price a buyer would actually be charged right now.

        Founding while the beta window is open, list afterwards — one resolver, used by BOTH the
        pricing page and checkout. If they resolved separately they would eventually disagree, and
        the failure mode is a page advertising one price and a checkout charging another.

        Falls back to list when no founding price exists yet, which is the state today: the founding
        prices have to be created in Stripe first (F1 is an operator task). Until then the window
        being open changes nothing, rather than breaking checkout.
        """
        founding = await self._active_price(db, plan_id, currency, interval, PriceKind.FOUNDING)
        if self.beta_window()["founding_active"] and founding:
            return founding

        list_price = await self._active_price(db, plan_id, currency, interval, PriceKind.LIST)
        if list_price:
            return list_price

        # The window has closed and nobody ever created a list price. Keep selling at the founding
        # rate rather than returning None — None means "no active price for this plan", which is a
        # dead checkout button and a pricing page with a blank where the number should be.
        #
        # This is a real configuration today: only the founding prices are being created, so on
        # BETA_END_DATE this branch is the difference between "still sells, at the old price" and
        # "cannot sell at all", with nothing failing loudly in between.
        if founding:
            logger.warning(
                "BILLING: founding window closed and no %s list price for plan %s/%s — "
                "still selling the founding price. Create a list price to roll customers onto.",
                interval, plan_id, currency,
            )
        return founding

    async def active_subscription(self, db: AsyncSession, user: User) -> Optional[UserSubscription]:
        return (
            await db.execute(
                select(UserSubscription).where(
                    UserSubscription.user_id == user.id,
                    UserSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
                )
            )
        ).scalar_one_or_none()

    async def map_price_to_plan(self, db: AsyncSession, stripe_price_id: str) -> Optional[int]:
        """The plan a Stripe price grants (used by the subscription webhook)."""
        row = (
            await db.execute(select(PlanPrice.plan_id).where(PlanPrice.stripe_price_id == stripe_price_id))
        ).first()
        return row[0] if row else None

    # ------------------------------------------------------------------ #
    # Stripe customer
    # ------------------------------------------------------------------ #
    async def _get_or_create_customer(self, db: AsyncSession, user: User) -> str:
        if user.stripe_customer_id:
            return user.stripe_customer_id
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name or user.username,
            metadata={"user_id": str(user.id), "user_uuid": user.uuid},
        )
        user.stripe_customer_id = customer.id
        await db.commit()
        return customer.id

    # ------------------------------------------------------------------ #
    # Checkout (subscribe / upgrade)
    # ------------------------------------------------------------------ #
    async def create_checkout_session(
        self,
        db: AsyncSession,
        user: User,
        plan_code: str,
        country_code: Optional[str],
        *,
        interval: str = "month",
        consent: bool = False,
        consent_doc_versions: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> str:
        """Create a Stripe subscription Checkout session for ``plan_code`` and return its URL.

        **No consent, no session** (§5.5). EU consumers have a 14-day withdrawal right on digital
        services; access starts immediately, so the buyer must actively agree to begin before that
        window closes. The check is here rather than in the UI because a UI checkbox proves nothing
        after the fact — the consent row written below is the record, and it is written *before*
        Stripe is called so a session cannot exist without one.
        """
        plan = await self._plan_by_code(db, plan_code)
        if not plan or plan.code in (PlanCode.GUEST, PlanCode.FREE):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a purchasable plan.")
        if not plan.is_active or not plan.is_assignable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This plan isn't available yet.",
            )

        # Already subscribed → send them to the Customer Portal instead of a second subscription.
        if await self.active_subscription(db, user):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active subscription. Use 'Manage subscription' to change it.",
            )

        if not consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Please confirm you want your subscription to start immediately, and that you "
                    "understand this waives your 14-day right of withdrawal once it begins."
                ),
            )

        # Reject anything we cannot price rather than silently selling a monthly subscription to
        # someone who asked for a year.
        interval = (interval or "month").strip().lower()
        if interval not in ("month", "year"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Billing interval must be 'month' or 'year'.",
            )

        currency = self.resolve_currency(country_code)
        # Founding while the window is open, list afterwards (F1/F5). Same resolver as the pricing
        # page, so the two can never quote different numbers.
        price = await self.resolve_offer_price(db, plan.id, currency, interval)
        if not price:  # fall back to EUR if the resolved currency has no price yet
            price = await self.resolve_offer_price(db, plan.id, "EUR", interval)
        if not price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active price for this plan. Please try again later.",
            )

        # Written BEFORE the Stripe call, and committed with the customer creation below. If Stripe
        # then fails, we hold a consent for a purchase that did not happen — harmless. The reverse,
        # a purchase with no consent record, is the one that cannot be allowed to happen.
        db.add(
            BillingConsent(
                user_id=user.id,
                consent_type=CONSENT_WITHDRAWAL_WAIVER,
                doc_versions=(consent_doc_versions or settings.legal_doc_versions)[:60],
                ip=(client_ip or "unknown")[:45],
            )
        )
        await db.commit()

        customer_id = await self._get_or_create_customer(db, user)
        metadata = {
            "user_id": str(user.id),
            "plan_id": str(plan.id),
            "plan_code": plan.code,
            # Read back by the founding-lock handler when the checkout completes: it needs to know
            # which price was actually sold, and the session's line items are not on the event.
            "price_kind": price.price_kind,
            "stripe_price_id": price.stripe_price_id,
        }

        kwargs: Dict[str, Any] = {
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": price.stripe_price_id, "quantity": 1}],
            "client_reference_id": user.uuid,
            "metadata": metadata,
            "subscription_data": {"metadata": metadata},
            "allow_promotion_codes": True,
            # Return to the APP (beta.resomix.com), not the marketing host — a user who subscribes
            # from the app must land back in the app (same login session), not on resomix.com where
            # a different account may be signed in. See settings.app_url.
            "success_url": f"{settings.app_url}/profile?checkout=success",
            "cancel_url": f"{settings.app_url}/profile?checkout=cancelled",
        }
        if settings.stripe_automatic_tax_enabled:
            kwargs["automatic_tax"] = {"enabled": True}
            kwargs["customer_update"] = {"address": "auto"}

        session = stripe.checkout.Session.create(**kwargs)
        return session.url

    # ------------------------------------------------------------------ #
    # Founding lock (subscription schedule)
    # ------------------------------------------------------------------ #
    async def apply_founding_lock(self, db: AsyncSession, session: Dict[str, Any]) -> None:
        """Pin a founding subscription to its rate for the agreed number of cycles (§5.3).

        Phase 1 runs the founding price for a fixed number of ITERATIONS — 22 monthly or 2 yearly —
        then phase 2 rolls onto the list price. Iterations rather than a date: the guarantee is
        "your first N cycles at this rate", and a date would shorten the lock for anyone who
        subscribed late in the window.

        ``end_behavior="release"`` detaches the schedule once phase 2 starts, leaving an ordinary
        subscription behind. Without it the subscription stays schedule-managed forever and the
        Customer Portal cannot change it — a paying customer who wants to switch plan would be
        stuck, and support could not fix it either.

        **Never raises.** This runs inside the Stripe webhook handler; an exception here would make
        us return 500, Stripe would retry the whole event, and the retry would re-run everything
        else in it. A missing lock is recoverable by hand from the logged error. A wedged webhook is
        much worse.
        """
        subscription_id = session.get("subscription")
        metadata = session.get("metadata") or {}
        if not subscription_id or metadata.get("price_kind") != PriceKind.FOUNDING:
            return  # not a founding subscription — nothing to lock

        try:
            plan_id = int(metadata["plan_id"])
            founding = (
                await db.execute(
                    select(PlanPrice).where(PlanPrice.stripe_price_id == metadata["stripe_price_id"])
                )
            ).scalar_one_or_none()
            if founding is None:
                logger.error("BILLING: founding price %s not found locally; no lock applied",
                             metadata.get("stripe_price_id"))
                return

            list_price = await self._active_price(
                db, plan_id, founding.currency, founding.interval, PriceKind.LIST
            )
            if list_price is None:
                # The schedule cannot be built without somewhere to roll onto. Loud, because the
                # customer is now on a founding price with no exit — they keep it until someone
                # notices, which is the generous direction but is not what was agreed.
                logger.error(
                    "BILLING: no %s list price for plan %s — founding lock NOT applied to %s",
                    founding.interval, plan_id, subscription_id,
                )
                return

            iterations = FOUNDING_LOCK_ITERATIONS.get(founding.interval)
            if not iterations:
                logger.error("BILLING: no founding lock defined for interval %r", founding.interval)
                return

            schedule = stripe.SubscriptionSchedule.create(from_subscription=subscription_id)
            # Stripe pre-fills phase 0 from the live subscription. Its start_date must be carried
            # over verbatim — the API refuses to move the start of a phase already in progress.
            current_start = schedule.phases[0].start_date if schedule.phases else None
            phase_one: Dict[str, Any] = {
                "items": [{"price": founding.stripe_price_id, "quantity": 1}],
                "iterations": iterations,
            }
            if current_start:
                phase_one["start_date"] = current_start
            stripe.SubscriptionSchedule.modify(
                schedule.id,
                end_behavior="release",
                phases=[
                    phase_one,
                    {"items": [{"price": list_price.stripe_price_id, "quantity": 1}]},
                ],
            )

            await self._record_founding_lock(db, subscription_id, schedule.id, iterations, founding.interval)
            logger.info(
                "BILLING: founding lock applied to %s (%s x%d -> %s)",
                subscription_id, founding.stripe_price_id, iterations, list_price.stripe_price_id,
            )
        except Exception as exc:  # noqa: BLE001 — see the docstring
            logger.error("BILLING: could not apply founding lock to %s: %s", subscription_id, exc)

    async def _record_founding_lock(
        self, db: AsyncSession, subscription_id: str, schedule_id: str,
        iterations: int, interval: str,
    ) -> None:
        """Mirror the lock locally so support and the profile screen can read it without Stripe.

        The row may not exist yet — `customer.subscription.created` and
        `checkout.session.completed` race, and either can land first. That is fine: the
        `subscription_schedule.*` webhook writes the same fields when it arrives, so the mirror
        converges either way.
        """
        row = (
            await db.execute(
                select(UserSubscription).where(
                    UserSubscription.stripe_subscription_id == subscription_id
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return
        row.is_founding = True
        row.stripe_schedule_id = schedule_id
        row.founding_lock_ends_at = self._lock_end(row.current_period_start, iterations, interval)
        await db.commit()

    @staticmethod
    def _lock_end(start: Any, iterations: int, interval: str) -> Optional[datetime]:
        """When the founding rate ends: start + iterations × interval.

        An estimate for display, deliberately: Stripe's schedule is what actually enforces it, and
        its cycle boundaries can shift by a day on month-end dates. Shown as a month, never as a
        precise instant, so the approximation is never presented as more than it is.
        """
        if start is None:
            return None
        months = iterations * (12 if interval == "year" else 1)
        year = start.year + (start.month - 1 + months) // 12
        month = (start.month - 1 + months) % 12 + 1
        # Clamp the day so 31 January + 1 month lands on the end of February rather than
        # overflowing into March. `monthrange` knows the real calendar, including the century rule
        # for leap years that a hand-written `year % 4` gets wrong.
        day = min(start.day, calendar.monthrange(year, month)[1])
        return start.replace(year=year, month=month, day=day)

    # ------------------------------------------------------------------ #
    # Customer Portal (manage / downgrade / cancel / card / invoices)
    # ------------------------------------------------------------------ #
    async def create_portal_session(self, db: AsyncSession, user: User) -> str:
        if not user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No billing account yet — subscribe first.",
            )
        kwargs: Dict[str, Any] = {
            "customer": user.stripe_customer_id,
            "return_url": f"{settings.app_url}/profile",
        }
        if settings.stripe_billing_portal_config_id:
            kwargs["configuration"] = settings.stripe_billing_portal_config_id
        session = stripe.billing_portal.Session.create(**kwargs)
        return session.url

    # ------------------------------------------------------------------ #
    # Plan display (pricing page / profile)
    # ------------------------------------------------------------------ #
    async def get_plans_for_display(
        self, db: AsyncSession, country_code: Optional[str], current_plan_code: Optional[str]
    ) -> Dict[str, Any]:
        """Assignable consumer plans for the pricing page, with the resolved-currency price and
        purchasable/coming-soon flags. Inactive non-free plans (basic/max) → coming_soon.

        Restricted to the catalogue codes on purpose. `is_assignable` alone is a property of the
        row, so any plan created by hand or through the admin screens — a throwaway called "temp",
        say — was advertised on the public pricing page as a real product. The public page should
        only ever show plans the product actually sells, and that set is PlanCode.
        """
        currency = self.resolve_currency(country_code)
        plans = (
            await db.execute(
                select(Plan)
                .where(Plan.is_assignable.is_(True), Plan.code.in_(PUBLIC_PLAN_CODES))
                .order_by(Plan.sort_order)
            )
        ).scalars().all()

        out: List[Dict[str, Any]] = []
        for plan in plans:
            # The SAME resolver checkout uses, so the page cannot advertise a price the checkout
            # will not charge.
            price = await self.resolve_offer_price(db, plan.id, currency)
            resolved_currency = price.currency if price else currency
            if not price and currency != "EUR":
                price = await self.resolve_offer_price(db, plan.id, "EUR")
                resolved_currency = price.currency if price else currency
            # The undiscounted price, shown struck through beside a founding one. Only meaningful
            # when it differs — otherwise the card would claim a saving of zero.
            list_price = await self._active_price(
                db, plan.id, resolved_currency, "month", PriceKind.LIST
            )
            is_founding_price = bool(price and price.price_kind == PriceKind.FOUNDING)
            is_free = plan.code == PlanCode.FREE
            purchasable = bool(plan.is_active and price and not is_free)
            out.append(
                {
                    "code": plan.code,
                    "name": plan.name,
                    "is_free": is_free,
                    "unit_amount_cents": price.unit_amount_cents if price else (0 if is_free else None),
                    "currency": price.currency if price else currency,
                    "interval": price.interval if price else "month",
                    "purchasable": purchasable,
                    "coming_soon": bool(not plan.is_active and not is_free),
                    "is_current": plan.code == current_plan_code,
                    "is_founding_price": is_founding_price,
                    # Every interval this plan can actually be bought at, with the price that
                    # would be charged for each. ADDITIVE — the pricing page ignores it today.
                    # It exists so a monthly/yearly toggle can be built without another backend
                    # change, and so the page can never offer an interval that has no price.
                    "offers": await self._offers(db, plan.id, resolved_currency),
                    "list_unit_amount_cents": (
                        list_price.unit_amount_cents
                        if (is_founding_price and list_price and price
                            and list_price.unit_amount_cents != price.unit_amount_cents)
                        else None
                    ),
                    # The numbers the page prints. Rendered from the SAME rows that enforce them, so
                    # an admin raising a limit changes the pricing page in the same breath — the
                    # alternative is a marketing page that quietly starts lying after an edit.
                    "limits": await self._public_limits(db, plan),
                }
            )
        return {
            "currency": currency,
            "current_plan_code": current_plan_code,
            "plans": out,
            "beta": self.beta_window(),
        }

    async def _offers(self, db: AsyncSession, plan_id: int, currency: str) -> List[Dict[str, Any]]:
        """What this plan can be bought at, per interval.

        Only intervals with an active price appear, so a caller cannot render a "yearly" toggle for
        a plan that has no yearly price — the failure would otherwise be a checkout that 400s after
        the user has already chosen.
        """
        out: List[Dict[str, Any]] = []
        for interval in ("month", "year"):
            price = await self.resolve_offer_price(db, plan_id, currency, interval)
            if price is None:
                continue
            list_price = await self._active_price(db, plan_id, currency, interval, PriceKind.LIST)
            founding = price.price_kind == PriceKind.FOUNDING
            out.append({
                "interval": interval,
                "unit_amount_cents": price.unit_amount_cents,
                "currency": price.currency,
                "is_founding_price": founding,
                # Only when it differs, so nothing can advertise a saving of zero.
                "list_unit_amount_cents": (
                    list_price.unit_amount_cents
                    if (founding and list_price and list_price.unit_amount_cents != price.unit_amount_cents)
                    else None
                ),
            })
        return out

    async def _public_limits(self, db: AsyncSession, plan: Plan) -> Dict[str, Any]:
        """The plan's limits as the pricing page shows them.

        `None` = unlimited, matching `/entitlements/me`: the internal sentinel is `-1`, and a page
        that received it would print "-1 searches a day". `0` is preserved — it is a real limit
        meaning "not included", which is how the guest and free rows say what they do not have.
        """
        entitlements = await self.entitlements.get_entitlements_map(db, plan)

        def cap(key: str) -> Optional[int]:
            value = entitlements.get(key)
            if not isinstance(value, int) or isinstance(value, bool):
                return None
            return None if value < 0 else value

        return {
            "searches_per_day": cap(FeatureKey.SEARCH_PLAYLISTS_PER_MONTH),
            "uploads_per_month": cap(FeatureKey.UPLOADS_PER_MONTH),
            "top_sk_max": cap(FeatureKey.MAX_TRACKS_PER_PLAYLIST),
            "dropdown_max_tracks": cap(FeatureKey.DROPDOWN_MAX_TRACKS),
            "library_playlists_max": cap(FeatureKey.LIBRARY_PLAYLISTS_MAX),
            "exports_per_day": cap(FeatureKey.EXPORTS_PER_DAY),
            "export_track_limit": cap(FeatureKey.EXPORT_TRACK_LIMIT),
            "can_view_full_analysis": bool(entitlements.get(FeatureKey.CAN_VIEW_FULL_ANALYSIS)),
            "can_similarity_upload": bool(entitlements.get(FeatureKey.CAN_SIMILARITY_UPLOAD)),
        }

    @staticmethod
    def beta_window() -> Dict[str, Any]:
        """The founding-offer window, for the countdown and the checkout gate.

        `founding_active` is computed HERE rather than in the browser: a client clock can be wrong
        or deliberately set back, and a countdown that disagrees with what checkout will actually
        sell is worse than no countdown. The client still gets `end_date` so it can render a live
        ticker, but the server's answer is the one that decides.
        """
        end_date = settings.beta_end_date
        try:
            parsed = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            active = datetime.now(timezone.utc) < parsed
        except (ValueError, AttributeError):
            # A malformed env value must not take the pricing page down. Fail OPEN — the founding
            # window stays open, which sells at the lower price rather than silently withdrawing an
            # offer that is still being advertised.
            logger.warning("BILLING: could not parse beta_end_date %r; treating as open", end_date)
            return {"end_date": None, "founding_active": True}
        return {"end_date": end_date, "founding_active": active}

    # ------------------------------------------------------------------ #
    # Subscription summary + invoices (profile "Plan & Billing")
    # ------------------------------------------------------------------ #
    async def get_subscription_summary(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """Effective plan + the raw subscription row (status/renewal/cancel) + this period's usage."""
        plan = await self.entitlements.get_effective_plan(db, user)
        row = (
            await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id))
        ).scalar_one_or_none()

        usage: List[Dict[str, Any]] = []
        for fk in _USAGE_FEATURES:
            snapshot = await self.gate.usage_snapshot(db, fk, user=user)
            # `limit: None` = unlimited, same contract as /entitlements/me. This used to pass the
            # raw entitlement through, so a Pro row rendered its cap as **-1** on the "Plan &
            # Billing" screen. `used` now reports for unlimited plans too, since those are counted.
            usage.append({"feature": fk, "used": snapshot.used, "limit": snapshot.limit})

        # The Library cap is a database count, not a Redis counter — there is no window and no
        # reset, so it cannot come from `usage_snapshot`. Appended here so the profile shows the
        # same four figures as the workspace chip.
        library_max = await self.entitlements.get_int(
            db, FeatureKey.LIBRARY_PLAYLISTS_MAX, user=user
        )
        try:
            from app.repositories.playlist_repository import PlaylistRepository

            library_used = await PlaylistRepository().count_library_visible(db, user.id)
        except Exception:  # pragma: no cover — a meter must never break the billing screen
            library_used = None
        usage.append({
            "feature": FeatureKey.LIBRARY_PLAYLISTS_MAX,
            "used": library_used,
            "limit": None if library_max < 0 else library_max,
        })

        subscription = None
        if row is not None:
            subscription = {
                "status": row.status,
                "currency": row.currency,
                "current_period_end": row.current_period_end.isoformat() if row.current_period_end else None,
                "cancel_at_period_end": bool(row.cancel_at_period_end),
                "canceled_at": row.canceled_at.isoformat() if row.canceled_at else None,
                "trial_end": row.trial_end.isoformat() if row.trial_end else None,
            }
        return {
            "plan": {"code": plan.code, "name": plan.name} if plan else None,
            "subscription": subscription,
            "usage": usage,
        }

    async def list_invoices(self, db: AsyncSession, user: User, limit: int = 24) -> List[Dict[str, Any]]:
        rows = (
            await db.execute(
                select(BillingInvoice)
                .where(BillingInvoice.user_id == user.id)
                .order_by(BillingInvoice.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [
            {
                "stripe_invoice_id": r.stripe_invoice_id,
                "amount_paid_cents": r.amount_paid_cents,
                "currency": r.currency,
                "status": r.status,
                "period_start": r.period_start.isoformat() if r.period_start else None,
                "period_end": r.period_end.isoformat() if r.period_end else None,
                "hosted_invoice_url": r.hosted_invoice_url,
                "invoice_pdf": r.invoice_pdf,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            }
            for r in rows
        ]

    async def get_usage_history(
        self, db: AsyncSession, user: User, limit_periods: int = 12
    ) -> List[Dict[str, Any]]:
        """Past-period usage (uploads / similarity) per billing period, newest first."""
        rows = (
            await db.execute(
                select(UsagePeriodHistory)
                .where(
                    UsagePeriodHistory.subject_type == "user",
                    UsagePeriodHistory.subject_id == str(user.id),
                )
                .order_by(UsagePeriodHistory.period_start.desc())
            )
        ).scalars().all()

        periods: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            key = r.period_start.isoformat() if r.period_start else "?"
            bucket = periods.setdefault(
                key,
                {
                    "period_start": r.period_start.isoformat() if r.period_start else None,
                    "period_end": r.period_end.isoformat() if r.period_end else None,
                    "features": [],
                },
            )
            bucket["features"].append(
                {"feature": r.feature_key, "used": r.used_count, "limit": r.limit_value}
            )

        ordered = sorted(periods.values(), key=lambda p: p["period_start"] or "", reverse=True)
        return ordered[:limit_periods]
