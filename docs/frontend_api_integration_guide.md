# Resomix Frontend API Integration Guide

This guide details the integration points for the Resomix Frontend to communicate with the Backend API. It provides a comprehensive list of endpoints, required headers, request payloads, and expected responses based on the current implementation.

## Base URL

The API base URL typically depends on the environment:

- Local Development: `http://localhost:8001`
- Production: `https://api.resomix.com` (or as configured)

## API Versioning

As of May 2026, the Resomix API has transitioned to **URL-based versioning** for all B2B and Administrative operations.

- **Current Version**: `v1`
- **Base Path**: `/api/v1/`
- **Legacy Support**: Unversioned root paths (e.g., `/get_similarity/`) remain supported for existing frontend and partner integrations but are officially deprecated. New integrations **must** use the `/api/v1/` prefix.

---

## Authentication & Headers

The API supports three main tiers of authentication based on the actor:

1. **Public/Anonymous Access**: Used for public endpoints (like search, waitlist, and telemetry) or legacy frontend components.
   - **Header**: `X-API-KEY: <your-public-api-key>`
2. **End-User Access (JWT)**: Used for consumer user-specific actions (like profile management, favorites, ratings, checkout).
   - **Header**: `Authorization: Bearer <your-access-token>`
3. **B2B Partner Access**: Used by B2B clients to hit similarity, ingest, or analytics endpoints.
   - **Header**: `Authorization: Bearer rmx_<partner_api_key>` (Recommended)
   - **Header Fallback**: `X-API-KEY: rmx_<partner_api_key>`
4. **Administrative Access (RBAC)**: Used by the internal admin dashboard.
   - **Header**: `Authorization: Bearer <admin-jwt-access-token>` (Requires `role: admin` claim issued by `/api/v1/admin/auth/login`)
   - **Header Fallback**: `X-API-KEY: <global_system_key>` (Supported for legacy system-to-system integrations)

**Note on Cookies**: The refresh token is managed automatically via an `HttpOnly` cookie set by the server upon login/registration. You do not need to manage it manually in JavaScript.

**Note on Traceability**: All partner-authenticated responses now include an `X-Correlation-ID` header. Please include this ID when reporting issues to support.
**Note on Idempotency**: For all `POST`, `PUT`, and `PATCH` requests, you should include an `Idempotency-Key` header. This ensures that if a request is retried due to network issues, it will not be processed multiple times on the server.
   - **Header**: `Idempotency-Key: <unique-uuid>`
   - **TTL**: Cached responses are stored for 24 hours.
   - **Behavior**: Replayed requests will return the cached response with an `X-Idempotency-Hit: true` header.

---

## 1. Authentication (`/auth`)

### 1.1 Register

- **URL**: `POST /api/v1/auth/register`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "unique_username",
    "password": "StrongPassword123!",
    "name": "Optional Display Name"
  }
  ```
- **Returns**: `201 Created` with success message. Sends a verification email.

### 1.2 Login

- **URL**: `POST /api/v1/auth/login`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "email_or_username": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Returns**: `200 OK`
  ```json
  {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user": {
      "uuid": "...",
      "email": "user@example.com",
      "username": "unique_username",
      ...
    }
  }
  ```
  _(Also sets `refresh_token` in an HttpOnly cookie)._
  _If 2FA is enabled, it returns `{"requires_2fa": true, "user_id": "...", "method": "email"}`._

### 1.3 Verify 2FA

- **URL**: `POST /api/v1/auth/verify-2fa`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "user_id": "uuid-from-login-response",
    "code": "123456"
  }
  ```
- **Returns**: Same as Login response.

### 1.3.1 Email Verification
- **Verify Email**: `GET /api/v1/auth/verify-email?token=...`
- **Resend Verification**: `POST /api/v1/auth/resend-verification` `{"email": "..."}`

### 1.4 Refresh Token

- **URL**: `POST /api/v1/auth/refresh`
- **Auth Required**: No (relies on HttpOnly cookie)
- **Returns**: `200 OK` with a new `access_token`.

### 1.5 Logout

- **URL**: `POST /api/v1/auth/logout`
- **Auth Required**: No (relies on HttpOnly cookie)
- **Returns**: `200 OK` with success message. Clears the HttpOnly cookie.

