# Resomix RBAC & Admin Security — Implementation Plan (Part 2 of 2)

**This continues from Part 1.** Part 1 covered the current state audit, database migrations, seed data, the RBAC permission-check dependency, and JWT-based admin authentication. Part 2 covers hardening the existing admin routes, the new user and role management endpoints, the admin audit log service, the partner-as-user path, and the complete implementation sequence.

---

## 8. Admin Route Hardening

### 8.1 The Transition Plan

All existing admin routes in `app/api/routers/admin/` currently use `get_api_key` from `app/api/dependencies/auth.py`. This must be replaced with `require_admin` (the new JWT-based dependency introduced in Part 1). The transition is done **router by router**, not all at once.

**The sequence:**
1. Implement `require_admin` and the admin login endpoint (Part 1 prerequisites).
2. Write the admin JWT e2e test before touching any route.
3. Migrate one router at a time, running the test suite after each.
4. Remove `get_api_key` only after all admin routes are migrated and tests pass.

**Do not** run both `get_api_key` and `require_admin` on the same endpoint simultaneously. Pick one and test it.

### 8.2 Router-by-Router Migration

Each router in `app/api/routers/admin/` needs the following change pattern on every endpoint:

- **Remove** `api_key: str = Security(get_api_key)` from the endpoint signature.
- **Add** `current_admin: User = Depends(require_admin)` to the endpoint signature.
- **Pass** `current_admin` down to the controller method so it can be used for audit logging.

Routers to migrate, in recommended order (lowest risk first):

| Router File | Risk Level | Notes |
| :--- | :--- | :--- |
| `admin/auth.py` (new) | — | The login endpoint itself; bootstrap |
| `admin/waitlist.py` | Low | Read-heavy, no destructive ops |
| `admin/feedback.py` | Low | Read-heavy |
| `admin/contact.py` | Low | Read-heavy |
| `admin/spotify_apps.py` | Medium | Creates associations |
| `admin/partners.py` | High | Creates and deletes tenants; do last |
| `admin/operation_limits.py` | Medium | Affects per-user quotas |
| `admin/playlist.py` | Medium | Content management |
| `admin/users.py` (new) | — | New file; built with `require_admin` from the start |
| `admin/roles.py` (new) | — | New file; built with `require_admin` from the start |

### 8.3 Granular Permission Enforcement on Admin Routes

`require_admin` is the gate for entering the admin space. But not every admin user should be able to do everything. For finer control, some sensitive admin endpoints should additionally call `require_permission("permission:name")`.

Examples of where granular enforcement matters:
- The `DELETE /admin/partners/{partner_id}` endpoint should require both `admin:access` (via `require_admin`) and `partner:delete`.
- The `POST /admin/partners/api-keys/revoke` endpoint should require `partner:api_key:manage`.
- The `POST /admin/users/{user_id}/roles` endpoint should require `user:role:assign`.
- The `GET /admin/reports/` endpoints require `reports:view`.

For endpoints that are general read operations within the admin space (list waitlist, list feedback, etc.), `require_admin` alone is sufficient — every admin has `admin:access`.

The pattern is: use `require_admin` as the base; stack `require_permission(...)` only on destructive or sensitive mutation endpoints.

---

## 9. User Management Admin Endpoints

### 9.1 New Router: `admin/users.py`

Create this file from scratch. It should follow the exact same structure as the existing admin routers — `APIRouter` with prefix `/admin/users`, tag `admin-users`, and all endpoints secured with `require_admin`.

**Endpoints to implement:**

**`GET /admin/users/`** — Paginated list of all users across all partners (admin sees everything). Supports filtering by `partner_id`, `is_email_verified`, `role` name, and text search on email/username. Returns user summary objects (no password hashes ever, not even hashed).

**`GET /admin/users/{user_uuid}`** — Full user detail including their assigned roles, operation limits, and Spotify app association. Uses the user's `uuid` (not internal `id`) in the URL to avoid leaking internal IDs in the admin UI.

**`POST /admin/users/`** — Create a user manually. Accepts email, username, password, `partner_id`, and an optional initial role name. The password should go through the same `bcrypt` hashing used in the consumer registration flow. This endpoint is for onboarding partner-linked users or internal admin accounts — it is not a public registration route.

