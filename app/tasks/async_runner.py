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
async engine inside that same loop afterward — resetting the pool so the next task's loop
gets a fresh, correctly-bound one. (Disposing inside the binding loop is safe; disposing
across loops is what fails.)
"""

import asyncio
from typing import Any, Coroutine

from database.connection import async_engine


def run_async_task(coro: Coroutine) -> Any:
    """Run ``coro`` to completion in a fresh event loop, disposing the async engine after."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(async_engine.dispose())
        except Exception:
            pass
        finally:
            loop.close()
            asyncio.set_event_loop(None)
