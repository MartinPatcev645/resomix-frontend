"""
Export gating and metering (pricing v2.1, C2)
=============================================

The endpoint that makes ``exports_per_day`` enforceable. What matters here is not that a denial
happens but **in what order**, because each ordering decision is a way to charge someone for
nothing:

  * an unknown format is a 422, not an upsell — sending someone to checkout for a format that does
    not exist takes their money for a problem it cannot solve;
  * the playlist is loaded **before** the credit is consumed, so a 404 is free;
  * a failure after the consume refunds, so a user who received no file was never charged.

Fakes throughout — no DB, no Redis, no entitlements.
"""

import json

import pytest

from app.controllers.playlist_export_controller import PlaylistExportController
from app.services.entitlement_gate import GateResult


class _FakeGate:
    def __init__(self, *, export=None, quota=None, track_limit=100, unlocked=100):
        self.export = export if export is not None else GateResult(True)
        self.quota = quota if quota is not None else GateResult(True, limit=1, count=0)
        self.caps = {"export_track_limit": track_limit, "max_tracks_per_playlist": unlocked}
        self.calls = []

    async def check_export(self, db, target, *, user=None, visitor_id=None):
        self.calls.append(("check_export", target))
        return self.export

    async def try_consume(self, db, feature_key, *, user=None, visitor_id=None):
        self.calls.append(("try_consume", feature_key))
        return self.quota

    async def get_cap(self, db, feature_key, *, user=None, visitor_id=None):
        return self.caps.get(feature_key, 0)

    async def refund(self, db, feature_key, *, user=None, visitor_id=None):
        self.calls.append(("refund", feature_key))


class _FakePlaylists:
    def __init__(self, found=True, tracks=3):
        self.found = found
        self.tracks = tracks
        self.calls = []

    async def get_playlist_similarity_data(self, db, uuid, user_id=None, partner_id=None):
        self.calls.append({"uuid": uuid, "user_id": user_id, "partner_id": partner_id})
        if not self.found:
            return {"success": False, "error": "Playlist not found"}
        return {
            "success": True,
            "data": {
                "playlist": {"name": "Set"},
                "queried_track": {"artist": "A", "title": "B"},
                "similar_tracks": [
                    {"rank": float(i), "artist": f"A{i}", "title": f"T{i}"}
                    for i in range(1, self.tracks + 1)
                ],
            },
        }


class _User:
    id = 7


class _State:
    partner_id = 1


class _Request:
    state = _State()


def _controller(**kw):
    c = PlaylistExportController()
    c.entitlement_gate = _FakeGate(**{k: v for k, v in kw.items() if k not in ("found", "tracks")})
    c.playlist_service = _FakePlaylists(
        found=kw.get("found", True), tracks=kw.get("tracks", 3)
    )
    return c


def _body(response):
    return json.loads(response.body)


async def _export(controller, *, user=_User(), target="txt", max_tracks=None, request=_Request()):
    return await controller.export_playlist(None, request, "pl-uuid", target, user, max_tracks)


@pytest.mark.asyncio
class TestUnknownFormat:
    async def test_is_a_422_not_an_upsell(self):
        c = _controller()
        r = await _export(c, target="pdf")
        assert r.status_code == 422

    async def test_costs_nothing(self):
        """No gate call at all — an unknown format must not spend an export or even look one up."""
        c = _controller()
        await _export(c, target="pdf")
        assert c.entitlement_gate.calls == []

    async def test_a_transfer_target_is_not_downloadable_here(self):
        """Apple has its own endpoint. Accepting it here would consume the day's export and hand
        back an empty TXT file."""
        c = _controller()
        assert (await _export(c, target="apple")).status_code == 422


@pytest.mark.asyncio
class TestPlanGate:
    async def test_guest_gets_login_required(self):
        """`can_export` is false for the guest plan, so the gate denies with `login_required` —
        the login wall the spec asks for, not an upgrade prompt they cannot act on."""
        c = _controller(export=GateResult(False, "login_required"))
        r = await _export(c, user=None)
        assert r.status_code == 402
        assert _body(r)["code"] == "login_required"

    async def test_wrong_plan_gets_plan_required(self):
        c = _controller(export=GateResult(False, "upgrade_required"))
        r = await _export(c)
        assert r.status_code == 402
        assert _body(r)["code"] == "plan_required"

    async def test_a_denied_plan_never_consumes(self):
        c = _controller(export=GateResult(False, "upgrade_required"))
        await _export(c)
        assert not any(call[0] == "try_consume" for call in c.entitlement_gate.calls)

    async def test_a_denied_plan_never_loads_the_playlist(self):
        c = _controller(export=GateResult(False, "upgrade_required"))
        await _export(c)
        assert c.playlist_service.calls == []