**`PATCH /admin/users/{user_uuid}`** — Update user profile fields. Allowed fields: `name`, `email`, `username`, `language`, `timezone`, `is_email_verified`. Password changes must go through a separate dedicated endpoint, not this one.

**`POST /admin/users/{user_uuid}/deactivate`** — Soft-deactivate a user. This does not delete the row. Instead, it revokes all active sessions from `user_sessions` and marks the user as inactive. The `users` table needs an `is_active` boolean column — check if it already exists; if not, add it in a migration. Deactivated users cannot log in.

**`POST /admin/users/{user_uuid}/activate`** — Re-activates a previously deactivated user.

**`GET /admin/users/{user_uuid}/roles`** — Lists all roles assigned to a user, including `granted_at` and the username of who granted each role.

**`POST /admin/users/{user_uuid}/roles`** — Assigns a role to a user. Body: `{ "role_name": "partner_user" }`. Calls `rbac_repository.assign_role(...)` with `granted_by_id = current_admin.id`. Emits an `admin_audit_log` entry.

**`DELETE /admin/users/{user_uuid}/roles/{role_name}`** — Revokes a role from a user. Calls `rbac_repository.revoke_role(...)`. Also emits an `admin_audit_log` entry.

**`GET /admin/users/{user_uuid}/operation-limits`** — Lists all operation limits for a user. Reuses the existing `UserOperationLimit` model.

**`PUT /admin/users/{user_uuid}/operation-limits/{operation_code}`** — Sets or updates the limit for a specific operation code for this user. This replaces the existing operation limit endpoint if one exists in `admin/operation_limits.py`.

### 9.2 New Router: `admin/roles.py`

This is the interface for managing the RBAC configuration itself.

**Endpoints to implement:**

**`GET /admin/roles/`** — Lists all roles with their permission count. No pagination needed — there will never be more than ~20 roles.

**`GET /admin/roles/{role_name}`** — Full role detail including every assigned permission.

**`POST /admin/roles/`** — Creates a new role. Requires `role:manage` permission in addition to `admin:access`. Body: `{ "name": "label_manager", "description": "..." }`.

**`PATCH /admin/roles/{role_name}`** — Updates the description of a role. Does not allow renaming the `admin` or `user` built-in roles (enforce this in the controller).

**`POST /admin/roles/{role_name}/permissions`** — Assigns a permission to a role. Body: `{ "permission_name": "track:upload" }`. Requires `role:manage`.

**`DELETE /admin/roles/{role_name}/permissions/{permission_name}`** — Removes a permission from a role. Requires `role:manage`. Must prevent removing `admin:access` from the `admin` role (enforce in the controller).

**`GET /admin/permissions/`** — Lists all available permissions. This is a read-only reference endpoint; permissions are seeded, not created through the UI.

### 9.3 Controllers and Services

Create:
- `app/controllers/user_management_controller.py` — handles all user admin operations. References `rbac_repository` for role operations and writes to `admin_audit_logs` on every mutation.
- `app/controllers/role_management_controller.py` — handles role and permission management. Also writes to `admin_audit_logs`.

Do **not** put admin user management logic into the existing `UserController` or `AuthController`. Those serve the consumer API. Mixing admin and consumer concerns in a single controller violates separation of concerns and makes the codebase harder to audit.

---

## 10. Admin Audit Log Service

### 10.1 Why a Dedicated Service

The `system_logs` table captures HTTP request telemetry. The `admin_audit_logs` table captures the *semantic meaning* of admin actions. These are different concerns. A service layer makes the audit log easy to call from any admin controller without repeating logic.

### 10.2 `app/services/admin_audit_service.py`

Create this file. It should expose a single primary method: `log_admin_action(...)`.

**Parameters it should accept:**
- `db: AsyncSession` — the active database session.
- `admin_user_id: int` — the `id` of the admin performing the action (from `current_admin.id`).
- `action: str` — the action string, e.g., `"user.role.assign"`. Use dot-separated `resource.subresource.verb` format consistently.
- `target_type: str` — e.g., `"user"`, `"partner"`, `"role"`.
- `target_id: str` — the UUID or ID of the affected resource, as a string.
- `before_state: dict | None` — snapshot of the object before the change. Fetch this before the mutation.
- `after_state: dict | None` — snapshot of the object after the change. Fetch this after the mutation.
- `request: Request` — to extract `ip_address` and `user_agent`.
- `correlation_id: str | None` — optional, to link to the `system_logs` entry for the same request.

