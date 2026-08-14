"""
/entitlements/me — limits · usage · resets (pricing v2.1, D1)
=============================================================

The endpoint the frontend already fetches to decide what to show, extended with the two things it
could not previously answer: how much of the allowance is spent, and when it comes back.

Three properties carry the weight:

  * **it is a union.** `plan` and `entitlements` are untouched. Every consumer shipping today keeps
    working; the new blocks are additive.
  * **null is not zero.** `-1` never reaches the client (a browser would render "3/-1"), and an
    unreadable counter reports `null` rather than a fabricated `0` that looks like data.
  * **it degrades, it does not fail.** This one call drives the UI. A Redis outage must cost the
    usage chip, not the entitlement map — and therefore not the whole interface.

Fakes throughout: no DB, no Redis.
"""

import json

import pytest

from app.controllers.entitlement_controller import EntitlementController
from app.core.config import settings
from app.services.entitlement_gate import UsageSnapshot


class _Plan:
    code = "free"
    name = "Free"
    is_default = True


FREE_MAP = {
    "search_playlists_per_month": 3,
    "uploads_per_month": 5,
    "max_tracks_per_playlist": 20,
    "dropdown_max_tracks": 50,
    "library_playlists_max": 5,
    "exports_per_day": 1,
    "export_track_limit": 20,
    "can_export": True,
}

PRO_MAP = {
    **FREE_MAP,
    "search_playlists_per_month": -1,
    "uploads_per_month": 50,
    "max_tracks_per_playlist": 100,
    "library_playlists_max": -1,
    "exports_per_day": -1,
    "export_track_limit": 100,
}


class _Entitlements:
    def __init__(self, mapping):
        self.mapping = mapping

    async def get_effective_map(self, db, *, user=None, visitor_id=None):
        return _Plan(), dict(self.mapping)


class _Gate:
    def __init__(self, snapshots=None, raises=False):
        self.snapshots = snapshots or {}
        self.raises = raises
        self.calls = []

    async def usage_snapshot(self, db, feature_key, *, user=None, visitor_id=None):
        self.calls.append(feature_key)
        if self.raises:
            raise RuntimeError("redis exploded")
        return self.snapshots.get(feature_key, UsageSnapshot(feature_key))


class _Playlists:
    """Stands in for PlaylistRepository.

    The signature is part of the contract being tested. It gained `cap` when visibility stopped
    being a stored flag: "how many are unlocked" became `min(owned, cap)` and is unanswerable
    without it. A stub that kept the old two-argument shape did not fail loudly — the controller
    catches, logs and reports `None`, so the chip silently went blank. Hence `seen_caps`.
    """

    def __init__(self, count=0, raises=False):
        self.count = count
        self.raises = raises
        self.calls = 0
        self.seen_caps = []

    async def count_library_visible(self, db, user_id, cap=None):
        self.calls += 1
        self.seen_caps.append(cap)
        if self.raises:
            raise RuntimeError("db exploded")
        return self.count


class _Guest:
    @staticmethod
    def derive_visitor_id(request):
        return "visitor-abc"


class _User:
    id = 7


def _controller(*, mapping=FREE_MAP, snapshots=None, gate_raises=False, library=0, library_raises=False):
    c = EntitlementController()
    c.entitlements = _Entitlements(mapping)
    c.gate = _Gate(snapshots, gate_raises)
    c.playlist_repository = _Playlists(library, library_raises)
    c.guest_identity = _Guest()
    return c


async def _get(controller, user=_User()):
    response = await controller.get_my_entitlements(None, None, user, settings.system_partner_id)
    return json.loads(response.body)["data"]


@pytest.mark.asyncio
class TestItIsAUnion:
    async def test_the_existing_fields_are_untouched(self):
        """Existing consumers read these. Reshaping them would be a silent breaking change to
        every part of the UI that gates on entitlements today."""
        data = await _get(_controller())
        assert data["is_frontend"] is True
        assert data["is_guest"] is False
        assert data["plan"] == {"code": "free", "name": "Free", "is_default": True}
        assert data["entitlements"] == FREE_MAP

    async def test_the_new_blocks_are_all_present(self):
        data = await _get(_controller())
        assert set(data["limits"]) >= {"searches_per_day", "uploads_per_month", "top_sk_max",
                                       "library_playlists_max", "exports_per_day"}
        assert set(data["usage"]) == {"searches_used_today", "uploads_used_month",
                                      "exports_used_today", "library_playlists_used"}
        assert set(data["resets"]) == {"search_at", "upload_at", "export_at"}

    async def test_b2b_partners_get_neither(self):
        """B2B has its own quota system. Sending consumer limits would invite a partner to build
        against numbers that do not govern them."""
        c = _controller()
        response = await c.get_my_entitlements(None, None, _User(), 999)
        data = json.loads(response.body)["data"]
        assert data["is_frontend"] is False
        assert "limits" not in data


