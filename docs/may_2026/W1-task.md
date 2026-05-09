# W1 Implementation Plan — W1-2, W1-3 & W1-4
## 35-Day Partner-Readiness Roadmap v3.0

> **Status:** W1-1 ✅, W1-2 ✅ Complete  
> **This document covers:** W1-3 · W1-4  
> **W1-2 has been implemented and verified with unit tests.**

---

## Prerequisites Checklist (Before Starting W1-2)

- [x] `partners`, `partner_api_keys`, `partner_quotas`, `partner_usage_log`, `partner_webhooks`, `webhook_delivery_log` tables applied to Docker DB  
- [x] `app/models/partner.py` registered in `app/models/__init__.py`  
- [x] `.env` has `PARTNER_API_KEY_SIGNING_SECRET` set (32+ bytes)

---

## Database Synchronization

If the Docker database needs to be manually updated to match the latest schema in `new_database.sql`:

```bash
# To apply the entire schema to a fresh database:
docker exec -i resomix-test-db mariadb -uroot -ptest resomix_db < new_database.sql

# To apply only the recent UNIQUE constraints (W1-2 hardening):
docker exec -i resomix-test-db mariadb -uroot -ptest resomix_db -e "ALTER TABLE partners ADD UNIQUE (contact_email); ALTER TABLE partner_api_keys ADD UNIQUE (key_hash);"
```

---

## W1-2 — API Key Issuance (7 hours)

### Goal
Admin endpoints to **issue**, **revoke**, and **rotate** partner API keys.  
- Key format: `rmx_live_<secrets.token_urlsafe(32)>` or `rmx_sandbox_<secrets.token_urlsafe(32)>`  
- Only the SHA-256 hex digest is stored in `partner_api_keys.key_hash`  
- Plaintext is returned **once** at issuance, never again

### Files to CREATE

#### 1. `app/schemas/partner.py` *(NEW)*
**Why:** Every existing feature has its own `app/schemas/<name>.py`. Pydantic schemas are the contract between the HTTP layer and the rest of the system.

```python
# Contents:
class PartnerCreateRequest:        # legal_name, display_name, contact_email, tier, country_code, vat_number
class PartnerResponse:             # all partner fields (no secrets)
class PartnerListResponse:         # paginated list (success, data[], pagination{})
class ApiKeyIssueRequest:          # partner_id, label, scopes[], rate_limit_rps, rate_limit_monthly, expires_at?
class ApiKeyIssueResponse:         # key_prefix, plaintext_key (ONLY TIME it's returned), scopes, label, expires_at
class ApiKeyRevokeRequest:         # api_key_id, reason
class ApiKeyRotateRequest:         # api_key_id, label (issues new, revokes old atomically)
class ApiKeyListResponse:          # list of ApiKeyPublicDetail (NO hash, NO plaintext)
class ApiKeyPublicDetail:          # id, partner_id, key_prefix, label, scopes, is_active, created_at, last_used_at, expires_at, revoked_at
```

**Best Practices:**
- Inherit from `app/schemas/common.py` → `APIResponse` and `PaginationResponse` (already used everywhere)
- All response models use `model_config = ConfigDict(from_attributes=True)` (SQLAlchemy 2.0 Pydantic v2 pattern)
- `plaintext_key` field is annotated with `exclude=True` on any model that should not serialize it to logs

---

#### 2. `app/repositories/partner_repository.py` *(NEW)*
**Why:** Strict layered architecture — repositories own all DB queries, no raw SQL in controllers/services.  
Extend `BaseRepository[Partner]` (same pattern as `OperationLimitRepository`).

```python
class PartnerRepository(BaseRepository[Partner]):
  # _find_existing()           - match by partner_uuid
  # _async_find_existing()     - async version
  # async_get_by_id()          - inherited from BaseRepository
  # async_list_partners()      - paginated, filter by tier/is_active
  # async_create_partner()     - wraps async_create with UUID generation

class PartnerApiKeyRepository(BaseRepository[PartnerApiKey]):
  # _find_existing()           - match by key_hash
  # _async_find_existing()     - async version  
  # async_get_by_hash()        - THE lookup used on every request (index on key_hash)
  # async_list_keys_for_partner() - returns ApiKeyPublicDetail (never hash)
  # async_issue_key()          - creates row with hashed key, returns PartnerApiKey ORM obj
  # async_revoke_key()         - sets is_active=False, revoked_at=now(), revoked_reason
  # async_rotate_key()         - atomically revoke old + insert new in single transaction
  # async_touch_last_used()    - UPDATE last_used_at, last_used_ip (fire-and-forget)
```