**Behaviour:**
- This method must never raise an exception that propagates to the route handler. Wrap the database insert in a try/except and log a critical warning to the standard logger if the audit write fails — but do not fail the original admin operation because of a logging failure.
- Always use `db.flush()` not `db.commit()` — the calling controller manages the transaction.

### 10.3 Calling Pattern in Controllers

The audit log call should happen **after** the mutation succeeds but **before** the controller returns. Always capture the `before_state` **before** the mutation and the `after_state` **after**. This ensures the audit log reflects a real change, not a speculative one.

For the `before_state`, use a simple dict serialisation of the relevant model fields — not the full SQLAlchemy object. Define a `to_audit_dict()` helper method on each model that needs it (User, Partner, Role, UserRole).

---

## 11. Partner-as-User Path

### 11.1 The Current Situation

A partner is a B2B tenant represented by the `partners` table. Users are consumer accounts in the `users` table, linked to a partner via `partner_id`. A user already *belongs to* a partner via `partner_id`.

What does not yet exist is a **user who logs in with JWT and represents a partner organisation** with specific permissions scoped to that partner's data — i.e., a partner CRM/dashboard user.

### 11.2 The Design (Future-Ready, Low-Effort Now)

The design is already 90% complete in the schema. No new tables are needed.

- A partner staff member is a `User` row with `partner_id` set to that partner's ID.
- They are given the `partner_user` role.
- The `partner_user` role has permissions that are scoped to what a partner should see.
- The JWT issued to them contains their `user_id` and `partner_id`. The existing `partner_id` on `User` is already loaded when `get_current_user` resolves them.

**What to do now (preparation only):**
1. Seed the `partner_user` role (already included in Section 4.1 of Part 1). Leave its `role_permissions` empty for now — no partner UI exists yet.
2. Ensure `POST /admin/users/` (Section 9.1) allows creating a user with a specific `partner_id` and assigning the `partner_user` role in one operation.
3. Document in the code that `partner_id` on `User` is the isolation boundary, and that `partner_user` roles will be used when the partner portal is built.

**What not to do now:** Do not build partner-facing authenticated endpoints, a partner login page, or partner-scoped JWT flows. This is explicitly deferred until the partner portal is in scope.

### 11.3 SFTP User Linkage

With the `user_id` FK added to `sftp_users` (Part 1, Section 3.2), it becomes possible to associate an SFTP account with a platform user. The flow is:

- When provisioning SFTP access for a new partner via `POST /admin/partners/`, also create a `sftp_users` row with `user_id` pointing to the partner's designated user account.
- The SFTP username and password are separate credentials, but the association allows admin to see "which user owns this SFTP account."
- Expose this association in `GET /admin/users/{user_uuid}` — include a `sftp_account` object in the response if one exists.

This requires updating `user_management_controller.py` to join `sftp_users` on `user_id` when loading the full user detail.

---

## 12. Schemas and Pydantic Models

All new admin endpoints need Pydantic request and response schemas. Follow the existing convention in `app/schemas/`.

**Create `app/schemas/admin_user.py`:**
- `AdminUserSummary` — for the list endpoint. Fields: `uuid`, `email`, `username`, `name`, `partner_id`, `is_email_verified`, `created_at`, roles as a list of strings.
- `AdminUserDetail` — for the detail endpoint. Extends `AdminUserSummary` with `roles` (full objects including `granted_at`, `granted_by_username`), `operation_limits`, `spotify_app_association`, `sftp_account`.
- `AdminUserCreateRequest` — fields: `email`, `username`, `password`, `name`, `partner_id`, `initial_role`.
- `AdminUserUpdateRequest` — all fields optional.
- `AdminRoleAssignRequest` — `role_name: str`.
- `AdminUserListResponse` — wraps `AdminUserSummary` list with pagination.

**Create `app/schemas/admin_role.py`:**
- `RoleDetail` — `name`, `description`, `permissions` as list of strings.
- `RoleCreateRequest` — `name`, `description`.
- `PermissionSummary` — `name`, `description`.
- `RoleListResponse` — list of `RoleDetail`.

**Create `app/schemas/admin_auth.py`:**
- `AdminLoginRequest` — `email`, `password`.
- `AdminTokenResponse` — `access_token`, `token_type`, `expires_in`.

