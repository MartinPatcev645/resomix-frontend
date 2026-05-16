# RBAC Plan — Integration Gap Analysis & Corrections

**Purpose:** This document audits the two-part RBAC implementation plan against the actual codebase to confirm what integrates seamlessly, what requires corrections, and what was missed. Read this alongside Part 1 and Part 2 before starting any implementation.

---

## 1. What the Audit Confirmed — No Changes Needed

These facts were assumed in the plan and are confirmed correct by reading the code:

| Assumption | Verified In | Status |
| :--- | :--- | :--- |
| `Role`, `Permission`, `UserRole`, `RolePermission` models exist | `app/models/user.py` | ✅ Correct |
| All four RBAC models are imported in `app/models/__init__.py` | Line 33–42 of `__init__.py` | ✅ Correct |
| `User` has a `partner_id` FK to `partners` | `app/models/user.py` line 217 | ✅ Correct |
| `UserRole` has no `granted_at` / `granted_by` columns | `app/models/user.py` `UserRole` class | ✅ Confirmed missing — migration needed |
| `SftpUser` model already exists | `app/models/sftp_user.py` | ✅ Already created |
| `SftpUser` already imported in `__init__.py` | Line 48 of `__init__.py` | ✅ Already there |
| `verify_password` / `hash_password` in `app/core/security.py` | Lines 33–57 | ✅ Bcrypt, ready to reuse |
| `create_access_token` accepts a `data: Dict[str, Any]` — extra claims can be passed today | `app/core/security.py` line 64 | ✅ No change needed to this function |
| Auth router uses HttpOnly cookie for refresh token | `app/api/routers/auth.py` + `app/controllers/auth_controller.py` | ✅ Admin auth must follow the same pattern |
| All admin routers are registered in `app/api/routers/__init__.py` as `v1_routers` | Lines 73–81 | ✅ New admin routers follow the same registration pattern |
| `admin/` router `__init__.py` exports each router individually | `app/api/routers/admin/__init__.py` | ✅ New routers must be added here too |
| Rate limiting middleware (`limiter`) exists and is used on auth routes | `app/api/routers/auth.py` + `app/api/middlewares/rate_limit.py` | ✅ Admin login endpoint must also use `limiter` |

---

## 2. Corrections to the Plan

### 2.1 `SftpUser` Model — Already Exists, Plan Said to Create It

**Part 1, Section 3.2** said: *"No SQLAlchemy model exists for `sftp_users` yet — create `app/models/sftp_user.py`"*

**Reality:** `app/models/sftp_user.py` already exists and is already imported in `app/models/__init__.py`. The model is fully defined with `label_id`, `partner_id`, `username`, `password_hash`, `home_directory`, `is_active`, and `created_at`.

**Correction:** Do **not** create this file. Only write the Alembic migration to add the nullable `user_id` FK column. Then add the `user_id` mapped column and `user` relationship to the **existing** `SftpUser` class in the existing file. Also add the reverse `sftp_user` relationship on the `User` model in `app/models/user.py`.

### 2.2 `create_access_token` — No Change Needed

**Part 1, Section 6.2** said: *"Update `app/core/security.py` — add optional `extra_claims` parameter."*

**Reality:** `create_access_token(data: Dict[str, Any], ...)` already accepts an arbitrary dict. You can pass `{"sub": user.uuid, "role": "admin"}` directly as the `data` argument today with no code changes. The function does `to_encode = data.copy()` and merges `exp`, `iat`, and `type` — everything else in `data` passes through cleanly.

**Correction:** Remove `app/core/security.py` from the file change list for Part 1. No changes are needed there.

### 2.3 `is_active` on `User` — Does Not Exist Yet

**Part 2, Section 9.1** mentioned deactivating users and said: *"check if `is_active` already exists; if not, add it in a migration."*

**Reality:** The `users` table DDL (confirmed from `new_database.sql` lines 165–190) does **not** have an `is_active` column. The `User` SQLAlchemy model in `app/models/user.py` also does not have it.