**Best Practices:**
- `async_rotate_key` must use a **single transaction** — if inserting new key fails, old key stays active
- `async_touch_last_used` should be fire-and-forget (use `asyncio.create_task`) to not add latency to every request
- Never return `key_hash` from any public method — only the service layer needs it for comparison

---

#### 3. `app/services/partner_service.py` *(NEW)*
**Why:** Business logic lives in services, not repositories or controllers.

```python
class PartnerService:
  # generate_api_key(tier: str) -> tuple[str, str, str]
    # Returns (plaintext_key, key_hash, key_prefix)
    # plaintext = f"rmx_{tier}_{secrets.token_urlsafe(32)}"
    # key_hash  = hashlib.sha256(plaintext.encode()).hexdigest()
    # key_prefix = plaintext[:16]

  # async issue_key(db, request: ApiKeyIssueRequest) -> ApiKeyIssueResponse
    # Calls PartnerApiKeyRepository.async_issue_key()
    # Logs via LoggingService (category="PARTNER", action="API_KEY_ISSUED")
    # Returns ApiKeyIssueResponse with plaintext_key

  # async revoke_key(db, api_key_id, reason) -> bool
    # Calls async_revoke_key()
    # Logs revocation

  # async rotate_key(db, request: ApiKeyRotateRequest) -> ApiKeyIssueResponse
    # Calls async_rotate_key() — single transaction
    # Returns new key (plaintext, once)

  # async list_keys(db, partner_id) -> list[ApiKeyPublicDetail]
    # No hash, no plaintext in response

  # async create_partner(db, request: PartnerCreateRequest) -> PartnerResponse
    # Generates partner_uuid = str(uuid.uuid4())
    # Creates via PartnerRepository
```

**Best Practices:**
- `generate_api_key` is a pure function (no DB) — easy to unit test
- SHA-256 is computed in Python, not in SQL — keeps MariaDB simple
- Log every key issuance and revocation to `system_logs` via `LoggingService.log()` with `category="PARTNER"` — follows existing telemetry pattern

---

#### 4. `app/controllers/partner_controller.py` *(NEW)*
**Why:** Consistent with all other controllers (similarity_controller, operation_limit_controller, etc.). Controllers coordinate HTTP concerns only — no DB logic.

```python
class PartnerController:
  # __init__ -> self.partner_service = PartnerService(), self.logging_service = LoggingService()

  # async create_partner(db, request, payload) -> JSONResponse
  # async list_partners(db, request, filters) -> JSONResponse
  # async issue_api_key(db, request, payload) -> JSONResponse
  # async list_api_keys(db, request, partner_id) -> JSONResponse
  # async revoke_api_key(db, request, payload) -> JSONResponse
  # async rotate_api_key(db, request, payload) -> JSONResponse
```

Each method:
1. Delegates to `PartnerService`
2. Wraps result in `format_response()` (imported from `app/utils/response_utils.py`)
3. Returns `JSONResponse`
4. Has its own try/except → logs errors → returns 500

---

#### 5. `app/api/routers/admin/partners.py` *(NEW)*
**Why:** Admin endpoints belong in `app/api/routers/admin/`. Protected by `get_api_key` (same as all other admin routes).

```python
# Router prefix: /admin/partners
# Tags: ["admin-partners"]

# Endpoints:
#   POST   /                      → create_partner
#   GET    /                      → list_partners (page, page_size, tier filter, is_active filter)
#   POST   /api-keys/issue        → issue_api_key
#   GET    /api-keys/{partner_id} → list_api_keys
#   POST   /api-keys/revoke       → revoke_api_key
#   POST   /api-keys/rotate       → rotate_api_key
```

All endpoints: `api_key: str = Security(get_api_key)` — matches existing admin pattern.

### Files to MODIFY

#### 6. `app/api/routers/admin/__init__.py`
Add: `from .partners import router as admin_partners_router` and export in `__all__`.

#### 7. `app/api/routers/__init__.py`
Add: `from .admin.partners import router as admin_partners_router`  
Add to `all_routers` list.

#### 8. `app/core/config.py`
Add these settings fields and env-var mappings in `__init__`:
```python
partner_api_key_hash_algorithm: str = Field(default="sha256")
# No new secrets needed — SHA-256 is deterministic and keyless
# The "secret" IS the key itself (high-entropy random string)
```
No breaking changes to existing config consumers.

