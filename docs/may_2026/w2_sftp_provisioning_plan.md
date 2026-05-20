# W2-4: Automated SFTP Partner Provisioning — Implementation Plan

**Status:** Planning  
**Scope:** Full end-to-end flow for automatically provisioning a partner as an SFTPGo virtual user when they are created through the Admin Dashboard, replacing the current fully manual process.  
**Servers touched:** Alwyzon (FastAPI/MariaDB) + Hetzner SX65 (SFTPGo + shell script)

---

## Background: Why This Change

### What Happens Today (The Problem)

Onboarding a new SFTP partner is a two-step, fully manual operation:

1. **Manually** insert a row into the `sftp_users` table in MariaDB with the username, a bcrypt-hashed password, home directory, and partner FK.
2. **Manually** open the SFTPGo Admin UI on Hetzner, create the virtual user there again with the same credentials, and set up the folder structure.

These two systems are **completely disconnected**. There is no code path that links partner creation in the Admin Dashboard to SFTPGo user creation on Hetzner. This is fragile, error-prone, and does not scale.

### What We Are Building (The Solution)

When an admin creates a partner and fills in the SFTP section of the form:

```
Admin Dashboard
      ↓  POST /api/v1/admin/partners/sftp/provision
Alwyzon FastAPI
      ↓  writes sftp_user row to MariaDB
      ↓  calls Hetzner internal provisioning endpoint
Hetzner SX65 (Python script)
      ↓  creates /srv/sftp/partners/{id}/incoming|processed|error
      ↓  creates SFTPGo virtual user via SFTPGo REST API
      ↓  returns confirmation
Alwyzon
      ↓  returns provisioned credentials to admin
```

---

## W2-5: Storage Quotas — How It Already Works

Before the phases, a quick clarification on the W2-5 audit mark:

SFTPGo's quota enforcement works by reading the `quota_size` field from the **external auth hook response**. Every time a partner connects over SFTP, SFTPGo calls our `/internal/sftp/auth` endpoint. Our code reads the partner's `tier` from the database and returns a tier-to-bytes mapping:

```
sandbox    → 1 GB  (1,073,741,824 bytes)
starter    → 10 GB (10,737,418,240 bytes)
growth     → 50 GB (53,687,091,200 bytes)
enterprise → 0     (0 = unlimited in SFTPGo)
```

This value is returned in the JSON response as `"quota_size": <bytes>`. SFTPGo enforces this limit natively — no code on our side needs to check it per-upload. SFTPGo rejects uploads that would breach the quota before they land.

**The SFTPGo Admin UI also shows quota fields**, but what we return dynamically in the auth hook **overrides** any static value set in the Admin UI for virtual/external users. Our code is the single source of truth. This is why W2-5 is marked complete — the dynamic response fully controls storage limits.

---

## Phase Summary

| Phase | What | Servers |
| :--- | :--- | :--- |
| **Phase 1** | Database & Schema — extend `sftp_users`, add new Alembic migration | Alwyzon (MariaDB) |
| **Phase 2** | Alwyzon API Layer — new service, controller methods, schemas, admin routes | Alwyzon (FastAPI) |
| **Phase 3** | Hetzner Provisioning Script — internal HTTP endpoint + shell operations | Hetzner SX65 |
| **Phase 4** | File Validation & Upload Integrity — checksum, partial upload detection | Alwyzon + Hetzner |

---

## Phase 1: Database & Schema

### Goal

Extend the `sftp_users` table to store all information needed to fully describe an SFTP partner account. Remove the hard coupling to `label_id` (a legacy concept that does not apply to B2B partners), and add fields for optional SSH public key auth, IP allowlisting, and provisioning status tracking.

---

### File 1 — `app/models/sftp_user.py`

**Current state:**
- `label_id` is a non-nullable FK to `labels.id` with `ondelete=RESTRICT`. This was designed for per-label SFTP in the old architecture, but B2B partners operate at the partner level, not the label level. This forces every SFTP user to belong to a label — an architectural mismatch.
- No `public_key` column — there is no way to store an RSA/Ed25519 public key for key-based auth.
- No `allowed_ip` column — the IP whitelist check in the auth hook is commented out because the field does not exist on the model.
- No `sftp_provisioned_at` timestamp — we have no audit trail of when the Hetzner SFTPGo account was last successfully created.
- `home_directory` stores a path but it is always overridden in the auth hook response anyway, making it redundant and confusing.

**What we plan to do:**
- Make `label_id` **nullable** (`nullable=False` → `nullable=True`). Not dropping it — label-scoped SFTP may still be useful in future. This is a non-destructive change.
- Add `public_key TEXT NULLABLE` — stores a single OpenSSH-format public key string (e.g. `ssh-ed25519 AAAA...`).
- Add `allowed_ip VARCHAR(255) NULLABLE` — a comma-separated list of whitelisted IPs or CIDRs. Simple string for now; can be evolved to a JSON array later without breaking nullability.
- Add `use_public_key BOOLEAN NOT NULL DEFAULT FALSE` — when True, the auth hook returns public key auth mode to SFTPGo. Maps to `external_auth_scope = 3` (password + pubkey).
- Add `sftp_provisioned_at DATETIME NULLABLE` — set when the Hetzner provisioning call returns success. `NULL` means "account in MariaDB but NOT yet live in SFTPGo". This is the critical integrity flag for retry logic.
- Add `sftp_home_dir VARCHAR(500) NULLABLE` — the chroot path returned to SFTPGo. Moving this from a hard-coded f-string in the auth hook into the database makes the system explicit and auditable.
- Update `__table_args__` to add a compound index on `(partner_id, is_active)`.

**Why:**
- The single source of truth for all SFTP user configuration should be MariaDB, not the auth hook's inline code. Moving config into columns means we can update values (e.g. toggle IP whitelist off for a partner) without code deploys.
- `sftp_provisioned_at` being `NULL` is the atomic "not yet provisioned" signal. If Hetzner is unreachable when the admin creates a partner, the MariaDB row exists but `sftp_provisioned_at` remains `NULL` — allowing a clean retry without duplicating DB records.

**Surgical edit guide:**
- Add the five new column definitions at the bottom of the column list, before the Relationships block.
- Only `label_id` changes on an existing column: `nullable=False` → `nullable=True`, and remove the implicit `default`.
- Add `Index("idx_sftp_partner_active", "partner_id", "is_active")` to `__table_args__` tuple (before the dict entry).