**Correction:** This is a confirmed gap. Add a **4th migration** specifically for this:
- Table: `users` — add `is_active TINYINT(1) DEFAULT 1`.
- SQLAlchemy model: `app/models/user.py` → `User` class — add `is_active: Mapped[bool]` mapped column with `default=True`.
- The `get_current_user` dependency in `app/api/dependencies/auth.py` must check `user.is_active` after fetching the user and raise `HTTP 403 Forbidden` with detail `"Account is deactivated."` if it is `False`. This is a **security-critical** change — a deactivated user must not be able to get a new access token even if they hold a valid JWT until it naturally expires. To force immediate lockout, also check `is_active` in `verify_session_active`.

### 2.4 Admin Login Must Follow Existing Cookie Pattern

**Part 1, Section 6.2** described the admin login as returning an access token and a refresh token. The existing consumer auth uses HttpOnly cookies for refresh tokens (confirmed in `app/controllers/auth_controller.py` lines 253–268). 

**Correction:** The admin login endpoint must use the **exact same cookie pattern** — access token in the JSON body, refresh token in an HttpOnly cookie using `settings.cookie_secure`, `settings.cookie_samesite`, and `settings.safe_cookie_domain`. Do not invent a new token transport for admin sessions.

### 2.5 Admin Refresh Token Must Be Separate From Consumer Refresh Token

Since admin and consumer sessions share the `user_sessions` table and both use the `refresh_token` HttpOnly cookie, the admin token refresh endpoint (`POST /api/v1/admin/auth/refresh`) must validate that the incoming refresh token belongs to an admin-role user before issuing a new access token with the `"role": "admin"` claim. It can reuse `AuthService.refresh_access_token(...)` internally but must add the role-claim injection step before returning.

### 2.6 Rate Limiting on Admin Login — Must Be Applied

**Part 2 did not mention rate limiting on the admin login endpoint.** The existing consumer `/auth/login` uses `@limiter.limit(auth_rate_limit("login"))` from `app/api/middlewares/rate_limit.py`. The admin login endpoint is a higher-value target and must have a **stricter** rate limit than the consumer login.

**Correction:** Apply `@limiter.limit("5/minute")` (same as `verify_2fa`) to the admin login endpoint in `app/api/routers/admin/auth.py`. Do not leave the admin login unthrottled.

### 2.7 Two Separate Router Registration Steps — Plan Only Mentioned One

**Part 2, Section 14 (Step 27)** listed registering new routers in `app/api/routers/admin/__init__.py`. But routers must be registered in **two places**:

1. `app/api/routers/admin/__init__.py` — the admin sub-package `__all__` and imports.
2. `app/api/routers/__init__.py` — the `v1_routers` list which is what `main.py` actually reads to mount routes.

**Correction:** Every new admin router (`auth`, `users`, `roles`) needs an entry in **both files**, following the exact pattern of the existing entries on lines 18–26 and 73–81 of `app/api/routers/__init__.py`.

---

## 3. Gaps Not Covered in the Plan

### 3.1 `get_current_user` Must Check `is_active`

Once `is_active` is added to `User` (correction 2.3 above), the `get_current_user` dependency in `app/api/dependencies/auth.py` must be updated to check `user.is_active` immediately after fetching the user from the database. If `False`, raise `HTTP 403 Forbidden`. This is the enforcement point — it means the deactivation takes effect on the **next request** after an existing access token expires (max 2 hours if you follow the recommendation). This is the industry-standard acceptable window.

### 3.2 `require_permission` Must Also Check `is_active`

Since `require_permission` wraps `get_current_user`, the `is_active` check flows through automatically if it is in `get_current_user`. No separate check is needed in `require_permission`. This is already correct by design — document it explicitly so developers understand why it does not need a redundant check.

### 3.3 Admin `logout-all` Must Also Invalidate Admin Sessions

The existing `POST /auth/logout-all` endpoint calls `auth_service.logout_all(db, user_id)` which revokes all entries in `user_sessions` for that user. This already handles admin sessions because admin sessions live in the same table. The admin `POST /admin/auth/logout` should call the same service method. No separate logout-all mechanism is needed for admin. This is actually a benefit of the unified `user_sessions` table — document it so the admin auth controller does not accidentally duplicate the logic.

