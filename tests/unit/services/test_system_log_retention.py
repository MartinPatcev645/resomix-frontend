"""
`system_logs` retention
=======================

Deleting rows on a timer is the kind of job that is either boringly correct or a genuine incident,
so the properties pinned here are the ones with teeth:

* **`days <= 0` must never mean "delete everything".** 0 is the documented "disabled" value in
  config. A reading that emptied the table would be a catastrophic misinterpretation of a default.
* **A dry run writes nothing.** It is what an operator uses to decide whether to run it for real.
* **Batching terminates.** A delete loop that cannot end is worse than one that deletes too little.
* **Only rows past the cutoff are touched.** The cutoff is the entire safety mechanism — this
  table has no `user_id`, so time is the only handle anything has on it.

No database: the session is a stub that records the statements it was given.

See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §5.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.prune_system_logs import prune  # noqa: E402


class _Session:
    """Records every statement, answers the COUNT, and drains `remaining` in DELETE batches."""

    def __init__(self, *, due: int = 0, batch: int = 1000):
        self.due = due
        self.remaining = due
        self.batch = batch
        self.statements: list[str] = []
        self.params: list[dict] = []
        self.commits = 0

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        self.statements.append(sql)
        self.params.append(params or {})
        result = MagicMock()

        if "COUNT(*)" in sql:
            result.scalar.return_value = self.due
            return result

        # DELETE ... LIMIT :n
        n = min((params or {}).get("n", self.batch), self.remaining)
        self.remaining -= n
        result.rowcount = n
        return result

    async def commit(self):
        self.commits += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.fixture
def session(monkeypatch):
    """Installs a stub `AsyncSessionLocal`, and hands the test the session it will hand the job."""
    made: list[_Session] = []

    def _install(**kwargs):
        stub = _Session(**kwargs)
        made.append(stub)
        monkeypatch.setattr(
            "database.connection.AsyncSessionLocal", lambda: stub, raising=False
        )
        return stub

    yield _install


# --------------------------------------------------------------------------- #
# The refusal
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("days", [0, -1, -365])
@pytest.mark.asyncio
async def test_a_non_positive_window_deletes_nothing(days, session) -> None:
    """`SYSTEM_LOG_RETENTION_DAYS=0` disables pruning. If that were read as a cutoff of "now",
    the first scheduled run would empty the table."""
    stub = session(due=5_000)

    result = await prune(days)

    assert result["skipped"] is True
    assert result["deleted"] == 0
    assert stub.statements == []  # not even a count — it never opened the door


# --------------------------------------------------------------------------- #
# Dry run
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_dry_run_counts_and_writes_nothing(session) -> None:
    stub = session(due=1_234)

    result = await prune(90, dry_run=True)

    assert result["due"] == 1_234
    assert result["deleted"] == 0
    assert stub.commits == 0
    assert not any("DELETE" in s for s in stub.statements)


@pytest.mark.asyncio
async def test_the_cutoff_is_the_configured_number_of_days_back(session) -> None:
    """The cutoff is the whole safety mechanism, so it is asserted rather than assumed."""
    stub = session(due=1)
    before = datetime.utcnow()

    await prune(30, dry_run=True)

    cutoff = stub.params[0]["cutoff"]
    expected = before - timedelta(days=30)
    assert abs((cutoff - expected).total_seconds()) < 5
    # And every statement is scoped by it — nothing runs unbounded.
    assert all("created_at < :cutoff" in s for s in stub.statements if "system_logs" in s)


# --------------------------------------------------------------------------- #
# Deleting
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_nothing_due_means_no_delete_is_issued(session) -> None:
    """The steady state. After the first run clears the backlog, every subsequent daily run should
    be a single cheap count."""
    stub = session(due=0)

    result = await prune(90)

    assert result["deleted"] == 0
    assert not any("DELETE" in s for s in stub.statements)
    assert stub.commits == 0


@pytest.mark.asyncio
async def test_a_backlog_is_cleared_in_batches_and_terminates(session) -> None:
    """10,000 rows at 500 a batch: all of them go, and the loop ends."""
    stub = session(due=10_000)

    result = await prune(90, batch_size=500)

    assert result["deleted"] == 10_000
    assert result["batches"] == 20
    assert stub.remaining == 0
    assert "hit_batch_limit" not in result


@pytest.mark.asyncio
async def test_each_batch_commits_so_an_interrupted_run_keeps_its_progress(session) -> None:
    """A single transaction around a multi-million-row delete is how a maintenance job becomes an
    outage. Committing per batch also means Ctrl-C loses at most one batch."""
    stub = session(due=3_000)

    await prune(90, batch_size=1_000)

    # One commit per batch, plus the final empty batch that ends the loop.
    assert stub.commits >= 3


@pytest.mark.asyncio
async def test_a_partial_final_batch_is_handled(session) -> None:
    """2,500 rows at 1,000 a batch — the last one is short, which is where an off-by-one lives."""
    stub = session(due=2_500)

    result = await prune(90, batch_size=1_000)

    assert result["deleted"] == 2_500
    assert stub.remaining == 0
