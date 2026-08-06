"""
Founding prices, the lock, and the consent gate (pricing v2.1, Phase F)
=======================================================================

Everything here decides what a customer is charged, so the failure modes are not cosmetic:

  * **price selection** — the pricing page and checkout must resolve through the *same* code. Two
    resolvers eventually disagree, and the disagreement is a page advertising one number while the
    checkout charges another.
  * **the lock** — phase 1 is counted in ITERATIONS, not an end date. A date would silently shorten
    the guarantee for anyone who subscribed late in the window; "your first 22 cycles" is what was
    promised.
  * **consent** — no consent, no session. The row is written *before* Stripe is called, so a
    subscription with no audit record behind it cannot exist.

Stripe is never contacted: the resolvers and helpers are exercised directly with fakes.
"""

from datetime import datetime

import pytest

from app.core.entitlement_keys import FOUNDING_LOCK_ITERATIONS, PriceKind
from app.services.billing_service import BillingService


class _Price:
    def __init__(self, kind, amount, interval="month", currency="EUR", price_id=None):
        self.price_kind = kind
        self.unit_amount_cents = amount
        self.interval = interval
        self.currency = currency
        self.stripe_price_id = price_id or f"price_{kind}_{interval}"


def _service(prices, founding_open=True):
    """A BillingService whose price lookup is a dict and whose beta window is fixed."""
    service = BillingService()

    async def _active_price(db, plan_id, currency, interval="month", price_kind=PriceKind.LIST):
        return prices.get((interval, currency, price_kind))

    service._active_price = _active_price
    service.beta_window = staticmethod(lambda: {"end_date": "x", "founding_active": founding_open})
    return service


FOUNDING = _Price(PriceKind.FOUNDING, 799)
LIST = _Price(PriceKind.LIST, 999)
BOTH = {
    ("month", "EUR", PriceKind.FOUNDING): FOUNDING,
    ("month", "EUR", PriceKind.LIST): LIST,
}


@pytest.mark.asyncio
class TestPriceSelection:
    async def test_the_founding_price_is_sold_while_the_window_is_open(self):
        price = await _service(BOTH).resolve_offer_price(None, 1, "EUR")
        assert price.unit_amount_cents == 799

    async def test_the_list_price_is_sold_once_it_closes(self):
        price = await _service(BOTH, founding_open=False).resolve_offer_price(None, 1, "EUR")
        assert price.unit_amount_cents == 999

    async def test_an_open_window_with_no_founding_price_falls_back_to_list(self):
        """Today's state: the founding prices have to be created in Stripe first. An open window
        must change nothing until they exist, rather than breaking checkout."""
        only_list = {("month", "EUR", PriceKind.LIST): LIST}
        price = await _service(only_list).resolve_offer_price(None, 1, "EUR")
        assert price.unit_amount_cents == 999

    async def test_no_price_at_all_resolves_to_nothing(self):
        assert await _service({}).resolve_offer_price(None, 1, "EUR") is None

    async def test_a_closed_window_never_reaches_for_a_founding_price(self):
        """Even if one is still sitting in the table. The window is the authority on what is for
        sale, not the presence of a row."""
        price = await _service(BOTH, founding_open=False).resolve_offer_price(None, 1, "EUR")
        assert price.price_kind == PriceKind.LIST


class TestTheLockIsCountedInCycles:
    def test_monthly_runs_for_22_cycles(self):
        assert FOUNDING_LOCK_ITERATIONS["month"] == 22

    def test_yearly_runs_for_2_cycles(self):
        """§6.2: the copy must read "your first two years at the founding rate" — which is only
        true if the schedule actually runs two yearly iterations."""
        assert FOUNDING_LOCK_ITERATIONS["year"] == 2


class TestLockEndEstimate:
    def test_monthly_adds_the_iteration_count_in_months(self):
        end = BillingService._lock_end(datetime(2026, 8, 6), 22, "month")
        assert (end.year, end.month) == (2028, 6)

    def test_yearly_adds_years(self):
        end = BillingService._lock_end(datetime(2026, 8, 6), 2, "year")
        assert (end.year, end.month) == (2028, 8)

    def test_a_month_end_start_does_not_overflow(self):
        """31 January + 1 month is 28/29 February, not 2/3 March. Overflowing would report a lock
        ending in the wrong month."""
        end = BillingService._lock_end(datetime(2026, 1, 31), 1, "month")
        assert (end.month, end.day) == (2, 28)

    def test_a_leap_year_end_is_handled(self):
        # 2028 IS a leap year; 2027 is not. The clamp must follow the real calendar, not a rule of
        # thumb — `calendar.monthrange` also gets the century exception right.
        end = BillingService._lock_end(datetime(2028, 1, 31), 1, "month")
        assert (end.month, end.day) == (2, 29)

    def test_a_non_leap_year_end_is_handled(self):
        end = BillingService._lock_end(datetime(2027, 1, 31), 1, "month")
        assert (end.month, end.day) == (2, 28)

    def test_no_start_means_no_estimate(self):
        """Better to show nothing than a date computed from a missing period start."""
        assert BillingService._lock_end(None, 22, "month") is None


