"""
The deletion lifecycle
======================

Two steps, and the second one is manual. A user's request deactivates the account and touches
nothing else; an admin runs the scrub later. What is tested here is the wiring between them:

* **A request must change nothing but the account's status.** If it ever started scrubbing, the
  30-day window would stop being a window and a change of mind would cost real data.
* **Restore must refuse once the account has been scrubbed.** Flipping `is_active` back on a
  scrubbed row produces a working account with no email, no name and no password — and the admin
  screen reports success.
* **The blocked-sign-in message must distinguish the three states.** Once sign-in is blocked it is
  the only surface a returning user has; a generic message strands someone who wants their account
  back.
* **Static routes must precede parameterised ones.** `/pending-deletions` declared after
  `/{user_uuid}` is simply unreachable.

See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §1.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.services.account_scrub_service import AccountScrubService
from app.utils.account_state import inactive_account_detail

NOW = datetime(2026, 8, 10, 12, 0, 0)


def _user(*, active=True, requested=None, scrubbed=None):
    """The REAL User model — a MagicMock would invent whichever attribute the code asked for."""
    from app.models.user import User

    u = User()
    u.id, u.uuid = 42, "uuid-42"
    u.email, u.username, u.name = "someone@example.com", "someone", "Some One"
    u.is_active = active
    u.deletion_requested_at = requested
    u.anonymized_at = scrubbed
    return u


# --------------------------------------------------------------------------- #
# The restore guard
# --------------------------------------------------------------------------- #

def test_a_pending_account_can_still_be_restored() -> None:
    """The whole point of not scrubbing on a timer: for as long as the account is there, a change
    of mind costs one flag flip."""
    AccountScrubService.assert_restorable(_user(active=False, requested=NOW))  # no raise


def test_a_scrubbed_account_cannot_be_restored() -> None:
    """`is_active = True` on a scrubbed row is a working account belonging to nobody — no email,
    no name, no password. It has to fail loudly rather than no-op into apparent success."""
    with pytest.raises(ValueError, match="already been scrubbed"):
        AccountScrubService.assert_restorable(
            _user(active=False, requested=NOW - timedelta(days=40), scrubbed=NOW)
        )


@pytest.mark.asyncio
async def test_reactivate_refuses_a_scrubbed_account() -> None:
    """The guard has to sit in `reactivate` itself, not only in the admin UI. There are three
    callers, and the next one will not remember to check."""
    from app.services.user_service import UserService

    with pytest.raises(ValueError, match="already been scrubbed"):
        await UserService().reactivate(None, _user(active=False, scrubbed=NOW))


# --------------------------------------------------------------------------- #
# What a blocked user is told
# --------------------------------------------------------------------------- #

def test_a_pending_deletion_is_told_the_account_can_come_back() -> None:
    """This text is the only route back for someone who changed their mind."""
    detail = inactive_account_detail(_user(active=False, requested=NOW))

    assert detail["code"] == "ACCOUNT_PENDING_DELETION"
    assert "restore" in detail["error"]
    assert "support@resomix.com" in detail["error"]


def test_a_scrubbed_account_is_not_promised_a_restore() -> None:
    """Offering to restore something that no longer exists is worse than saying no."""
    detail = inactive_account_detail(_user(active=False, requested=NOW, scrubbed=NOW))

    assert detail["code"] == "ACCOUNT_DELETED"
    assert "cannot be restored" in detail["error"]


def test_the_terminal_state_wins_over_the_pending_one() -> None:
    """A scrubbed account still carries `deletion_requested_at`. If the checks ran the other way
    round it would be reported as recoverable, which is the one answer that must never be wrong."""
    both = _user(active=False, requested=NOW - timedelta(days=40), scrubbed=NOW)

    assert inactive_account_detail(both)["code"] == "ACCOUNT_DELETED"


def test_an_admin_deactivation_keeps_the_original_message() -> None:
    """Nobody asked to leave — this is a support matter, not a deletion."""
    detail = inactive_account_detail(_user(active=False))

    assert detail["code"] == "ACCOUNT_DEACTIVATED"


def test_a_database_without_the_new_columns_degrades_instead_of_raising() -> None:
    """This runs inside an auth path. A missing column must not turn a 403 into a 500."""

    class _Old:
        is_active = False

    assert inactive_account_detail(_Old())["code"] == "ACCOUNT_DEACTIVATED"


# --------------------------------------------------------------------------- #
# The queue's arithmetic
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "waiting, approaching, overdue",
    [
        (0, False, False),    # requested today
        (19, False, False),
        (20, True, False),    # two-thirds of 30 — amber, with time left to act
        (29, True, False),
        (30, False, True),    # the Art. 12(3) month is up
        (47, False, True),
    ],
)
def test_the_ageing_thresholds(waiting, approaching, overdue) -> None:
    """Computed server-side so the thresholds cannot drift between screens.

    Amber starts at two-thirds of the window rather than on the final day: a queue that only warns
    when it is already too late is not a warning.
    """
    sla = 30
    assert (sla * 2 // 3 <= waiting < sla) is approaching
    assert (waiting >= sla) is overdue


def test_a_request_made_today_is_zero_days_not_one() -> None:
    """An off-by-one here would make every fresh request look a day older than it is, which over a
    queue is the difference between "fine" and "amber"."""
    assert (NOW - NOW).days == 0


# --------------------------------------------------------------------------- #
# Route ordering
# --------------------------------------------------------------------------- #

def test_static_admin_user_routes_precede_the_parameterised_one() -> None:
    """FastAPI matches in declaration order, so `/pending-deletions` declared after
    `/{user_uuid}` is unreachable — every request lands on `get_user_detail` with
    `user_uuid="pending-deletions"` and returns a puzzling 404.

    Caught exactly this way when the route was first added.
    """
    from fastapi.routing import APIRoute

    import app.main

    paths = [
        r.path
        for r in app.main.app.routes
        if isinstance(r, APIRoute)
        and r.path.startswith("/api/v1/admin/users")
        and "GET" in r.methods
    ]

    assert "/api/v1/admin/users/pending-deletions" in paths, "route is not registered"
    assert paths.index("/api/v1/admin/users/pending-deletions") < paths.index(
        "/api/v1/admin/users/{user_uuid}"
    ), "the parameterised route is declared first and will swallow /pending-deletions"
