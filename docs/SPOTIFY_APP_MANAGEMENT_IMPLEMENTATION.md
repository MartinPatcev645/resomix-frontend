# Spotify App Management Implementation Guide

## Overview
- Build complete CRUD API for managing multiple Spotify apps (`spotify_apps`) and user associations (`user_spotify_apps`).
- Unlike operation limits, this requires full CRUD operations for the app table itself, not just associations.
- Follow existing pattern: Router → Controller → Service → Repository → Models.
- Protect all endpoints with API key dependency, keep admin-only scope.
- Handle one-to-one user associations: each user can only be associated with ONE Spotify app at a time.

---

## Critical Requirements & Constraints

### ⚠️ Critical Attention Points

1. **One-to-One User Association**
   - Database enforces `user_id` as PRIMARY KEY in `user_spotify_apps` table.
   - When associating a user with a new app, MUST remove existing association first (or handle update logic).
   - Service layer must check for existing association before creating new one.
   - When updating association, decrement `user_count` on old app, increment on new app.

2. **User Count Maintenance**
   - `spotify_apps.user_count` is a denormalized counter that MUST be kept in sync.
   - Increment `user_count` when:
     - New user association is created
     - User is moved from one app to another (increment new app)
   - Decrement `user_count` when:
     - User association is deleted
     - User is moved from one app to another (decrement old app)
   - Use database transactions to ensure atomicity of count updates and association changes.

3. **Client Secret Security**
   - NEVER return `client_secret` in GET/list responses (exclude from schemas).
   - Only include `client_secret` in create/update request schemas (for admin input).
   - Consider encryption at rest if storing in database (though current schema stores plaintext).
   - Logging: Never log full client secrets; redact in logs if necessary.

4. **Active App Validation**
   - When associating users, verify the target `spotify_app_id` has `is_active = true`.
   - Prevent associations with inactive apps.
   - When deactivating an app, consider impact on existing user associations (warn admin or prevent deactivation if users exist).

5. **Spotify Dashboard Sync**
   - This system assumes admin manually adds user emails to Spotify Developer Dashboard for each app.
   - API does NOT sync with Spotify; it only manages internal associations.
   - Document that admin must add user email to Spotify dashboard BEFORE creating association here.

---

## File Structure

### Schemas (`app/schemas/spotify_app.py`)
- **Do:** Create Pydantic models for:
  - `SpotifyAppResponse` (id, name, description, client_id, is_active, user_count, created_at, updated_at) - **EXCLUDE client_secret**.
  - `SpotifyAppListResponse` (list + total count).
  - `SpotifyAppDetailResponse` (single app, same as response but with optional client_secret for admin view only).
  - `SpotifyAppCreateRequest` (name, description, client_id, client_secret, is_active optional).
  - `SpotifyAppUpdateRequest` (all fields optional except validation).
  - `SpotifyAppDeleteResponse` (success + message).
  - `UserSpotifyAppResponse` (user_id, user_email, user_username, user_uuid, spotify_app_id, spotify_app_name, created_at, updated_at).
  - `UserSpotifyAppListFilters` (pagination, search by email/uuid/username, filter by spotify_app_id).
  - `UserSpotifyAppListResponse` (data + pagination).
  - `UserSpotifyAppUpsertRequest` (user_identifier, spotify_app_id).
  - `UserSpotifyAppDeleteResponse` (success + message).
- **Do:** Reuse base response mixins from `app/schemas/common` for consistent `success` flag.
- **Do:** Include validation:
  - `client_id` and `client_secret` must be non-empty strings.
  - `name` must be unique (enforced at DB level, but validate in service).
  - `spotify_app_id` must reference existing active app.
- **Don't:** Import ORM models or services; keep schemas pure.
- **Don't:** Include `client_secret` in any response schema except admin detail view (if needed).

---

### Repository (`app/repositories/spotify_app_repository.py`)
- **Do:** Extend `BaseRepository[SpotifyApp]` for CRUD helpers.
- **Do:** Extend `BaseRepository[UserSpotifyApp]` for association CRUD (or create separate class).
- **Do:** Add async helpers for `SpotifyApp`:
  - `async_get_by_id` - fetch by primary key.
  - `async_get_by_client_id` - fetch by client_id (for uniqueness checks).
  - `async_list` - list all with optional filters (is_active, search by name).
  - `async_create` - create new app, return created instance.
  - `async_update` - update app fields, return updated instance.
  - `async_delete` - delete app (check for existing user associations first in service layer).
  - `async_increment_user_count` - atomic increment of user_count.
  - `async_decrement_user_count` - atomic decrement of user_count.