---

## W1-3 — `get_current_partner()` FastAPI Dependency (5 hours)

### Goal
A reusable FastAPI dependency that:
1. Reads `Authorization: Bearer rmx_*` header
2. Hashes the token with SHA-256
3. Looks up the hash in `partner_api_keys` (indexed)
4. Validates: `is_active=True`, not expired, not revoked
5. Populates `request.state.partner_id` and `request.state.api_key_id`
6. Returns a typed `PartnerContext` dataclass

### Files to CREATE

#### 9. `app/api/dependencies/partner_auth.py` *(NEW)*
**Why:** Separate file keeps partner auth isolated from user JWT auth (`app/api/dependencies/auth.py`). This is the most critical security surface — it must be reviewed in isolation.

```python
@dataclass
class PartnerContext:
    partner_id: int
    partner_uuid: str
    api_key_id: int
    key_prefix: str
    scopes: list[str]
    tier: str

async def get_current_partner(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
) -> PartnerContext:
    ...
```

**Logic inside `get_current_partner`:**
```python
# 1. Extract header: auth_header = request.headers.get("Authorization")
# 2. Validate format: must start with "Bearer rmx_"
#    → If missing/wrong format: raise HTTPException(401, "Partner API key required",
#      headers={"WWW-Authenticate": "Bearer"})
# 3. token = auth_header.removeprefix("Bearer ").strip()
# 4. key_hash = hashlib.sha256(token.encode()).hexdigest()
# 5. key_row = await PartnerApiKeyRepository().async_get_by_hash(db, key_hash)
#    → If None: raise HTTPException(401, "Invalid API key")
# 6. If not key_row.is_active: raise HTTPException(403, "API key has been revoked")
# 7. If key_row.expires_at and key_row.expires_at < datetime.utcnow():
#      raise HTTPException(403, "API key has expired")
# 8. partner = await PartnerRepository().async_get_by_id(db, key_row.partner_id)
#    → If not partner or not partner.is_active: raise HTTPException(403, "Partner account inactive")
# 9. Populate request.state:
#      request.state.partner_id = partner.id
#      request.state.api_key_id = key_row.id
# 10. Fire-and-forget: asyncio.create_task(
#        PartnerApiKeyRepository().async_touch_last_used(db, key_row.id, client_ip))
# 11. return PartnerContext(
#        partner_id=partner.id,
#        partner_uuid=partner.partner_uuid,
#        api_key_id=key_row.id,
#        key_prefix=key_row.key_prefix,
#        scopes=key_row.scopes,
#        tier=partner.tier
#     )
```

**Best Practices:**
- Use `hashlib.sha256` — stdlib, no dependencies
- **Constant-time comparison is not needed here** because we're comparing a hash lookup (DB index), not doing string comparison of secrets. The hash itself is the lookup key, not a secret.
- The `async_get_by_hash` query hits the `idx_apikey_hash` index — O(1) lookup
- Never log the token or the hash in any log message — log only `key_prefix`
- `request.state` population enables downstream middleware (W1-6, W2-1) to read partner context without re-querying DB
- Keep `PartnerContext` as a frozen `@dataclass` — immutable after construction

#### 10. Update `app/api/dependencies/__init__.py`
Export `get_current_partner` and `PartnerContext`.

### How It Will Be Used on Endpoints
Partner-protected endpoints will use:
```python
from app.api.dependencies.partner_auth import get_current_partner, PartnerContext

@router.post("/partner/search")
async def partner_search(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: PartnerContext = Depends(get_current_partner),
) -> JSONResponse:
    # partner.partner_id, partner.scopes, partner.tier available here
    ...
```

> **IMPORTANT:** `get_current_partner` is **separate** from `get_api_key` (which is the internal admin key). They must never be swapped. Partner endpoints use `get_current_partner`; admin endpoints use `get_api_key`.

### No Changes to Existing Endpoints
`get_current_partner` is **additive only** — no existing router, controller, or service is touched in W1-3. It is a new dependency waiting to be injected into new partner-facing endpoints (built in W1-4 and beyond).

---

## W1-4 — `tenant_id` Integration into Existing Tables (17 hours)

> This is the highest-risk task of Week 1. The roadmap correctly estimates 17 hours.  
> **Default decision from roadmap:** Add `partner_id` column to existing tables. Demo/cc_by data uses `partner_id = 1` (the sandbox tenant seeded in W1-1).

### Phase A — Decision Document (2 hours)

