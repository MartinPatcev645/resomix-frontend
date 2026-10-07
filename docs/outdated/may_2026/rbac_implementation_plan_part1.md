# Resomix RBAC & Admin Security — Implementation Plan (Part 1 of 2)

**Scope:** Activate the existing RBAC schema, introduce proper admin authentication via JWT, wire permissions into dependency resolution, and establish the correct linkage between `users`, `roles`, `permissions`, `partners`, and `sftp_users`. Part 2 covers the admin UI routes, user management endpoints, audit logging, and the partner-as-user path.

---

## 1. Current State Audit

### What We Have (Keep As-Is)

| Asset | Location | Status |
| :--- | :--- | :--- |
| `roles` table | `new_database.sql` line 191, `app/models/user.py` `Role` class | Exists, **empty** |
| `permissions` table | `new_database.sql` line 200, `app/models/user.py` `Permission` class | Exists, **empty** |
| `user_roles` junction | `new_database.sql` line 336, `app/models/user.py` `UserRole` class | Exists, **no audit columns**, **empty** |
| `role_permissions` junction | `new_database.sql` line 347, `app/models/user.py` `RolePermission` class | Exists, **empty** |
| `users` table | `new_database.sql` line 165, `app/models/user.py` `User` class | Exists, `partner_id` FK present |
| `sftp_users` table | `new_database.sql` line 1263 | Exists, FK to `labels` + `partners`, **no FK to `users`** |
| JWT user auth | `app/api/dependencies/auth.py` → `get_current_user` | Working, no RBAC checks inside |
| Admin API key auth | `app/api/dependencies/auth.py` → `get_api_key` | Working, single shared secret — **not secure** |
| `app/core/security.py` | Token encode/decode | Working JWT infrastructure |

### What Is Missing

1. **Seed data** — roles and permissions tables are empty; no roles are assigned to any user.
2. **`user_roles` audit columns** — no `granted_at` or `granted_by` as recommended by the expert.
3. **RBAC permission enforcement** — `get_current_user` returns a user object but never checks roles or permissions.
4. **No `get_current_admin` dependency** — admin routes rely only on a static API key string; anyone with that string is a full admin, forever.
5. **Admin has no proper login** — no JWT-based admin session; no way to know *which* admin did what.
6. **No user management admin routes** — you cannot list, create, update, or assign roles to users via the API.
7. **`sftp_users` is not linked to `users`** — SFTP accounts exist independently, making it impossible to associate an SFTP identity with an authenticated user.
8. **No admin operation audit log** — admin actions are not separately tracked beyond the generic `system_logs` table.
9. **`partner_id` on `users` is structurally correct, but the path for adding a partner as a user with limited permissions is not defined.**

---

## 2. The Expert's Recommendation — Applied

The expert confirmed the four-table RBAC setup (`roles`, `permissions`, `user_roles`, `role_permissions`) is correct and should not be changed. Their specific action items were:

1. **Seed the roles** — at minimum `admin` and `user`. Defer `label_manager` and `artist` until DSP partners require them.
2. **Seed the permissions** — named as `resource:action` strings, mapping real operations in the system.
3. **Seed `role_permissions`** — admin gets everything; user gets the consumer-facing subset.
4. **Add `granted_at` and `granted_by` to `user_roles`** — for audit trail of who assigned a role and when.

All four items are addressed in this plan.

---

## 3. Database Changes

### 3.1 Migration: Add Audit Columns to `user_roles`

This is an additive, non-breaking migration. Apply via Alembic.

**What to do:**
- Add `granted_at DATETIME DEFAULT CURRENT_TIMESTAMP` — auto-populated on insert.
- Add `granted_by INT UNSIGNED DEFAULT NULL` — FK to `users(id)` with `ON DELETE SET NULL`. Nullable because the first admin may be seeded without a granting user.

**File to touch:** Create a new Alembic migration file under `alembic/versions/`. The migration should be named something like `add_audit_cols_to_user_roles.py`.

**SQLAlchemy model to update:** `app/models/user.py` → `UserRole` class.
- Add `granted_at: Mapped[Optional[DateTime]]` column.
- Add `granted_by: Mapped[Optional[int]]` column with FK to `users.id`.
- Add a `granter: Mapped[Optional["User"]]` relationship pointing to the granting user (use `foreign_keys` explicitly since `UserRole` already references `users` via `user_id`).