---

### File 2 — `alembic/versions/` — New Migration File

**Current state:**
- No existing migration covers the new columns. The previous migrations handled the `user_id` FK addition and `partner_id` isolation.

**What we plan to do:**
- Create `alembic/versions/xxxx_sftp_provisioning_fields.py`.
- `upgrade()` runs:
  - `op.alter_column("sftp_users", "label_id", nullable=True)`
  - `op.add_column("sftp_users", ...)` × 5 for the new columns
  - `op.create_index("idx_sftp_partner_active", "sftp_users", ["partner_id", "is_active"])`
- `downgrade()` reverses all of the above in reverse order.

**Why:**
- One migration = one feature. If Phase 1 needs to be rolled back, a single `alembic downgrade -1` restores the exact prior state cleanly. Never batch unrelated schema changes.

**Surgical edit guide:**
- Generate the file skeleton with `alembic revision --autogenerate -m "sftp_provisioning_fields"`, then edit the generated body to match the explicit changes above. Do not rely fully on autogenerate — it sometimes misses `alter_column` for nullability changes.

---

### File 3 — `new_database.sql` + `alembic/versions/schema.sql`

**Current state:**
- Both files contain a `CREATE TABLE sftp_users (...)` block (line ~1263 in `new_database.sql`, line ~1288 in `schema.sql`). They reflect the old schema — no new columns, `label_id` is NOT NULL.

**What we plan to do:**
- Add the five new columns to the CREATE TABLE block in both files.
- Change `label_id ... NOT NULL` → `label_id ... DEFAULT NULL`.
- Add `INDEX idx_sftp_partner_active (partner_id, is_active)` to the key definitions.

**Why:**
- These files are used as the baseline when provisioning a brand new database from scratch (fresh install, new staging environment). If they fall out of sync with the ORM, a fresh install will have a schema mismatch that is invisible until something breaks at runtime.

**Surgical edit guide:**
- Find the `sftp_users` block in each file. Insert new columns after the `created_at` line, before the closing `)`. Keep the column order consistent with the ORM model to avoid confusion.

---

### File 4 — `app/repositories/sftp_user_repository.py`

**Current state:**
- Only has `get_by_username()` with eager loading of the `partner` relationship.
- No method to look up by `partner_id`.
- No method to update `sftp_provisioned_at` after Hetzner confirms.
- No method to find all unprovisioned users for retry logic.

**What we plan to do:**
- Add `get_by_partner_id(db, partner_id)` — returns the `SftpUser` for a given partner. Uses a `select(...).where(SftpUser.partner_id == partner_id)` with `selectinload(SftpUser.partner)`.
- Add `mark_provisioned(db, sftp_user_id, home_dir)` — sets `sftp_provisioned_at = func.now()` and `sftp_home_dir = home_dir` atomically using an SQLAlchemy `update()` statement. Does not fetch the object first (avoids an unnecessary SELECT).
- Add `get_unprovisioned(db)` — returns all `SftpUser` rows where `sftp_provisioned_at IS NULL` and `is_active IS TRUE`. Used by a future retry mechanism.

**Why:**
- The Repository pattern is the established data-access pattern in this codebase. All SQL belongs here, not in services. Adding methods here keeps services clean and testable with simple mocks.

**Surgical edit guide:**
- Add the three methods below the existing `get_by_username()` method. Import `update` from `sqlalchemy` at the top of the file (it is not currently imported).

---

### Phase 1 Checklist

- [ ] Edit `app/models/sftp_user.py` — 5 new columns, `label_id` nullable, compound index
- [ ] Create Alembic migration with `upgrade()` and `downgrade()`
- [ ] Run `alembic upgrade head` on dev DB and inspect the table with `DESCRIBE sftp_users`
- [ ] Update `new_database.sql` to match new schema
- [ ] Update `alembic/versions/schema.sql` to match new schema
- [ ] Add 3 new methods to `app/repositories/sftp_user_repository.py`
- [ ] Verify existing rows — new nullable columns return `None` for existing rows (correct behaviour)

---

## Phase 2: Alwyzon API Layer

### Goal

Build the service, controller methods, schemas, and admin routes that:
1. Accept SFTP provisioning details from the Admin Dashboard form.
2. Write the `sftp_users` row to MariaDB.
3. Call the Hetzner provisioning endpoint to create the SFTPGo virtual user and folder structure.
4. Mark the record provisioned in MariaDB once Hetzner confirms.
5. Return the final credentials to the admin UI.

Also update the existing `/internal/sftp/auth` hook to use the new database columns instead of hard-coded values.

---

### File 1 — `app/schemas/partner.py`

**Current state:**
- Contains all partner and API key schemas. Nothing for SFTP provisioning.

**What we plan to do:**
- Add `SftpProvisionRequest` — the admin's input payload. Fields:
  - `partner_id: int` — which partner to provision SFTP for.
  - `username: str` — desired username (validated: 3–64 chars, alphanumeric + underscores only via `pattern` field validator).
  - `password: str` — plaintext password, min 12 chars. Hashed server-side; never stored.
  - `use_public_key: bool = False` — if `True`, `public_key` becomes required.
  - `public_key: Optional[str] = None` — full OpenSSH public key string.
  - `allowed_ip: Optional[str] = None` — optional IP/CIDR whitelist.
- Add a `@model_validator(mode="after")` that raises `ValueError("public_key is required when use_public_key is True")` before the payload reaches any controller or service.
- Add `SftpProvisionResponse` — what admin UI receives after success. Fields:
  - `sftp_user_id: int`
  - `partner_id: int`
  - `username: str`
  - `home_dir: str`
  - `use_public_key: bool`
  - `sftp_host: str` — public-facing SFTP hostname for the partner to use.
  - `sftp_port: int`
  - `provisioned_at: datetime`
- Add `SftpStatusResponse` — a lightweight read-only view returned by `GET /admin/partners/{id}/sftp`:
  - `sftp_user_id: int`
  - `username: str`
  - `is_active: bool`
  - `use_public_key: bool`
  - `has_allowed_ip: bool` — boolean only; never expose the actual IP in a response.
  - `sftp_provisioned_at: Optional[datetime]` — `None` means not yet live in SFTPGo.
  - `home_dir: Optional[str]`

