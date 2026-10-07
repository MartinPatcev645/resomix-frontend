# Week 2 Implementation Plan: W2-1, W2-2, W2-3

**Roadmap Reference:** Resomix 35-Day Partner-Readiness Roadmap v3.0 — Days 8–11
**Estimated Total:** 13 hours (W2-1: 5h, W2-2: 4h, W2-3: 4h)
**Dependency:** W1-3 (`get_current_partner()`) — **DONE**

---

## Codebase Audit Summary (Current State)

Before implementing, here is what already exists and what is missing:

| Component | Exists? | Location | Gap |
|---|---|---|---|
| `PartnerUsageLog` SQLAlchemy model | ✅ Yes | `app/models/partner.py` | Full schema: `correlation_id, partner_id, api_key_id, endpoint, method, status_code, latency_ms, client_ip, user_agent, error_code` |
| `TimingMiddleware` | ✅ Yes | `app/observability.py` | Measures latency, writes to `timing.txt` only — does **not** write to DB |
| `get_current_partner()` dependency | ✅ Yes | `app/api/dependencies/partner.py` | Sets `request.state.partner_id` and `request.state.api_key_id` |
| `update_api_key_usage()` | ✅ Yes | `app/services/partner_service.py` | Updates `last_used_at/ip` on the key row only — does **not** write a `PartnerUsageLog` row |
| `LoggingService` / `system_logs` | ✅ Yes | `app/services/logging_service.py` | For general app logs; separate from partner audit trail |
| Audit-log middleware writing to `partner_usage_logs` | ❌ **Missing** | — | Core of W2-1 |
| `/api/v1/` route prefix for B2B endpoints | ❌ **Missing** | — | Core of W2-2 |
| Semver deprecation policy doc | ❌ **Missing** | — | Part of W2-2 |
| Idempotency-Key header support | ❌ **Missing** | — | Core of W2-3 |
| Redis (for idempotency cache) | ✅ Yes | `app/db/redis.py` | Already used for rate limiting |

---

## W2-1 — Per-Key Audit Log Middleware (5h)

### Goal
Every authenticated partner request (one that passes `get_current_partner()`) writes one row to `partner_usage_logs` containing: `timestamp, correlation_id, partner_id, api_key_id, endpoint, method, status_code, latency_ms, client_ip, user_agent`.

### What We Have
- `PartnerUsageLog` model is **fully defined** with all required columns. No DB migration needed (table already exists from W1-1).
- `TimingMiddleware` already captures `start` time and `response.status_code` — we can extend the pattern.
- `request.state.partner_id` and `request.state.api_key_id` are populated by `get_current_partner()` before the route handler runs.

### What We Need to Build

**1. New middleware: `app/api/middlewares/partner_audit.py`**

This middleware sits after `TimingMiddleware` in the stack. It:
1. Records `start = time.perf_counter()` before `call_next`.
2. Calls `call_next(request)`.
3. After the response, checks if `request.state` has `partner_id` and `api_key_id` (set by `get_current_partner()`). If not present, it's a non-partner/consumer request — **skip logging**.
4. If present, enqueues a background DB write to `partner_usage_logs`.

```python
# app/api/middlewares/partner_audit.py

import time
import uuid
import asyncio
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class PartnerAuditMiddleware(BaseHTTPMiddleware):
    """
    Writes one PartnerUsageLog row per authenticated partner request.
    Only fires when request.state.partner_id AND request.state.api_key_id
    are set (i.e., only after get_current_partner() succeeds).
    Consumer-facing requests are silently skipped.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()

        # Assign a correlation_id early so it can be read by route handlers
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        response = await call_next(request)

        latency_ms = round((time.perf_counter() - start) * 1000, 3)

        # Only log if this was a partner-authenticated request
        partner_id = getattr(request.state, "partner_id", None)
        api_key_id = getattr(request.state, "api_key_id", None)

        if partner_id and api_key_id:
            asyncio.create_task(
                _write_audit_log(
                    partner_id=partner_id,
                    api_key_id=api_key_id,
                    correlation_id=correlation_id,
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    client_ip=_get_ip(request),
                    user_agent=request.headers.get("user-agent", "")[:500],
                    error_code=response.headers.get("X-Error-Code"),
                )
            )

        # Expose correlation_id to the client for support tracing
        response.headers["X-Correlation-ID"] = correlation_id
        return response


def _get_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _write_audit_log(**kwargs):
    """Fire-and-forget DB write using a fresh session."""
    try:
        from database.connection import AsyncSessionLocal
        from app.models.partner import PartnerUsageLog
        from sqlalchemy import insert

        async with AsyncSessionLocal() as session:
            await session.execute(insert(PartnerUsageLog).values(**kwargs))
            await session.commit()
    except Exception as e:
        logger.error(f"[PartnerAuditMiddleware] Failed to write audit log: {e}")
```

