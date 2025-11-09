## Admin Operation Limits Backend Plan

### Overview
- Build API + backend flow so admins can read operation catalog (`operation_types`) and manage per-user limits (`user_operation_limits`).
- Follow existing pattern: Router → Controller → Service → Repository → Models.
- Protect endpoints with API key dependency, keep admin-only scope.

---

### Schemas (`app/schemas/operation_limit.py`)
- **Do:** create Pydantic models for:
  - `OperationTypeResponse` (id, code, description).
  - `AdminOperationTypeListResponse` (list + count metadata).
  - `UserOperationLimitResponse` (user + operation info + timestamps).
  - `UserOperationLimitListFilters` (pagination, search by email/uuid/operation).
  - `UserOperationLimitListResponse` (data + pagination).
  - `UserOperationLimitUpsertRequest` (user identifier, operation_code, limit_value, optional window_seconds).
  - `UserOperationLimitDeleteResponse` (success + message).
- **Do:** reuse base response mixins from `app/schemas/common` for consistent `success` flag when appropriate.
- **Do:** include validation (limit_value ≥ 0, window_seconds ≥ 60 when provided).
- **Don’t:** import ORM models or services; keep schemas pure.

---

### Repository (`app/repositories/operation_limit_repository.py`)
- **Do:** extend `BaseRepository[UserOperationLimit]` for CRUD helpers.
- **Do:** add async helpers:
  - fetch `OperationType` by code / list all.
  - join query returning limits with related user + operation for admin list (include email, username, current playlist count placeholder via subquery).
  - upsert logic: check existing record by `user_id` + `operation_id`.
- **Do:** expose playlist count helper via subquery using `select(func.count(Playlist.id))`.
- **Do:** keep methods async-first; add sync only if necessary.
- **Don’t:** handle request validation or API formatting here.

---

### Service (`app/services/operation_limit_service.py`)
- **Do:** orchestrate admin operations:
  - list operation types.
  - resolve user by email/uuid (reuse `UserRepository` methods or create minimal helper).
  - list user limits with pagination/filtering, packaging repository output into dicts for controllers.
  - upsert limit (create/update) with validation against `operation_types`.
  - delete limit.
- **Do:** capture `created_by` using admin user id when provided by controller.
- **Do:** handle zero/unlimited policy (e.g., reject negative numbers, allow `None` for unlimited if required).
- **Don’t:** return FastAPI responses; return structured dicts `{success: bool, data/error}` only.

---

### Controller (`app/controllers/operation_limit_controller.py`)
- **Do:** mirror structure of `WaitlistController`: instantiate service + logging, wrap service results into JSONResponse.
- **Do:** log admin actions (`LOGGING` category like `"ADMIN_OPERATION_LIMIT"`).
- **Do:** expose methods:
  - `list_operation_types`
  - `list_user_operation_limits`
  - `get_user_operation_limit`
  - `upsert_user_operation_limit`
  - `delete_user_operation_limit`
- **Do:** include timing, correlation id, and consistent response formatting using `format_response`.
- **Don’t:** perform raw DB queries; delegate to service.

---

### Router (`app/api/routers/admin/operation_limits.py`)
- **Do:** create router with prefix `/admin/operation-limits`, tag `["admin-operation-limits"]`.
- **Do:** endpoints:
  - `GET /operation-types` → list catalog.
  - `GET /` → list user limits with filters.
  - `GET /{user_identifier}/{operation_code}` → fetch single (allow email/uuid path parameter; controller handles detection).
  - `PUT /` → upsert limit (body `UserOperationLimitUpsertRequest`).
  - `DELETE /{user_identifier}/{operation_code}` → remove limit.
- **Do:** apply `Security(get_api_key)` and `Depends(get_database_session)` to all routes.
- **Do:** pass through authenticated admin id if available (e.g., from API key payload) for `created_by`.
- **Don’t:** embed business logic; only call controller.

---

### Wiring & Supporting Updates
- **Do:** export new schemas in `app/schemas/__init__.py` if that pattern exists.
- **Do:** register router in `app/api/routers/admin/__init__.py`.
- **Do:** ensure controller/service imports resolve (update `__all__` if present).
- **Do:** update dependency graph if a `UserRepository` helper doesn’t exist—either implement there or within operation-limit repository.
- **Don’t:** modify existing admin routers beyond adding new include statements.

---

### Final Checks
- Run `ruff`/linters (if configured) on new files.
- Verify Alembic/migration history unchanged (schema already migrated).
- Hit new endpoints locally with admin API key:
  - `GET /admin/operation-limits/operation-types`
  - `PUT /admin/operation-limits` with sample payload.
  - `GET /admin/operation-limits?search=user@example.com`
  - `DELETE /admin/operation-limits/user@example.com/playlist_create`
- Confirm responses include playlist count and updated metadata.
- Ensure logging entries appear with correct category/action names.

---

### Frontend Integration Guide
- Fetch operation types on admin settings load via `GET /admin/operation-limits/operation-types` to drive select options.
- Populate the management table with `GET /admin/operation-limits`, wiring pagination/search inputs to the API parameters.
- Use the upsert endpoint (`PUT /admin/operation-limits`) for create/update flows; send `user_identifier`, selected `operation_code`, numeric `limit_value`, and optional `window_seconds`.
- Treat duplicate submissions gracefully: by default the API responds `409` when a limit already exists for the same user+operation (even if values differ). To overwrite, call `PUT /admin/operation-limits?force=true`. Without `force` the response is:
  ```json
  {
    "success": false,
    "error": "User already has a limit for this operation"
  }
  ```
  Use the embedded `data` to show existing settings or prompt for delete/update.
- Remove limits through `DELETE /admin/operation-limits/{user_identifier}/{operation_code}` and optimistic UI updates.
- Show API error strings when `success` is false to mirror backend validation feedback.