**Do not remove** the existing `user_id`, `role_id`, or the relationships. This is purely additive.

### 3.2 Migration: Add `user_id` FK to `sftp_users`

Currently `sftp_users` links to `labels` and `partners` but not to `users`. When a label manager or partner SFTP account needs to be associated with a platform user, there is no join path.

**What to do:**
- Add a nullable `user_id INT UNSIGNED DEFAULT NULL` column to `sftp_users`.
- Add `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`.
- Add an index on this column.

This is nullable so existing SFTP accounts without a platform user link are not broken. New SFTP accounts provisioned for partners or label managers should always populate this column.

**File to touch:** New Alembic migration. No SQLAlchemy model exists for `sftp_users` yet — create `app/models/sftp_user.py` following the pattern of other models. It belongs in `app/models/`. Import it in `app/models/__init__.py` so SQLAlchemy is aware of it.

### 3.3 New Table: `admin_audit_logs`

This is a **new table** dedicated to logging every admin operation separately from the general `system_logs`. While `system_logs` captures request-level telemetry, `admin_audit_logs` captures the *intent and outcome* of administrative actions with the identity of the admin who performed them.

**Why separate?** The general `system_logs` does not have a concept of an acting admin user. Admin operations need to be searchable by actor, action type, and target resource for compliance and forensic purposes.

