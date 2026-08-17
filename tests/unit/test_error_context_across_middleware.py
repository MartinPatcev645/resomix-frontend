"""The captured exception must survive the middleware/app task boundary.

`TimingMiddleware` is a `BaseHTTPMiddleware`. Starlette runs the downstream app in a CHILD TASK
with a COPIED context, so a ContextVar REBOUND inside the app is invisible to the middleware that
reads it afterwards. `error_context` originally did exactly that, which meant `take_error()`
returned None on every request and every 5xx row on the admin Logs page said only

    POST /api/v1/billing/portal returned 502

with no exception type, no message and no traceback — for the entire life of the module. The
mechanism existed, was wired up, and captured nothing.

The fix is to MUTATE a shared dict rather than rebind the variable: copying a context copies the
reference, so both tasks see the same object. These tests pin that, because the failure mode is
invisible — nothing errors, the detail is just silently absent.
"""
import logging

import pytest
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core.error_context import install, record_current_exception, reset_error, take_error


@pytest.fixture(autouse=True)
def _installed():
    install()


def _app_with_capture(route_fn, sink: dict):
    """A middleware that resets before and takes after — exactly what TimingMiddleware does."""

    class _MW(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            reset_error()
            response = await call_next(request)
            sink["captured"] = take_error()
            return response

    app = Starlette(routes=[Route("/", route_fn)])
    app.add_middleware(_MW)
    return app


def test_exception_caught_inside_the_app_reaches_the_middleware():
    """The real shape: a controller catches, logs, and returns its own 5xx."""
    sink = {}
    logger = logging.getLogger("app.test.billing")

    async def route(request):
        try:
            raise RuntimeError("No configuration provided for the billing portal")
        except RuntimeError as exc:
            logger.error("Stripe error in billing flow: %s", exc)
            return PlainTextResponse("error", status_code=502)

    TestClient(_app_with_capture(route, sink)).get("/")

    captured = sink["captured"]
    assert captured is not None, "the middleware must see an exception captured inside the app"
    assert captured["type"] == "RuntimeError"
    assert "No configuration provided" in captured["message"]
    assert "raise RuntimeError" in captured["traceback"]


def test_a_clean_request_captures_nothing():
    sink = {}

    async def route(request):
        return PlainTextResponse("ok")

    TestClient(_app_with_capture(route, sink)).get("/")
    assert sink["captured"] is None


def test_one_requests_traceback_never_leaks_into_the_next():
    """`reset_error` must hand out a FRESH box, not clear a shared one."""
    sink = {}
    logger = logging.getLogger("app.test.billing")
    calls = {"n": 0}

    async def route(request):
        calls["n"] += 1
        if calls["n"] == 1:
            try:
                raise ValueError("first request only")
            except ValueError as exc:
                logger.error("failed: %s", exc)
        return PlainTextResponse("ok")

    app = _app_with_capture(route, sink)
    client = TestClient(app)

    client.get("/")
    assert sink["captured"]["type"] == "ValueError"

    client.get("/")   # clean request
    assert sink["captured"] is None, "a later request must not inherit an earlier traceback"


def test_first_exception_wins():
    """The original cause beats whatever a cleanup path raised on the way out."""
    sink = {}
    logger = logging.getLogger("app.test.billing")

    async def route(request):
        try:
            raise KeyError("the real cause")
        except KeyError as exc:
            logger.error("primary: %s", exc)
        try:
            raise OSError("cleanup noise")
        except OSError as exc:
            logger.error("secondary: %s", exc)
        return PlainTextResponse("error", status_code=500)

    TestClient(_app_with_capture(route, sink)).get("/")
    assert sink["captured"]["type"] == "KeyError"


def test_recording_outside_a_request_is_a_no_op():
    """A background task has no box; capturing must not crash or rebind into a dead context."""
    try:
        raise RuntimeError("in a worker, no request in flight")
    except RuntimeError:
        record_current_exception()   # must not raise
    assert take_error() is None