Before touching any code, write `docs/may_2026/W1-4_decision.md` with:
- Confirmation of "add column" approach (vs. new scoped tables)
- List of every table that needs `partner_id`
- Rollback plan if migration fails

**Tables that need `partner_id INT UNSIGNED DEFAULT 1`:**

| Table | Reason | Impact |
|---|---|---|
| `tracks` | Core content — every similarity query must be partner-scoped | HIGH |
| `audio_files` | Linked to tracks | HIGH |
| `releases` | DDEX content is per-distributor | MEDIUM |
| `playlists` | Similarity results returned to partner | HIGH |

**Tables that do NOT need `partner_id`:**
- `users`, `roles`, `permissions` — internal user management, not partner-scoped
- `genres`, `operation_types` — global reference tables
- `system_logs` — system-wide, cross-tenant by design
- `carts`, `orders`, `purchases` — B2C ecommerce, no multi-tenancy yet
- `contributors`, `labels` — shared across distributors by ISRC

### Phase B — SQL Migration (apply to Docker DB)

```sql
-- Run these in order:
ALTER TABLE tracks
  ADD COLUMN partner_id INT UNSIGNED NOT NULL DEFAULT 1
  COMMENT 'FK → partners.id; 1 = sandbox tenant',
  ADD INDEX idx_track_partner (partner_id),
  ADD CONSTRAINT fk_track_partner
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;

ALTER TABLE audio_files
  ADD COLUMN partner_id_tenant INT UNSIGNED NOT NULL DEFAULT 1,
  ADD INDEX idx_audiofile_partner (partner_id_tenant);
-- NOTE: audio_files already has a party_id column (VARCHAR).
-- Use partner_id_tenant to avoid name collision.
-- Decision: rename clarification in decision doc.

ALTER TABLE releases
  ADD COLUMN partner_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD INDEX idx_release_partner (partner_id),
  ADD CONSTRAINT fk_release_partner
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;

ALTER TABLE playlists
  ADD COLUMN partner_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD INDEX idx_playlist_partner (partner_id);
```

> **Why DEFAULT 1?** All existing data gets assigned to the sandbox tenant (id=1) automatically. New data without a partner context will also fall to sandbox. This is safe.

### Phase C — SQLAlchemy Model Updates

#### Files to MODIFY

**`app/models/track.py`**
- Add: `partner_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("partners.id"), nullable=False, default=1, index=True)`
- Add relationship: `partner: Mapped["Partner"] = relationship("Partner")`
- **Why:** Alembic and typed queries need the column declared on the model.

**`app/models/audio_file.py`**
- Add `partner_id_tenant` column (see naming note above)

**`app/models/release.py`**
- Add `partner_id` column + FK

**`app/models/playlist.py`**
- Add `partner_id` column (no FK constraint — playlists can be system-generated)

**`app/models/partner.py`** *(already created in W1-1)*
- Add back-references: `tracks`, `releases`, `playlists` relationships

### Phase D — Repository Query Audit (hardest part — 8–10 hours)

Every repository method that queries `tracks`, `audio_files`, `releases`, or `playlists` must be audited. Any method that could return cross-tenant data must be updated.

#### `app/repositories/track_repository.py` — HIGH PRIORITY
All `SELECT` queries on `tracks` must gain a `WHERE partner_id = :pid` filter when called from a partner-authenticated context.

**Pattern to use (add `partner_id` parameter with default `None`):**
```python
async def async_search_tracks(
    self,
    db: AsyncSession,
    query: str,
    partner_id: Optional[int] = None,   # ADD THIS
    ...
) -> List[Track]:
    stmt = select(Track).where(Track.title.ilike(f"%{query}%"))
    if partner_id is not None:           # ADD THIS BLOCK
        stmt = stmt.where(Track.partner_id == partner_id)
    ...
```

**Why `Optional[int]` with default `None` instead of required?**  
Existing callers (B2C user endpoints, admin endpoints) should continue to work unchanged. Only new partner endpoints pass `partner_id`. This avoids breaking dozens of existing call sites.

**Repository methods to audit in `track_repository.py`:**
- `async_get_by_id` — add partner_id guard
- `async_search_tracks` — add partner_id filter
- `async_get_tracks_for_similarity` — add partner_id filter
- `async_get_by_isrc` — add partner_id filter (ISRC can exist across tenants)
- Any bulk-fetch method