**Why:**
- Input validation at the schema layer (Pydantic) is the first line of defence. If `use_public_key=True` and `public_key` is missing, it is rejected before any DB or network call happens. This is the pattern already used for `ApiKeyIssueRequest` scope validation.
- `SftpStatusResponse` deliberately hides the actual `allowed_ip` string. An admin can see whether a whitelist is configured (`has_allowed_ip: True`) but reading the full IP requires a separate privileged call. This follows the principle of minimal exposure in API responses.

**Surgical edit guide:**
- Add the three new schema classes at the bottom of `partner.py`, after the existing `ApiKeyRotateRequest`. No changes to any existing class — purely additive.
- Import `model_validator` from `pydantic` at the top if not already present.

---

### File 2 — `app/core/config.py`

**Current state:**
- Has `hetzner_internal_api_key` (line 68) used for track deletion calls to Hetzner.
- No settings for the SFTP provisioning endpoint URL, public SFTP hostname, or port.
- No `sftp_base_path` setting — it is currently read as `os.getenv("SFTP_BASE_PATH", "/srv/sftp")` inline in the auth hook.

**What we plan to do:**
- Add `hetzner_sftp_provision_url: Optional[str] = None` — the full URL of the internal provisioning script on Hetzner (e.g. `http://10.0.0.5:8090/internal/provision-sftp-user`). Uses the private IP, never public.
- Add `sftp_server_host: str = "sftp.resomix.com"` — the public-facing hostname given to partners after provisioning.
- Add `sftp_server_port: int = 2222` — the SFTPGo listening port.
- Add `sftp_base_path: str = "/srv/sftp"` — replaces the scattered `os.getenv` calls in the auth hook and ingestion service.

**Why:**
- Config values that differ between environments (dev, staging, prod) must live in `Settings`. Right now `sftp_base_path` is read with `os.getenv` in two different places — this creates invisible coupling. Centralising it means a single `.env` change covers everything.
- `hetzner_sftp_provision_url` is `Optional` because it is only needed in environments where Hetzner is reachable. In local development, if it is `None`, the service can detect this and skip the Hetzner call (returning a "locally provisioned only" state).

**Surgical edit guide:**
- Add the four new fields in the "External Services" block (around line 64–74), immediately after `hetzner_internal_api_key`.
- Add their env var mappings to the `env_var_map` dict (around line 485) following the existing `HETZNER_INTERNAL_API_KEY` pattern.

---

### File 3 — `app/services/sftp_service.py` *(New File)*

**Current state:**
- Does not exist. SFTP logic is split: quota calculation and home dir construction are inline in the auth hook router. No central service owns SFTP logic.

**What we plan to do:**
- Create `SftpService` class following the exact same structure as `PartnerService` (docstring header, `__init__` with repo dependencies, named async methods).
- Methods:

  **`provision_partner_sftp(db, request: SftpProvisionRequest) → SftpUser`**  
  Main provisioning method. Steps in order:
  1. Verify partner exists via `partner_repo.async_get_by_id`. Raise `ValueError` if not found.
  2. Check no existing `SftpUser` for `partner_id` via `sftp_user_repo.get_by_partner_id`. Raise `ValueError("already provisioned")` if found.
  3. Hash the plaintext password using `get_password_hash()` from `app.core.security`.
  4. Build `home_dir = f"{settings.sftp_base_path}/partners/{partner.id}"`.
  5. Create `SftpUser` row with `sftp_provisioned_at=None` (signals "intent, not yet live").
  6. `await db.flush()` — gets the DB-assigned `id` without committing the transaction.
  7. Call `await self._call_hetzner_provisioning(partner.id, request.username, home_dir, request.public_key if request.use_public_key else None)`.
  8. If Hetzner call raises, propagate the exception — the controller will rollback.
  9. Call `sftp_user_repo.mark_provisioned(db, sftp_user.id, home_dir)`.
  10. Return the `SftpUser` object.

  **`_call_hetzner_provisioning(partner_id, username, home_dir, public_key) → dict`**  
  Private helper using `httpx.AsyncClient`. Posts to `settings.hetzner_sftp_provision_url`. Sends `Authorization: Bearer {settings.hetzner_internal_api_key}`. 10-second timeout. If `hetzner_sftp_provision_url` is `None`, logs a warning and returns `{"skipped": True}` (dev mode). If response status is not 200, raises `RuntimeError(f"Hetzner returned {status}: {body}")`.

  **`get_quota_bytes(tier: str) → int`**  
  Extracted from the auth hook. The tier-to-bytes map lives here as a class-level constant `QUOTA_MAP`. Makes the mapping testable in isolation.

  **`deactivate_partner_sftp(db, partner_id: int) → bool`**  
  Sets `is_active=False` on the `SftpUser` row. Used when a partner is suspended. Does NOT call Hetzner to delete directories — that is a separate decommission operation (Phase 3+).

**Why:**
- A dedicated `SftpService` follows the Single Responsibility Principle. The auth hook router becomes a simple translator (DB → SFTPGo spec). All logic (hashing, Hetzner call, error handling) moves into a testable, mockable service.
- Using `db.flush()` before the Hetzner call means we get the database-assigned `id` without committing, so the entire operation (DB write + Hetzner call) stays within one transaction boundary. If Hetzner fails, the controller can call `db.rollback()` and the `sftp_users` row disappears cleanly.

**Surgical edit guide:**
- Create the file from scratch. Use `partner_service.py` as the structural template.
- Import `sftp_user_repo` singleton from `app.repositories.sftp_user_repository`.
- Import `PartnerRepository` from `app.repositories.partner_repository` (already exists).
- Import `httpx` **inside** `_call_hetzner_provisioning` only — lazy import to avoid startup errors in environments where httpx behaves differently.

---

### File 4 — `app/api/routers/internal/sftp.py`

**Current state:**
- Lines 50–57: `quota_map` dict hard-coded inline.
- Line 48: `SFTP_BASE_PATH = os.getenv("SFTP_BASE_PATH", "/srv/sftp")` — reads env var directly.
- Lines 40–43: IP whitelist check commented out with `# TODO`.
- No public key support in the response.