### 1.6 Logout All Devices

- **URL**: `POST /api/v1/auth/logout-all`
- **Auth Required**: Yes (JWT Bearer)
- **Returns**: `200 OK`

### 1.7 Password Reset

- **Request Link**: `POST /api/v1/auth/password-reset` `{"email": "..."}`
- **Confirm Reset**: `POST /api/v1/auth/password-reset-confirm` `{"token": "...", "new_password": "..."}`

---

## 2. User Profile (`/users`)

### 2.1 Get My Profile

- **URL**: `GET /api/v1/users/me`
- **Auth Required**: Yes (JWT Bearer)
- **Returns**: Complete user profile data.

### 2.2 Update Profile

- **URL**: `PATCH /api/v1/users/me`
- **Auth Required**: Yes (JWT Bearer)
- **Body**: (All optional)
  ```json
  {
    "name": "New Name",
    "language": "en",
    "timezone": "UTC",
    "profile_picture": "https://..."
  }
  ```
- **Returns**: `200 OK` with success message.

### 2.3 Change Password

- **URL**: `POST /api/v1/users/me/change-password`
- **Auth Required**: Yes (JWT Bearer)
- **Body**:
  ```json
  {
    "current_password": "oldPassword123!",
    "new_password": "newStrongPassword123!"
  }
  ```

### 2.4 Manage Sessions

- **Get Sessions**: `GET /api/v1/users/me/sessions` (Requires JWT)
- **Revoke Session**: `DELETE /api/v1/users/me/sessions/{session_id}` (Requires JWT)

### 2.5 2FA Settings

- **Enable 2FA**: `POST /api/v1/users/me/enable-2fa` `{"method": "email"}` (Requires JWT)
- **Disable 2FA**: `POST /api/v1/users/me/disable-2fa` `{"password": "current_password"}` (Requires JWT)

### 2.6 Delete Account

- **URL**: `DELETE /api/v1/users/me`
- **Auth Required**: Yes (JWT Bearer)
- **Body**: `{"password": "current_password"}`

---

## 3. Search (`/search_tracks`)

### 3.1 Search Tracks

- **URL**: `GET /api/v1/search_tracks/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Query Params**:
  - `query`: string (required)
  - `mode`: `artist`, `title`, or `auto` (default: auto)
- **Returns**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
         "id": 123,
         "uuid": "...",
         "title": "...",
         "artist": "...",
         ...
      }
    ]
  }
  ```

---

## 4. Similarity (`/api/v1/similarity`)

### 4.1 Upload & Get Similarity

- **URL**: `POST /api/v1/similarity/upload`
- **Legacy URL**: `POST /get_similarity/` (Deprecated)
- **Auth Required**: API Key (JWT optional; if provided, links upload to user)
- **Form Data**:
  - `file`: Audio file (max 100MB)
- **Query Params**:
  - `top_sk`: 10, 20, 50, or 100 (default: 20)
- **Headers**:
  - `Idempotency-Key`: UUID (Recommended)
- **Returns**: Information about the uploaded track and a list of similar tracks.

### 4.2 Get Similarity by Track ID

- **URL**: `POST /api/v1/similarity/search`
- **Legacy URL**: `POST /get_selection_similarity/` (Deprecated)
- **Auth Required**: API Key (JWT optional)
- **Body**:
  ```json
  {
    "track_id": 123,
    "top_sk": 20
  }
  ```

### 4.3 Segment Status Poll

- **URL**: `GET /api/v1/similarity/segment-status/{playlist_uuid}`
- **Legacy URL**: `GET /segment_status/{playlist_uuid}` (Deprecated)
- **Auth Required**: API Key
- **Returns**: `{"segmentation_completed": true/false}`
- **Description**: Checks if segment preview processing completed for a playlist.

---

## 5. Playlists (`/playlists`)

### 5.1 Fork Public Playlist

- **URL**: `POST /api/v1/playlists/fork/{playlist_id}`
- **Auth Required**: Yes (JWT Bearer)
- **Description**: Copies a public playlist to the user's account.

### 5.2 Get User Playlists