Keep the response wrapper convention already established in the codebase (`{ "success": true, "data": ... }`).

---

## 13. Test Coverage

### 13.1 Tests to Add

All tests go in `tests/api/`. Follow the existing pattern of `patch.object` on the controller singleton.

**`tests/api/test_admin_auth.py`:**
- Admin with correct credentials and `admin:access` permission receives a JWT.
- Admin with wrong password receives `401`.
- Non-admin user (has `user` role but not `admin:access`) receives `403`.
- Admin JWT is required for all admin routes — passing a consumer JWT returns `403`.
- Expired admin JWT returns `401`.

**`tests/api/test_user_management.py`:**
- `GET /admin/users/` returns paginated list.
- `POST /admin/users/` creates a user with the correct `partner_id`.
- `POST /admin/users/{uuid}/roles` assigns a role and creates an audit log entry.
- `DELETE /admin/users/{uuid}/roles/user` revokes a role.
- Assigning the same role twice returns a clear conflict error, not a 500.
- `POST /admin/users/{uuid}/deactivate` revokes all sessions and prevents re-login.

**`tests/api/test_rbac_permissions.py`:**
- A user with only the `user` role receives `403` on an `admin:access`-protected route.
- A user with the `admin` role but **not** `partner:delete` receives `403` on delete-partner endpoint (if granular enforcement is applied there).
- `get_user_permissions` repository function returns the correct set for a multi-role user.
- The `request.state.permissions` cache prevents duplicate DB queries within a request.

### 13.2 Updating Existing Security Tests

The existing tests in `tests/api/test_granular_security.py` use `dependency_overrides` to bypass authentication. After the admin route migration, any test that calls admin endpoints must either:
1. Use `dependency_overrides[require_admin]` (replacing `dependency_overrides[get_api_key]`), or
2. Provide a valid mock admin user via `dependency_overrides[get_current_user]` and ensure the mock user's `permissions` resolve correctly.

Update `tests/api/test_admin_workflows.py` to use `require_admin` overrides once that dependency exists.

---

## 14. Implementation Sequence

The following order minimises risk and ensures each step is independently testable before the next begins.

| Step | Action | Risk | Approx. Effort |
| :--- | :--- | :--- | :--- |
| 1 | Write and run the `user_roles` migration (add `granted_at`, `granted_by`) | Low | 1h |
| 2 | Write and run the `sftp_users` migration (add `user_id`) | Low | 1h |
| 3 | Write and run the `admin_audit_logs` migration | Low | 1h |
| 4 | Update `UserRole` model in `app/models/user.py` | Low | 30m |
| 5 | Create `app/models/sftp_user.py` and `app/models/admin_audit_log.py` | Low | 1h |
| 6 | Create `app/repositories/rbac_repository.py` with all query functions | Low | 2h |
| 7 | Create `scripts/seed_rbac.py` and **run it on staging first** | Medium | 2h |
| 8 | Add `require_permission` and `require_admin` to `app/api/dependencies/auth.py` | Medium | 2h |
| 9 | Update `app/core/security.py` with optional `extra_claims` | Low | 30m |
| 10 | Create `app/controllers/admin_auth_controller.py` | Medium | 2h |
| 11 | Create `app/api/routers/admin/auth.py` (login, logout, refresh) | Medium | 2h |
| 12 | Write `tests/api/test_admin_auth.py` and confirm all pass | Medium | 2h |
| 13 | Create `app/services/admin_audit_service.py` | Low | 1.5h |
| 14 | Migrate `admin/waitlist.py` from `get_api_key` to `require_admin` | Low | 1h |
| 15 | Migrate `admin/feedback.py`, `admin/contact.py` | Low | 1h |
| 16 | Migrate `admin/spotify_apps.py`, `admin/operation_limits.py` | Medium | 1.5h |
| 17 | Migrate `admin/partners.py` (most critical — test thoroughly) | High | 2h |
| 18 | Create schemas: `admin_user.py`, `admin_role.py` in `app/schemas/` | Low | 2h |
| 19 | Create `app/controllers/user_management_controller.py` | Medium | 4h |
| 20 | Create `app/controllers/role_management_controller.py` | Low | 2h |
| 21 | Create `app/api/routers/admin/users.py` | Medium | 3h |
| 22 | Create `app/api/routers/admin/roles.py` | Low | 2h |
| 23 | Write `tests/api/test_user_management.py` | Medium | 3h |
| 24 | Write `tests/api/test_rbac_permissions.py` | Medium | 2h |
| 25 | Update existing `test_admin_workflows.py` to use new auth | Low | 1h |
| 26 | Run full test suite on staging. Fix any failures. | — | Buffer 2h |
| 27 | Run `seed_rbac.py` on production. Assign `admin` role to the first admin user manually. | High | 30m |
| 28 | Remove `get_api_key` from all admin routes. Delete the static secret from production env. | High | 1h |