**What we plan to do:**
- Replace the inline `quota_map` dict with `sftp_service.get_quota_bytes(partner.tier)`.
- Replace `os.getenv("SFTP_BASE_PATH", ...)` with `sftp_user.sftp_home_dir or f"{settings.sftp_base_path}/partners/{partner_id}"`. The fallback handles legacy rows that were created before Phase 1.
- Uncomment and activate the IP whitelist using `sftp_user.allowed_ip`. Format: split the comma-separated string into a list and pass as `"filters": {"allowed_ip": [...]}` in the response.
- Add conditional public key support: if `sftp_user.use_public_key and sftp_user.public_key`, include `"public_keys": [sftp_user.public_key]` in the returned dict.

**Why:**
- The auth hook should be a pure translator: reads from MariaDB → formats as SFTPGo virtual user spec → returns. All intelligence moves to the service layer. This makes the auth hook deterministic and trivially testable.
- Activating IP whitelisting is a direct security improvement. It was always planned (the commented-out code proves it) but was blocked on the missing `allowed_ip` column from Phase 1.

**Surgical edit guide:**
- Import `SftpService` at the top, instantiate as `sftp_service = SftpService()` module-level singleton.
- Import `settings` from `app.core.config` (remove the `os.getenv` import if it becomes unused).
- Lines 50–57: Replace the entire `quota_map` dict block with one line.
- Line 66: Replace the `home_dir` f-string with the fallback-aware expression.
- Lines 40–43: Replace the commented block with the live IP whitelist check and list conversion.
- After line 70 (existing `"quota_size"` key): Add the conditional `public_keys` key.

---

### File 5 — `app/controllers/partner_controller.py`

**Current state:**
- `__init__` creates `self.partner_service` and `self.admin_log_service`.
- No SFTP methods.

**What we plan to do:**
- Add `self.sftp_service = SftpService()` to `__init__`.
- Add `async def provision_partner_sftp(self, db, request, payload: SftpProvisionRequest, current_admin) → JSONResponse`:
  - Calls `self.sftp_service.provision_partner_sftp(db, payload)`.
  - On success: logs the operation, commits, returns `SftpProvisionResponse` built from the returned `SftpUser` object plus `settings.sftp_server_host` and `settings.sftp_server_port`.
  - On `ValueError`: rollback → `HTTP 400`.
  - On `RuntimeError` (Hetzner call failed): **do NOT rollback** — the MariaDB record was saved intentionally (for retry). Return `HTTP 502` with message explaining "account saved locally, SFTP not yet active on Hetzner — please retry provisioning."
  - On generic `Exception`: rollback → `HTTP 500`.
- Add `async def get_partner_sftp_status(self, db, partner_id) → JSONResponse`:
  - Calls `sftp_user_repo.get_by_partner_id(db, partner_id)`.
  - Returns `SftpStatusResponse` if found, or `HTTP 404` if not provisioned.

**Why:**
- Differentiating the `RuntimeError` (Hetzner down) path from a generic exception is deliberate. We must NOT rollback in that case — the MariaDB row with `sftp_provisioned_at=NULL` is the retry signal. This distinction in the controller means the service stays clean (it just raises; it does not decide what to do).

**Surgical edit guide:**
- Add `from app.services.sftp_service import SftpService` to imports.
- Add `from app.schemas.partner import SftpProvisionRequest, SftpProvisionResponse, SftpStatusResponse` to imports.
- Add `self.sftp_service = SftpService()` as the third line in `__init__`.
- Add the two new methods after `rotate_api_key()` at the bottom of the class.

---

### File 6 — `app/api/routers/admin/partners.py`

**Current state:**
- 8 endpoints for partner CRUD and API key lifecycle.
- No SFTP endpoint.

**What we plan to do:**
- Add `POST /admin/partners/sftp/provision` — calls `partner_controller.provision_partner_sftp`. Protected by `require_admin` + `require_permission("partners:manage")`. Request body: `SftpProvisionRequest`.
- Add `GET /admin/partners/{partner_id}/sftp` — calls `partner_controller.get_partner_sftp_status`. Protected by `require_admin`. Returns `SftpStatusResponse`.
- Add `POST /admin/partners/{partner_id}/sftp/retry` — for the `HTTP 502` case. Calls `sftp_service.retry_provisioning(db, partner_id)` which re-attempts only the Hetzner call for an unprovisioned row. Same RBAC guards.

**Why:**
- Three endpoints is the right number: one to create, one to read status, one to retry on failure. This is RESTful and maps directly to the three meaningful states: (not provisioned), (provisioned), (failed/pending retry).
- The retry endpoint is essential given the `HTTP 502` case above — without it, the admin has no way to trigger re-provisioning without a manual DB + Hetzner operation.

**Surgical edit guide:**
- Add the three new route handlers at the bottom of the file, after `rotate_api_key`.
- Import `SftpProvisionRequest` from `app.schemas.partner`.
- No changes to existing routes.

---

### Phase 2 Checklist

- [ ] Add `SftpProvisionRequest`, `SftpProvisionResponse`, `SftpStatusResponse` to `app/schemas/partner.py`
- [ ] Add 4 new settings to `app/core/config.py` and corresponding env var mappings
- [ ] Create `app/services/sftp_service.py` with `SftpService` class and all 4 methods
- [ ] Update `app/api/routers/internal/sftp.py` — use service, activate IP whitelist, add pubkey support
- [ ] Add `SftpService` to `app/controllers/partner_controller.py` `__init__` and add 2 new methods
- [ ] Add 3 new routes to `app/api/routers/admin/partners.py`
- [ ] Add `HETZNER_SFTP_PROVISION_URL`, `SFTP_SERVER_HOST`, `SFTP_SERVER_PORT`, `SFTP_BASE_PATH` to `.env`
- [ ] Test: `SftpProvisionRequest` with `use_public_key=True` and no `public_key` must fail at schema validation (HTTP 422), before hitting any DB
- [ ] Test: Partner creation flow — provision endpoint → MariaDB row with `sftp_provisioned_at=NULL` exists → Hetzner call mock succeeds → `sftp_provisioned_at` is set
- [ ] Test: Simulate Hetzner unreachable → endpoint returns `HTTP 502` → MariaDB row with `NULL` timestamp persists → retry endpoint sets the timestamp

---

## Notes on Best Practices Applied Throughout

**Transaction boundary integrity:**
The `db.flush()` before the Hetzner call means both operations (MariaDB write + Hetzner HTTP call) are logically part of the same workflow but only the DB write is transactional. The intentional non-rollback on `RuntimeError` is a deliberate design choice documented in the controller — any future developer reading the code will see exactly why.

