"""
Request-scoped capture of the last exception, so a 5xx is never a dead end
=========================================================================

THE PROBLEM

Almost every controller in this codebase does the same thing:

    except Exception as e:
        logger.error(f"Error doing X: {e}")
        return JSONResponse(500, {"error": "Failed to do X"})

The exception is caught, so it never reaches FastAPI's exception handlers. The middleware's 5xx
safety net then records the only thing still available to it — the method, the path and the status
— which is how the admin Logs page ends up showing:

    POST /api/v1/admin/users/…/plan-grant returned 500

and nothing else. No exception type, no message, no traceback. The person reading it learns
nothing they did not already know from the failed request.

THE FIX, WITHOUT TOUCHING EVERY ENDPOINT

``ExceptionCaptureFilter`` is installed on the root logger. A logging filter runs **inside** the
`except` block that emitted the record — which is the one moment `traceback.format_exc()` still
returns the live traceback. So any `logger.error(...)` made while handling an exception leaves the
type, message and traceback in a context variable, whether or not that call site passed
``exc_info``.

The middleware then attaches it to the 5xx row. Every endpoint benefits, including ones written
before this existed and ones written after by someone who has never read it.

Scoped per request via ``contextvars``, so concurrent requests cannot read each other's failures.
"""

from __future__ import annotations

import logging
import sys
import traceback
from contextvars import ContextVar
from typing import Any, Dict, Optional

# Set by the filter below; read and cleared by the middleware when it writes the 5xx row.
_last_error: ContextVar[Optional[Dict[str, Any]]] = ContextVar("_last_error", default=None)


def record_current_exception() -> None:
    """Capture whatever exception is currently being handled, if any.

    Safe to call anywhere. Outside an ``except`` block ``sys.exc_info()`` is empty and this does
    nothing, so it can be wired into a code path that only *sometimes* runs during a failure.

    Keeps the FIRST exception of the request rather than the last: the original cause is more
    useful than whatever a cleanup path raised on the way out.
    """
    exc_type, exc_value, _tb = sys.exc_info()
    if exc_type is None:
        return
    if _last_error.get() is not None:
        return
    try:
        _last_error.set(
            {
                "type": exc_type.__name__,
                "message": str(exc_value)[:2000],
                "traceback": traceback.format_exc()[:12000],
            }
        )
    except Exception:  # noqa: BLE001 — capturing diagnostics must never itself fail a request
        pass


def take_error() -> Optional[Dict[str, Any]]:
    """Read and clear the captured exception."""
    value = _last_error.get()
    if value is not None:
        _last_error.set(None)
    return value


def reset_error() -> None:
    """Clear at the start of a request.

    Worker threads and tasks can inherit a context, so without this a later request could report a
    traceback belonging to an earlier one — a misleading log is worse than a missing one.
    """
    _last_error.set(None)


class ExceptionCaptureHandler(logging.Handler):
    """Captures the live traceback whenever anything logs an ERROR during exception handling.

    A HANDLER, not a filter. A filter attached to a Logger only runs for records logged directly
    to that logger — records from child loggers (`logging.getLogger(__name__)`, i.e. every module
    in this codebase) propagate to the root logger's HANDLERS but never touch its filters. A filter
    on the root logger therefore captured nothing at all, which is exactly the trap this comment
    exists to stop someone re-entering.

    ``emit`` runs synchronously at the log call site, so it is still inside the ``except`` block —
    the only moment ``traceback.format_exc()` has anything to return.

    Emits nothing itself: it observes and returns.
    """

    def __init__(self) -> None:
        super().__init__(level=logging.ERROR)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            record_current_exception()
        except Exception:  # noqa: BLE001 — never let diagnostics break a request
            pass


def install() -> None:
    """Attach the capture handler to the root logger. Idempotent.

    Safe to call before or after logging is configured: it hangs off the root logger itself, not
    off whichever handlers happen to exist at the time.
    """
    root = logging.getLogger()
    if any(isinstance(h, ExceptionCaptureHandler) for h in root.handlers):
        return
    root.addHandler(ExceptionCaptureHandler())
