"""
Transfers count against the daily export allowance (pricing v2.1, C2)
====================================================================

``exports_per_day`` is **one** allowance shared by every destination. A free account gets one export
a day whether that is a TXT download or an Apple Music transfer — otherwise the limit is
per-destination and a free user gets as many exports as we have integrations.

The transfers use **peek-then-record**, not the download's ``try_consume``, and the difference is
deliberate: a transfer is long and fails routinely (expired Music User Token, Apple rate limit, a
playlist with no matchable tracks) and each controller has several exits. Consuming up front would
spend a free user's single daily export on a transfer that never happened, and refunding on every
exit leaves a window where a crash keeps the charge. Record-on-success has no such window — the same
reasoning as the upload credit in B3.

Asserted at the source level: the alternative is driving a live Apple/Spotify transfer, which tests
their infrastructure rather than our rule.
"""

import re
from pathlib import Path

import pytest

CONTROLLERS = Path(__file__).resolve().parents[3] / "app" / "controllers"

TRANSFERS = {
    "apple": "apple_music_transfer_controller.py",
    "spotify": "spotify_transfer_controller.py",
}


def _code(name: str) -> str:
    """Comments explain the rule using the same call names — match on code only."""
    src = (CONTROLLERS / TRANSFERS[name]).read_text()
    return re.sub(r"^\s*#.*$", "", src, flags=re.M)


@pytest.mark.parametrize("platform", sorted(TRANSFERS))
class TestBothTransfersAreMetered:
    def test_the_daily_allowance_is_checked(self, platform):
        code = _code(platform)
        assert "EXPORTS_PER_DAY" in code
        assert "peek_allowed(" in code

    def test_the_check_runs_before_the_transfer_starts(self, platform):
        """After the plan gate, before any third-party API call — a user over their limit should
        not have a playlist created on Apple's side and then be told no."""
        code = _code(platform)
        assert code.index("peek_allowed(") < code.index("record_use(")

    def test_the_charge_happens_only_on_success(self, platform):
        """`record_use` must sit inside the success path, after the transfer returned. Every
        exception handler is below it, so a failed transfer is never charged."""
        code = _code(platform)
        charge = code.index("record_use(")
        assert charge < code.index("except ValueError")

    def test_no_refund_path_was_introduced(self, platform):
        """Record-on-success means there is nothing to reverse. A refund appearing here would mean
        someone reintroduced charge-on-acceptance."""
        assert "refund(" not in _code(platform)

    def test_denial_uses_the_shared_402_contract(self, platform):
        """Not a bespoke error shape — the frontend switches on one code for every export path."""
        code = _code(platform)
        assert "EXPORT_LIMIT_REACHED" in code
        assert "quota_denied_response(" in code

    def test_the_plan_gate_still_runs_first(self, platform):
        """The allowance is about *how often*; `check_export` is about *whether at all*. Checking
        the allowance first would tell someone their limit resets tomorrow for a destination their
        plan will never include."""
        code = _code(platform)
        assert code.index("check_export(") < code.index("peek_allowed(")