**Columns to include:**
- `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`
- `admin_user_id INT UNSIGNED NOT NULL` — FK to `users(id)`, the admin who performed the action. `ON DELETE RESTRICT` — never delete audit records.
- `action VARCHAR(100) NOT NULL` — e.g., `user.role.assign`, `partner.api_key.revoke`, `user.deactivate`.
- `target_type VARCHAR(50)` — what type of resource was acted upon, e.g., `user`, `partner`, `role`.
- `target_id VARCHAR(100)` — the ID or UUID of the target resource. Stored as VARCHAR to support both integer IDs and UUIDs.
- `before_state JSON DEFAULT NULL` — snapshot of the resource before the change.
- `after_state JSON DEFAULT NULL` — snapshot of the resource after the change.
- `ip_address VARCHAR(45)` — the IP of the admin's request.
- `user_agent VARCHAR(500)` — the admin's client.
- `correlation_id CHAR(36)` — links to the request in `system_logs`.
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP` with an index.

**File to touch:** Create `app/models/admin_audit_log.py`. Import in `app/models/__init__.py`. Add a corresponding Alembic migration.

---

## 4. Seed Data

Seeding is a one-time operation that must be run in both staging and production. It should be implemented as a standalone idempotent script (using `INSERT IGNORE` or `ON DUPLICATE KEY IGNORE` semantics) so it is safe to run multiple times.

### 4.1 Roles to Seed

| `name` | `description` |
| :--- | :--- |
| `admin` | Full system access. Can manage users, partners, roles, and all content. |
| `user` | Standard consumer. Can use playlists, similarity search, and profile features. |
| `partner_user` | A user who represents a B2B partner. Has access to partner-scoped operations. Defer permissions until partner UI exists. |

Do not add `label_manager` or `artist` now. They will be added when the DSP onboarding roadmap begins.

### 4.2 Permissions to Seed

Permissions follow the `resource:action` convention. Below is the full initial set. The admin role gets all of them; the user role gets the starred subset.

**User-Facing Permissions (assign to both `admin` and `user` roles):**

| Permission Name | Description |
| :--- | :--- |
| `track:read` | View and search tracks |
| `playlist:read` | View playlists |
| `playlist:create` | Create a new playlist |
| `playlist:update` | Edit own playlists |
| `playlist:delete` | Delete own playlists |
| `playlist:fork` | Fork a public playlist |
| `similarity:search` | Run a similarity search by track ID |
| `similarity:upload` | Upload audio for similarity search |
| `spotify:transfer` | Transfer a playlist to Spotify |
| `profile:read` | Read own profile |
| `profile:update` | Update own profile |

**Admin-Only Permissions (assign to `admin` role only):**

| Permission Name | Description |
| :--- | :--- |
| `admin:access` | Can log in to and use the admin interface |
| `user:read` | List and view user details |
| `user:create` | Register a new user manually |
| `user:update` | Edit any user's profile or status |
| `user:delete` | Deactivate or delete a user |
| `user:role:assign` | Assign or revoke roles on any user |
| `partner:read` | View partner records |
| `partner:create` | Create a new partner tenant |
| `partner:update` | Update partner details |
| `partner:delete` | Delete a partner |
| `partner:api_key:manage` | Issue, revoke, or rotate API keys for partners |
| `role:read` | View roles and their permissions |
| `role:manage` | Create, update, or delete roles and their permission assignments |
| `operation_limit:manage` | Set or adjust per-user operation limits |
| `waitlist:manage` | Approve, reject, or delete waitlist entries |
| `feedback:manage` | View and resolve feedback entries |
| `contact:manage` | View and resolve contact inquiries |
| `content:takedown` | Issue a manual content takedown |
| `reports:view` | View generated reports and analytics |

### 4.3 Where to Put the Seed Script

Create `scripts/seed_rbac.py`. It should:
1. Use `AsyncSessionLocal` directly (same pattern as other scripts).
2. Be fully idempotent — check if a row exists before inserting.
3. Accept a `--dry-run` flag that prints what would be inserted without committing.
4. Log each insertion clearly.

Do **not** put the seed logic inside Alembic migrations. Migrations handle schema; seed data is a separate concern and should be independently re-runnable.

---

## 5. Core RBAC Enforcement

### 5.1 The Permission Check Pattern

The current `get_current_user` dependency in `app/api/dependencies/auth.py` returns a `User` object with no role or permission context. This is correct — the dependency should remain lean and not eagerly load all relationships.

The right approach is a **dependency factory** that wraps `get_current_user` and adds a permission check. This is the same pattern already used for `get_current_partner_scoped` in `app/api/dependencies/partner.py`.

**What to create:** A new function `require_permission(permission_name: str)` in `app/api/dependencies/auth.py`. It returns a FastAPI dependency that:
1. Calls `get_current_user` to obtain the authenticated user.
2. Loads that user's roles and the permissions of those roles from the database. This is a single joined query — load `user_roles` joined to `role_permissions` joined to `permissions` where `user_id = current_user.id`. This must be done async.
3. Checks if the required permission name is in the set of resolved permission names.
4. If yes, returns the user (so the route still has access to the user object).
5. If no, raises `HTTP 403 Forbidden` with a clear message: `"Insufficient permissions. Required: {permission_name}"`.

Cache the resolved permission set on `request.state.permissions` after the first resolution per request so that multiple permission checks in the same request lifecycle don't hit the database multiple times.

### 5.2 The `require_admin` Shortcut

Because admin routes need `admin:access` on every endpoint, create a convenience dependency `require_admin` that calls `require_permission("admin:access")`. This becomes a drop-in replacement for `get_api_key` on admin routes.

**Where to define it:** `app/api/dependencies/auth.py`, directly below `require_permission`.

### 5.3 Existing Routes and Backward Compatibility

**Do not change** `get_api_key` yet. It is used in tests and the existing admin routes. The migration to `require_admin` is done route-by-route during the admin route hardening phase (covered in Part 2). The key rule is: `get_api_key` stays for the transition period and is removed only after all routes have been migrated and tested.

**Do not change** `get_current_user`. It remains the base dependency for user authentication. The permission layer sits on top of it.

### 5.4 Repository Changes

Create `app/repositories/rbac_repository.py`. This should contain:

- `get_user_permissions(db, user_id: int) -> set[str]` — the single query that resolves a user's full permission set. Use a JOIN across `user_roles`, `role_permissions`, and `permissions`. Return a Python `set` of permission name strings. This is the only place this query should ever live.
- `get_user_roles(db, user_id: int) -> list[Role]` — for listing a user's assigned roles in the management UI.
- `assign_role(db, user_id: int, role_id: int, granted_by_id: int) -> UserRole` — inserts a row into `user_roles` with `granted_by` and `granted_at` populated.
- `revoke_role(db, user_id: int, role_id: int) -> bool` — deletes the row from `user_roles`.

Do not scatter permission queries across controllers and services. All RBAC queries must go through this one repository.

---

## 6. Admin JWT Authentication

### 6.1 The Problem with the Current Approach

The current admin authentication is a **single shared static API key** (`settings.api_key`). This means:
- There is no way to know *which* admin made a request.
- The key never expires.
- There is no revocation mechanism.
- If the key leaks, every admin function is compromised with no audit trail.

The fix is a **JWT-based admin login** that uses the same `users` table but checks that the user has the `admin:access` permission before issuing an admin-scoped JWT.

### 6.2 Admin Login Flow

The admin user is a regular `User` row with the `admin` role assigned in `user_roles`. The login endpoint is a new, separate endpoint, not the existing `POST /auth/login` which is for consumer users.

Create `POST /api/v1/admin/auth/login`. It accepts `email` and `password` (form or JSON), verifies credentials against the `users` table using the existing `bcrypt` password verification, checks that the user has `admin:access` permission, and returns a short-lived JWT access token (recommend 2 hours maximum) and a refresh token.

The JWT payload for admin tokens should include a `"role": "admin"` claim in addition to the standard `sub` (user UUID) and `type` claims. This allows `require_admin` to fast-fail on the claim without a database hit if the token lacks that claim.

**What to touch:**
- `app/api/routers/admin/__init__.py` — register the new auth router.
- Create `app/api/routers/admin/auth.py` with the login, logout, and token-refresh endpoints.
- `app/controllers/` — create `app/controllers/admin_auth_controller.py` for the login business logic.
- `app/core/security.py` — the existing `create_access_token` can be reused; add an optional `extra_claims` parameter to allow injecting `{"role": "admin"}` into the payload without changing the function signature.

### 6.3 Admin Token Verification in `require_admin`

The `require_admin` dependency should, after verifying the user exists and has `admin:access` permission, also check that the JWT claim `role == "admin"` is present. This provides defence-in-depth: even if someone has the `admin:access` permission but logged in via the consumer endpoint (which does not embed the claim), they cannot use admin routes.

### 6.4 Cloudflare Zero Trust — The Relationship

The existing Cloudflare ZTS provides network-level access control to the admin UI application (the React frontend). This is a separate, complementary layer:

- **Cloudflare ZTS:** Controls *who can reach* the admin UI at the network level (VPN/identity-aware proxy). This is not changing.
- **JWT Admin Auth (new):** Controls *who can make authenticated API calls* from within the admin UI. API requests require a valid admin JWT token.

These two layers work together. Cloudflare prevents unauthenticated traffic from reaching the admin domain. The JWT layer ensures that even a valid Cloudflare session cannot perform admin API operations without a proper admin JWT. Do not remove Cloudflare ZTS — add the JWT layer on top of it.

---

## 7. Files Summary for Part 1

| Action | File | What to do |
| :--- | :--- | :--- |
| Create migration | `alembic/versions/xxx_add_audit_cols_user_roles.py` | Add `granted_at`, `granted_by` to `user_roles` |
| Create migration | `alembic/versions/xxx_add_user_id_sftp_users.py` | Add nullable `user_id` FK to `sftp_users` |
| Create migration | `alembic/versions/xxx_create_admin_audit_logs.py` | Create `admin_audit_logs` table |
| Update model | `app/models/user.py` → `UserRole` | Add `granted_at`, `granted_by`, `granter` relationship |
| Create model | `app/models/sftp_user.py` | Full SQLAlchemy model for `sftp_users` |
| Create model | `app/models/admin_audit_log.py` | SQLAlchemy model for `admin_audit_logs` |
| Update | `app/models/__init__.py` | Import both new models |
| Create | `scripts/seed_rbac.py` | Idempotent role/permission seed script |
| Create | `app/repositories/rbac_repository.py` | `get_user_permissions`, `assign_role`, etc. |
| Update | `app/api/dependencies/auth.py` | Add `require_permission`, `require_admin` |
| Create | `app/api/routers/admin/auth.py` | Admin login/logout/refresh endpoints |
| Create | `app/controllers/admin_auth_controller.py` | Admin login business logic |
| Update | `app/core/security.py` | Optional `extra_claims` on `create_access_token` |

---

*Continue in Part 2 → Admin Routes Hardening, User Management Endpoints, Audit Logging Service, Partner-User Association, and Implementation Sequence.*
