"""
Quota denial contract (pricing v2.1)
====================================

Every gated endpoint answers denials in one shape so the frontend can pick its modal from a single
field. Two things here are easy to break by accident and expensive when broken:

  * ``error`` must stay a HUMAN SENTENCE. The frontend renders it directly
    (``apiError.error`` → ``errorMessage`` in ``packages/api-client/src/utils.ts``), so putting a
    machine code there literally shows users the words "quota_exceeded".
  * ``resets_at`` must carry an explicit UTC offset. Without one the browser reads it as local
    time and shows a reset hour that is wrong by the visitor's offset.

Pure unit tests: no database, no Redis.
"""

import json
from datetime import datetime, timezone

from app.services.entitlement_gate import GateResult, REASON_LOGIN, REASON_UPGRADE
from app.utils.quota_response import (
    EXPORT_LIMIT_REACHED,
    LIBRARY_FULL,
    PLAN_REQUIRED,
    QUOTA_EXCEEDED,
    plan_required_response,
    quota_denied_response,
)


def _body(response):
    return json.loads(response.body)


def _denied(**kw):
    base = dict(
        reason=REASON_UPGRADE,
        cta="Upgrade your plan for more.",
        limit=3,
        count=3,
        metric="search_playlists_per_month",
        resets_at=datetime(2026, 8, 6, 0, 0, 0),
    )
    base.update(kw)
    return GateResult(False, **base)


class TestStatusCode:
    def test_quota_denial_is_402_not_403(self):
        """403 means "you may not"; a quota denial means "you may, but not right now".

        The frontend needs to tell an upsell apart from a permission error without parsing prose.
        """
        assert quota_denied_response(_denied(), message="x").status_code == 402

    def test_402_is_distinct_from_the_429_used_for_rate_limiting(self):
        # 402 = "you've used your allowance"; 429 = "you're going too fast". Different messages.
        assert quota_denied_response(_denied(), message="x").status_code != 429


class TestErrorAndCodeAreSeparate:
    def test_error_carries_the_human_sentence(self):
        msg = "You've used today's 3 free sonic searches."
        assert _body(quota_denied_response(_denied(), message=msg))["error"] == msg

    def test_machine_code_is_not_in_the_error_field(self):
        """Regression guard for the whole reason `code` exists — see module docstring."""
        body = _body(quota_denied_response(_denied(), message="You've used today's searches."))
        assert body["error"] != QUOTA_EXCEEDED
        assert body["code"] == QUOTA_EXCEEDED

    def test_existing_reason_is_preserved_for_current_consumers(self):
        """`useAccess` / `GateCtaModal` already switch on `reason`; it must keep working."""
        assert _body(quota_denied_response(_denied(), message="x"))["reason"] == REASON_UPGRADE

    def test_guest_denial_reports_login_required(self):
        gate = _denied(reason=REASON_LOGIN)
        assert _body(quota_denied_response(gate, message="x"))["reason"] == REASON_LOGIN


class TestPayload:
    def test_carries_metric_used_limit_and_upgrade_target(self):
        data = _body(quota_denied_response(_denied(), message="x"))["data"]
        assert data["metric"] == "search_playlists_per_month"
        assert data["used"] == 3
        assert data["limit"] == 3
        assert data["upgrade"] == "pro"

    def test_resets_at_has_an_explicit_utc_offset(self):
        """Naive timestamps are read as local time by the browser — the user would be told the
        wrong reset hour, off by their own offset."""
        data = _body(quota_denied_response(_denied(), message="x"))["data"]
        assert data["resets_at"].endswith("+00:00")

    def test_an_already_aware_datetime_is_not_shifted(self):
        aware = datetime(2026, 8, 6, 0, 0, 0, tzinfo=timezone.utc)
        data = _body(quota_denied_response(_denied(resets_at=aware), message="x"))["data"]
        assert data["resets_at"] == aware.isoformat()

    def test_success_is_false(self):
        assert _body(quota_denied_response(_denied(), message="x"))["success"] is False


class TestCodes:
    def test_plan_required_is_a_different_code_to_a_spent_allowance(self):
        """Waiting fixes a spent allowance; it never fixes "not on your plan". The copy and the
        modal differ, so the code must too."""
        body = _body(plan_required_response(_denied(), message="Embed sharing is a Pro feature."))
        assert body["code"] == PLAN_REQUIRED
        assert body["code"] != QUOTA_EXCEEDED

    def test_every_code_is_distinct(self):
        assert len({QUOTA_EXCEEDED, LIBRARY_FULL, EXPORT_LIMIT_REACHED, PLAN_REQUIRED}) == 4

    def test_library_and_export_codes_are_selectable(self):
        for code in (LIBRARY_FULL, EXPORT_LIMIT_REACHED):
            assert _body(quota_denied_response(_denied(), code=code, message="x"))["code"] == code