**No secrets in API responses:**
`SftpStatusResponse` exposes `has_allowed_ip: bool` instead of the IP string. `SftpProvisionResponse` never returns the password hash. The plaintext password is given to the admin exactly once (at provision time), mirroring the API key plaintext-at-issuance pattern.

**Environment-aware Hetzner call:**
If `settings.hetzner_sftp_provision_url` is `None`, the service skips the HTTP call and logs a warning. This means the full provisioning flow works in local development without a Hetzner connection — the MariaDB row is written correctly, the Hetzner step is skipped, and the developer can test the admin UI flow end-to-end.

**Auth hook stays clean:**
The internal SFTP auth hook becomes a pure translator after Phase 2. It reads from MariaDB and formats a response. Zero business logic in the router layer.

---

## Phase 3: Hetzner Provisioning Script

### Goal

Deploy a lightweight internal HTTP service on the Hetzner SX65 server that Alwyzon can call (over the private network) to perform the two things that can only happen on Hetzner:
1. Create the partner's directory tree under `/srv/sftp/partners/{partner_id}/`.
2. Register the user in SFTPGo's REST API so the user appears in the SFTPGo Admin UI and their quota is pre-seeded.

This service is **not exposed to the public internet** — it binds to the private/internal IP only and requires a Bearer token matching the existing `hetzner_internal_api_key`.

### Architecture Note: Two Auth Models Running Together

SFTPGo supports both an external auth hook (dynamic, called on every login) and a local user database (static, managed via REST API). The current setup uses the external auth hook exclusively — SFTPGo calls Alwyzon on each connection. This is the correct primary mechanism and stays unchanged.

The reason we **also** create a user via SFTPGo's REST API in Phase 3 is purely operational: it makes the SFTPGo Admin UI useful. Without a registered user record, the admin panel shows an empty user list. The REST-created user acts as the canonical "shell" — it holds the home directory and quota — but the external auth hook always wins on authentication. If the two ever conflict, the hook response overrides the static record.

---

### Hetzner Server Checklist (Manual Operations)

Before Phase 3 code runs, the following must be set up manually on Hetzner SX65:

- [ ] **SFTPGo is installed and running** (confirmed by user — already done via Docker)
- [ ] **SFTPGo HTTP Admin API is bound to `127.0.0.1:8090`** — confirm in `sftpgo.json` under `httpd.bindings[0].address = "127.0.0.1"`. Do NOT expose this on a public interface.
- [ ] **SFTPGo admin credentials noted** — the provisioning script needs a username/password or API token to call the SFTPGo REST API. Create a dedicated service account in the SFTPGo Admin UI (`admin` → users → create API key) and store it as `SFTPGO_API_KEY` in the Hetzner environment.
- [ ] **SFTP base directory created** — `mkdir -p /srv/sftp/partners` with `chown -R sftpgo:sftpgo /srv/sftp` (or whatever user SFTPGo runs as in your Docker setup).
- [ ] **Private network configured** — Alwyzon must be able to reach Hetzner on an internal/private IP. If both servers are in the same Hetzner project, use the private network IP (e.g. `10.0.0.x`). If not, restrict access at the firewall level so only Alwyzon's IP can reach the provisioning port.
- [ ] **Bind provisioning script to private IP only** — in `hetzner_provisioning/main.py`, start uvicorn with `host="10.0.0.x"` (your Hetzner private VLAN IP) or `host="127.0.0.1"` if Alwyzon reaches Hetzner through a tunnel. **Never use `host="0.0.0.0"`** — that binds to all interfaces including the public NIC, making the endpoint internet-reachable regardless of firewall rules.
- [ ] **Firewall rule** — on Hetzner, port `8091` (the provisioning service port) must only accept connections from Alwyzon's IP. Block all other sources.
- [ ] **Provisioning service process managed** — use `systemd` or Docker Compose to run the provisioning service so it survives reboots.
- [ ] **`HETZNER_INTERNAL_API_KEY` set in Hetzner environment** — this is the shared secret both sides use. Must match the value in Alwyzon's `.env`.

---

### Files Touched

---

#### `hetzner_provisioning/` *(New Directory on Hetzner SX65)*

**Current state:**
- No provisioning service exists. The Hetzner server runs SFTPGo (Docker) and the main Alwyzon-side FastAPI app.

**What we plan to do:**
- Create a minimal standalone FastAPI application (separate from the main Alwyzon codebase) that lives on the Hetzner server. It is a simple single-file service: `main.py` + `requirements.txt` + a `systemd` unit file.
- The service listens on `127.0.0.1:8091` (or the private internal IP). It exposes two endpoints.

**Endpoint 1: `POST /internal/provision-sftp-user`**

Request body (JSON, sent by Alwyzon):
```json
{
  "partner_id": 42,
  "username": "acme_records",
  "password_hash": "$2b$12$...",
  "home_dir": "/srv/sftp/partners/42",
  "quota_bytes": 10737418240,
  "use_public_key": false,
  "public_key": null
}
```
Note: Alwyzon sends the already-hashed password — the plaintext never leaves Alwyzon. The Hetzner script uses the hash directly when creating the SFTPGo user.

Steps the endpoint performs in order:
1. Validate the `Authorization: Bearer` header against `SFTPGO_API_KEY`. Return `HTTP 403` if invalid.
2. Create the directory tree:
   - `/srv/sftp/partners/{partner_id}/incoming/`
   - `/srv/sftp/partners/{partner_id}/processed/`
   - `/srv/sftp/partners/{partner_id}/error/`
   - `/srv/sftp/partners/{partner_id}/test/`
   - `chown -R 1000:1000` and `chmod 750` on each directory (uid/gid 1000 = the sftpgo user).
3. Call SFTPGo REST API `POST http://127.0.0.1:8090/api/v2/users` to create the virtual user:
   - `username`, `home_dir`, `password` (the bcrypt hash), `status: 1` (active)
   - `quota_size`: the tier-specific bytes from the request
   - `permissions`: `{"/": ["*"]}` — SFTPGo permissions; the external auth hook also returns permissions and they merge
   - `filesystem`: `{"provider": 0}` — local filesystem
   - `public_keys`: list with the public key if `use_public_key` is `True`
4. If SFTPGo returns `HTTP 409 Conflict` (user already exists), update instead via `PUT /api/v2/users/{username}`.
5. Return `HTTP 200` with `{"status": "ok", "home_dir": "...", "sftpgo_user_created": true}`.