- **URL**: `GET /api/v1/playlists/get-all-playlists/`
- **Auth Required**: Yes (JWT Bearer)
- **Query Params**: `page`, `page_size`, `play_time`, `num_tracks`, `start_date`, `end_date`, `is_public`, `own_favorites`, `all_favorites`
- **Returns**: Paginated list of user's playlists.

### 5.3 Rename / Change Visibility

- **Rename**: `PUT /api/v1/playlists/rename/` `{"playlist_id": "...", "new_name": "..."}`
- **Visibility**: `PUT /api/v1/playlists/visibility/` `{"playlist_id": "...", "is_public": true/false}`
- **Auth Required**: JWT (Optional but highly recommended to verify ownership)

### 5.4 Get Playlist Similarity Data

- **URL**: `GET /api/v1/playlists/similarity/{playlist_id}`
- **Auth Required**: API Key (JWT optional to view own private playlists)
- **Returns**: Playlist formatted like similarity endpoint response.

### 5.5 Get HLS M3U8 (Audio Streaming)

- **URL**: `GET /api/v1/playlists/similarity-hls/{playlist_id}.m3u8`
- **Auth Required**: API Key (JWT optional to view own private playlists)
- **Returns**: `application/vnd.apple.mpegurl` file content with signed URLs.

### 5.6 Get Playback Session (Edge Auth)

- **URL**: `POST /api/v1/playlists/{playlist_id}/play-session`
- **Auth Required**: API Key
- **Returns**: `{"playback_url": "..."}` with JWT token appended.

---

## 6. External Transfers (`/spotify`, `/apple-music`, `/tidal`)

### 6.1 Spotify Transfer

- **Get Client ID**: `GET /api/v1/spotify/app-client-id` (Requires JWT)
  - Returns: `{"client_id": "...", "app_name": "..."}`
- **Transfer**: `POST /api/v1/spotify/transfer-playlist/` (Requires JWT)
  - Body: `{"playlist_id": "uuid", "access_token": "spotify-token", "playlist_name": "Optional"}`

### 6.2 Apple Music Transfer

- **Get Dev Token**: `GET /api/v1/apple-music/developer-token/`
  - Returns: `{"token": "...", "expires_at": 123456789}`
- **Transfer**: `POST /api/v1/apple-music/transfer-playlist/`
  - Body: `{"playlist_id": "uuid", "music_user_token": "apple-token", "playlist_name": "Optional"}`

### 6.3 Tidal Transfer

- **Exchange Token**: `POST /api/v1/tidal/auth/token`
  - Body: `{"code": "auth-code", "code_verifier": "...", "redirect_uri": "..."}`
- **Transfer**: `POST /api/v1/tidal/transfer-playlist/`
  - Body: `{"playlist_id": "uuid", "access_token": "tidal-token", "playlist_name": "Optional"}`

---

## 7. Playlist Engagement (`/playlist`)

### 7.1 Favorites

- **Add**: `POST /api/v1/playlist/add-favorite/{playlist_id}` (Requires JWT)
- **Remove**: `POST /api/v1/playlist/remove-favorite/{playlist_id}` (Requires JWT)

### 7.2 Follows

- **Follow**: `POST /api/v1/playlist/follow/{playlist_id}` (Requires JWT)
- **Unfollow**: `POST /api/v1/playlist/unfollow/{playlist_id}` (Requires JWT)

---

## 8. Ratings (`/ratings`)

### 8.1 Track Ratings

- **Rate**: `POST /api/v1/ratings/tracks/`
  ```json
  {
    "track_id": "uuid",
    "playlist_id": "uuid",
    "rating": 1 // 1=similar, 0=not similar
  }
  ```
  _(Requires JWT or API Key + manual user_id)_
- **Get**: `GET /api/v1/ratings/tracks/{track_id}/playlist/{playlist_id}`
- **Delete**: `DELETE /api/v1/ratings/tracks/{track_id}/playlist/{playlist_id}`

### 8.2 Playlist Ratings

- **Rate**: `POST /api/v1/ratings/playlists/`
  ```json
  {
    "playlist_id": "uuid",
    "rating": 3, // 0-3 stars
    "message": "Optional review"
  }
  ```
  _(Requires JWT or API Key + manual user_id)_
