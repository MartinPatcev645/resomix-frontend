"""
Search and upload denials use the 402 contract (pricing v2.1, E2)
=================================================================

B1 defined the 402 quota contract and C2/C3 adopted it, but the two **biggest** meters — search and
upload — still answered 403 through the legacy ``OperationLimitEvaluator`` seam. That left the
headline modals with nothing to open on, and the client with no `resets_at` to tell anyone when
their allowance came back.

Two denials arrive through this seam and conflating them is the failure that matters:

  * **a spent allowance** — 402, with metric / used / limit / resets_at. It comes back, and an
    upgrade makes it bigger.
  * **a permission refusal** ("not yet allowed", "disabled for your account") — 403, prose only.
    Waiting will not help and neither will upgrading, so it must carry no reset time and no upgrade
    target: that would sell something that cannot fix the problem.

Also pinned here: the search copy is **daily**. It read "this month's" until the window changed
under it (A2 kept the key `search_playlists_per_month`), which told a user who had spent three
searches to wait a month for something that returns at midnight.
"""

import json
from datetime import datetime

import pytest

from app.services.entitlement_gate import GateResult
from app.services.operation_limit_evaluator import (
    _LIMIT_DENY_MSG,
    OperationLimitEvaluator,
    OperationLimitResult,
)
from app.utils.quota_response import operation_limit_response


class _Gate:
    def __init__(self, result):
        self.result = result

    async def peek_allowed(self, db, feature_key, *, user=None, visitor_id=None):
        return self.result


class _Db:
    async def execute(self, *a, **kw):
        class _R:
            @staticmethod
            def scalar_one_or_none():
                return None

        return _R()


def _evaluator(gate_result):
    e = OperationLimitEvaluator()
    e._gate = _Gate(gate_result)
    return e


DENIED = GateResult(
    False, "upgrade_required", limit=3, count=3,
    metric="search_playlists_per_month", resets_at=datetime(2026, 8, 7),
)


@pytest.mark.asyncio
class TestASpentAllowanceIs402:
    async def test_status_is_402(self):
        """Not 403. The request is well-formed and the caller is authenticated — they have spent
        something that comes back."""
        result = await _evaluator(DENIED)._check_monthly(_Db(), 7, "playlist_create")
        assert result.status_code == 402

    async def test_it_carries_the_machine_code(self):
        result = await _evaluator(DENIED)._check_monthly(_Db(), 7, "playlist_create")
        assert result.code == "quota_exceeded"

    async def test_it_carries_the_numbers_the_modal_needs(self):
        result = await _evaluator(DENIED)._check_monthly(_Db(), 7, "playlist_create")
        assert (result.used, result.limit) == (3, 3)
        assert result.metric == "search_playlists_per_month"
        assert result.resets_at == datetime(2026, 8, 7)

    async def test_an_allowed_check_stays_allowed(self):
        result = await _evaluator(GateResult(True, limit=3, count=1))._check_monthly(
            _Db(), 7, "playlist_create"
        )
        assert result.allowed is True
        assert result.code is None


class TestTheSearchCopyIsDaily:
    def test_it_does_not_say_month(self):
        """It said "this month's" until the window changed under it — telling someone to wait a
        month for an allowance that returns at midnight."""
        assert "month" not in _LIMIT_DENY_MSG["playlist_create"].lower()

    def test_it_says_today(self):
        assert "today" in _LIMIT_DENY_MSG["playlist_create"].lower()

    def test_uploads_stay_monthly(self):
        """Uploads did NOT re-window — Stripe owns that anchor."""
        assert "month" in _LIMIT_DENY_MSG["upload_create"].lower()

    def test_unlimited_is_written_as_fair_use(self):
        """A hard UI-text rule (§6.2): "unlimited" always carries "(fair use)"."""
        copy = _LIMIT_DENY_MSG["playlist_create"].lower()
        assert "unlimited" not in copy or "fair use" in copy

    def test_no_timezone_leaks_into_the_prose(self):
        """`resets_at` travels in the payload and the client renders it locally. "midnight UTC"
        would be the wrong hour for almost everyone reading it."""
        for copy in _LIMIT_DENY_MSG.values():
            assert "utc" not in copy.lower()


class TestTheResponseShape:
    @staticmethod
    def _body(response):
        return json.loads(response.body)

    def test_a_quota_denial_carries_the_full_payload(self):
        response = operation_limit_response(
            OperationLimitResult(
                allowed=False, status_code=402, message="You've used today's sonic searches (3).",
                reason="upgrade_required", code="quota_exceeded",
                metric="search_playlists_per_month", used=3, limit=3,
                resets_at=datetime(2026, 8, 7),
            )
        )
        body = self._body(response)
        assert response.status_code == 402
        assert body["code"] == "quota_exceeded"
        assert body["data"]["used"] == 3
        assert body["data"]["upgrade"] == "pro"
        assert body["data"]["resets_at"].startswith("2026-08-07")

    def test_reset_time_carries_an_explicit_offset(self):
        """Rendered in the visitor's local time; without an offset it is read as local and shows
        the wrong hour."""
        response = operation_limit_response(
            OperationLimitResult(
                allowed=False, status_code=402, message="x", code="quota_exceeded",
                resets_at=datetime(2026, 8, 7),
            )
        )
        assert self._body(response)["data"]["resets_at"].endswith("+00:00")

    def test_the_prose_stays_human(self):
        """`error` is rendered directly to users by the api-client, so it must never become the
        machine code."""
        response = operation_limit_response(
            OperationLimitResult(
                allowed=False, status_code=402, message="You've used today's sonic searches (3).",
                code="quota_exceeded",
            )
        )
        assert self._body(response)["error"] == "You've used today's sonic searches (3)."

    def test_a_permission_refusal_stays_403_with_no_quota_body(self):
        """"Disabled for your account" is not a quota. Offering a reset time would promise it comes
        back, and offering an upgrade would sell something that cannot fix it."""
        response = operation_limit_response(
            OperationLimitResult(
                allowed=False, status_code=403,
                message="This action is disabled for your account.",
            )
        )
        body = self._body(response)
        assert response.status_code == 403
        assert body.get("data") in (None, {})
        assert body.get("code") in (None, "")


class TestEveryMeteredCallSiteUsesTheHelper:
    """A call site that hand-rolls its own denial drifts. These three are the metered ones."""

    @pytest.mark.parametrize(
        "module",
        [
            "controllers/similarity_controller.py",
            "controllers/analysis_result_controller.py",
        ],
    )
    def test_the_controller_delegates(self, module):
        from pathlib import Path

        src = (Path(__file__).resolve().parents[3] / "app" / module).read_text()
        assert "operation_limit_response(limit_check)" in src

    def test_no_controller_still_hand_rolls_the_limit_response(self):
        from pathlib import Path

        app = Path(__file__).resolve().parents[3] / "app"
        for module in ("controllers/similarity_controller.py", "controllers/analysis_result_controller.py"):
            src = (app / module).read_text()
            assert "status_code=limit_check.status_code" not in src