- **Do:** Add async helpers for `UserSpotifyApp`:
  - `async_get_by_user_id` - fetch association by user_id (returns single or None).
  - `async_list_associations` - join query returning associations with user + app info for admin list.
  - `async_create_association` - create new association (handle unique constraint violation).
  - `async_update_association` - update association (change user's app).
  - `async_delete_association` - delete association by user_id.
  - `async_count_by_app_id` - count users for a specific app (for validation).
- **Do:** Use database transactions for operations that modify both association and user_count.
- **Do:** Keep methods async-first; add sync only if necessary.
- **Don't:** Handle request validation or API formatting here.
- **Don't:** Update user_count manually in create/update/delete; use dedicated increment/decrement methods.

---

### Service (`app/services/spotify_app_service.py`)
- **Do:** Orchestrate admin operations for both apps and associations.
- **Do:** For `SpotifyApp` CRUD:
  - `list_spotify_apps` - list all apps with optional filters, return dict with data + total.
  - `get_spotify_app` - get single app by id, return dict with data (exclude client_secret unless admin detail view).
  - `create_spotify_app` - validate uniqueness of name and client_id, create app, return dict.
  - `update_spotify_app` - validate uniqueness if name/client_id changed, update app, return dict.
  - `delete_spotify_app` - check for existing user associations, prevent deletion if users exist (or cascade delete associations), return dict.
- **Do:** For `UserSpotifyApp` operations:
  - `list_user_associations` - list with pagination/filtering, join user + app data, return dict.
  - `get_user_association` - get association by user_identifier (email/uuid/username/id), return dict.
  - `upsert_user_association` - resolve user, check if app is active, handle existing association (update vs create), update user_count on both old and new apps atomically, return dict.
  - `delete_user_association` - resolve user, delete association, decrement user_count, return dict.
- **Do:** Resolve user by email/uuid/username using `UserRepository` methods.
- **Do:** Use transactions for operations that modify user_count and associations together.
- **Do:** Validate app is active before allowing associations.
- **Do:** Handle one-to-one constraint: when creating new association, delete old one first (or update if exists).
- **Do:** Return structured dicts `{success: bool, data/error}` only.
- **Don't:** Return FastAPI responses; return dicts only.
- **Don't:** Allow deletion of apps with active user associations without explicit cascade flag.

---

### Controller (`app/controllers/spotify_app_controller.py`)
- **Do:** Mirror structure of `OperationLimitController`: instantiate service + logging, wrap service results into JSONResponse.
- **Do:** Log admin actions with category `"ADMIN_SPOTIFY_APP"` and appropriate actions:
  - `list_spotify_apps_success/failed/exception`
  - `get_spotify_app_success/failed/exception`
  - `create_spotify_app_success/failed/exception`
  - `update_spotify_app_success/failed/exception`
  - `delete_spotify_app_success/failed/exception`
  - `list_user_associations_success/failed/exception`
  - `get_user_association_success/failed/exception`
  - `upsert_user_association_success/failed/exception`
  - `delete_user_association_success/failed/exception`
- **Do:** Expose methods for apps:
  - `list_spotify_apps`
  - `get_spotify_app`
  - `create_spotify_app`
  - `update_spotify_app`
  - `delete_spotify_app`
- **Do:** Expose methods for associations:
  - `list_user_associations`
  - `get_user_association`
  - `upsert_user_association`
  - `delete_user_association`
- **Do:** Include timing, correlation id, and consistent response formatting using `format_response`.
- **Do:** Handle appropriate HTTP status codes:
  - 200 for successful GET/PUT/DELETE
  - 201 for successful POST (if using POST for create)
  - 400 for validation errors
  - 404 for not found
  - 409 for conflicts (duplicate name/client_id, user already associated)
  - 422 for business rule violations (inactive app, app has users)
- **Don't:** Perform raw DB queries; delegate to service.
- **Don't:** Log client secrets in metadata; redact if necessary.

---

### Router (`app/api/routers/admin/spotify_apps.py`)
- **Do:** Create router with prefix `/admin/spotify-apps`, tag `["admin-spotify-apps"]`.
- **Do:** Endpoints for `SpotifyApp` CRUD:
  - `GET /` → list apps with filters (is_active, search).
  - `GET /{app_id}` → get single app detail.
  - `POST /` → create new app (body: `SpotifyAppCreateRequest`).
  - `PUT /{app_id}` → update app (body: `SpotifyAppUpdateRequest`).
  - `DELETE /{app_id}` → delete app (query param `cascade=true` to allow deletion with users).
- **Do:** Endpoints for `UserSpotifyApp` associations:
  - `GET /users` → list user associations with filters (pagination, search, spotify_app_id filter).
  - `GET /users/{user_identifier}` → get user's association (email/uuid/username/id in path).
  - `PUT /users` → create/update user association (body: `UserSpotifyAppUpsertRequest`).
  - `DELETE /users/{user_identifier}` → remove user association.
- **Do:** Apply `Security(get_api_key)` and `Depends(get_database_session)` to all routes.
- **Do:** Pass through authenticated admin id if available for `created_by` field.
- **Do:** Use appropriate HTTP methods (POST for create, PUT for update, DELETE for delete).
- **Don't:** Embed business logic; only call controller.
- **Don't:** Expose client_secret in GET endpoints.

---

## Best Practices

### ✅ Dos

1. **Transaction Management**
   - Use database transactions for operations that modify both `user_spotify_apps` and `spotify_apps.user_count`.
   - Ensure atomicity: if association creation fails, user_count should not be incremented.
   - Use `async with db.begin()` or `await db.commit()` appropriately.

2. **Error Handling**
   - Return descriptive error messages for validation failures.
   - Handle unique constraint violations gracefully (name, client_id, user_id).
   - Check app existence and active status before operations.
   - Validate user existence before association operations.

3. **User Count Synchronization**
   - Always update user_count within the same transaction as association changes.
   - Use atomic increment/decrement operations in repository.
   - Consider using database triggers as backup (optional, not required).

4. **Security**
   - Never expose client_secret in responses.
   - Validate admin permissions (via API key).
   - Sanitize user input (name, description fields).
   - Use parameterized queries (SQLAlchemy handles this).

5. **Logging**
   - Log all admin actions with appropriate categories and actions.
   - Include relevant metadata (app_id, user_id, but NOT client_secret).
   - Use correlation IDs for request tracing.
   - Log user_count changes for audit trail.

6. **Validation**
   - Validate client_id and client_secret format (non-empty, reasonable length).
   - Validate name uniqueness before create/update.
   - Validate app is active before allowing new associations.
   - Validate user exists before association operations.

7. **Response Consistency**
   - Use consistent response format: `{success: bool, data: {...}, ...}`.
   - Include pagination metadata for list endpoints.
   - Return appropriate HTTP status codes.

---

### ❌ Don'ts

1. **Security Violations**
   - **DON'T** return `client_secret` in any GET/list response.
   - **DON'T** log full client secrets in log messages.
   - **DON'T** expose endpoints without API key authentication.

2. **Data Integrity**
   - **DON'T** allow deletion of apps with active user associations without explicit cascade flag.
   - **DON'T** allow associations with inactive apps.
   - **DON'T** update user_count outside of transactions.
   - **DON'T** create duplicate user associations (enforce one-to-one).

3. **Business Logic in Wrong Layer**
   - **DON'T** put validation logic in repository layer.
   - **DON'T** put business rules in controller layer.
   - **DON'T** perform database queries directly in controller.

4. **Error Handling**
   - **DON'T** return raw database exceptions to API clients.
   - **DON'T** expose internal error details in production.
   - **DON'T** ignore transaction rollback on errors.

5. **Performance**
   - **DON'T** load full user/app objects when only IDs are needed.
   - **DON'T** perform N+1 queries in list endpoints (use joins).
   - **DON'T** forget to add indexes for frequently queried fields.

6. **Code Quality**
   - **DON'T** duplicate code between create and update operations.
   - **DON'T** skip input validation.
   - **DON'T** forget to handle edge cases (empty lists, null values).

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `app/schemas/spotify_app.py` with all required schemas.
- [ ] Create `app/repositories/spotify_app_repository.py` with CRUD methods.
- [ ] Create `app/services/spotify_app_service.py` with business logic.
- [ ] Create `app/controllers/spotify_app_controller.py` with HTTP orchestration.
- [ ] Create `app/api/routers/admin/spotify_apps.py` with all endpoints.

### Phase 2: Integration
- [ ] Register router in `app/api/routers/admin/__init__.py`.
- [ ] Export schemas in `app/schemas/__init__.py` (if pattern exists).
- [ ] Update `app/main.py` to include new router (if not auto-discovered).
- [ ] Verify all imports resolve correctly.

### Phase 3: Testing & Validation
- [ ] Test app CRUD operations:
  - [ ] Create app with valid data.
  - [ ] Create app with duplicate name (should fail).
  - [ ] Create app with duplicate client_id (should fail).
  - [ ] List apps with filters.
  - [ ] Get app by ID.
  - [ ] Update app (name, description, is_active).
  - [ ] Delete app without users (should succeed).
  - [ ] Delete app with users without cascade (should fail).
  - [ ] Delete app with users with cascade (should succeed and delete associations).
- [ ] Test user association operations:
  - [ ] Create association for user.
  - [ ] Create association for user who already has one (should update).
  - [ ] Create association with inactive app (should fail).
  - [ ] List associations with pagination and filters.
  - [ ] Get association by user identifier.
  - [ ] Update association (move user to different app).
  - [ ] Delete association.
  - [ ] Verify user_count increments/decrements correctly.
- [ ] Test transaction atomicity:
  - [ ] Verify user_count updates only if association succeeds.
  - [ ] Verify rollback on errors.

### Phase 4: Security & Logging
- [ ] Verify client_secret never appears in GET responses.
- [ ] Verify all endpoints require API key.
- [ ] Test logging captures all actions correctly.
- [ ] Verify no sensitive data in logs.

### Phase 5: Documentation
- [ ] Update API documentation (OpenAPI/Swagger).
- [ ] Document admin workflow (add user to Spotify dashboard first).
- [ ] Document user_count maintenance requirements.

---

## Wiring & Supporting Updates

- **Do:** Export new schemas in `app/schemas/__init__.py` if that pattern exists.
- **Do:** Register router in `app/api/routers/admin/__init__.py`.
- **Do:** Ensure controller/service imports resolve (update `__all__` if present).
- **Do:** Verify `UserRepository` has methods to resolve users by email/uuid/username (or implement in service).
- **Don't:** Modify existing admin routers beyond adding new include statements.

---

## Frontend Integration Guide

### App Management
- Fetch apps list on admin settings load via `GET /admin/spotify-apps` to display in table.
- Use filters to show only active apps or search by name.
- Create new app via `POST /admin/spotify-apps` with name, description, client_id, client_secret.
- Update app via `PUT /admin/spotify-apps/{app_id}` (can update name, description, is_active).
- Delete app via `DELETE /admin/spotify-apps/{app_id}?cascade=true` (warn admin if users exist).
- Display user_count for each app to show distribution.

### User Association Management
- Populate associations table with `GET /admin/spotify-apps/users`, wiring pagination/search inputs.
- Use search to find users by email/username.
- Filter by `spotify_app_id` to see all users for a specific app.
- Create/update association via `PUT /admin/spotify-apps/users` with `user_identifier` and `spotify_app_id`.
- Handle one-to-one constraint: if user already has association, show current app and allow update.
- Remove association via `DELETE /admin/spotify-apps/users/{user_identifier}`.
- Show user_count updates in real-time after association changes.

### User Workflow
1. Admin adds user email to Spotify Developer Dashboard for specific app.
2. Admin creates association in this system via API.
3. System increments user_count for that app.
4. When user authenticates with Spotify, use the associated app's client_id.

---

## Edge Cases to Handle

1. **Concurrent Updates**: Handle race conditions when multiple admins update user_count simultaneously (use database-level atomic operations).

2. **Cascade Deletion**: When deleting app with cascade=true, ensure all associations are deleted and user_count is reset to 0.

3. **App Deactivation**: When deactivating app, consider warning admin about existing user associations. Optionally prevent deactivation if users exist.

4. **User Deletion**: When user is deleted (CASCADE), association is automatically deleted. Ensure user_count is decremented (may need trigger or handle in user deletion logic).

5. **Invalid App References**: If app is deleted while associations exist (shouldn't happen with proper constraints), handle gracefully.

6. **Empty Lists**: Handle pagination when no results exist (return empty array, not null).

---

## Final Checks

- Run `ruff`/linters on new files.
- Verify migration `003_add_spotify_app_tables.sql` is applied.
- Test all endpoints locally with admin API key.
- Verify user_count stays in sync after all operations.
- Confirm logging entries appear with correct category/action names.
- Verify client_secret never appears in responses.
- Test transaction rollback on errors.
- Verify one-to-one constraint is enforced (user can only have one association).

---

## Notes

- The `user_count` field is denormalized for performance. It should be kept in sync via application logic, not database triggers (though triggers could be added as backup).
- Consider adding a periodic job to recalculate user_count from `user_spotify_apps` table if discrepancies are detected.
- For production, consider encrypting `client_secret` at rest using application-level encryption before storing in database.
- The system assumes admin manually manages Spotify Developer Dashboard user lists. No API integration with Spotify for user management.

---

## Integration with Spotify Transfer Service

### Current Implementation Analysis

**Current Flow:**
1. Frontend handles Spotify OAuth PKCE flow and obtains `access_token`
2. Frontend sends `access_token` to backend in `SpotifyTransferRequest`
3. Backend creates `spotipy.Spotify(auth=access_token)` client directly
4. Backend uses client to search tracks and create playlists
5. No `client_id` or `client_secret` is used in backend (frontend handles OAuth)
6. `settings.spotify_client_id` and `settings.spotify_client_secret` exist in config but are **NOT used** in transfer service

**Key Observations:**
- `_create_spotify_client()` method only needs `access_token` - no client credentials required
- Spotify client validates token by calling `client.me()` which we already do
- 403 errors are already handled for "not be registered" cases
- No user identification in current flow (only API key auth, not user-specific)

### Required Changes for Multi-App Support

#### 1. User Identification Strategy

**Option A: Add User Identifier to Request (Recommended)**
- Add `user_uuid` or `user_email` field to `SpotifyTransferRequest` schema
- Frontend sends Resomix user identifier along with access_token
- Backend resolves user and checks association

**Option B: Extract User from Access Token**
- After creating Spotify client, call `client.me()` to get Spotify user email
- Look up Resomix user by email in database
- Check association for that user

**Option C: Use JWT Authentication**
- Replace API key auth with JWT token authentication
- Extract user from JWT token
- Check association for authenticated user

**Recommendation:** Use **Option A** for backward compatibility and clarity. Option B is fallback if frontend can't provide user identifier.

#### 2. Service Layer Updates (`app/services/spotify_transfer_service.py`)

**Changes Required:**

1. **Add Repository Dependencies:**
   - Import `SpotifyAppRepository` (to be created)
   - Import `UserRepository` (if not already imported)
   - Add repositories to `__init__` method

2. **Add User Association Check Method:**
   ```python
   async def _check_user_spotify_association(
       self, 
       db: AsyncSession, 
       user_identifier: str  # email, uuid, or user_id
   ) -> Optional[SpotifyApp]:
       """
       Check if user has Spotify app association.
       Returns SpotifyApp if associated, None otherwise.
       """
   ```

3. **Update `transfer_playlist_to_spotify` Method:**
   - Add `user_identifier: Optional[str]` parameter
   - Before creating Spotify client, check user association:
     - If `user_identifier` provided: resolve user and check association
     - If not provided: try to extract from access_token (Option B fallback)
   - If no association found: raise `ValueError` with message asking user to contact admin
   - If association found: proceed with transfer (access_token should be from that app)
   - Log which app is being used for the transfer

4. **Remove Environment Variable Dependencies:**
   - Remove any references to `settings.spotify_client_id` or `settings.spotify_client_secret`
   - These are no longer needed (frontend handles OAuth with correct client_id)

#### 3. Controller Updates (`app/controllers/spotify_transfer_controller.py`)

**Changes Required:**

1. **Update Method Signature:**
   - Add `user_identifier: Optional[str]` parameter to `transfer_playlist_to_spotify` method
   - Pass through to service layer

2. **Error Handling:**
   - Handle new error case: "User not associated with any Spotify app"
   - Return appropriate HTTP status (403 Forbidden or 400 Bad Request)
   - Include helpful error message directing user to contact admin

3. **Logging:**
   - Log which Spotify app is being used for transfer
   - Log user association check results

#### 4. Schema Updates (`app/schemas/spotify_transfer.py`)

**Changes Required:**

1. **Update `SpotifyTransferRequest`:**
   - Add optional `user_uuid: Optional[str]` field
   - Add validator to ensure format if provided
   - Document that it's optional but recommended

2. **Update Error Response:**
   - Add specific error codes/messages for association-related errors

#### 5. Router Updates (`app/api/routers/spotify_transfer.py`)

**Changes Required:**

1. **Update Endpoint:**
   - Extract `user_uuid` from request body
   - Pass to controller method
   - Update documentation to mention user association requirement

#### 6. New Endpoint: Get User's Spotify App Client ID

**Purpose:** Frontend needs to know which `client_id` to use for OAuth flow.

**Implementation:**

1. **New Schema (`app/schemas/spotify_app.py`):**
   ```python
   class UserSpotifyAppClientIdResponse(BaseModel):
       success: bool
       client_id: Optional[str]  # None if no association
       app_name: Optional[str]
       message: Optional[str]  # If no association, explain next steps
   ```

2. **New Service Method:**
   ```python
   async def get_user_spotify_app_client_id(
       self,
       db: AsyncSession,
       user_identifier: str
   ) -> Dict[str, Any]:
       """
       Get Spotify app client_id for user's associated app.
       Returns client_id if associated, None otherwise.
       """
   ```

3. **New Controller Method:**
   - Handle HTTP request/response
   - Log access to client_id

4. **New Router Endpoint:**
   ```
   GET /spotify/app-client-id?user_uuid={uuid}
   ```
   - Returns client_id for frontend to use in OAuth flow
   - Returns 404 or helpful message if no association

#### 7. Configuration Cleanup (`app/core/config.py`)

**Changes Required:**

1. **Mark as Deprecated (Optional):**
   - Add deprecation notice to `spotify_client_id` and `spotify_client_secret` fields
   - Document that they're no longer used in transfer service
   - Keep for backward compatibility or remove entirely

2. **Remove from Environment Variable Mapping:**
   - If removing, update `.env.example` documentation
   - Update deployment documentation

### Integration Flow

**New Frontend Flow:**
1. User initiates Spotify transfer
2. Frontend calls `GET /spotify/app-client-id?user_uuid={uuid}` to get client_id
3. If no association: Show message "Please contact admin to enable Spotify transfer"
4. If association exists: Use returned `client_id` for OAuth flow
5. After OAuth, send `access_token` + `user_uuid` to transfer endpoint
6. Backend validates association and proceeds with transfer

**Backend Flow:**
1. Receive transfer request with `user_uuid` and `access_token`
2. Resolve user by `user_uuid`
3. Check `user_spotify_apps` table for association
4. If no association: Return 403 with message "User not associated with any Spotify app. Please contact admin."
5. If association exists: Proceed with transfer (access_token should be from associated app)
6. If Spotify returns 403 "not be registered": This means user email not in Spotify dashboard for that app

### Critical Implementation Notes

1. **User Association Validation:**
   - MUST check association BEFORE creating Spotify client
   - Return clear error if no association exists
   - Don't rely solely on Spotify's 403 error (check proactively)

2. **Access Token Validation:**
   - Access token should be from the associated app's client_id
   - If token is from wrong app, Spotify will reject it
   - This is acceptable - user needs to re-authenticate with correct app

3. **Error Messages:**
   - "User not associated with any Spotify app. Please contact admin to enable Spotify transfer."
   - "This Spotify account is not authorized. Please ensure your email is added to the Spotify app in the developer dashboard."

4. **Backward Compatibility:**
   - Make `user_uuid` optional initially
   - If not provided, try to extract from access_token (Option B)
   - Log warning when user_uuid not provided
   - Eventually make it required

5. **Logging:**
   - Log which Spotify app is being used for each transfer
   - Log user association check results
   - Log when fallback to access_token extraction is used

### Testing Checklist

- [ ] Test transfer with user who has association (should succeed)
- [ ] Test transfer with user who has no association (should fail with clear message)
- [ ] Test transfer without user_uuid (should use fallback or fail gracefully)
- [ ] Test with access_token from wrong app (Spotify should reject, handle gracefully)
- [ ] Test new endpoint: `GET /spotify/app-client-id?user_uuid={uuid}`
- [ ] Test with invalid user_uuid (should return 404)
- [ ] Verify environment variables are no longer read from config
- [ ] Verify logging includes app information

### Migration Path

1. **Phase 1: Add Association Check (Non-Breaking)**
   - Add user_uuid as optional field
   - Add association check with fallback
   - Keep existing behavior if no user_uuid provided

2. **Phase 2: Add Client ID Endpoint**
   - Add new endpoint for frontend to get client_id
   - Frontend can start using it

3. **Phase 3: Make User UUID Required**
   - After frontend is updated, make user_uuid required
   - Remove fallback logic

4. **Phase 4: Cleanup Config**
   - Remove unused environment variables
   - Update documentation