**`app/repositories/playlist_repository.py`** — HIGH PRIORITY  
- `async_get_playlist_by_uuid` — add optional partner_id guard
- `async_get_similarity_playlist` — add partner_id filter
- `async_create_playlist` — accept `partner_id` kwarg, default to 1

**`app/repositories/similarity_repository.py`** — HIGH PRIORITY  
- All queries that return tracks for similarity results need partner_id filtering

**`app/repositories/release_repository.py`** — MEDIUM PRIORITY  
- `async_list_releases` — add optional partner_id filter

**`app/repositories/audio_file_repository.py`** (if exists, or queries in other repos) — MEDIUM

### Phase E — Service Layer Review

Services that call the above repositories:

**`app/services/similarity_service.py`**  
- Accept `partner_id: int = 1` in relevant method signatures
- Pass through to repository calls
- This is the most critical path — a bug here exposes cross-tenant audio data

**`app/services/search_service.py`**  
- Add `partner_id` filter to any full-text search against `tracks`

**`app/services/playlist_service.py`**  
- Pass `partner_id` when creating similarity playlists

### Phase F — Controller Updates

**`app/controllers/similarity_controller.py`**  
- Read `partner_id` from `request.state` (set by `get_current_partner` in W1-3)
- Fall back to `1` (sandbox) if `request.state.partner_id` not set (preserves B2C flow)

```python
partner_id = getattr(request.state, "partner_id", 1)
```

This single line is the bridge between W1-3 and W1-4. It means:
- B2C requests (JWT auth) → `partner_id = 1` (sandbox) automatically
- Partner requests (`get_current_partner`) → correct `partner_id` from token

---

## Impact on Existing Functionality

| Feature | Impact | Risk | Mitigation |
|---|---|---|---|
| Similarity upload (`/get_similarity/`) | Will now tag tracks with `partner_id=1` (sandbox). No change to response | LOW | `DEFAULT 1` on column |
| Playlists | New playlists get `partner_id=1`. Existing playlists updated by migration | LOW | `DEFAULT 1` |
| Search (`/search/`) | No change until partner-scoped search endpoints are built | NONE | Existing B2C search ignores partner_id |
| Admin endpoints | Not affected — admin uses its own `get_api_key` dependency | NONE | No changes to admin routes |
| Auth (`/auth/`) | Not affected — user JWT flow is completely separate | NONE | — |
| DDEX ingestion | `tracks` insert must now supply `partner_id` — check `track_upload_service.py` | MEDIUM | Find all `Track(...)` constructors and add `partner_id=1` default |
| Purchases/Cart | Not affected — separate tables, not in scope | NONE | — |
| HLS streaming | Not affected — reads `audio_files` by path, not partner | NONE | — |
| Telemetry | `partner_usage_log` is separate; existing `system_logs` unchanged | NONE | — |

---

## Best Practices Summary

### Security
- SHA-256 hash lookup via indexed `key_hash` column — safe and fast
- Never log token strings — log only `key_prefix` (first 16 chars, safe to display)
- `get_current_partner` returns typed `PartnerContext` — downstream code never handles raw strings
- Revoked/expired keys return `403`, not `401` — distinction matters for partner UX

### Architecture (matching existing patterns)
- One service per domain: `partner_service.py`
- One repository per model: `partner_repository.py`
- One controller per feature: `partner_controller.py`
- One router per domain: `admin/partners.py`
- Schemas in `app/schemas/partner.py` — inherit `APIResponse` / `PaginationResponse`
- Log all mutations via `LoggingService.log()` with `category="PARTNER"`

### Database Safety
- All DDL uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
- `DEFAULT 1` on `partner_id` = zero-downtime migration (existing rows assigned to sandbox)
- No existing columns are modified, renamed, or dropped
- Test on Docker DB before any production run

### Backward Compatibility
- `partner_id` optional parameter with `default=None` in repositories preserves all existing callers
- `getattr(request.state, "partner_id", 1)` in controllers is the safe fallback
- No existing B2C endpoints are modified

---

## File Creation / Modification Summary

### W1-2
| Action | File |
|---|---|
| CREATE | `app/schemas/partner.py` |
| CREATE | `app/repositories/partner_repository.py` |
| CREATE | `app/services/partner_service.py` |
| CREATE | `app/controllers/partner_controller.py` |
| CREATE | `app/api/routers/admin/partners.py` |
| MODIFY | `app/api/routers/admin/__init__.py` |
| MODIFY | `app/api/routers/__init__.py` |