**Endpoint 2: `DELETE /internal/provision-sftp-user/{username}`**

Called when a partner is decommissioned (future). Removes the SFTPGo user record (NOT the files — file deletion is a separate manual archive operation). The directory is renamed to `/srv/sftp/partners/{partner_id}__decommissioned_{timestamp}` rather than deleted, as a safety measure.

**Why a separate service instead of running a shell script directly:**
- Shell scripts called remotely (via SSH) require SSH key management and are harder to authenticate consistently with the Bearer token pattern already in use.
- A FastAPI HTTP service matches the existing architecture (Alwyzon already calls Hetzner over HTTP for similarity and track deletion). It is testable, loggable, and restartable cleanly.
- A tiny FastAPI service has essentially zero overhead — it uses no database, no Redis. It is a pure filesystem + HTTP bridge.

**Surgical edit guide:**
- Create `hetzner_provisioning/main.py` — single FastAPI app, ~100 lines.
- Create `hetzner_provisioning/requirements.txt` — only `fastapi`, `uvicorn`, `httpx`, `python-dotenv`.
- Create `hetzner_provisioning/provisioning.service` — systemd unit file that starts the service on boot as root or via sudoers so it has `chown` permissions.

**Example `main.py` template (to be copied to Hetzner):**
```python
import os
import httpx
from fastapi import FastAPI, Depends, HTTPException, Header, status
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import subprocess

app = FastAPI(title="Hetzner SFTP Provisioner")

HETZNER_INTERNAL_API_KEY = os.getenv("HETZNER_INTERNAL_API_KEY")
SFTPGO_ADMIN_URL = os.getenv("SFTPGO_ADMIN_URL", "http://127.0.0.1:8090/api/v2")
SFTPGO_ADMIN_USER = os.getenv("SFTPGO_ADMIN_USER", "admin")
SFTPGO_ADMIN_PASS = os.getenv("SFTPGO_ADMIN_PASS", "admin_password")

class ProvisionRequest(BaseModel):
    partner_id: int
    username: str
    password_hash: str
    home_dir: str
    quota_bytes: int
    use_public_key: bool
    public_key: Optional[str] = None

def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=403, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    if token != HETZNER_INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

async def get_sftpgo_token():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{SFTPGO_ADMIN_URL}/token", auth=(SFTPGO_ADMIN_USER, SFTPGO_ADMIN_PASS))
        resp.raise_for_status()
        return resp.json()["access_token"]

@app.post("/internal/provision-sftp-user", dependencies=[Depends(verify_token)])
async def provision_user(req: ProvisionRequest):
    # 1. Create Directories
    home = Path(req.home_dir)
    for sub in ["incoming", "processed", "error", "test"]:
        d = home / sub
        d.mkdir(parents=True, exist_ok=True)
    
    # Needs sudo or running as root for chown. Adjust uid/gid as necessary.
    subprocess.run(["chown", "-R", "1000:1000", str(home)], check=True)
    subprocess.run(["chmod", "-R", "750", str(home)], check=True)

    # 2. SFTPGo API User Creation
    token = await get_sftpgo_token()
    payload = {
        "username": req.username,
        "password": req.password_hash,
        "home_dir": req.home_dir,
        "status": 1,
        "permissions": {"/": ["*"]},
        "quota_size": req.quota_bytes,
        "filesystem": {"provider": 0}
    }
    if req.use_public_key and req.public_key:
        payload["public_keys"] = [req.public_key]

    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post(f"{SFTPGO_ADMIN_URL}/users", json=payload, headers=headers)
        if resp.status_code == 409: # Conflict, update instead
            resp = await client.put(f"{SFTPGO_ADMIN_URL}/users/{req.username}", json=payload, headers=headers)
        resp.raise_for_status()

    return {"status": "ok", "home_dir": req.home_dir, "sftpgo_user_created": True}
```

---

#### `app/services/sftp_service.py` *(Update from Phase 2)*

**Current state (after Phase 2):**
- `_call_hetzner_provisioning` exists and sends the provisioning request to Hetzner.
- It sends `password` (the plaintext) in the request body.

**What we plan to do:**
- Change the Hetzner call payload to send `password_hash` (the bcrypt hash generated in Phase 2 step 3) **instead of** the plaintext password. The Hetzner service stores the hash directly in SFTPGo.
- Add a `quota_bytes` field to the payload, populated by `sftp_service.get_quota_bytes(partner.tier)`. This way Hetzner does not need to know about partner tiers — it just receives a number.
- Add the `retry_provisioning(db, partner_id) → SftpUser` public method:
  - Fetches the `SftpUser` by `partner_id` via `sftp_user_repo.get_by_partner_id`.
  - Raises `ValueError` if the row does not exist or if `sftp_provisioned_at` is already set (meaning it was already successfully provisioned).
  - Re-calls `_call_hetzner_provisioning` with the existing row's data.
  - Calls `mark_provisioned` on success.

**Why:**
- Sending the hash (not the plaintext) to Hetzner is the correct security posture. The plaintext never leaves Alwyzon after it is hashed. The Hetzner service only ever sees the bcrypt output.
- `retry_provisioning` is the companion to the `HTTP 502` response from Phase 2 — without it, the retry route in the admin router has nothing to call.

**Surgical edit guide:**
- In `_call_hetzner_provisioning`, change the payload key from `password` to `password_hash` and pass the hash value.
- Add `quota_bytes: int` as a new parameter to `_call_hetzner_provisioning` and include it in the payload.
- Add `retry_provisioning` method below `deactivate_partner_sftp`.

---

#### `app/controllers/partner_controller.py` *(Update from Phase 2)*

**Current state (after Phase 2):**
- `provision_partner_sftp` exists but does not have the retry method hooked up.

**What we plan to do:**
- Add `retry_partner_sftp(self, db, request, partner_id, current_admin)` controller method:
  - Calls `self.sftp_service.retry_provisioning(db, partner_id)`.
  - On success: logs the retry action with `admin_log_service`, commits, returns updated `SftpStatusResponse`.
  - On `ValueError` (already provisioned or not found): `HTTP 400`.
  - On `RuntimeError` (Hetzner still down): `HTTP 502` again.

**Surgical edit guide:**
- Add the single method `retry_partner_sftp` at the bottom of the class.

---

### Phase 3 Checklist