**Total estimated effort: ~40 hours.** This excludes the Cloudflare ZTS (already in place) and any frontend admin login UI changes.

---

## 15. Standards and Constraints

### Things to Strictly Follow

- **Never return password hashes** in any API response, including admin endpoints. The `password_hash` field must be explicitly excluded from every Pydantic response schema.
- **Never log passwords or tokens** in `admin_audit_logs`, `system_logs`, or standard Python logging.
- **`before_state` and `after_state` in `admin_audit_logs`** must exclude `password_hash` if serialising a `User` object.
- **Seeded roles and built-in permissions are immutable through the API.** The `admin` and `user` roles cannot be deleted. The `admin:access` permission cannot be removed from the `admin` role. Enforce this in the controller with explicit guards, not just at the database level.
- **All admin mutations must have an `admin_audit_logs` entry.** If a controller performs a write and does not call `admin_audit_service.log_admin_action`, it is incomplete. This is a hard rule.
- **Do not re-use the consumer `POST /auth/login` for admin login.** They are separate flows with different token claims and different session management.
- **Do not store plaintext API keys, secrets, or passwords anywhere** — this is already the pattern; maintain it.
- **Permission checks are always async database operations** unless the result has already been cached on `request.state.permissions` for this request. Do not do synchronous permission lookups.
- **Separation of concerns:** Admin controllers handle admin workflows. Consumer controllers handle consumer workflows. Never merge them.

### Things Not to Do

- Do not add an `is_admin` boolean to the `users` table — the expert confirmed the role-table approach is correct.
- Do not embed a full list of permissions in the JWT — tokens become large and cannot be invalidated on role changes. Always resolve permissions from the database (with request-scoped caching).
- Do not create an admin-specific `user_sessions` table — admin sessions use the same `user_sessions` table, but the JWT carries an additional `"role": "admin"` claim to distinguish them.
- Do not remove Cloudflare ZTS. It is a complementary network layer, not a replacement for JWT auth.
- Do not build partner-facing authenticated endpoints yet. The `partner_user` role is seeded as a placeholder; no partner login flow exists until the partner portal sprint.

---

## 16. Files Summary for Part 2

| Action | File | What to Do |
| :--- | :--- | :--- |
| Create | `app/schemas/admin_user.py` | Request/response schemas for user management |
| Create | `app/schemas/admin_role.py` | Request/response schemas for role management |
| Create | `app/schemas/admin_auth.py` | Admin login request and token response schemas |
| Create | `app/controllers/admin_auth_controller.py` | Admin JWT login logic |
| Create | `app/controllers/user_management_controller.py` | User CRUD, role assignment, deactivation |
| Create | `app/controllers/role_management_controller.py` | Role and permission management |
| Create | `app/services/admin_audit_service.py` | `log_admin_action(...)` universal audit writer |
| Create | `app/api/routers/admin/auth.py` | Admin login/logout/refresh endpoints |
| Create | `app/api/routers/admin/users.py` | User management admin endpoints |
| Create | `app/api/routers/admin/roles.py` | Role and permission admin endpoints |
| Update | `app/api/routers/admin/__init__.py` | Register `auth`, `users`, `roles` routers |
| Update | All files in `app/api/routers/admin/` | Replace `get_api_key` with `require_admin` |
| Create | `tests/api/test_admin_auth.py` | Admin login and JWT enforcement tests |
| Create | `tests/api/test_user_management.py` | User CRUD and role assignment tests |
| Create | `tests/api/test_rbac_permissions.py` | Permission enforcement tests |
| Update | `tests/api/test_admin_workflows.py` | Switch to `require_admin` dependency override |

---

*End of Part 2. Read Part 1 first for schema migrations, seed data, and core dependency setup.*