**2. Register in `app/main.py`**

```python
# app/main.py — add import
from app.api.middlewares.partner_audit import PartnerAuditMiddleware

# Register AFTER setup_cors, BEFORE TimingMiddleware
app.add_middleware(PartnerAuditMiddleware)
app.add_middleware(TimingMiddleware)
```

> **Order matters:** Starlette middleware runs outermost-first. `PartnerAuditMiddleware` wraps `TimingMiddleware` so `partner_id` is guaranteed to be set by the time the audit write fires.

**3. Expose `correlation_id` in `get_current_partner()` fallback**

The `correlation_id` is set by the middleware. However, if `get_current_partner()` rejects the request with a 401/403, the route handler never runs and `partner_id` is never set on `request.state` — so the middleware correctly skips the DB write. Failed auth attempts are already logged to `system_logs` by the exception handler.

### Testing Checklist
- [ ] Authenticated B2B request → row appears in `partner_usage_logs` with correct `partner_id`, `api_key_id`, `status_code`, `latency_ms`.
- [ ] Consumer frontend request (no B2B key) → no row written.
- [ ] Failed auth (bad key) → no row written to `partner_usage_logs`; error visible in `system_logs`.
- [ ] `X-Correlation-ID` header present in every response.
- [ ] DB write failure (e.g., DB down) does not crash the request (fire-and-forget).

---

## W2-2 — API Versioning: `/api/v1/` Prefix for B2B Endpoints (4h)

### Goal
All B2B partner-facing endpoints are prefixed with `/api/v1/`. Consumer frontend endpoints remain unversioned. A semver deprecation policy is documented.

### Current State
Only `app/api/routers/webhooks.py` already uses `/api/v1/webhooks`. All other routers are unversioned.

### Route Classification

| Router File | Current Prefix | Action | Rationale |
|---|---|---|---|
| `similarity.py` | `/get_similarity/`, `/get_selection_similarity/`, `/segment_status/` | **Version** → `/api/v1/similarity/upload`, `/api/v1/similarity/search`, `/api/v1/similarity/segment-status/{uuid}` | Core B2B endpoint |
| `monthly_pipeline.py` | `/monthly_pipeline/` | **Version** → `/api/v1/ingest/` | B2B ingestion pipeline |
| `open_tracks_pipeline.py` | `/open_tracks_pipeline/` | **Version** → `/api/v1/ingest/open/` | B2B ingestion |
| `partner.py` | `/partner/` | **Version** → `/api/v1/partner/` | B2B identity |
| `metadata.py` | `/metadata/` | **Version** → `/api/v1/metadata/` | B2B utility |
| `admin/similarity.py` | `/similarity/` | **Version** → `/api/v1/admin/similarity/` | Admin |
| `admin/partners.py` | `/admin/partners/` | **Version** → `/api/v1/admin/partners/` | Admin |
| `admin/operation_limits.py` | `/admin/operation-limits/` | **Version** → `/api/v1/admin/operation-limits/` | Admin |
| `auth.py` | `/auth/` | **Keep** unversioned | Consumer frontend |
| `users.py` | `/users/` | **Keep** unversioned | Consumer frontend |
| `playlists.py` | `/playlists/` | **Keep** unversioned | Consumer frontend |
| `playlist_engagement.py` | `/playlist/` | **Keep** unversioned | Consumer frontend |
| `feedback.py`, `contact.py`, `waitlist.py` | `/feedback/`, `/contact/`, `/waitlist/` | **Keep** unversioned | Consumer public |
| `ratings.py` | `/ratings/` | **Keep** unversioned | Consumer frontend |
| `spotify_transfer.py`, `apple_music_transfer.py`, `tidal_transfer.py` | `/spotify/`, `/apple-music/`, `/tidal/` | **Keep** unversioned | Consumer frontend |
| `preview.py` | `/preview/` | **Keep** unversioned | Consumer frontend |
| `telemetry.py` | `/telemetry/` | **Keep** unversioned | Consumer frontend |
| `purchases.py` | `/cart`, `/checkout/` | **Keep** unversioned | Consumer frontend |
| `health.py` | `/health` | **Keep** unversioned | Public |
| `webhooks.py` | `/api/v1/webhooks/` | Already versioned ✅ | — |
| `dummy.py` | `/dummy/` | **Keep** unversioned | Dev/test only |
| `admin/feedback.py`, `admin/contact.py`, `admin/waitlist.py`, `admin/playlist.py`, `admin/promo.py`, `admin/spotify_apps.py` | `/admin/...` | **Version** → `/api/v1/admin/...` | Admin dashboard |