- **Get**: `GET /api/v1/ratings/playlists/{playlist_id}`
- **Delete**: `DELETE /api/v1/ratings/playlists/{playlist_id}`
- **Stats**: `GET /api/v1/ratings/playlists/{playlist_id}/stats` (API Key only)

### 8.3 Rating Statistics

- **Track Stats**: `GET /api/v1/ratings/tracks/{track_id}/stats`
  - Returns: `{"total_ratings": 100, "rating_distribution": {"0": 20, "1": 80}}`
- **Playlist Stats**: `GET /api/v1/ratings/playlists/{playlist_id}/stats`
  - Returns: `{"total_ratings": 50, "average_rating": 2.5, "rating_distribution": {"0": 5, "1": 10, "2": 15, "3": 20}}`

---

## 9. Cart & Checkout (`/cart`, `/checkout`)

### 9.1 Cart Operations (Requires JWT)

- **Get Cart**: `GET /api/v1/cart`
- **Add Item/Playlist**: `POST /api/v1/cart/add`
  ```json
  {
    "items": [{ "track_id": "uuid", "source_playlist_id": "uuid" }],
    // OR
    "playlist_id": "uuid"
  }
  ```
- **Remove Track**: `DELETE /api/v1/cart/remove/{track_id}`
- **Remove Playlist**: `DELETE /api/v1/cart/remove-playlist/{playlist_id}`
- **Clear Cart**: `DELETE /api/v1/cart/clear`

### 9.2 Promo Code (Requires JWT)

- **Apply**: `POST /api/v1/cart/promo` `{"code": "SUMMER25"}`

### 9.3 Checkout (Requires JWT)

- **Init Checkout**: `POST /api/v1/checkout/init` `{"cart_id": 123}` (Phase 2 pre-flight)
- **Create Stripe Session**: `POST /api/v1/checkout/create-session`

---

## 10. Telemetry (`/telemetry`)

### 10.1 Sync Telemetry

- **URL**: `POST /api/v1/telemetry/sync`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**:
  ```json
  {
    "events": [
      {
         "event_type": "stream_start",
         "track_id": 123,
         ...
      }
    ]
  }
  ```
- **Description**: Accepts batches of playback events (from 30s heartbeat or page unload).

---

## 11. Waitlist (`/waitlist`)

### 11.1 Join Waitlist

- **URL**: `POST /api/v1/waitlist/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**: `{"email": "user@example.com"}`

### 11.2 Check Status

- **URL**: `POST /api/v1/waitlist/status`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**: `{"email": "user@example.com"}`

---

## 12. Contact & Support (`/api/v1/contact`)

### 12.1 Submit Contact Form

- **URL**: `POST /api/v1/contact/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "I need help with...",
    "subject": "Optional subject",
    "phone": "Optional phone number"
  }
  ```

---

## 13. Feedback (`/api/v1/feedback`)

### 13.1 Submit Feedback

- **URL**: `POST /api/v1/feedback/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**:
  ```json
  {
    "satisfaction": 8,
    "recommendation": 9,
    "feedback": "Great service!",
    "category": "Optional category"
  }
  ```
  _(Requires JWT or API Key + manual user_id)_

---

## 14. Preview (`/api/v1/preview`)

### 14.1 Get Preview URL

- **URL**: `GET /api/v1/preview/get_preview/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Query Params**: `track_id`
- **Returns**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "download_url": "https://media.resomix.com/..."
    }
  }
  ```

---

## 15. Metadata (`/api/v1/metadata`)

### 15.1 Extract Metadata

- **URL**: `POST /api/v1/metadata/track`
- **Legacy URL**: `POST /metadata/` (Deprecated)
- **Auth Required**: API Key (`X-API-KEY`)
- **Form Data**: `file` (Audio file)
- **Returns**: Extracted ID3/metadata tags.

---

## 16. Health (`/health`)

### 16.1 API Status

- **URL**: `GET /health`
- **Auth Required**: None
- **Returns**: `{"status": "healthy", "service": "Resomix API"}`

### 16.2 Root Info

- **URL**: `GET /`
- **Returns**: API version and status.

---