### 3.4 `admin/similarity.py` Router Exists — Was Not in the Migration List

**Part 2, Section 8.2** listed the routers to migrate. `admin/similarity.py` was not included. It exists in `app/api/routers/admin/similarity.py` and uses `get_api_key`. It must be migrated to `require_admin` along with the others.

**Correction:** Add `admin/similarity.py` to the migration list between `admin/contact.py` and `admin/spotify_apps.py` (medium risk, internal operations endpoint).

### 3.5 `admin/promo.py` Router Exists — Was Not in the Migration List

Similarly, `admin/promo.py` exists in `app/api/routers/admin/promo.py` and was not in the migration list.

**Correction:** Add `admin/promo.py` to the migration list at the end, alongside `admin/partners.py` (low risk — promo code management, no cross-tenant risk).

### 3.6 The `logging_service.log(...)` Pattern — Admin Controllers Must Follow It

Every existing controller (auth, playlist, spotify transfer, etc.) calls `self.logging_service.log(...)` from `app/services/logging_service.py` for request-level telemetry into `system_logs`. The new admin controllers must also instantiate `LoggingService` in their `__init__` and call it on every endpoint, in **addition** to the `admin_audit_service.log_admin_action(...)` calls. These two logging calls serve different purposes and are not interchangeable. Missing the `logging_service` call would make admin endpoints invisible in the general `system_logs` request trace.

### 3.7 `AdminAuditLog` Model Must Be Added to `app/models/__init__.py`

**Part 1** said to create `app/models/admin_audit_log.py` and import it in `__init__.py`. This was mentioned but easy to miss. It must be added to **both** the import block and the `__all__` list in `app/models/__init__.py`, following the same pattern as all other models.

### 3.8 Seed Script Must Handle the First Admin User

**Part 1, Section 4.3** described the seed script as handling roles and permissions. But it must also include logic to assign the `admin` role to a specific user — the bootstrapping step. If the `users` table is empty (fresh install), the script should print a clear instruction: *"Create a user via POST /auth/register, then re-run this script with `--admin-email=you@domain.com` to assign the admin role."* This prevents the scenario where the system is deployed with no one having `admin:access`.

### 3.9 Consumer Registration Should Auto-Assign `user` Role

Currently, `app/controllers/auth_controller.py → register(...)` calls `auth_service.register_user(...)`. After the RBAC seed is in place, new user registration must also insert a row into `user_roles` assigning the `user` role. This must be added to `app/services/auth_service.py → register_user(...)` — it should fetch the `user` role ID and insert the assignment in the same transaction as the user creation. If the `user` role does not exist in the database (seed not run), log a warning but do not fail registration.

### 3.10 The `UserRole.user_id` Column Type Mismatch

The existing `UserRole` model has `user_id` as `mysql.INTEGER(unsigned=True)`. The `User.id` is also `mysql.INTEGER(unsigned=True)`. These match, so the FK is correct. However, the new `granted_by` column must also use `mysql.INTEGER(unsigned=True)` to match `User.id`. The plan mentioned this implicitly but it must be stated explicitly because using Python's default `Integer` instead of `mysql.INTEGER(unsigned=True)` would create a type mismatch that MariaDB will reject on the FK constraint.

---

## 4. Corrected File Change List

This supersedes the file lists at the end of Part 1 and Part 2. Use this as the authoritative checklist.

### Migrations (New — run in this order)

| Migration | Purpose |
| :--- | :--- |
| `add_audit_cols_to_user_roles` | Add `granted_at`, `granted_by` to `user_roles` |
| `add_user_id_to_sftp_users` | Add nullable `user_id` FK to `sftp_users` |
| `create_admin_audit_logs` | New `admin_audit_logs` table |
| `add_is_active_to_users` | Add `is_active TINYINT(1) DEFAULT 1` to `users` |

### Models to Update (Existing Files Only — No New Model Files)