### W1-3
| Action | File |
|---|---|
| CREATE | `app/api/dependencies/partner_auth.py` |
| MODIFY | `app/api/dependencies/__init__.py` |

### W1-4
| Action | File |
|---|---|
| SQL on Docker | ALTER TABLE tracks, audio_files, releases, playlists |
| MODIFY | `app/models/track.py` |
| MODIFY | `app/models/audio_file.py` |
| MODIFY | `app/models/release.py` |
| MODIFY | `app/models/playlist.py` |
| MODIFY | `app/models/partner.py` (add back-references) |
| MODIFY | `app/repositories/track_repository.py` |
| MODIFY | `app/repositories/playlist_repository.py` |
| MODIFY | `app/repositories/similarity_repository.py` |
| MODIFY | `app/repositories/release_repository.py` |
| MODIFY | `app/services/similarity_service.py` |
| MODIFY | `app/services/search_service.py` |
| MODIFY | `app/services/playlist_service.py` |
| MODIFY | `app/controllers/similarity_controller.py` |
| MODIFY | `app/services/track_upload_service.py` (add partner_id=1 default to Track constructors) |

---

## Testing Checklist (Day 7 Gate)

### W1-2 Tests
- [x] `POST /admin/partners` creates a partner and returns a UUID
- [x] `POST /admin/partners/api-keys/issue` returns plaintext key **once** starting with `rmx_live_` or `rmx_sandbox_`
- [x] Re-running issue does **not** return the same key (new key every time)
- [x] `POST /admin/partners/api-keys/revoke` sets `is_active=False`
- [x] `POST /admin/partners/api-keys/rotate` returns new key, old key returns 403

### W1-3 Tests
- [ ] `Authorization: Bearer rmx_live_xxx` (valid) → 200, `request.state.partner_id` populated
- [ ] No header → 401 with `WWW-Authenticate: Bearer`
- [ ] Wrong prefix (e.g. `Bearer sk_xxx`) → 401
- [ ] Revoked key → 403
- [ ] Expired key → 403
- [ ] Inactive partner → 403

### W1-4 Tests
- [ ] `tracks` table has `partner_id` column, existing rows have `partner_id=1`
- [ ] New track inserted via similarity upload → `partner_id=1` in DB
- [ ] Similarity query for partner A does not return partner B's tracks
- [ ] B2C similarity endpoint still works (fallback to sandbox)
- [ ] Playlists created by partner endpoint are tagged with correct `partner_id`
- [ ] Admin search endpoints still return all tracks (no partner filter on admin)

---

## Quality Assurance & Post-Task Workflow
To be strictly followed after the completion of EVERY task:

### 1. Static Analysis & Verification
- **Import Check**: Run a static check or dry-run to ensure all new imports are resolved and there are no circular dependencies.
- **Logic Validation**: Perform a mental walkthrough and basic manual test of the core logic to ensure it meets the requirements.

### 2. Testing Strategy
- **Internal Backend Logic**: For any new service, repository, or utility logic, create a unit test (under `tests/`) that covers:
    - The "Happy Path".
    - Edge cases (null values, empty strings, invalid IDs).
    - Failure modes (database errors, timeout simulations).
- **Run Tests**: Execute the tests using `pytest` and ensure 100% pass rate for the new components before proceeding.

### 3. Documentation & Integration
- **API Documentation (Frontend/External)**: If the task involves a new API endpoint, provide a "Frontend Integration Guide" snippet in the task walkthrough. This should include:
    - Endpoint URL and Method.
    - Required Headers (e.g., `Authorization`).
    - Request Body Schema.
    - Expected Response and Error Codes.
- **Internal Guide**: Update relevant internal docs if internal service signatures have changed.

---

## Notes for the Developer

1. **Start W1-4 Phase A before writing code** — the decision doc forces explicit agreement on scope before 17 hours of work begin.
2. **The `audio_files.party_id` naming conflict** — `audio_files` already has `party_id VARCHAR(100)` (the DDEX distributor ID). The new column should be named `partner_id_tenant` (INT) or similar — these are different concepts (distributor vs. B2B API tenant). Document this clearly in the decision doc.
3. **`track_upload_service.py`** is the most likely source of a missed `partner_id` assignment. Search every `Track(` constructor call in that file.
4. **Do not add `partner_id` filter to admin endpoints** — admin is cross-tenant by design.
5. **Do not modify the `system_logs` table** — it is cross-tenant observability infrastructure.

## Notes for the AI
- ALWAYS USE the source .venv/ before running any commands