class TestConsentIsRequired:
    @pytest.mark.asyncio
    async def test_checkout_refuses_without_consent(self):
        """No consent, no session — checked before Stripe is contacted."""
        from fastapi import HTTPException

        service = BillingService()

        class _Plan:
            id = 1
            code = "pro"
            is_active = True
            is_assignable = True

        async def _plan_by_code(db, code):
            return _Plan()

        async def _active_subscription(db, user):
            return None

        service._plan_by_code = _plan_by_code
        service.active_subscription = _active_subscription

        with pytest.raises(HTTPException) as exc:
            await service.create_checkout_session(None, object(), "pro", "GR", consent=False)
        assert exc.value.status_code == 400
        assert "withdrawal" in exc.value.detail.lower()

    def test_the_default_is_no_consent(self):
        """A caller that forgets the field is REFUSED, never silently consented for. The default
        is the one place this could go wrong invisibly."""
        import inspect

        signature = inspect.signature(BillingService.create_checkout_session)
        assert signature.parameters["consent"].default is False

    def test_the_request_schema_also_defaults_to_false(self):
        from app.api.routers.billing import CheckoutRequest

        assert CheckoutRequest(plan_code="pro").consent is False


class TestScheduleMirror:
    """`sync_schedule` keeps the local copy honest; Stripe remains the enforcer."""

    def test_phase_one_end_is_read_from_stripe(self):
        from app.services.billing_sync_service import BillingSyncService

        schedule = {"phases": [{"end_date": 1801000000}, {}]}
        assert BillingSyncService._phase_one_end(schedule) is not None

    def test_a_single_phase_schedule_reports_no_end(self):
        """One phase means nothing to roll onto, so its end is not a price change and must not be
        reported as the end of a founding lock."""
        from app.services.billing_sync_service import BillingSyncService

        assert BillingSyncService._phase_one_end({"phases": [{"end_date": 1801000000}]}) is None

    def test_a_missing_end_date_reports_nothing(self):
        from app.services.billing_sync_service import BillingSyncService

        assert BillingSyncService._phase_one_end({"phases": [{}, {}]}) is None

    def test_no_phases_reports_nothing(self):
        from app.services.billing_sync_service import BillingSyncService

        assert BillingSyncService._phase_one_end({}) is None


class TestTheAdminPathCannotClobberTheListPrice:
    """The upsert key had to grow with the schema.

    A founding and a list price now coexist on the same plan / interval / currency. Keying the
    upsert without `price_kind` would make attaching the founding price **overwrite the list price
    row** — and the list price is what the schedule rolls onto, so the damage would surface 22
    months later, on someone else's shift.
    """

    def test_the_upsert_keys_on_price_kind(self):
        import inspect

        from app.services.admin_entitlement_service import AdminEntitlementService

        src = inspect.getsource(AdminEntitlementService.add_or_update_price)
        assert "PlanPrice.price_kind == price_kind" in src

    def test_new_rows_carry_the_kind(self):
        import inspect

        from app.services.admin_entitlement_service import AdminEntitlementService

        src = inspect.getsource(AdminEntitlementService.add_or_update_price)
        assert "price_kind=price_kind" in src

    def test_it_defaults_to_list(self):
        """An existing caller that omits the field keeps its old behaviour exactly — `list` is what
        every price was before a founding offer existed."""
        import inspect

        from app.services.admin_entitlement_service import AdminEntitlementService

        signature = inspect.signature(AdminEntitlementService.add_or_update_price)
        assert signature.parameters["price_kind"].default == PriceKind.LIST

    def test_the_request_schema_defaults_to_list(self):
        from app.schemas.admin_entitlement import AddPlanPriceRequest

        assert AddPlanPriceRequest(stripe_price_id="price_1").price_kind == PriceKind.LIST

    def test_the_admin_listing_surfaces_the_kind(self):
        """Without it the admin screen shows two identical-looking rows for one plan and no way to
        tell which is which."""
        import inspect

        from app.services.admin_entitlement_service import AdminEntitlementService

        assert '"price_kind"' in inspect.getsource(AdminEntitlementService._price_meta)


@pytest.mark.asyncio
class TestOnlyFoundingPricesExist:
    """The configuration actually being deployed: only the €7.99 / €69 founding prices are created,
    with no list prices behind them.

    That is coherent — no list price means no rollover, so the subscription simply stays at the
    founding rate. But it puts a time bomb on BETA_END_DATE: once the window closes,
    `resolve_offer_price` would look for a list price, find nothing, and return None — which is a
    dead checkout button and a pricing page with a blank where the number goes. Nothing fails
    loudly; it just stops selling.
    """

    ONLY_FOUNDING = {("month", "EUR", PriceKind.FOUNDING): FOUNDING}

    async def test_it_sells_while_the_window_is_open(self):
        price = await _service(self.ONLY_FOUNDING).resolve_offer_price(None, 1, "EUR")
        assert price.unit_amount_cents == 799

    async def test_it_STILL_sells_after_the_window_closes(self):
        """The important one. Selling at the old price beats not selling."""
        price = await _service(self.ONLY_FOUNDING, founding_open=False).resolve_offer_price(
            None, 1, "EUR"
        )
        assert price is not None
        assert price.unit_amount_cents == 799

    async def test_a_list_price_still_wins_once_the_window_closes(self):
        """The fallback must not shadow a list price that DOES exist — otherwise creating one
        later would have no effect."""
        price = await _service(BOTH, founding_open=False).resolve_offer_price(None, 1, "EUR")
        assert price.unit_amount_cents == 999

    async def test_no_prices_at_all_is_still_nothing(self):
        assert await _service({}, founding_open=False).resolve_offer_price(None, 1, "EUR") is None