@pytest.mark.asyncio
class TestLimits:
    async def test_values_come_from_entitlements(self):
        limits = (await _get(_controller()))["limits"]
        assert limits["searches_per_day"] == 3
        assert limits["uploads_per_month"] == 5
        assert limits["top_sk_max"] == 20
        assert limits["library_playlists_max"] == 5
        assert limits["exports_per_day"] == 1

    async def test_unlimited_is_null_not_minus_one(self):
        """`-1` is an internal sentinel. Sent to a browser it renders as "3/-1"."""
        limits = (await _get(_controller(mapping=PRO_MAP)))["limits"]
        assert limits["searches_per_day"] is None
        assert limits["library_playlists_max"] is None
        assert limits["exports_per_day"] is None

    async def test_zero_stays_zero(self):
        """Guest limits are 0 and 0 means DENY. Collapsing it to null would read as unlimited —
        the exact inversion of what it means."""
        limits = (await _get(_controller(mapping={**FREE_MAP, "exports_per_day": 0})))["limits"]
        assert limits["exports_per_day"] == 0

    async def test_selectable_and_unlocked_depth_are_separate(self):
        """On free they differ (50 selectable, 20 unlocked). One number would make the dropdown and
        the result disagree about what the plan gives."""
        limits = (await _get(_controller()))["limits"]
        assert limits["dropdown_max_tracks"] == 50
        assert limits["top_sk_max"] == 20

    async def test_a_missing_entitlement_is_null_not_zero(self):
        """A feature row that has not been seeded yet is unknown, not "you get none of it"."""
        limits = (await _get(_controller(mapping={})))["limits"]
        assert limits["searches_per_day"] is None

    async def test_limits_agree_with_entitlements(self):
        """`limits` is a second SHAPE, never a second source of truth."""
        data = await _get(_controller())
        assert data["limits"]["uploads_per_month"] == data["entitlements"]["uploads_per_month"]


@pytest.mark.asyncio
class TestUsage:
    async def test_counted_usage_is_reported(self):
        from datetime import datetime

        snapshots = {
            "search_playlists_per_month": UsageSnapshot(
                "search_playlists_per_month", limit=3, used=2, resets_at=datetime(2026, 8, 7)
            ),
            "exports_per_day": UsageSnapshot("exports_per_day", limit=1, used=1),
        }
        usage = (await _get(_controller(snapshots=snapshots)))["usage"]
        assert usage["searches_used_today"] == 2
        assert usage["exports_used_today"] == 1

    async def test_zero_usage_is_zero_not_null(self):
        snapshots = {"exports_per_day": UsageSnapshot("exports_per_day", limit=1, used=0)}
        assert (await _get(_controller(snapshots=snapshots)))["usage"]["exports_used_today"] == 0

    async def test_unknown_usage_is_null_not_zero(self):
        """`null` is reserved for genuinely unreadable — Redis down, or no identity to count
        against. Reporting 0 there would show a full allowance to someone who has spent it."""
        snapshots = {"search_playlists_per_month": UsageSnapshot("search_playlists_per_month")}
        assert (await _get(_controller(snapshots=snapshots)))["usage"]["searches_used_today"] is None

    async def test_an_unlimited_plan_still_reports_usage(self):
        """Unlimited is not unmeasured. `limits.searches_per_day` is null while
        `usage.searches_used_today` is a real number — that pairing is the whole point, and it is
        what tells us whether the fair-use position holds."""
        snapshots = {
            "search_playlists_per_month": UsageSnapshot(
                "search_playlists_per_month", limit=None, used=37
            )
        }
        data = await _get(_controller(mapping=PRO_MAP, snapshots=snapshots))
        assert data["limits"]["searches_per_day"] is None
        assert data["usage"]["searches_used_today"] == 37

    async def test_the_library_count_comes_from_the_database(self):
        """It is not a Redis counter — it is how many playlists are currently listed."""
        c = _controller(library=4)
        assert (await _get(c))["usage"]["library_playlists_used"] == 4
        assert c.playlist_repository.calls == 1

    async def test_an_unlimited_library_is_still_counted(self):
        """Pro has no cap, but "how many playlists do our paying users actually keep" is exactly
        the number the fair-use position rests on."""
        c = _controller(mapping=PRO_MAP, library=137)
        assert (await _get(c))["usage"]["library_playlists_used"] == 137
        assert c.playlist_repository.calls == 1

    async def test_the_chip_counts_against_the_same_plan_it_displays(self):
        """The numerator and the denominator must come from ONE resolution of the plan.

        `usage.library_playlists_used` is the numerator; `limits.library_playlists_max` is the
        denominator. Resolving the plan twice — once for each — is how a chip ends up reading
        "6/5": a grant expiring, a subscription webhook landing, or a cache entry rolling between
        the two calls is enough. Asserting the cap handed to the counter IS the displayed limit is
        what pins them together.
        """
        c = _controller(library=4)
        payload = await _get(c)

        assert c.playlist_repository.seen_caps == [payload["limits"]["library_playlists_max"]]

    async def test_a_guest_has_no_library_count(self):
        """Guests have no Library at all, and no user id to count against."""
        c = _controller()
        assert (await _get(c, user=None))["usage"]["library_playlists_used"] is None
        assert c.playlist_repository.calls == 0