## 17. Admin & B2B Operations (`/api/v1/admin`, `/api/v1/ingest`)

These endpoints are used by the internal admin dashboard or B2B integrations and **must** include the `/api/v1/` prefix. **Administrative endpoints now strictly require an Admin JWT Bearer Token** (or the global System API Key for legacy services).

### 17.1 Admin Authentication (`/api/v1/admin/auth`)

- **Admin Login**: `POST /api/v1/admin/auth/login` (Body: `{"email": "...", "password": "..."}`)
  - Returns JWT token with the `role: admin` claim required for all `/api/v1/admin/*` endpoints.

### 17.2 Partner Management (`/api/v1/admin/partners`)

- **Get Current Partner Info**: `GET /api/v1/partner/me` (API Key Required)
  - Returns: `{"id": 1, "name": "...", "tier": "...", "is_active": true}`
- **Create Partner**: `POST /api/v1/admin/partners/`
- **List Partners**: `GET /api/v1/admin/partners/` (supports `page`, `page_size`, `tier`, `is_active`)
- **Get Partner Detail**: `GET /api/v1/admin/partners/{partner_id}`
- **Update Partner**: `PATCH /api/v1/admin/partners/{partner_id}`
- **Delete Partner**: `DELETE /api/v1/admin/partners/{partner_id}`
- **Issue API Key**: `POST /api/v1/admin/partners/api-keys/issue`
- **List API Keys**: `GET /api/v1/admin/partners/api-keys/{partner_id}`
- **Revoke API Key**: `POST /api/v1/admin/partners/api-keys/revoke`
- **Rotate API Key**: `POST /api/v1/admin/partners/api-keys/rotate`

#### SFTP Provisioning (Admin)
- **Provision SFTP Partner**: `POST /api/v1/admin/partners/sftp/provision`
  - Body: `{"partner_id": 42, "username": "...", "password": "...", "use_public_key": false, "public_key": null}`
- **Get SFTP Status**: `GET /api/v1/admin/partners/{partner_id}/sftp`
- **Retry SFTP Provisioning**: `POST /api/v1/admin/partners/{partner_id}/sftp/retry`

### 17.3 User & Role Management (Admin) (`/api/v1/admin/users`, `/api/v1/admin/roles`)

- **List/Search Users**: `GET /api/v1/admin/users` (Requires Admin Auth)
- **Get User Details**: `GET /api/v1/admin/users/{user_uuid}`
- **Create User**: `POST /api/v1/admin/users`
- **Update User**: `PATCH /api/v1/admin/users/{user_uuid}`
- **Toggle User Status**: `POST /api/v1/admin/users/{user_uuid}/toggle-status`
- **Assign Role**: `POST /api/v1/admin/users/{user_uuid}/roles` `{"role_name": "admin"}`
- **Remove Role**: `DELETE /api/v1/admin/users/{user_uuid}/roles/{role_name}`
- **List System Roles**: `GET /api/v1/admin/roles`
- **Get Role Details**: `GET /api/v1/admin/roles/{role_name}`
- **List System Permissions**: `GET /api/v1/admin/roles/permissions`
- **Update Role Permissions**: `PUT /api/v1/admin/roles/{role_name}/permissions` `{"permissions": ["...", "..."]}`
- **Legacy User Search**: `GET /api/v1/users/search` (Deprecated)

### 17.4 Operation Limits (`/api/v1/admin/operation-limits`)

- **List Types**: `GET /api/v1/admin/operation-limits/operation-types`
- **List User Limits**: `GET /api/v1/admin/operation-limits/`
- **Get User Limit**: `GET /api/v1/admin/operation-limits/{user_identifier}/{operation_code}`
- **Upsert Limit**: `PUT /api/v1/admin/operation-limits/`
- **Delete Limit**: `DELETE /api/v1/admin/operation-limits/{user_identifier}/{operation_code}`

### 17.5 Admin Playlist Management (`/api/v1/admin/playlist`)