**On Hetzner SX65:**
- [ ] Confirm SFTPGo Admin API is bound to `127.0.0.1:8090` (not public)
- [ ] Create SFTPGo API key for the provisioning service (via Admin UI → API keys)
- [ ] Create `/srv/sftp/partners` directory with correct ownership
- [ ] Set firewall to allow port `8091` only from Alwyzon's IP
- [ ] Create `hetzner_provisioning/` directory and write `main.py`, `requirements.txt`
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Install and enable `provisioning.service` systemd unit: `systemctl enable --now provisioning`
- [ ] Test the provisioning endpoint manually with `curl` from Alwyzon

**On Alwyzon:**
- [ ] Add `HETZNER_SFTP_PROVISION_URL=http://{hetzner_private_ip}:8091/internal/provision-sftp-user` to `.env`
- [ ] Update `_call_hetzner_provisioning` to send `password_hash` and `quota_bytes`
- [ ] Add `retry_provisioning` to `app/services/sftp_service.py`
- [ ] Add `retry_partner_sftp` to `app/controllers/partner_controller.py`
- [ ] Wire the `POST /admin/partners/{partner_id}/sftp/retry` route added in Phase 2 to call `retry_partner_sftp`
- [ ] End-to-end test: create a partner via Admin → call provision endpoint → verify directory on Hetzner was created → verify user appears in SFTPGo Admin UI → connect with an SFTP client using the credentials

---

## Phase 4: File Validation & Upload Integrity

### Goal

Protect the ingestion pipeline from:
1. **Partial uploads** — partner starts uploading a CSV but loses connection mid-file. Without a guard, our ingestion task reads a truncated file and produces corrupted data.
2. **Corrupted or mismatched files** — the bytes on disk do not match what the partner intended to send, either due to network corruption or a wrong file being uploaded.
3. **Invalid file content** — a file that passes the size check but contains garbage data (e.g. a PDF accidentally named `.csv`).

The existing system uses a `.done` sentinel file pattern: the partner uploads all files, then uploads a `.done` file to signal "I'm finished." The event hook watches for `.done` and fires the ingestion task. This is a good foundation. Phase 4 builds integrity checks on top of it.

---

### The Checksum Protocol (Partner-Facing)

The protocol we adopt is simple and industry-standard:

1. Partner uploads their CSV manifest (e.g. `catalog_batch_001.csv`) into `/incoming/`.
2. Partner uploads a companion checksum file (e.g. `catalog_batch_001.sha256`) into `/incoming/`. This file contains a single line: the SHA-256 hex digest of the CSV followed by two spaces and the filename: `a3f0...  catalog_batch_001.csv`.
3. Partner uploads `.done` to signal completion.
4. Our event hook fires, reads both files, verifies the digest, and only proceeds to ingestion if the checksum matches.

This is the same format produced by the Unix `sha256sum` command, which partners on any OS can generate trivially.

---

### Files Touched

---

#### `app/api/routers/internal/sftp.py`

**Current state:**
- The event hook fires the ingestion task immediately when `.done` is detected with no validation of any kind. It reads the batch path from the SftpUser row and passes it directly to `process_ingestion_batch`.

**What we plan to do:**
- Before calling `process_ingestion_batch`, run a pre-flight validation sequence inside the event hook's background task scope. The hook itself still returns `{"status": "ok"}` immediately to SFTPGo (SFTPGo does not need to wait for our validation). The validation runs asynchronously.
- Extract the validation logic into a call to `sftp_service.validate_incoming_batch(partner_id, batch_path)` which returns a `BatchValidationResult` named tuple (`valid: bool`, `error: str | None`, `csv_path: str | None`).
- If `valid` is `False`, log an error and write a `ValidationFailed` `IngestLog` row. Do not call `process_ingestion_batch`.
- Replace the `os.getenv` call for `SFTP_BASE_PATH` with `settings.sftp_base_path` (this was already flagged in Phase 2 as a cleanup item — Phase 4 is when the event hook gets touched anyway, so we do it here).

**Surgical edit guide:**
- Import `SftpService` at the top (already imported after Phase 2).
- In the `.done` branch, replace the direct `background_tasks.add_task(process_ingestion_batch, ...)` call with a new wrapper background task `_validate_and_ingest(partner_id, batch_path)` that calls `sftp_service.validate_incoming_batch` first, then conditionally calls `process_ingestion_batch`.
- Keep the event hook function itself thin — no logic inline.

---

#### `app/services/sftp_service.py`

**Current state (after Phases 2 and 3):**
- Handles provisioning, Hetzner calls, quota bytes, deactivation, and retry.
- No file validation logic.

**What we plan to do:**
- Add `validate_incoming_batch(partner_id, batch_path) → BatchValidationResult`.

  **Step 1 — Directory sanity check:**
  Verify `Path(batch_path)` exists and is a directory. Return `BatchValidationResult(valid=False, error="incoming directory not found")` if not.

  **Step 2 — Find the CSV:**
  Glob for `*.csv` files. If none found, return `valid=False, error="no CSV manifest found"`. If more than one CSV is found, return `valid=False, error="ambiguous batch: multiple CSV files"` (partners should upload exactly one CSV per batch).

  **Step 3 — Find the checksum file:**
  Look for a `*.sha256` file whose stem matches the CSV filename (e.g. `catalog_batch_001.sha256` paired with `catalog_batch_001.csv`). If no checksum file is found, proceed **without checksum verification** but log a warning. This makes the checksum optional for partners who haven't yet adopted the protocol, without breaking existing partners.

  **Step 4 — Checksum verification (when present):**
  Read the `.sha256` file. Parse the expected hash. Compute `hashlib.sha256` over the CSV file contents in 64KB streaming chunks (never read the entire file into memory at once — CSV manifests can be hundreds of MB). Compare digests. If they differ, return `valid=False, error="checksum mismatch — file may be corrupted or truncated"`.

  **Step 5 — Partial upload detection:**
  Even if no checksum file is present, check for a partial upload condition: read the CSV file size, wait 500ms, read it again. If the size changed between the two reads, the file is still being written. Return `valid=False, error="file still uploading — retry in 30 seconds"`. This is a coarse guard; the `.done` sentinel should make this unnecessary, but it is a safety net.

  **Step 6 — CSV header validation:**
  Open the first line of the CSV and check it contains at minimum the required headers: `isrc` and `title`. If either is missing, return `valid=False, error="invalid CSV headers — expected at least: isrc, title"`. This catches the most common mistake (wrong file uploaded) before any DB writes happen.