| File | Change |
| :--- | :--- |
| `app/models/user.py` → `UserRole` | Add `granted_at`, `granted_by` columns + `granter` relationship. Use `mysql.INTEGER(unsigned=True)` for `granted_by`. |
| `app/models/user.py` → `User` | Add `is_active: Mapped[bool]` column. Add `sftp_user` optional reverse relationship. |
| `app/models/sftp_user.py` → `SftpUser` | Add nullable `user_id` column + `user` relationship. |
| `app/models/__init__.py` | Add import and `__all__` entry for `AdminAuditLog` only. Everything else already imported. |

### New Files to Create

| File | Purpose |
| :--- | :--- |
| `app/models/admin_audit_log.py` | `AdminAuditLog` SQLAlchemy model |
| `app/repositories/rbac_repository.py` | `get_user_permissions`, `assign_role`, `revoke_role`, `get_user_roles` |
| `app/services/admin_audit_service.py` | `log_admin_action(...)` — never raises, wraps its own exception |
| `app/services/auth_service.py` (update, not new) | Add role assignment in `register_user` for `user` role auto-assignment |
| `scripts/seed_rbac.py` | Idempotent seed + `--admin-email` flag for first admin bootstrap |
| `app/controllers/admin_auth_controller.py` | Admin login/logout business logic |
| `app/controllers/user_management_controller.py` | User CRUD, role assign/revoke |
| `app/controllers/role_management_controller.py` | Role and permission view/manage |
| `app/schemas/admin_user.py` | Request/response schemas for user management |
| `app/schemas/admin_role.py` | Request/response schemas for role management |
| `app/schemas/admin_auth.py` | `AdminLoginRequest`, `AdminTokenResponse` |
| `app/api/routers/admin/auth.py` | Admin login, logout, refresh endpoints |
| `app/api/routers/admin/users.py` | User management endpoints |
| `app/api/routers/admin/roles.py` | Role and permission endpoints |

### Files to Update (Existing)

| File | Change |
| :--- | :--- |
| `app/api/dependencies/auth.py` | Add `require_permission(...)` factory + `require_admin` shortcut. Update `get_current_user` to check `user.is_active`. |
| `app/api/routers/admin/__init__.py` | Add imports for `auth`, `users`, `roles` routers |
| `app/api/routers/__init__.py` | Add three new admin routers to `v1_routers` list |
| All existing `app/api/routers/admin/*.py` | Replace `Security(get_api_key)` with `Depends(require_admin)`. Add the two that were missed: `similarity.py` and `promo.py`. |

---

## 5. Integration Sequence Correction

Replace Step 5 in Part 2's sequence with this corrected sequence:

1. Write all 4 migrations → run on staging.
2. Update `UserRole` model, update `User` model (`is_active` + `sftp_user` rel), update `SftpUser` model.
3. Create `AdminAuditLog` model, add to `__init__.py`.
4. Create `rbac_repository.py`.
5. Create `admin_audit_service.py`.
6. Create `seed_rbac.py` (with `--admin-email` flag), run on staging.
7. Update `get_current_user` to check `user.is_active`.
8. Add `require_permission` + `require_admin` to `app/api/dependencies/auth.py`.
9. Update `auth_service.register_user` to auto-assign `user` role.
10. Create `admin_auth_controller.py` — reuse `verify_password`, `create_access_token`, and cookie pattern from existing consumer auth.
11. Create `app/api/routers/admin/auth.py` with `@limiter.limit("5/minute")` on login.
12. Register `admin_auth_router` in both `admin/__init__.py` and `app/api/routers/__init__.py`.
13. Write `test_admin_auth.py` — confirm all pass before touching any existing routes.
14. Migrate existing admin routers one-by-one (all 9: feedback, contact, waitlist, operation\_limits, similarity, promo, spotify\_apps, playlist, partners).
15. Create schemas, controllers, and routers for `users` and `roles` management.
16. Register `users` and `roles` routers in both init files.
17. Write `test_user_management.py` and `test_rbac_permissions.py`.
18. Update `test_admin_workflows.py` to use `require_admin` overrides.
19. Run full test suite on staging. Fix failures.
20. Run `seed_rbac.py --admin-email=<real-admin>` on production.
21. Remove `get_api_key` usages from all admin routes.

---

*This gap analysis supersedes any conflicting detail in Part 1 or Part 2. The two-part plan remains correct in structure and intent — these are precision corrections only.*