- **List Playlists**: `GET /api/v1/admin/playlist/`
- **Get Detail**: `GET /api/v1/admin/playlist/{uuid}`
- **Delete Single**: `DELETE /api/v1/admin/playlist/{playlist_id}`
- **Batch Delete**: `POST /api/v1/admin/playlist/batch-delete`
- **Export CSV**: `POST /api/v1/admin/playlist/export`
- **Visibility**: `PATCH /api/v1/admin/playlist/{playlist_id}/visibility`
- **Batch Visibility**: `POST /api/v1/admin/playlist/batch-visibility`

### 17.6 Admin Waitlist Management (`/api/v1/admin/waitlist`)

- **List**: `GET /api/v1/admin/waitlist/`
- **Delete Single**: `DELETE /api/v1/admin/waitlist/{waitlist_id}`
- **Update Status**: `POST /api/v1/admin/waitlist/update-status/{waitlist_id}`
- **Batch Delete**: `POST /api/v1/admin/waitlist/batch-delete`
- **Export CSV**: `POST /api/v1/admin/waitlist/export`

### 17.7 Admin Contact & Feedback (`/api/v1/admin/contact`, `/api/v1/admin/feedback`)

- **List Contacts**: `GET /api/v1/admin/contact/`
- **Get Contact**: `GET /api/v1/admin/contact/{contact_id}`
- **Delete Contact**: `DELETE /api/v1/admin/contact/{contact_id}`
- **Mark Contact Status**: `POST /api/v1/admin/contact/mark-status/{contact_id}`
- **Batch Delete Contacts**: `POST /api/v1/admin/contact/batch-delete`
- **Export Contacts**: `POST /api/v1/admin/contact/export`

- **List Feedback**: `GET /api/v1/admin/feedback/`
- **Get Feedback**: `GET /api/v1/admin/feedback/{feedback_id}`
- **Feedback Stats**: `GET /api/v1/admin/feedback/stats`
- **Update Feedback Content**: `PATCH /api/v1/admin/feedback/{feedback_id}`
- **Delete Feedback**: `DELETE /api/v1/admin/feedback/{feedback_id}`
- **Update Feedback Status**: `PATCH /api/v1/admin/feedback/{feedback_id}/status`
- **Batch Delete Feedback**: `POST /api/v1/admin/feedback/batch-delete`
- **Export Feedback**: `POST /api/v1/admin/feedback/export`

### 17.8 Spotify Apps (Admin) (`/api/v1/admin/spotify-apps`)

- **List Apps**: `GET /api/v1/admin/spotify-apps/`
- **Get App**: `GET /api/v1/admin/spotify-apps/{app_id}`
- **Create App**: `POST /api/v1/admin/spotify-apps/`
- **Update App**: `PUT /api/v1/admin/spotify-apps/{app_id}`
- **Delete App**: `DELETE /api/v1/admin/spotify-apps/{app_id}`
- **List User Associations**: `GET /api/v1/admin/spotify-apps/users`
- **Upsert Association**: `PUT /api/v1/admin/spotify-apps/users`
- **Delete Association**: `DELETE /api/v1/admin/spotify-apps/users/{user_identifier}`

### 17.9 Admin Similarity (`/api/v1/admin/similarity`)

- **Rebuild Index**: `POST /api/v1/admin/similarity/rebuild-index`

### 17.10 Promo Codes (Admin) (`/api/v1/admin/promo`)

- **Create Promo**: `POST /api/v1/admin/promo/create`

### 17.11 Ingestion Pipelines (`/api/v1/ingest`)

- **Monthly Track**: `POST /api/v1/ingest/monthly/track`
- **Monthly Update Embeddings**: `POST /api/v1/ingest/monthly/update_embeddings`
- **Open Tracks Track**: `POST /api/v1/ingest/open/track`
- **Open Tracks Update Embeddings**: `POST /api/v1/ingest/open/update_embeddings`

### 17.12 Dummy / Testing Endpoints (`/dummy`)

- **Dummy HLS**: `GET /dummy/dummy-hls/{playlist_id}.m3u8`
  - Returns a static HLS M3U8 file regardless of ID.

---

## Standard Response Format

Almost all successful endpoints return data wrapped in a standard JSON response structure:

```json
{
  "success": true,
  "data": { ... payload ... },
  "message": "Optional success message" // for some endpoints
}
```

Errors are typically returned as:

```json
{
  "success": false,
  "error": "Error description message"
}
```