### Implementation Approach

**Option A — Prefix in `app/api/routers/__init__.py` (recommended)**

Rather than modifying every individual router file, apply the `/api/v1` prefix at registration time in `all_routers`. This preserves backward-compatible imports and avoids touching ~15 files:

```python
# app/api/routers/__init__.py — modified all_routers section

V1_PREFIX = "/api/v1"

# B2B / Admin routers get the versioned prefix
v1_routers = [
    (similarity_router,           V1_PREFIX),
    (monthly_pipeline_router,     f"{V1_PREFIX}/ingest"),
    (open_tracks_pipeline_router, f"{V1_PREFIX}/ingest/open"),
    (metadata_router,             V1_PREFIX),
    (partner_router,              V1_PREFIX),
    (admin_partners_router,       V1_PREFIX),
    (admin_operation_limits_router, V1_PREFIX),
    (admin_similarity_router,     f"{V1_PREFIX}/admin"),
    (admin_feedback_router,       V1_PREFIX),
    (admin_contact_router,        V1_PREFIX),
    (admin_waitlist_router,       V1_PREFIX),
    (admin_playlist_router,       V1_PREFIX),
    (admin_promo_router,          V1_PREFIX),
    (admin_spotify_apps_router,   V1_PREFIX),
]

# Consumer-facing routers keep their existing unversioned paths
unversioned_routers = [
    auth_router, users_router, playlists_router, playlist_engagement_router,
    feedback_router, contact_router, waitlist_router, ratings_router,
    spotify_transfer_router, tidal_transfer_router, apple_music_transfer_router,
    preview_router, telemetry_router, purchases_router, webhooks_router,
    health_router, dummy_router,
]
```

```python
# app/main.py — updated router registration loop

from app.api.routers import v1_routers, unversioned_routers

for router, prefix in v1_routers:
    app.include_router(router, prefix=prefix)

for router in unversioned_routers:
    app.include_router(router)
```

**Important:** The individual router files keep their existing prefix strings (e.g., `prefix="/similarity"`). The `prefix` argument in `include_router` is **additive**, so `/api/v1` + `/similarity` → `/api/v1/similarity`. No router files need to be edited.

**Renamed endpoint paths for clarity (update inside the router files):**

| Old URL | New URL | Router File |
|---|---|---|
| `POST /get_similarity/` | `POST /api/v1/similarity/upload` | `similarity.py` |
| `POST /get_selection_similarity/` | `POST /api/v1/similarity/search` | `similarity.py` |
| `GET /segment_status/{uuid}` | `GET /api/v1/similarity/segment-status/{uuid}` | `similarity.py` |
| `POST /monthly_pipeline/track/` | `POST /api/v1/ingest/monthly_pipeline/track/` | `monthly_pipeline.py` |
| `POST /open_tracks_pipeline/track/` | `POST /api/v1/ingest/open/open_tracks_pipeline/track/` | `open_tracks_pipeline.py` |
| `GET /partner/me` | `GET /api/v1/partner/me` | `partner.py` |

### Semver Deprecation Policy (create `docs/may_2026/api_versioning_policy.md`)

```markdown
## Resomix API Versioning Policy

- Current stable version: **v1** (`/api/v1/`)
- Breaking changes (removed fields, changed types, auth method changes) require a new version (`/api/v2/`).
- Old versions remain supported for **6 months** after the new version ships, then are sunset.
- Non-breaking additions (new optional fields, new endpoints) are added in-place to the current version.
- `Deprecation` and `Sunset` response headers will be added to any endpoint scheduled for removal.
- Consumer (non-B2B) endpoints are **not versioned** and follow a separate compatibility guarantee.
```

### Testing Checklist
- [ ] `curl /api/v1/similarity/upload` (with file) returns valid JSON.
- [ ] `curl /get_similarity/` (old unversioned) returns `404`.
- [ ] `curl /auth/login` (consumer, unversioned) still works.
- [ ] OpenAPI docs at `/docs` show both sets of routes correctly prefixed.
- [ ] `admin/partners` tests updated to use `/api/v1/admin/partners/`.