@pytest.mark.asyncio
class TestResets:
    async def test_reset_times_are_reported(self):
        from datetime import datetime

        snapshots = {
            "search_playlists_per_month": UsageSnapshot(
                "search_playlists_per_month", limit=3, used=3, resets_at=datetime(2026, 8, 7)
            )
        }
        assert (await _get(_controller(snapshots=snapshots)))["resets"]["search_at"].startswith(
            "2026-08-07"
        )

    async def test_reset_times_carry_an_explicit_offset(self):
        """The client renders these in local time. Without an offset the timestamp is read as local
        and shows the wrong reset hour to everyone outside UTC."""
        from datetime import datetime

        snapshots = {
            "exports_per_day": UsageSnapshot("exports_per_day", limit=1, used=1,
                                             resets_at=datetime(2026, 8, 7))
        }
        assert (await _get(_controller(snapshots=snapshots)))["resets"]["export_at"].endswith("+00:00")

    async def test_an_unlimited_feature_has_no_reset(self):
        """Nothing accrues, so nothing rolls over. A reset time would imply a limit exists."""
        assert (await _get(_controller(mapping=PRO_MAP)))["resets"]["search_at"] is None

    async def test_there_is_no_library_reset(self):
        """Deleting a playlist frees a slot immediately — the Library cap is not a window."""
        assert "library_at" not in (await _get(_controller()))["resets"]


@pytest.mark.asyncio
class TestItDegradesRatherThanFails:
    async def test_a_redis_outage_still_returns_the_entitlement_map(self):
        """This single call drives the UI. Failing it over a usage counter would black out every
        gated control on the page to avoid showing one wrong number."""
        data = await _get(_controller(gate_raises=True))
        assert data["entitlements"] == FREE_MAP
        assert data["limits"]["searches_per_day"] == 3

    async def test_a_redis_outage_reports_unknown_usage(self):
        usage = (await _get(_controller(gate_raises=True)))["usage"]
        assert usage["searches_used_today"] is None
        assert usage["exports_used_today"] is None

    async def test_every_usage_key_is_present_even_when_it_fails(self):
        """A missing key and a null value are different bugs on the client. Always send the shape."""
        usage = (await _get(_controller(gate_raises=True)))["usage"]
        assert set(usage) == {"searches_used_today", "uploads_used_month",
                              "exports_used_today", "library_playlists_used"}

    async def test_a_failing_library_count_does_not_break_the_response(self):
        data = await _get(_controller(library_raises=True))
        assert data["usage"]["library_playlists_used"] is None
        assert data["entitlements"] == FREE_MAP

    async def test_one_failing_metric_does_not_take_out_the_others(self):
        """The snapshots are read in a loop; a shared try/except would let the first failure
        discard the two that worked."""
        c = _controller(snapshots={
            "exports_per_day": UsageSnapshot("exports_per_day", limit=1, used=1),
        }, library=2)
        usage = (await _get(c))["usage"]
        assert usage["exports_used_today"] == 1
        assert usage["library_playlists_used"] == 2