@pytest.mark.asyncio
class TestPlaylistLookup:
    async def test_missing_playlist_is_a_404(self):
        c = _controller(found=False)
        assert (await _export(c)).status_code == 404

    async def test_a_404_does_not_spend_the_daily_export(self):
        """The load deliberately happens BEFORE the consume. A stale link costing a free user their
        one export for the day is indefensible."""
        c = _controller(found=False)
        await _export(c)
        assert not any(call[0] == "try_consume" for call in c.entitlement_gate.calls)

    async def test_the_partner_is_passed_through(self):
        """The tracks query filters `t.partner_id = :partner_id`. Passing None compares against
        NULL, matches no rows, and yields an EMPTY export that has still spent the day's credit —
        a silent failure with no error anywhere. It comes from request.state, as on the similarity
        endpoint."""
        c = _controller()
        await _export(c)
        assert c.playlist_service.calls[0]["partner_id"] == 1

    async def test_the_owner_is_passed_through(self):
        """Without it the service treats the caller as anonymous and a private playlist the user
        owns comes back as "not public"."""
        c = _controller()
        await _export(c)
        assert c.playlist_service.calls[0]["user_id"] == 7


@pytest.mark.asyncio
class TestDailyAllowance:
    async def test_spent_allowance_is_402_export_limit_reached(self):
        denied = GateResult(
            False, "upgrade_required", limit=1, count=1, metric="exports_per_day"
        )
        c = _controller(quota=denied)
        r = await _export(c)
        assert r.status_code == 402
        assert _body(r)["code"] == "export_limit_reached"

    async def test_the_denial_carries_the_numbers_the_modal_needs(self):
        from datetime import datetime

        denied = GateResult(
            False, "upgrade_required", limit=1, count=1,
            metric="exports_per_day", resets_at=datetime(2026, 8, 6),
        )
        c = _controller(quota=denied)
        data = _body(await _export(c))["data"]
        assert data["used"] == 1 and data["limit"] == 1
        assert data["resets_at"].startswith("2026-08-06")
        assert data["metric"] == "exports_per_day"

    async def test_resets_at_carries_an_explicit_offset(self):
        """The client renders this in local time. Without an offset it is read as local and shows
        the wrong reset hour to everyone outside UTC."""
        from datetime import datetime

        denied = GateResult(
            False, "upgrade_required", limit=1, count=1,
            metric="exports_per_day", resets_at=datetime(2026, 8, 6),
        )
        c = _controller(quota=denied)
        assert _body(await _export(c))["data"]["resets_at"].endswith("+00:00")

    async def test_the_consume_is_atomic_not_peek_then_record(self):
        """A TXT export cannot fail after this point, so `try_consume` is safe — and it is the only
        form that stops two parallel clicks both passing a limit of 1."""
        c = _controller()
        await _export(c)
        assert ("try_consume", "exports_per_day") in c.entitlement_gate.calls


@pytest.mark.asyncio
class TestSuccess:
    async def test_returns_the_file(self):
        c = _controller()
        r = await _export(c)
        assert r.status_code == 200
        data = _body(r)["data"]
        assert data["filename"].endswith(".txt")
        assert "INPUT TRACK" in data["content"]

    async def test_the_plan_cap_trims_the_file(self):
        c = _controller(track_limit=2, unlocked=100, tracks=10)
        data = _body(await _export(c))["data"]
        assert data["track_count"] == 2
        assert data["truncated"] is True
        assert "T3" not in data["content"]

    async def test_the_unlocked_count_also_trims(self):
        """`export_scope = full` means "what the user can see" — the unlocked count is a ceiling
        even when the export limit is higher."""
        c = _controller(track_limit=100, unlocked=2, tracks=10)
        assert _body(await _export(c))["data"]["track_count"] == 2

    async def test_a_client_request_can_only_narrow(self):
        c = _controller(track_limit=100, unlocked=100, tracks=10)
        assert _body(await _export(c, max_tracks=3))["data"]["track_count"] == 3

    async def test_a_client_request_cannot_widen(self):
        c = _controller(track_limit=2, unlocked=100, tracks=10)
        assert _body(await _export(c, max_tracks=999))["data"]["track_count"] == 2


@pytest.mark.asyncio
class TestFailureAfterConsume:
    async def test_a_build_failure_refunds_the_credit(self):
        """Record-on-success is not available here (the consume must be atomic), so the refund is
        what keeps "charged but received nothing" impossible."""
        c = _controller()

        def _boom(*a, **kw):
            raise RuntimeError("formatting exploded")

        import app.controllers.playlist_export_controller as mod
        original = mod.export_service.build_txt
        mod.export_service.build_txt = _boom
        try:
            r = await _export(c)
        finally:
            mod.export_service.build_txt = original

        assert r.status_code == 500
        assert ("refund", "exports_per_day") in c.entitlement_gate.calls
