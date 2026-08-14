"""
Async runner for Celery tasks
=============================

A Celery prefork worker executes each task synchronously, so an async task body must be
driven by an event loop. The naive ``asyncio.run(core())`` per task is BROKEN here: the
process-wide async SQLAlchemy engine (``database.connection.async_engine``) binds its
connection-pool primitives to the FIRST event loop that uses it. ``asyncio.run`` creates a
NEW loop each task and closes it on return, so the 2nd task fails with
``RuntimeError: <Queue ...> is bound to a different event loop``.

``run_async_task`` fixes this by running the coroutine in a fresh loop and DISPOSING the
loop-bound resources inside that same loop afterward — resetting their pools so the next
task's loop gets fresh, correctly-bound ones. (Disposing inside the binding loop is safe;
disposing across loops is what fails.)

**Every process-wide async connection pool has to be listed here**, not just SQLAlchemy's.
The Redis pool (``app.db.redis._redis_pool``) was missed when it was added, and the poll-based
similarity upload was the first task to use it: on 2026-08-14 every job logged
``could not update <job_id>: Event loop is closed`` on its first Redis call, because that call
drew a connection created in a previous task's now-closed loop. It happened to be survivable —
redis-py discarded the dead connection, so the *next* call in the same task reconnected on the
live loop and the job still finished — but only by luck. Had the failing call been the one that
records the RESULT rather than the one that records "running", the job would have sat unfinished
until the client gave up: a completed playlist the user never receives, which is the exact
failure the poll-based upload exists to prevent.
"""

import asyncio
from typing import Any, Coroutine

from database.connection import async_engine


async def _dispose_engine() -> None:
    await async_engine.dispose()


async def _dispose_redis() -> None:
    # Imported lazily so this module stays importable in contexts that never touch Redis.
    from app.db.redis import close_redis_pool

    await close_redis_pool()


# Order is not significant — these are independent pools. Add to this list whenever a new
# process-wide async pool appears, or it will fail exactly as Redis did.
_LOOP_BOUND_RESOURCES = (_dispose_engine, _dispose_redis)


def run_async_task(coro: Coroutine) -> Any:
    """Run ``coro`` to completion in a fresh event loop, disposing loop-bound pools after."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        # Each disposal is independent: one failing must not leave the others bound to a loop
        # that is about to close, or the next task inherits the very bug this prevents.
        for dispose in _LOOP_BOUND_RESOURCES:
            try:
                loop.run_until_complete(dispose())
            except Exception:
                pass
        loop.close()
        asyncio.set_event_loop(None)
