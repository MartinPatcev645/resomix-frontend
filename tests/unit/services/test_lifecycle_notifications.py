"""
The two scheduled notifications
===============================

**Grant expiry (L1).** Expiry is read-time — `ends_at` is compared on every entitlement lookup,
with no job behind it. Nothing ever *notices* an expiry, including the person it happens to, so
today a comped user finds their features refusing to work on day 31 with no explanation.

**Pending-deletions digest (L2).** The admin queue is pull-only: it works if somebody opens it.
This is the push half, and it is the difference between a late erasure request being noticed and
being a breach.

What is pinned here is mostly about **not** sending:

* a revoked grant must not generate an "ending soon" note for something already gone;
* a scrubbed or deactivated account must never be emailed;
* the digest must stay silent when nothing is due, or it becomes a daily mail people filter away —
  and the one day it matters, it goes unread;
* the ending-soon and ended notices must each go out exactly once, per grant.

No database: the session is a stub answering the two queries.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.notify_pending_deletions import collect  # noqa: E402

NOW = datetime.utcnow()


# --------------------------------------------------------------------------- #
# L2 — the digest's arithmetic and its silence
# --------------------------------------------------------------------------- #

class _DeletionSession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, stmt, params=None):
        result = MagicMock()
        result.mappings.return_value.all.return_value = self.rows
        return result


def _pending(days_ago: int, email="someone@example.com"):
    return {
        "uuid": f"uuid-{days_ago}",
        "email": email,
        "name": "Some One",
        "username": "someone",
        "deletion_requested_at": NOW - timedelta(days=days_ago, hours=1),
    }


@pytest.mark.asyncio
async def test_the_digest_counts_overdue_and_approaching_separately() -> None:
    """They call for different actions — one needs the scrub run, the other an extension notice —
    so collapsing them into "N waiting" would hide the distinction that matters."""
    db = _DeletionSession([_pending(2), _pending(21), _pending(35)])

    state = await collect(db, sla_days=30)

    assert state["total"] == 3
    assert state["overdue"] == 1     # 35 days
    assert state["approaching"] == 1  # 21 days, past two-thirds of 30
    assert state["items"][0]["waiting_days"] == 2


@pytest.mark.asyncio
async def test_nothing_due_means_nothing_is_flagged() -> None:
    """Three fresh requests are not a problem, and the digest must not manufacture one."""
    db = _DeletionSession([_pending(1), _pending(3), _pending(5)])

    state = await collect(db, sla_days=30)

    assert state["total"] == 3
    assert state["overdue"] == 0 and state["approaching"] == 0


@pytest.mark.asyncio
async def test_the_thresholds_match_the_admin_queue_exactly() -> None:
    """The digest and the screen must never disagree about whether something is late.

    Same arithmetic, asserted in both places, because the two are computed by different code and
    the day they diverge is the day someone trusts the wrong one.
    """
    db = _DeletionSession([_pending(19), _pending(20), _pending(29), _pending(30)])

    items = (await collect(db, sla_days=30))["items"]

    assert [i["approaching"] for i in items] == [False, True, True, False]
    assert [i["overdue"] for i in items] == [False, False, False, True]


@pytest.mark.asyncio
async def test_a_request_made_today_reads_as_zero_days() -> None:
    db = _DeletionSession([_pending(0)])

    assert (await collect(db, sla_days=30))["items"][0]["waiting_days"] == 0


@pytest.mark.asyncio
async def test_the_digest_stays_quiet_when_nothing_is_due(monkeypatch) -> None:
    """A daily "nothing to do" email is one people learn to ignore, and the day it says something
    different is the day it gets deleted unread. Silence has to mean something."""
    from scripts import notify_pending_deletions as mod

    sent = []

    class _Svc:
        async def send_pending_deletions_digest(self, **kw):
            sent.append(kw)
            return True

    session = _DeletionSession([_pending(1), _pending(2)])
    monkeypatch.setattr(
        "database.connection.AsyncSessionLocal",
        lambda: _ctx(session),
        raising=False,
    )
    monkeypatch.setattr("app.services.email_service.EmailService", lambda: _Svc())

    result = await mod.run()

    assert result["quiet"] is True
    assert result["sent"] == 0
    assert sent == []


@pytest.mark.asyncio
async def test_the_digest_sends_when_something_is_overdue(monkeypatch) -> None:
    from scripts import notify_pending_deletions as mod

    sent = []

    class _Svc:
        async def send_pending_deletions_digest(self, **kw):
            sent.append(kw)
            return True

    class _WithAdmins(_DeletionSession):
        async def execute(self, stmt, params=None):
            result = MagicMock()
            rows = (
                [{"email": "admin@resomix.com", "name": "Admin", "username": "admin"}]
                if "user_roles" in str(stmt)
                else self.rows
            )
            result.mappings.return_value.all.return_value = rows
            return result

    monkeypatch.setattr(
        "database.connection.AsyncSessionLocal",
        lambda: _ctx(_WithAdmins([_pending(40)])),
        raising=False,
    )
    monkeypatch.setattr("app.services.email_service.EmailService", lambda: _Svc())

    result = await mod.run()

    assert result["quiet"] is False
    assert result["sent"] == 1
    assert sent[0]["overdue"] == 1
    # Asserted against the SETTING, not a literal. The value differs per environment
    # (`localhost:5175` in dev, `r-admin.resomix.com` in prod), so pinning a string would make this
    # pass or fail depending on which .env was loaded.
    #
    # The property that matters is that the digest uses the setting at all: the first version
    # derived the host from `app_url` by string surgery, which produced a dead link — the admin
    # surface is `r-admin.`, not `admin.`.
    from app.core.config import settings

    assert sent[0]["admin_url"] == settings.admin_url


class _ctx:
    """Minimal async context manager around a stub session."""

    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *exc):
        return False


# --------------------------------------------------------------------------- #
# L1 — who the grant notices reach, and how often
# --------------------------------------------------------------------------- #

def test_the_grant_queries_exclude_revoked_and_departed_accounts() -> None:
    """Asserted against the SQL because these are the conditions that decide whether a *wrong*
    email goes out, and each was a deliberate addition:

    * `revoked_at IS NULL` — a revoked grant must not warn about something already gone;
    * `is_active = 1` — a deactivated account should not be told its comp is ending;
    * `anonymized_at IS NULL` — a scrubbed account has a placeholder address, and mailing it would
      be both pointless and a small betrayal of the deletion we confirmed.
    """
    source = (Path(__file__).resolve().parents[3] / "scripts" / "notify_expiring_grants.py").read_text()

    assert "g.revoked_at IS NULL" in source
    assert "u.is_active = 1" in source
    assert "u.anonymized_at IS NULL" in source


def test_the_lookback_window_is_wider_than_a_day() -> None:
    """A missed run must not skip people permanently.

    There is no second chance to tell someone their plan ended, so the "it expired" query looks
    back over a window rather than at a single date — a reboot or a failed timer then catches up
    instead of silently losing everyone in that gap.
    """
    from scripts.notify_expiring_grants import LOOKBACK_DAYS, WARN_DAYS

    assert LOOKBACK_DAYS > 1
    assert WARN_DAYS >= 1


def test_the_dedupe_key_is_per_grant_not_per_user() -> None:
    """Someone comped twice must be told twice.

    Keying on the user would silently swallow the second notice, and the failure would look exactly
    like a working system.
    """
    source = (Path(__file__).resolve().parents[3] / "scripts" / "notify_expiring_grants.py").read_text()

    assert 'f"grant_{kind}:{row[\'grant_id\']}"' in source
    assert "IntegrityError" in source, "the unique index must be the guard, not a read-then-write check"


@pytest.mark.parametrize(
    "template, context",
    [
        (
            "grant_expiring_soon.html",
            {"name": "Alex", "plan_name": "Pro", "days_left": 3, "ends_on": "13 August 2026",
             "app_url": "https://resomix.com"},
        ),
        (
            "grant_expired.html",
            {"name": "Alex", "plan_name": "Pro", "ends_on": "10 August 2026",
             "app_url": "https://resomix.com"},
        ),
        (
            "admin_pending_deletions_digest.html",
            {"name": "Admin", "total": 2, "overdue": 1, "approaching": 1, "sla_days": 30,
             "admin_url": "https://r-admin.resomix.com",
             "items": [{"email": "a@b.c", "requested_on": "1 Jul 2026", "waiting_days": 40,
                        "overdue": True}]},
        ),
    ],
)
def test_the_new_templates_render(template, context) -> None:
    from app.services.email_service import jinja_env

    html = jinja_env.get_template(template).render(**context)

    assert "{{" not in html
    assert len(html) > 500


def test_the_expiry_notices_do_not_imply_anything_was_taken_away() -> None:
    """A comp ending is a gift running its course, not a loss — and nothing IS deleted. Copy that
    says otherwise would both misinform and make a returning subscriber less likely."""
    from app.services.email_service import jinja_env

    html = jinja_env.get_template("grant_expired.html").render(
        name="Alex", plan_name="Pro", ends_on="10 August 2026", app_url="https://resomix.com"
    )

    assert "still here" in html
    assert "nothing has been deleted" in html.lower()
    for phrase in ("you will lose", "removed your", "deleted your"):
        assert phrase not in html.lower()