---

## W2-3 — Idempotency-Key Support (4h)

### Goal
`POST /api/v1/similarity/search` and `POST /api/v1/ingest/monthly_pipeline/track/` support an `Idempotency-Key` header. If the same key is sent within 24 hours, the cached full response is returned without re-executing the handler.

### What We Have
- Redis is live (`app/db/redis.py`, `_redis_pool`).
- Pattern already used in `RateLimitService` with `INCR`, `SETEX`, `GET`.

### What We Need to Build

**1. `IdempotencyService` — `app/services/idempotency_service.py`**

```python
"""
Idempotency Service (W2-3)
===========================
Caches full HTTP response bodies in Redis keyed by
{partner_id}:{idempotency_key} for 24 hours.

Only POST endpoints opt in explicitly via the
`idempotency_required` dependency.
"""

import json
import logging
from typing import Optional, Tuple

import redis.asyncio as aioredis
from app.db.redis import _redis_pool

logger = logging.getLogger(__name__)

TTL_SECONDS = 86_400  # 24 hours
KEY_PREFIX = "idempotency"


class IdempotencyService:

    def _redis(self) -> aioredis.Redis:
        return aioredis.Redis(connection_pool=_redis_pool)

    def _make_key(self, partner_id: int, idempotency_key: str) -> str:
        # Scoped per partner so keys from different partners never collide
        return f"{KEY_PREFIX}:{partner_id}:{idempotency_key}"

    async def get_cached(
        self, partner_id: int, idempotency_key: str
    ) -> Optional[Tuple[int, dict]]:
        """
        Returns (status_code, body_dict) if a cached response exists,
        otherwise None.
        """
        try:
            client = self._redis()
            raw = await client.get(self._make_key(partner_id, idempotency_key))
            await client.aclose()
            if raw:
                return json.loads(raw)  # {"status": 200, "body": {...}}
        except Exception as e:
            logger.warning(f"[IdempotencyService] get_cached failed: {e}")
        return None

    async def store(
        self,
        partner_id: int,
        idempotency_key: str,
        status_code: int,
        body: dict,
    ) -> None:
        """Store a response. Fire-and-forget; never raises."""
        try:
            client = self._redis()
            payload = json.dumps({"status": status_code, "body": body})
            await client.setex(
                self._make_key(partner_id, idempotency_key),
                TTL_SECONDS,
                payload,
            )
            await client.aclose()
        except Exception as e:
            logger.warning(f"[IdempotencyService] store failed: {e}")
```

**2. FastAPI dependency — `app/api/dependencies/idempotency.py`**

```python
"""
Idempotency dependency.
Add to any POST endpoint that should be retry-safe.
"""

from typing import Optional
from fastapi import Header, Request, HTTPException, status

from app.services.idempotency_service import IdempotencyService
from fastapi.responses import JSONResponse

_svc = IdempotencyService()

MAX_KEY_LEN = 255


async def check_idempotency(
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    If an Idempotency-Key header is present and a cached response exists,
    return it immediately (short-circuit the route handler).
    Stores partner_id and idempotency_key on request.state for the
    post-response store step.
    """
    if not idempotency_key:
        request.state.idempotency_key = None
        return  # No header — pass through normally

    if len(idempotency_key) > MAX_KEY_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key must be ≤ 255 characters.",
        )

    partner_id = getattr(request.state, "partner_id", None)
    if not partner_id:
        # Non-partner request; idempotency not applicable
        request.state.idempotency_key = None
        return

    cached = await _svc.get_cached(partner_id, idempotency_key)
    if cached:
        # Return the cached response directly — route handler never runs
        body = cached["body"]
        body["_idempotent"] = True  # Signal to client this is a replay
        raise HTTPException(
            status_code=cached["status"],
            detail=body,
        )
        # Note: use JSONResponse here instead if the detail structure causes issues
        # return JSONResponse(status_code=cached["status"], content=body)

    # Store for later use by the route handler
    request.state.idempotency_key = idempotency_key
```

> **Design note:** The cache-**store** step happens inside the route controller after building the response, not in the dependency. This keeps the response body accessible.

**3. Helper function to store response — `app/utils/idempotency_utils.py`**

