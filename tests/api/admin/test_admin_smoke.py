"""
Admin end-to-end smoke test — hits EVERY /api/v1/admin route through the real stack
(no controller mocks) with a full-permission admin token, and asserts none return a 5xx.

Why: the mocked admin workflow tests patch the controller, so they never execute the real
controller -> service -> repository -> DB path. That is exactly how bugs like the
`playlist_uuid` NameError and the contact/playlist method mismatches slipped through. This
exercises those paths for real:

  • GET    — run fully (list endpoints with defaults; detail endpoints with a non-existent id).
  • DELETE — run fully against a non-existent id (safe: nothing to delete -> 404/no-op).
  • POST/PUT/PATCH — sent an empty body (required fields -> 422 before the controller; all-optional
                     or id-scoped -> controller runs its not-found path). Genuinely side-effectful
                     actions (index rebuild, job/ingestion triggers, SFTP provisioning, Stripe,
                     track set-live/stop, webhook create/retry) are SKIPPED so the test causes
                     no external work or destructive mutation.

A 5xx from any of these means an unhandled crash (NameError/AttributeError/bad query/…) — a bug.
"""

import re
import uuid as uuidlib

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app

ADMIN_PREFIX = "/api/v1/admin"

# Side-effectful POST/PUT/PATCH we must not actually trigger (external calls / real jobs / mutations
# that empty-body validation would not stop). Matched as substrings against the route path.
_DENY_WRITE = (
    "/similarity/rebuild-index",
    "/ingestion/trigger",
    "/ingestion/logs",          # {log_id}/retry
    "/processing/jobs",         # embeddings / {stage} / pause / resume
    "/sftp",                    # provision / retry / limits
    "/stripe/checkout",
    "/tracks/stop-batch",
    "/set-live",
    "/stop",
    "/webhooks",                # create / update / retry
)


def _fill_path(path: str) -> str:
    """Replace {param} placeholders with non-existent sentinels (numeric for *_id, uuid otherwise)."""
    def repl(m):
        name = m.group(1)
        if name == "id" or name.endswith("_id"):
            return "999999999"
        if "uuid" in name:
            return str(uuidlib.uuid4())
        return "nonexistent-" + uuidlib.uuid4().hex[:8]
    return re.sub(r"\{([^}]+)\}", repl, path)


def _collect_admin_routes():
    seen = set()
    out = []
    for r in app.routes:
        path = getattr(r, "path", None)
        methods = getattr(r, "methods", None)
        if not path or not methods or not path.startswith(ADMIN_PREFIX):
            continue
        for method in sorted(methods - {"HEAD", "OPTIONS"}):
            key = (method, path)
            if key in seen:
                continue
            seen.add(key)
            out.append((method, path))
    return sorted(out)


_ADMIN_ROUTES = _collect_admin_routes()


@pytest.fixture(scope="module")
async def admin_headers():
    from tests.api.library_helpers import create_admin_user, admin_auth_headers
    return admin_auth_headers(await create_admin_user())


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_admin_routes_discovered():
    # Guard: if routing changes drop admin routes, fail loudly rather than pass vacuously.
    assert len(_ADMIN_ROUTES) >= 80, f"only found {len(_ADMIN_ROUTES)} admin routes"


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path", _ADMIN_ROUTES, ids=[f"{m} {p}" for m, p in _ADMIN_ROUTES])
async def test_admin_endpoint_no_5xx(method, path, admin_headers):
    is_write = method in {"POST", "PUT", "PATCH"}
    if is_write and any(s in path for s in _DENY_WRITE):
        pytest.skip("side-effectful write endpoint — not invoked by smoke test")

    url = _fill_path(path)
    kwargs = {"headers": admin_headers}
    if is_write:
        kwargs["json"] = {}  # empty body -> 422 (validation) or controller not-found path

    async with _client() as ac:
        resp = await ac.request(method, url, **kwargs)

    assert resp.status_code < 500, (
        f"{method} {path} -> {resp.status_code}\n{resp.text[:800]}"
    )


# Mutation endpoints need a VALID body to get past validation and actually run the
# controller -> service -> repository path. We aim them at non-existent ids so they hit the
# not-found branch (safe: no real mutation) — but still execute the code where AttributeError /
# NameError-type bugs live (exactly how `mark_contact_status_admin` and `delete_contact_admin`
# were failing). Each must return a clean 4xx, never a 5xx.
_MUTATIONS = [
    ("POST",  "/api/v1/admin/contact/mark-status/999999999", {"status": "resolved"}),
    ("POST",  "/api/v1/admin/contact/batch-delete", {"ids": [999999999]}),
    ("PATCH", "/api/v1/admin/feedback/999999999/status", {"status": "resolved"}),
    ("POST",  "/api/v1/admin/feedback/batch-delete", {"ids": [999999999]}),
    ("POST",  "/api/v1/admin/waitlist/update-status/999999999", {"status": "approved"}),
    ("POST",  "/api/v1/admin/waitlist/batch-delete", {"ids": [999999999]}),
    ("PATCH", "/api/v1/admin/playlist/999999999/visibility", {"is_public": True}),
    ("POST",  "/api/v1/admin/playlist/batch-delete", {"ids": [999999999]}),
    ("POST",  "/api/v1/admin/playlist/batch-visibility", {"ids": [999999999], "is_public": True}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,body", _MUTATIONS, ids=[f"{m} {p}" for m, p, _ in _MUTATIONS])
async def test_admin_mutation_no_5xx(method, path, body, admin_headers):
    async with _client() as ac:
        resp = await ac.request(method, path, headers=admin_headers, json=body)
    assert resp.status_code < 500, f"{method} {path} -> {resp.status_code}\n{resp.text[:800]}"
