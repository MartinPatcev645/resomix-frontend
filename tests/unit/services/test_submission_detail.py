"""
Submission detail — who actually sent this
==========================================

The admin screens now answer "who is this" alongside "what did they say". The properties worth
pinning down are all about **not overstating what we know**:

* A guest must not be dressed up as an account. An anonymous form fill and a paying customer
  render from the same component, and the only thing keeping them apart is ``matched_account``.
* Matching a guest to an account **by email is an inference**, not a verified session. If
  ``matched_by_email`` were ever wrong, an admin would read "Account · Pro" over a message from
  someone who merely typed a subscriber's address into a public form.
* A failure in an *accessory* lookup — the plan, the history counts, prior replies — must degrade
  that one line, never take the panel down. The message is the point; the trimmings are not.

No database: the queries run through a stub that records what was asked for.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.submission_detail_service import SubmissionDetailService

NOW = datetime(2026, 8, 8, 12, 0, 0)


def _user(user_id=42, email="someone@example.com", active=True):
    """The REAL User model.

    A MagicMock answers to any attribute, which is how a field that does not exist passes in a
    test and raises AttributeError in production. The real model makes a typo fail here.
    """
    from app.models.user import User

    u = User()
    u.id = user_id
    u.uuid = f"uuid-{user_id}"
    u.email = email
    u.username = "someone"
    u.name = "Some One"
    u.is_active = active
    u.is_email_verified = True
    u.created_at = NOW
    return u


def _db(user=None, counts=(3, 1), raise_on_count=False):
    """A session that returns ``user`` for the User lookup and ``counts`` for the totals query."""
    db = MagicMock()

    async def execute(stmt, params=None):
        result = MagicMock()
        if params is not None:  # the raw counts query is the only one taking bind params
            if raise_on_count:
                raise RuntimeError("counts table is missing")
            row = {"contacts": counts[0], "feedbacks": counts[1]}
            result.mappings.return_value.first.return_value = row
            return result
        result.scalar_one_or_none.return_value = user
        result.scalars.return_value.all.return_value = [user] if user else []
        return result

    db.execute = AsyncMock(side_effect=execute)
    return db


@pytest.fixture(autouse=True)
def _no_plan_lookup(monkeypatch):
    """Stub the entitlement lookup by default — it is exercised explicitly where it matters."""
    plan = MagicMock()
    plan.code, plan.name = "pro", "Pro"
    monkeypatch.setattr(
        "app.services.entitlement_service.EntitlementService.get_effective_plan",
        AsyncMock(return_value=plan),
    )


# --------------------------------------------------------------------------- #
# Guest vs account
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_an_unmatched_guest_is_reported_as_a_guest_and_nothing_more() -> None:
    """No name, no plan, no counts.

    The shape is deliberately not padded out to look like an account: "we do not know who this
    was" is the honest answer, and half-filling the fields would invite an admin to trust it.
    """
    out = await SubmissionDetailService().submitter(_db(user=None), user_id=None)

    assert out == {"type": "guest", "matched_account": False}


@pytest.mark.asyncio
async def test_a_signed_in_submission_resolves_the_account() -> None:
    out = await SubmissionDetailService().submitter(_db(user=_user()), user_id=42)

    assert out["type"] == "account"
    assert out["matched_account"] is True
    assert out["matched_by_email"] is False  # a real session, not an inference
    assert out["email"] == "someone@example.com"
    assert out["plan"] == {"code": "pro", "name": "Pro"}


@pytest.mark.asyncio
async def test_matching_a_guest_by_email_is_flagged_as_an_inference() -> None:
    """Someone who wrote in signed-out is very likely the account with that address — but the UI
    has to be able to say "likely", and it can only do that if this flag is right."""
    out = await SubmissionDetailService().submitter(
        _db(user=_user()), user_id=None, fallback_email="someone@example.com"
    )

    assert out["matched_account"] is True
    assert out["matched_by_email"] is True
    # Still typed as a guest: they were not authenticated when they submitted.
    assert out["type"] == "guest"


@pytest.mark.asyncio
async def test_a_guest_email_matching_nobody_stays_a_guest() -> None:
    out = await SubmissionDetailService().submitter(
        _db(user=None), user_id=None, fallback_email="nobody@example.com"
    )

    assert out["matched_account"] is False


@pytest.mark.asyncio
async def test_feedback_never_email_matches() -> None:
    """Feedback carries no email of its own, so there is nothing to match a guest on — and
    inventing one from elsewhere would attribute an anonymous message to a real person."""
    svc = SubmissionDetailService()
    row = MagicMock()
    row.id, row.user_id, row.status = 5, None, "open"
    row.category, row.message, row.satisfaction, row.recommendation = "general", "hi", 8, 9
    row.submitted_at = NOW
    row.client_ip, row.user_agent = "203.0.113.9", "Mozilla/5.0"

    db = _db(user=_user())
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result)

    with pytest_monkeypatched_replies():
        out = await svc.feedback(db, 5)

    assert out["submitter"]["matched_account"] is False


# --------------------------------------------------------------------------- #
# Degrading rather than failing
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_broken_plan_lookup_leaves_the_rest_of_the_panel_intact(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.entitlement_service.EntitlementService.get_effective_plan",
        AsyncMock(side_effect=RuntimeError("plans table is mid-migration")),
    )

    out = await SubmissionDetailService().submitter(_db(user=_user()), user_id=42)

    assert out["matched_account"] is True
    assert out["email"] == "someone@example.com"
    assert out["plan"] is None  # the one line that could not be filled


@pytest.mark.asyncio
async def test_unavailable_counts_report_minus_one_rather_than_a_false_zero() -> None:
    """Zero means "they have never written in before", which is a real and useful statement.
    A failed query must not be able to say it."""
    out = await SubmissionDetailService().submitter(
        _db(user=_user(), raise_on_count=True), user_id=42
    )

    assert out["total_contacts"] == -1
    assert out["total_feedbacks"] == -1


@pytest.mark.asyncio
async def test_counts_are_carried_through_when_they_work() -> None:
    out = await SubmissionDetailService().submitter(_db(user=_user(), counts=(4, 2)), user_id=42)

    assert (out["total_contacts"], out["total_feedbacks"]) == (4, 2)


# --------------------------------------------------------------------------- #
# Batched resolution for the list screens
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_resolving_a_page_of_submitters_skips_the_query_when_there_is_nothing_to_resolve() -> None:
    """A page of entirely anonymous feedback must not cost a round trip."""
    db = _db(user=None)

    out = await SubmissionDetailService.resolve_submitters(db, [None, None])

    assert out == {}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolving_a_page_returns_a_lookup_keyed_by_user_id() -> None:
    out = await SubmissionDetailService.resolve_submitters(_db(user=_user(7)), [7, 7, None])

    assert set(out) == {7}
    assert out[7]["email"] == "someone@example.com"
    assert "plan" not in out[7]  # deliberately thin — a plan per row would be a query per row


@pytest.mark.asyncio
async def test_a_failed_page_resolution_returns_empty_rather_than_raising() -> None:
    """The submitter is one column. It must never be able to take the whole list down."""
    db = MagicMock()
    db.execute = AsyncMock(side_effect=RuntimeError("connection reset"))

    assert await SubmissionDetailService.resolve_submitters(db, [1, 2]) == {}


# --------------------------------------------------------------------------- #
# Request metadata
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_rows_predating_capture_report_null_metadata_not_an_error() -> None:
    """`client_ip` and `user_agent` were added long after these tables. Every historic row has
    neither, and the detail screen has to open anyway."""
    svc = SubmissionDetailService()
    row = MagicMock(spec=[])  # no client_ip, no user_agent — an old row read by a new model
    for attr, value in (
        ("id", 3), ("user_id", None), ("status", "open"), ("contact_type", "consumer"),
        ("submitted_at", NOW), ("name", "A"), ("email", None), ("phone", None),
        ("subject", None), ("message", "hello"), ("company_name", None), ("role", None),
        ("partner_type", None), ("preferred_path", None), ("catalog_context", None),
        ("catalog_size", None), ("estimated_calls", None),
    ):
        setattr(row, attr, value)

    db = _db(user=None)
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result)

    with pytest_monkeypatched_replies():
        out = await svc.contact(db, 3)

    assert out["request"] == {"client_ip": None, "user_agent": None}


@pytest.mark.asyncio
async def test_a_missing_submission_is_none_not_an_exception() -> None:
    db = _db(user=None)
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)

    assert await SubmissionDetailService().contact(db, 999) is None
    assert await SubmissionDetailService().feedback(db, 999) is None


# --------------------------------------------------------------------------- #

def pytest_monkeypatched_replies():
    """Silence the reply-history lookup, which has its own session and its own tests."""
    from unittest.mock import patch

    return patch(
        "app.services.user_message_service.UserMessageService.history",
        AsyncMock(return_value=[]),
    )