```python
"""
Call this at the end of any idempotency-protected controller action,
passing the JSONResponse object and request.
"""

import json
from fastapi import Request
from fastapi.responses import JSONResponse
from app.services.idempotency_service import IdempotencyService

_svc = IdempotencyService()


async def maybe_store_idempotent_response(
    request: Request, response: JSONResponse
) -> None:
    """
    If request.state has an idempotency_key and partner_id, cache the response.
    Safe to call unconditionally — no-ops if key is absent.
    """
    key = getattr(request.state, "idempotency_key", None)
    partner_id = getattr(request.state, "partner_id", None)
    if not key or not partner_id:
        return

    try:
        body = json.loads(response.body)
    except Exception:
        return  # Non-JSON response; skip caching

    await _svc.store(partner_id, key, response.status_code, body)
```

**4. Wire into similarity and ingest controllers**

In `app/controllers/similarity_controller.py`, at the end of `get_similarity_by_id()`:
```python
from app.utils.idempotency_utils import maybe_store_idempotent_response
# ...
response = JSONResponse(content=result)
await maybe_store_idempotent_response(request, response)
return response
```

In `app/api/routers/similarity.py` (the `get_selection_similarity` endpoint):
```python
from app.api.dependencies.idempotency import check_idempotency
# ...
async def get_similarity_by_id_endpoint(
    ...
    _idempotency=Depends(check_idempotency),   # <-- ADD THIS
) -> JSONResponse:
```

Apply the same pattern to the `monthly_pipeline/track/` endpoint.

**5. Client usage example (for documentation)**

```bash
# First call — executes normally
curl -X POST https://api.resomix.com/api/v1/similarity/search \
  -H "Authorization: Bearer rmx_live_xxx" \
  -H "Idempotency-Key: my-job-run-20260515-batch-001" \
  -H "Content-Type: application/json" \
  -d '{"track_id": 42, "top_sk": 20}'
# → { "success": true, "data": {...} }

# Retry (e.g., network failure) — returns SAME response, no DB query
curl -X POST https://api.resomix.com/api/v1/similarity/search \
  -H "Authorization: Bearer rmx_live_xxx" \
  -H "Idempotency-Key: my-job-run-20260515-batch-001" \
  -d '{"track_id": 42, "top_sk": 20}'
# → { "success": true, "data": {...}, "_idempotent": true }
```

### Edge Cases & Rules
| Case | Behaviour |
|---|---|
| No `Idempotency-Key` header | Normal execution, no caching |
| Key present, cache miss | Execute normally; cache result for 24h |
| Key present, cache hit | Return cached response immediately; `_idempotent: true` |
| Key > 255 chars | `400 Bad Request` |
| Non-partner (consumer) request with key | Key silently ignored |
| Redis down | Cache miss treated as normal request; `logger.warning` only |
| Different partner, same key string | Separate cache entries (scoped by `partner_id`) |
| `GET` / `DELETE` requests | Not applicable; dependency not added |

### Testing Checklist
- [ ] First POST with key → executes, returns result, Redis key created.
- [ ] Second POST with same key within 24h → returns identical body with `_idempotent: true`.
- [ ] `Idempotency-Key` from Partner A does not return Partner B's cached response.
- [ ] Redis TTL of cached key is ~86400 seconds after creation.
- [ ] POST without `Idempotency-Key` → behaves normally (no caching).
- [ ] Key > 255 chars → `400`.
- [ ] Simulate Redis down → request succeeds (degraded, not broken).

---

## Week 2 Acceptance Gate (Days W2-1 to W2-3 subset)

After completing these three tasks, the following must pass before proceeding:

- [ ] `curl POST /api/v1/similarity/search` with B2B key → response includes `X-Correlation-ID` header.
- [ ] `partner_usage_logs` table shows one new row with correct `partner_id`, `api_key_id`, `status_code`, `latency_ms`.
- [ ] `curl GET /get_similarity/` (old unversioned) → `404 Not Found`.
- [ ] `curl GET /auth/login` (consumer) → still reachable (not broken by versioning).
- [ ] Repeating a POST with the same `Idempotency-Key` returns `_idempotent: true` in body.
- [ ] All 135 existing tests still pass (`pytest`).

---

## Implementation Order

```
Day 8  (W2-1): Build PartnerAuditMiddleware → register → write integration test
Day 9  (W2-2, morning): Classify routes → apply v1 prefix in __init__.py → update main.py
Day 9  (W2-2, afternoon): Update test suite URLs → verify OpenAPI docs → write versioning policy doc
Day 10 (W2-3): Build IdempotencyService → dependency → wire into similarity + ingest → tests
Day 11 (buffer): Fix integration issues, run full test suite, update frontend_api_integration_guide.md
```