- Add `BatchValidationResult` as a `dataclass` or `NamedTuple` at the top of the file with fields: `valid: bool`, `error: Optional[str]`, `csv_path: Optional[Path]`, `checksum_verified: bool`.

**Why:**
- Doing validation in the service (not the router or the ingestion worker itself) means it is independently testable. A unit test can call `validate_incoming_batch` with a directory of fixture files without any HTTP or DB involvement.
- The streaming SHA-256 check (Step 4) is essential for large catalogs. A 500MB CSV must not be loaded into memory to check its hash.
- Making the checksum optional (Step 3) is a deliberate DX decision: legacy partners who are already uploading batches should not break the day Phase 4 ships. We add checksum support progressively.

**Surgical edit guide:**
- Add `BatchValidationResult` as a `NamedTuple` at the module level, above the `SftpService` class.
- Add `validate_incoming_batch` as the last method in the `SftpService` class.
- Import `asyncio`, `hashlib`, `Path` from `pathlib` at the top of the file (some of these may already be imported).

---

#### `app/services/ingestion_service.py`

**Current state:**
- `process_ingestion_batch` does its own basic validation: checks for a CSV, validates `isrc` and `title` column presence per-row. Row errors are written to `IngestionError`.
- No checksum verification.
- No pre-flight header check before starting row iteration.

**What we plan to do:**
- Add `checksum_verified: bool = False` as a parameter to `process_ingestion_batch`. When `True`, the function skips its own repeated header check (since `validate_incoming_batch` already confirmed it). When `False`, it runs the check as before — backward compatible.
- Add `validation_error: Optional[str] = None` as a parameter. If set, the function immediately creates an `IngestLog` with `status="FAILED"` and `error_message=validation_error` without processing any rows. This is the codepath hit when `sftp_service.validate_incoming_batch` returns `valid=False` but we still want an audit trail in `ingest_logs`.
- Move the CSV files glob logic into `process_ingestion_batch`'s early steps if `checksum_verified=False` (existing path). If `checksum_verified=True`, a `csv_path` is passed directly as a parameter, avoiding a second glob call.

**Why:**
- The ingestion worker should not re-validate what the SFTP service already validated. Eliminating duplicate header checks reduces CPU work on large files. The `checksum_verified` flag is the signal that upstream validation already passed.
- The `validation_error` parameter creates a clean audit trail in `ingest_logs` even for batches that never reach row processing. This means the admin dashboard can always see why a batch was rejected — it will appear as a `FAILED` entry with the specific reason.

**Surgical edit guide:**
- Add `checksum_verified: bool = False` and `validation_error: Optional[str] = None` and `csv_path: Optional[str] = None` as keyword arguments to the `process_ingestion_batch` function signature. All have defaults — no callers break.
- Add a guard block at the very top of the function body (after `set_current_partner_id`): if `validation_error` is set, write the failed `IngestLog` and return.
- In the CSV discovery section, add: `if csv_path: manifest_path = Path(csv_path)` to skip the glob when the path is already known.

---

#### `app/models/b2b.py` *(Minor Extension)*

**Current state:**
- `IngestLog` has `status` as `Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`.
- No field to track whether checksum verification was performed or passed.

**What we plan to do:**
- Add `checksum_verified: Mapped[bool]` — `BOOLEAN NOT NULL DEFAULT FALSE`. Set to `True` by `process_ingestion_batch` when checksum verification was performed and passed.
- Add `validation_method: Mapped[Optional[str]]` — `VARCHAR(50) NULLABLE`. Values: `"checksum_sha256"`, `"header_only"`, `"none"`. A quick query field to understand the integrity level of each ingested batch in the admin dashboard.

**Why:**
- The admin dashboard needs to show not just whether a batch succeeded but *how* it was validated. A batch with `checksum_verified=True` is a stronger data quality signal than one without. This is a key field for any compliance audit.

**Surgical edit guide:**
- Add the two new columns to the `IngestLog` class after `completed_at` column definition.
- Add the same columns to the `ingest_logs` CREATE TABLE block in `new_database.sql` and `schema.sql`.
- Create a new Alembic migration `xxxx_ingest_log_checksum_fields.py` following the same pattern as the Phase 1 migration.

---

### Phase 4 Checklist

- [ ] Add `BatchValidationResult` NamedTuple and `validate_incoming_batch` method to `app/services/sftp_service.py`
- [ ] Update `app/api/routers/internal/sftp.py` — replace direct ingestion call with `_validate_and_ingest` wrapper; clean up `SFTP_BASE_PATH` env var usage
- [ ] Update `app/services/ingestion_service.py` — add `checksum_verified`, `validation_error`, `csv_path` params
- [ ] Add `checksum_verified` and `validation_method` columns to `app/models/b2b.py`
- [ ] Create Alembic migration for `ingest_logs` new columns
- [ ] Update `new_database.sql` and `schema.sql` to match
- [ ] Update partner-facing documentation (or a README in the SFTP folder) describing the `.sha256` checksum protocol
- [ ] Test: upload a CSV + matching `.sha256` + `.done` → verify ingestion proceeds and `checksum_verified=True` in `ingest_logs`
- [ ] Test: upload a CSV + mismatched `.sha256` + `.done` → verify ingestion is blocked, `FAILED` log written with "checksum mismatch" message
- [ ] Test: upload a CSV + no `.sha256` + `.done` → verify ingestion proceeds with `checksum_verified=False` and a warning log (backward-compatible path)
- [ ] Test: upload only `.done` with no CSV → verify `FAILED` log with "no CSV manifest found"

---

## Full Implementation Order

For clarity, here is the recommended execution order across all four phases:

```
Phase 1 (DB)
  → Phase 2 (Alwyzon API)
    → Phase 3 Hetzner manual setup (checklist)
      → Phase 3 Hetzner provisioning service (code)
        → Phase 3 Alwyzon service updates (hash in payload, retry)
          → Phase 4 validation logic
            → Phase 4 ingestion service updates
              → Phase 4 model + migration
```

Phases 1 and 2 can be developed and tested locally without any Hetzner connectivity (the `hetzner_sftp_provision_url = None` dev mode from Phase 2). Phase 3 requires a live Hetzner connection for the end-to-end test. Phase 4 can be tested entirely locally using fixture files in a temporary directory.

