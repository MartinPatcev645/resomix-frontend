"""Loop-bound pools must be reset between Celery tasks.

Each task runs in a FRESH event loop. Any process-wide async pool that survives a task holds
connections bound to a loop that is now closed, so the next task's first call raises
``RuntimeError: Event loop is closed``.

This is not hypothetical. On 2026-08-14 every poll-based similarity upload logged
``could not update <job_id>: Event loop is closed`` on its first Redis call, because the Redis
pool was not in the disposal list. It survived only because redis-py drops the dead connection
and the next call in the same task reconnects — if the failing call had been the one recording
the RESULT, the job would have hung until the client timed out.

No database, no Redis server, no network — the disposal hooks are stubbed.
"""
import asyncio

import pytest

from app.tasks import async_runner


@pytest.fixture
def disposals(monkeypatch):
    """Replace the real pool disposals with recorders; returns the call log."""
    calls = []

    async def _fake_engine():
        calls.append("engine")

    async def _fake_redis():
        calls.append("redis")

    monkeypatch.setattr(async_runner, "_LOOP_BOUND_RESOURCES", (_fake_engine, _fake_redis))
    return calls


def test_every_loop_bound_pool_is_disposed(disposals):
    async def work():
        return "done"

    assert async_runner.run_async_task(work()) == "done"
    assert disposals == ["engine", "redis"]


def test_redis_is_in_the_real_disposal_list():
    """The regression guard: the bug was Redis being absent from this tuple."""
    names = {fn.__name__ for fn in async_runner._LOOP_BOUND_RESOURCES}
    assert "_dispose_engine" in names
    assert "_dispose_redis" in names


def test_pools_are_disposed_even_when_the_task_raises(disposals):
    async def boom():
        raise ValueError("task failed")

    with pytest.raises(ValueError):
        async_runner.run_async_task(boom())
    # A failed task still leaves connections bound to the loop being closed.
    assert disposals == ["engine", "redis"]


def test_one_failing_disposal_does_not_skip_the_others(monkeypatch):
    """The original code nested the disposals; a raise in the first would skip the rest."""
    calls = []

    async def _bad():
        calls.append("bad")
        raise RuntimeError("pool already gone")

    async def _good():
        calls.append("good")

    monkeypatch.setattr(async_runner, "_LOOP_BOUND_RESOURCES", (_bad, _good))

    async def work():
        return 1

    assert async_runner.run_async_task(work()) == 1
    assert calls == ["bad", "good"]


def test_consecutive_tasks_each_get_a_live_loop(disposals):
    """The actual failure mode: task 2 must not inherit task 1's closed loop."""
    seen = []

    async def work():
        loop = asyncio.get_running_loop()
        seen.append(loop)
        # An await forces real loop use, not just a lookup.
        await asyncio.sleep(0)
        assert not loop.is_closed()
        return id(loop)

    first = async_runner.run_async_task(work())
    second = async_runner.run_async_task(work())

    assert first != second, "each task must get its own loop"
    assert all(loop.is_closed() for loop in seen), "loops must not leak open"
    assert disposals == ["engine", "redis", "engine", "redis"]
