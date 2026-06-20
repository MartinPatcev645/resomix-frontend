# Resomix Frontend API Integration Guide

This guide is the canonical reference for all API endpoints the frontend (admin dashboard, consumer app, B2B partner portal) can call. It is generated from the live route list and should be kept in sync whenever new routes are added.

**Last verified:** 2026-06-18 against live server on `http://localhost:8001` (SFTP custom limits + update endpoint added in §19.2)

## Base URL

| Environment | URL |
|---|---|
| Local development | `http://localhost:8001` |
| Production | `https://api.resomix.com` |

## API Versioning

All endpoints are served at both the versioned (`/api/v1/`) and legacy unversioned paths. **New integrations must use `/api/v1/`.** Legacy unversioned paths are frozen and will eventually be removed.

---

## Authentication & Headers

Four auth tiers are supported depending on the caller:

| Tier | Actor | Header |
|---|---|---|
| **Public** | Anonymous / consumer frontend | `X-API-KEY: <public-api-key>` |
| **JWT (user)** | Logged-in consumer user | `Authorization: Bearer <access_token>` |
| **B2B Partner** | Partner system / integration | `Authorization: Bearer rmx_<partner_api_key>` |
| **Admin** | Internal admin dashboard | `Authorization: Bearer <admin_jwt>` **or** `X-API-KEY: <global_system_key>` |

**Notes:**
- Refresh tokens live in an `HttpOnly` cookie — do not manage them in JavaScript.
- All partner-authenticated responses include `X-Correlation-ID` for support tracing.
- For `POST`, `PUT`, `PATCH`: include `Idempotency-Key: <uuid>` to prevent duplicate processing. Replayed requests return the cached response with `X-Idempotency-Hit: true` (24-hour TTL).

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 Register
- **`POST /api/v1/auth/register`** — No auth
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "username": "unique_username",
    "password": "StrongPassword123!",
    "name": "Optional Display Name"
  }
  ```
- **Returns:** `201 Created`. Sends a verification email.

### 1.2 Login
- **`POST /api/v1/auth/login`** — No auth
- **Body:**
  ```json
  { "email_or_username": "user@example.com", "password": "StrongPassword123!" }
  ```
- **Returns:** `200 OK`
  ```json
  {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user": { "uuid": "...", "email": "...", "username": "..." }
  }
  ```
  _Sets `refresh_token` in an HttpOnly cookie. If 2FA is enabled returns `{"requires_2fa": true, "user_id": "...", "method": "email"}`._

### 1.3 Verify 2FA
- **`POST /api/v1/auth/verify-2fa`** — No auth
- **Body:** `{ "user_id": "uuid-from-login", "code": "123456" }`
- **Returns:** Same as Login.

### 1.4 Email Verification
- **Verify email:** `GET /api/v1/auth/verify-email?token=<token>`
- **Resend verification:** `POST /api/v1/auth/resend-verification` — Body: `{ "email": "..." }`

### 1.5 Refresh Token
- **`POST /api/v1/auth/refresh`** — Relies on HttpOnly cookie
- **Returns:** `{ "access_token": "..." }`

### 1.6 Logout
- **`POST /api/v1/auth/logout`** — Relies on HttpOnly cookie. Clears the cookie.

### 1.7 Logout All Devices
- **`POST /api/v1/auth/logout-all`** — Requires JWT Bearer

### 1.8 Password Reset
- **Request link:** `POST /api/v1/auth/password-reset` — Body: `{ "email": "..." }`
- **Confirm reset:** `POST /api/v1/auth/password-reset-confirm` — Body: `{ "token": "...", "new_password": "..." }`

---

## 2. User Profile (`/api/v1/users`)

### 2.1 Get My Profile
- **`GET /api/v1/users/me`** — Requires JWT
- **Returns:** Complete user profile.

### 2.2 Update Profile
- **`PATCH /api/v1/users/me`** — Requires JWT
- **Body (all optional):**
  ```json
  { "name": "New Name", "language": "en", "timezone": "UTC", "profile_picture": "https://..." }
  ```

### 2.3 Change Password
- **`POST /api/v1/users/me/change-password`** — Requires JWT
- **Body:** `{ "current_password": "old", "new_password": "new" }`

### 2.4 Manage Sessions
- **`GET /api/v1/users/me/sessions`** — Requires JWT. Returns all active sessions.
- **`DELETE /api/v1/users/me/sessions/{session_id}`** — Requires JWT. Revokes a session.

### 2.5 2FA Settings
- **Enable:** `POST /api/v1/users/me/enable-2fa` — Body: `{ "method": "email" }`
- **Disable:** `POST /api/v1/users/me/disable-2fa` — Body: `{ "password": "current_password" }`

### 2.6 Delete Account
- **`DELETE /api/v1/users/me`** — Requires JWT — Body: `{ "password": "current_password" }`

---

## 3. Search (`/api/v1/search_tracks`)

### 3.1 Search Tracks
- **`GET /api/v1/search_tracks/`** — Requires API Key
- **Query params:** `query` (required), `mode` = `artist | title | auto` (default: `auto`)
- **Returns:**
  ```json
  { "success": true, "data": [{ "id": 123, "uuid": "...", "title": "...", "artist": "..." }] }
  ```

---

## 4. Similarity (`/api/v1/similarity`)

### 4.1 Upload & Get Similarity
- **`POST /api/v1/similarity/upload`** — Requires API Key (JWT optional; links upload to user if provided)
- **Legacy:** `POST /api/v1/get_similarity/` _(deprecated)_
- **Form Data:** `file` (audio file, max 100 MB)
- **Query params:** `top_sk` = 10 | 20 | 50 | 100 (default: 20)
- **Returns:** Uploaded track info + list of similar tracks.

### 4.2 Get Similarity by Track ID
- **`POST /api/v1/similarity/search`** — Requires API Key
- **Legacy:** `POST /api/v1/get_selection_similarity/` _(deprecated)_
- **Body:** `{ "track_id": 123, "top_sk": 20 }`

### 4.3 Segment Status Poll
- **`GET /api/v1/similarity/segment-status/{playlist_uuid}`** — Requires API Key
- **Legacy:** `GET /api/v1/segment_status/{playlist_uuid}` _(deprecated)_
- **Returns:** `{ "segmentation_completed": true | false }`

---

## 5. Playlists (`/api/v1/playlists`)

### 5.1 Fork Public Playlist
- **`POST /api/v1/playlists/fork/{playlist_id}`** — Requires JWT. Copies a public playlist to user's account.

### 5.2 Get User Playlists
- **`GET /api/v1/playlists/get-all-playlists/`** — Requires JWT
- **Query params:** `page`, `page_size`, `play_time`, `num_tracks`, `start_date`, `end_date`, `is_public`, `own_favorites`, `all_favorites`
- **Returns:** Paginated list of user playlists.

### 5.3 Rename / Change Visibility
- **Rename:** `PUT /api/v1/playlists/rename/` — Body: `{ "playlist_id": "uuid", "new_name": "..." }`
- **Visibility:** `PUT /api/v1/playlists/visibility/` — Body: `{ "playlist_id": "uuid", "is_public": true }`

### 5.4 Get Playlist Similarity Data
- **`GET /api/v1/playlists/similarity/{playlist_id}`** — Requires API Key (JWT optional to view own private)
- **Returns:** Playlist formatted like similarity endpoint response.

### 5.5 Get HLS M3U8 (Audio Streaming)
- **`GET /api/v1/playlists/similarity-hls/{playlist_id}.m3u8`** — Requires API Key
- **Returns:** `application/vnd.apple.mpegurl` with signed segment URLs.

### 5.6 Get Playback Session (Edge Auth)
- **`POST /api/v1/playlists/{playlist_id}/play-session`** — Requires API Key
- **Returns:** `{ "playback_url": "..." }` with valet JWT appended.

---

## 6. Playlist Engagement (`/api/v1/playlist`)

### 6.1 Favorites
- **Add:** `POST /api/v1/playlist/add-favorite/{playlist_id}` — Requires JWT
- **Remove:** `POST /api/v1/playlist/remove-favorite/{playlist_id}` — Requires JWT

### 6.2 Follows
- **Follow:** `POST /api/v1/playlist/follow/{playlist_id}` — Requires JWT
- **Unfollow:** `POST /api/v1/playlist/unfollow/{playlist_id}` — Requires JWT

---

## 7. Ratings (`/api/v1/ratings`)

### 7.1 Track Ratings
- **Rate:** `POST /api/v1/ratings/tracks/`
  ```json
  { "track_id": "uuid", "playlist_id": "uuid", "rating": 1 }
  ```
  _(1 = similar, 0 = not similar. Requires JWT or API Key + user_id)_
- **Get:** `GET /api/v1/ratings/tracks/{track_id}/playlist/{playlist_id}`
- **Delete:** `DELETE /api/v1/ratings/tracks/{track_id}/playlist/{playlist_id}`
- **Stats:** `GET /api/v1/ratings/tracks/{track_id}/stats`
  - Returns: `{ "total_ratings": 100, "rating_distribution": { "0": 20, "1": 80 } }`

### 7.2 Playlist Ratings
- **Rate:** `POST /api/v1/ratings/playlists/`
  ```json
  { "playlist_id": "uuid", "rating": 3, "message": "Optional review" }
  ```
  _(0–3 stars. Requires JWT or API Key + user_id)_
- **Get:** `GET /api/v1/ratings/playlists/{playlist_id}`
- **Delete:** `DELETE /api/v1/ratings/playlists/{playlist_id}`
- **Stats:** `GET /api/v1/ratings/playlists/{playlist_id}/stats`
  - Returns: `{ "total_ratings": 50, "average_rating": 2.5, "rating_distribution": { ... } }`

---

## 8. Cart & Checkout (`/api/v1/cart`, `/api/v1/checkout`)

### 8.1 Cart Operations — Requires JWT

- **Get cart:** `GET /api/v1/cart`
- **Add items:** `POST /api/v1/cart/add`
  ```json
  {
    "items": [{ "track_id": "uuid", "source_playlist_id": "uuid" }]
  }
  ```
  _Or add a whole playlist:_ `{ "playlist_id": "uuid" }`
- **Remove track:** `DELETE /api/v1/cart/remove/{track_id}`
- **Remove playlist:** `DELETE /api/v1/cart/remove-playlist/{playlist_id}`
- **Clear cart:** `DELETE /api/v1/cart/clear`

### 8.2 Promo Code — Requires JWT
- **Apply:** `POST /api/v1/cart/promo` — Body: `{ "code": "SUMMER25" }`

### 8.3 Checkout — Requires JWT
- **Pre-flight:** `POST /api/v1/checkout/init` — Body: `{ "cart_id": 123 }`
- **Create Stripe session:** `POST /api/v1/checkout/create-session`

---

## 9. External Transfers

### 9.1 Spotify — Requires JWT
- **Get client ID:** `GET /api/v1/spotify/app-client-id`
  - Returns: `{ "client_id": "...", "app_name": "..." }`
- **Transfer playlist:** `POST /api/v1/spotify/transfer-playlist/`
  - Body: `{ "playlist_id": "uuid", "access_token": "spotify-token", "playlist_name": "Optional" }`

### 9.2 Apple Music
- **Get dev token:** `GET /api/v1/apple-music/developer-token/`
  - Returns: `{ "token": "...", "expires_at": 123456789 }`
- **Transfer playlist:** `POST /api/v1/apple-music/transfer-playlist/`
  - Body: `{ "playlist_id": "uuid", "music_user_token": "apple-token", "playlist_name": "Optional" }`

### 9.3 Tidal
- **Exchange token:** `POST /api/v1/tidal/auth/token`
  - Body: `{ "code": "auth-code", "code_verifier": "...", "redirect_uri": "..." }`
- **Transfer playlist:** `POST /api/v1/tidal/transfer-playlist/`
  - Body: `{ "playlist_id": "uuid", "access_token": "tidal-token", "playlist_name": "Optional" }`

---

## 10. Telemetry (`/api/v1/telemetry`)

### 10.1 Sync Telemetry Events
- **`POST /api/v1/telemetry/sync`** — Requires API Key
- **Body:**
  ```json
  { "events": [{ "event_type": "stream_start", "track_id": 123 }] }
  ```
- _Accepts batches from 30-second heartbeats or page-unload flushes._

---

## 11. Waitlist (`/api/v1/waitlist`)

- **Join:** `POST /api/v1/waitlist/` — Body: `{ "email": "user@example.com" }`
- **Check status:** `POST /api/v1/waitlist/status` — Body: `{ "email": "user@example.com" }`

Both require API Key.

---

## 12. Contact & Support (`/api/v1/contact`)

### 12.1 Submit Contact Form
- **`POST /api/v1/contact/`** — Requires API Key
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "I need help with...",
    "subject": "Optional subject",
    "phone": "Optional phone"
  }
  ```

---

## 13. Feedback (`/api/v1/feedback`)

### 13.1 Submit Feedback
- **`POST /api/v1/feedback/`** — Requires API Key (or JWT)
- **Body:**
  ```json
  {
    "satisfaction": 8,
    "recommendation": 9,
    "feedback": "Great service!",
    "category": "Optional category"
  }
  ```

---

## 14. Preview (`/api/v1/preview`)

### 14.1 Get Preview URL
- **`GET /api/v1/preview/get_preview/`** — Requires API Key
- **Query params:** `track_id`
- **Returns:**
  ```json
  { "success": true, "data": { "download_url": "https://media.resomix.com/..." } }
  ```

---

## 15. Metadata (`/api/v1/metadata`)

### 15.1 Extract Metadata
- **`POST /api/v1/metadata/track`** — Requires API Key
- **Legacy:** `POST /api/v1/metadata/` _(deprecated)_
- **Form Data:** `file` (audio file)
- **Returns:** Extracted ID3/metadata tags.

---

## 16. Health & Root

- **`GET /api/v1/health`** — No auth — Returns: `{ "status": "healthy", "service": "Resomix API" }`
- **`GET /api/v1/`** — No auth — Returns API version and status.

---

## 17. B2B Partner Endpoints (`/api/v1/partner`)

These endpoints are called by a B2B partner using their API key (`Authorization: Bearer rmx_<partner_api_key>`).

### 17.1 Get Partner Info
- **`GET /api/v1/partner/me`** — Requires Partner API Key
- **Returns:**
  ```json
  { "success": true, "data": { "id": 1, "name": "...", "tier": "growth", "is_active": true } }
  ```

### 17.2 Mint Playback Token (Valet Auth)
- **`POST /api/v1/partner/playback-token`** — Requires Partner API Key
- **Description:** Exchange the partner API key for a short-lived HS256 "valet" JWT. This token can be attached to Hetzner media-serving requests so they resolve partner-scoped assets without a database lookup per request.
- **Returns:**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJ...",
      "expires_in": 3600,
      "partner_id": 42,
      "scope": "playback"
    }
  }
  ```

### 17.3 Track Deletion Audit Log
- **`GET /api/v1/partner/deletion-log`** — Requires Partner API Key
- **Description:** Returns an ECDSA-signed log of track deletions for the partner (for compliance / reconciliation).
- **Query params:** `from_date` (YYYY-MM-DD), `to_date` (YYYY-MM-DD)
- **Returns:**
  ```json
  { "success": true, "data": { "entries": [...], "signature": "..." } }
  ```

---

## 18. Webhooks (`/api/v1/webhooks`)

### 18.1 Stripe Webhook Receiver
- **`POST /api/v1/webhooks/stripe`** — No standard auth (Stripe signature verified internally)
- **Description:** Stripe sends events here (checkout completed, subscription updated, etc.). Configure in your Stripe dashboard to point to this endpoint.
- **Note:** Do not call this from the frontend. It is invoked by Stripe directly.

---

## 19. Admin Operations (`/api/v1/admin`)

All admin endpoints require an authenticated admin. Supply either:
- `Authorization: Bearer <admin_jwt>` (issued by `POST /api/v1/admin/auth/login`), or
- `X-API-KEY: <global_system_key>` (legacy system-to-system; superadmin scope)

### 19.1 Admin Authentication

- **Admin login:** `POST /api/v1/admin/auth/login`
  - Body: `{ "email": "...", "password": "..." }`
  - Returns: JWT with `role: admin` claim required by all `/api/v1/admin/*` routes.

---

### 19.2 Partner Management (`/api/v1/admin/partners`)

#### CRUD
- **Create:** `POST /api/v1/admin/partners/` — `201`
  ```json
  {
    "legal_name": "Acme Music Ltd",
    "display_name": "Acme",
    "contact_email": "billing@acme.com",
    "tier": "growth",
    "country_code": "US",
    "vat_number": "optional"
  }
  ```
- **List:** `GET /api/v1/admin/partners/` — Query: `page`, `page_size`, `tier` (`sandbox|starter|growth|enterprise`), `is_active`
- **Get detail:** `GET /api/v1/admin/partners/{partner_id}`
- **Update:** `PATCH /api/v1/admin/partners/{partner_id}` — Body: any subset of create fields
- **Delete:** `DELETE /api/v1/admin/partners/{partner_id}`

#### API Key Management
- **Issue key:** `POST /api/v1/admin/partners/api-keys/issue` — `201`
  ```json
  { "partner_id": 42, "label": "prod-key" }
  ```
  Returns: `{ "api_key": "rmx_...", "key_id": "...", "label": "..." }` — **Store the raw key immediately; it is not stored.**
- **List keys:** `GET /api/v1/admin/partners/api-keys/{partner_id}`
- **Revoke key:** `POST /api/v1/admin/partners/api-keys/revoke`
  ```json
  { "api_key_id": 3, "reason": "compromised (min 5 chars)" }
  ```
  ⚠️ The field is **`api_key_id`** (the integer id from the list), **not** `key_id`, and **`reason` is required** (5–255 chars). Returns `200`; `404` if the id doesn't exist. (Sending `key_id` or omitting `reason` → `422`.)
- **Rotate key:** `POST /api/v1/admin/partners/api-keys/rotate` — `201`
  ```json
  { "api_key_id": 3, "label": "Production Key (optional)" }
  ```
  Revokes the old key, issues a new one with the same scopes/limits. The new key gets a **fresh expiry** (preserves the original validity window, starting now — never born expired); optionally pass `expires_at` (ISO datetime) to set it explicitly. Response `data.plaintext_key` is shown **only once** — store it immediately.

#### SFTP Provisioning
- **Provision:** `POST /api/v1/admin/partners/sftp/provision` — `201`
  ```json
  {
    "partner_id": 42,
    "password": "min-8-chars",
    "use_public_key": false,
    "public_key": null,
    "allowed_ip": null,

    "quota_bytes": null,
    "quota_files": null,
    "upload_bandwidth": null,
    "download_bandwidth": null,
    "max_sessions": null,
    "upload_data_transfer": null,
    "download_data_transfer": null,
    "total_data_transfer": null
  }
  ```
  - `username` is **auto-derived** from the partner UUID (`partner_<slug>`) — if sent it is ignored.
  - `password` required unless `use_public_key=true` (then `public_key` is required). `allowed_ip` = optional comma-separated IP/CIDR allowlist.
  - **The 8 limit fields are all optional.** Send a value to override; leave it `null` (or omit it) to use the partner tier's default. `0` = unlimited (SFTPGo convention). See the **SFTP Limits** reference table below for units + per-tier defaults.

- **Update SFTP limits:** `PATCH /api/v1/admin/partners/{partner_id}/sftp/limits` — `200`
  ```json
  { "quota_bytes": 12884901888, "upload_bandwidth": 5120 }
  ```
  - Changes the caps on an already-provisioned partner. **Send only the fields you want to change**; omitted/`null` fields keep their current value. At least one field is required.
  - Persists the new values (the SFTP auth hook serves them on the partner's next connection) and pushes them to SFTPGo immediately (best-effort).
  - **Returns** the same body as *Get SFTP status* (with the updated `limits`).

- **Get SFTP status:** `GET /api/v1/admin/partners/{partner_id}/sftp`
  - **Returns** (now includes the current `limits` so the admin UI can display/prefill them):
  ```json
  {
    "success": true,
    "data": {
      "provisioned": true,
      "host": "sftp.resomix.com",
      "port": 2022,
      "username": "partner_65c20f1c06df",
      "last_provisioned_at": "2026-06-18T10:00:00",
      "limits": {
        "quota_bytes": 10737418240,
        "quota_files": 0,
        "upload_bandwidth": 0,
        "download_bandwidth": 0,
        "max_sessions": 5,
        "upload_data_transfer": 0,
        "download_data_transfer": 0,
        "total_data_transfer": 0
      }
    }
  }
  ```
  _`limits` fields are `null` for partners provisioned before custom limits existed._

- **Retry provisioning:** `POST /api/v1/admin/partners/{partner_id}/sftp/retry`
  ```json
  { "password": "min-8-chars" }
  ```
  - For accounts that already failed initial provisioning (`sftp_provisioned_at` is null). Re-creates the SFTPGo user with the limits stored at provision time.
  - **Send the partner's password again** (the plaintext is never stored). It becomes the partner's login password — the SFTPGo user is created with it and the stored hash is updated to match. `password` may be omitted **only** for public-key accounts.
  - If the account is already fully provisioned, returns `400` with `"SFTP account is already fully provisioned"` (no-op — nothing to do).
  - **Returns** the same body as *Get SFTP status*.

##### SFTP Limits reference (units + per-tier defaults)

All limits are optional on provision; `0` = unlimited. When omitted, the partner's
tier default is used — use these for the frontend form's default/placeholder values.

| Field | Unit | sandbox | starter | growth | enterprise |
|---|---|---|---|---|---|
| `quota_bytes` | bytes | `1073741824` (1 GB) | `10737418240` (10 GB) | `53687091200` (50 GB) | `0` (unlimited) |
| `quota_files` | count | `0` | `0` | `0` | `0` |
| `upload_bandwidth` | KB/s | `2048` | `0` | `0` | `0` |
| `download_bandwidth` | KB/s | `4096` | `0` | `0` | `0` |
| `max_sessions` | count | `2` | `5` | `10` | `0` |
| `upload_data_transfer` | MB | `0` | `0` | `0` | `0` |
| `download_data_transfer` | MB | `0` | `0` | `0` | `0` |
| `total_data_transfer` | MB | `0` | `0` | `0` | `0` |

> UI tips: show quota in GB (convert to bytes on submit: `GB × 1073741824`), bandwidth in KB/s, transfer caps in MB. Label `0` as "Unlimited".

#### Webhook Subscriptions
- **Create webhook:** `POST /api/v1/admin/partners/webhooks` — `201`
  ```json
  { "partner_id": 42, "url": "https://partner.com/hooks", "events": ["ingestion.completed", "quota.warning"] }
  ```
  Returns: `{ "status": "success", "webhook": { "id": 1, ... }, "signing_secret": "whsec_..." }` — **Save the signing secret; it is shown only once.**
- **List webhooks for partner:** `GET /api/v1/admin/partners/webhooks/{partner_id}`
- **Update webhook:** `PATCH /api/v1/admin/partners/webhooks/{webhook_id}`
  ```json
  { "url": "https://new-url.com/hook", "events": ["track.indexed"], "is_active": true }
  ```
- **Delete webhook:** `DELETE /api/v1/admin/partners/webhooks/{webhook_id}`
- **List failed deliveries:** `GET /api/v1/admin/partners/webhooks/logs/failed`
- **Retry delivery:** `POST /api/v1/admin/partners/webhooks/logs/{log_id}/retry`

#### Stripe B2B Checkout
- **Create checkout session:** `POST /api/v1/admin/partners/{partner_id}/stripe/checkout`
  ```json
  { "tier": "growth", "billing_cycle": "monthly", "po_number": "PO-123" }
  ```
  Returns: `{ "checkout_url": "https://checkout.stripe.com/..." }`

---

### 19.3 User & Role Management

#### Users (`/api/v1/admin/users`)
- **List/search users:** `GET /api/v1/admin/users` — Query: `search`, `page`, `page_size`
- **Get user:** `GET /api/v1/admin/users/{user_uuid}`
- **Create user:** `POST /api/v1/admin/users`
- **Update user:** `PATCH /api/v1/admin/users/{user_uuid}`
- **Toggle active status:** `POST /api/v1/admin/users/{user_uuid}/toggle-status`
- **Assign role:** `POST /api/v1/admin/users/{user_uuid}/roles` — Body: `{ "role_name": "admin" }`
- **Remove role:** `DELETE /api/v1/admin/users/{user_uuid}/roles/{role_name}`

#### Roles & Permissions (`/api/v1/admin/roles`)
- **List roles:** `GET /api/v1/admin/roles`
- **Get role detail:** `GET /api/v1/admin/roles/{role_name}`
- **List all permissions:** `GET /api/v1/admin/roles/permissions`
- **Update role permissions:** `PUT /api/v1/admin/roles/{role_name}/permissions` — Body: `{ "permissions": ["partners:manage", "..."] }`

---

### 19.4 Operation Limits (`/api/v1/admin/operation-limits`)

- **List operation types:** `GET /api/v1/admin/operation-limits/operation-types`
- **List user limits:** `GET /api/v1/admin/operation-limits/`
- **Get user limit:** `GET /api/v1/admin/operation-limits/{user_identifier}/{operation_code}`
- **Upsert limit:** `PUT /api/v1/admin/operation-limits/`
- **Delete limit:** `DELETE /api/v1/admin/operation-limits/{user_identifier}/{operation_code}`

---

### 19.5 Playlist Management (`/api/v1/admin/playlist`)

- **List playlists:** `GET /api/v1/admin/playlist/`
- **Get detail:** `GET /api/v1/admin/playlist/{uuid}`
- **Delete single:** `DELETE /api/v1/admin/playlist/{playlist_id}`
- **Batch delete:** `POST /api/v1/admin/playlist/batch-delete` — Body: `{ "ids": [1, 2, 3] }`
- **Export CSV:** `POST /api/v1/admin/playlist/export`
- **Set visibility:** `PATCH /api/v1/admin/playlist/{playlist_id}/visibility`
- **Batch set visibility:** `POST /api/v1/admin/playlist/batch-visibility`

---

### 19.6 Waitlist Management (`/api/v1/admin/waitlist`)

- **List:** `GET /api/v1/admin/waitlist/`
- **Update status:** `POST /api/v1/admin/waitlist/update-status/{waitlist_id}`
- **Delete single:** `DELETE /api/v1/admin/waitlist/{waitlist_id}`
- **Batch delete:** `POST /api/v1/admin/waitlist/batch-delete`
- **Export CSV:** `POST /api/v1/admin/waitlist/export`

---

### 19.7 Contact Management (`/api/v1/admin/contact`)

- **List contacts:** `GET /api/v1/admin/contact/`
- **Get contact:** `GET /api/v1/admin/contact/{contact_id}`
- **Mark status:** `POST /api/v1/admin/contact/mark-status/{contact_id}`
- **Delete:** `DELETE /api/v1/admin/contact/{contact_id}`
- **Batch delete:** `POST /api/v1/admin/contact/batch-delete` — Body: `{ "ids": [1, 2] }`
- **Export CSV:** `POST /api/v1/admin/contact/export`

---

### 19.8 Feedback Management (`/api/v1/admin/feedback`)

- **List feedback:** `GET /api/v1/admin/feedback/`
  - Query: `page`, `page_size`, `search`, `search_column` (`message|id`), `status` (`open|resolved|all`), `date_from`, `date_to`, `sort_by`, `sort_order`
- **Feedback stats:** `GET /api/v1/admin/feedback/stats`
- **Get detail:** `GET /api/v1/admin/feedback/{feedback_id}`
- **Update status:** `PATCH /api/v1/admin/feedback/{feedback_id}/status` — Body: `{ "status": "resolved" }`
- **Delete:** `DELETE /api/v1/admin/feedback/{feedback_id}`
- **Batch delete:** `POST /api/v1/admin/feedback/batch-delete` — Body: `{ "ids": [1, 2, 3] }`
- **Export CSV:** `POST /api/v1/admin/feedback/export`

---

### 19.9 Spotify App Management (`/api/v1/admin/spotify-apps`)

- **List apps:** `GET /api/v1/admin/spotify-apps/`
- **Get app:** `GET /api/v1/admin/spotify-apps/{app_id}`
- **Create app:** `POST /api/v1/admin/spotify-apps/`
- **Update app:** `PUT /api/v1/admin/spotify-apps/{app_id}`
- **Delete app:** `DELETE /api/v1/admin/spotify-apps/{app_id}`
- **List user associations:** `GET /api/v1/admin/spotify-apps/users`
- **Upsert association:** `PUT /api/v1/admin/spotify-apps/users`
- **Delete association:** `DELETE /api/v1/admin/spotify-apps/users/{user_identifier}`

---

### 19.10 Promo Codes (`/api/v1/admin/promo`)

- **Create promo:** `POST /api/v1/admin/promo/create`

---

### 19.11 Similarity Index (`/api/v1/admin/similarity`)

- **Rebuild FAISS index:** `POST /api/v1/admin/similarity/rebuild-index`

---

### 19.12 Processing Jobs (`/api/v1/admin/processing`) — §C

Fire-and-forget batch embedding generation. The POST returns immediately (`202 Accepted`) with a `job_id`; poll the GET endpoint for status.

#### Trigger Embeddings Job
- **`POST /api/v1/admin/processing/jobs/embeddings`** — `202 Accepted`
- **Body:**
  ```json
  {
    "partner_id": 42,
    "env": "live",
    "ingest_log_id": null,
    "index_after": true,
    "only_pending": true
  }
  ```
  | Field | Description |
  |---|---|
  | `env` | `"live"` = persist + index into FAISS; `"test"` = dry-run (generate to temp, nothing saved) |
  | `ingest_log_id` | Restrict to one specific ingest batch. `null` = all pending tracks. |
  | `index_after` | Whether to insert generated embeddings into the partner FAISS index. |
  | `only_pending` | Skip tracks that already have embeddings. |

- **Returns:**
  ```json
  {
    "status": "accepted",
    "message": "Embeddings job started",
    "job_id": 17,
    "job_type": "embeddings",
    "env": "live"
  }
  ```

#### Get Job Status
- **`GET /api/v1/admin/processing/jobs/{job_id}`**
- **Returns:**
  ```json
  {
    "status": "success",
    "job": {
      "id": 17,
      "partner_id": 42,
      "ingest_log_id": null,
      "job_type": "embeddings",
      "status": "running",
      "total_tracks": 50,
      "processed_tracks": 12,
      "failed_tracks": 0,
      "error_details": null,
      "triggered_by": "admin@resomix.com",
      "created_at": "2026-06-07T10:00:00",
      "started_at": "2026-06-07T10:00:01",
      "completed_at": null
    }
  }
  ```
  _`status` values: `pending` → `running` → `paused` → `completed` | `partial` | `failed`_

#### Pause a Running Embeddings Job
- **`POST /api/v1/admin/processing/jobs/{job_id}/pause`** — `200`
- **Description:** Signals the media server to stop after the current track. In-flight tracks finish, then the job persists a `paused` snapshot. Only `embeddings` jobs support pause (`400` otherwise; `404` if the job doesn't exist).
- **Returns:**
  ```json
  { "status": "accepted", "message": "Pause requested", "job_id": 17, "job_status": "paused" }
  ```
  _`502` with `{ "status": "error", "detail": "..." }` if the media server can't be reached._

#### Resume a Paused / Interrupted Embeddings Job
- **`POST /api/v1/admin/processing/jobs/{job_id}/resume`** — `202 Accepted`
- **Query params:**
  | Param | Default | Description |
  |---|---|---|
  | `env` | `live` | `"live"` = persist; `"test"` = dry-run |
  | `index_after` | `true` | Rebuild the partner FAISS index from all embeddings on completion |
- **Description:** Re-hands the job's full track list to the media server; tracks that already have embeddings are skipped, so it picks up where it left off (also recovers a job interrupted by a crash/restart). Only `embeddings` jobs (`400` otherwise; `404` if missing).
- **Returns:**
  ```json
  { "status": "accepted", "message": "Embeddings job resumed", "job_id": 17, "job_status": "running", "total_tracks": 200 }
  ```
  _`502` if the media server can't be reached._

#### List Jobs
- **`GET /api/v1/admin/processing/jobs`**
- **Query params:** `partner_id`, `status` (`pending|running|completed|partial|failed`), `page` (default 1), `page_size` (default 50, max 100)
- **Returns:** `{ "status": "success", "jobs": [ ...job objects... ] }`

---

### 19.13 Ingestion Control (`/api/v1/admin/ingestion`) — §F

Manage the partner SFTP ingestion pipeline without running server commands.

#### List Ingest Logs
- **`GET /api/v1/admin/ingestion/logs`**
- **Query params:** `partner_id`, `status` (`PENDING|PROCESSING|COMPLETED|FAILED`), `page`, `page_size`
- **Returns:**
  ```json
  {
    "status": "success",
    "logs": [{
      "id": 5,
      "partner_id": 42,
      "party_id": "PARTY_ABC",
      "package_folder": "/srv/sftp/partners/42/live",
      "batch_filename": "metadata.csv",
      "status": "COMPLETED",
      "track_count": 10,
      "error_message": null,
      "started_at": "2026-06-07T09:00:00",
      "completed_at": "2026-06-07T09:00:05",
      "created_at": "2026-06-07T09:00:00"
    }]
  }
  ```

#### Get Ingest Log Detail (with row errors)
- **`GET /api/v1/admin/ingestion/logs/{log_id}`**
- **Returns:** `{ "status": "success", "log": { ...log object... }, "errors": [ { "id": 1, "error_code": "...", "error_message": "...", "error_severity": "...", "reference_node": "..." } ] }`

#### Manually Trigger Ingestion
- **`POST /api/v1/admin/ingestion/trigger`** — `202 Accepted`
- **Body:**
  ```json
  { "partner_id": 42, "env": "live" }
  ```
  _`env` must be `"test"` (dry-run: validate + report, persist nothing) or `"live"` (full persist)._
- **Returns:**
  ```json
  {
    "status": "accepted",
    "message": "Ingestion started",
    "partner_id": 42,
    "env": "live",
    "batch_path": "/srv/sftp/partners/42/live"
  }
  ```

#### Retry a Failed Batch
- **`POST /api/v1/admin/ingestion/logs/{log_id}/retry`** — `202 Accepted`
- **Returns:**
  ```json
  { "status": "accepted", "message": "Ingestion retry started", "ingest_log_id": 5, "partner_id": 42, "env": "live" }
  ```

---

### 19.14 Track Control (`/api/v1/admin/tracks`) — §G

Control whether individual partner tracks are searchable (active in the FAISS similarity index).

#### List Tracks with Processing Status
- **`GET /api/v1/admin/tracks`**
- **Query params:** `partner_id`, `is_active` (bool), `page`, `page_size`
- **Returns:**
  ```json
  {
    "status": "success",
    "tracks": [{
      "id": 101,
      "uuid": "...",
      "title": "My Track",
      "display_artist": "Artist",
      "isrc": "USXXX2600001",
      "is_active": false,
      "partner_id": 42,
      "processing": {
        "embedding_status": "pending",
        "peaks_status": "pending",
        "segments_status": "pending",
        "faiss_indexed": false,
        "sftp_env": "live",
        "embedding_error": null
      }
    }]
  }
  ```
  _`processing` is `null` if no processing-status row exists for the track._

#### Set Track Live (Activate + FAISS Index)
- **`POST /api/v1/admin/tracks/{track_id}/set-live`**
- **Description:** Marks the track active (`is_active = true`) and inserts its pre-generated embeddings into the partner's FAISS index for both `maest` and `discogs` engines. Embeddings must already exist on the media server (generated via the embeddings job first).
- **Returns:**
  ```json
  {
    "status": "success",
    "track_id": 101,
    "is_active": true,
    "faiss_indexed": true,
    "index_results": {
      "maest": { "success": true, "data": { "index_size": 71 } },
      "discogs": { "success": true, "data": { "index_size": 71 } }
    }
  }
  ```
  _`status` is `"partial"` if one engine failed._

#### Stop Track (Deactivate + Remove from FAISS)
- **`POST /api/v1/admin/tracks/{track_id}/stop`**
- **Query params:** `delete_embedding_file` (bool, default `false`) — Also delete the `.npy` embedding files from the media server.
- **Description:** Marks the track inactive (`is_active = false`) and removes it from both FAISS engines. Idempotent — safe to call on an already-stopped track.
- **Returns:**
  ```json
  {
    "status": "success",
    "track_id": 101,
    "is_active": false,
    "remove_result": { "success": true, "data": { "removed": 2 } }
  }
  ```

---

### 19.15 Legacy Ingestion Pipeline Endpoints _(deprecated)_

The following routes are kept for backward compatibility but replaced by the admin-driven pipeline above. Do not use in new integrations.

- `POST /api/v1/ingest/monthly/track`
- `POST /api/v1/ingest/monthly/update_embeddings`
- `POST /api/v1/ingest/open/track`
- `POST /api/v1/ingest/open/update_embeddings`
- `POST /api/v1/monthly_pipeline/track/`
- `POST /api/v1/monthly_pipeline/update_embeddings/`
- `POST /api/v1/open_tracks_pipeline/track/`
- `POST /api/v1/open_tracks_pipeline/update_embeddings/`

---

### 19.16 Logs & Audit Trail (`/api/v1/admin/logs`, `/api/v1/admin/operation-logs`)

Read-only viewers for the two log tables the platform writes to MariaDB. All
routes require an admin session and the `reports:view` permission. Responses use
the standard `{ success, data, pagination }` envelope; list results are newest-first.

There are **two** distinct sources:

| Source | Endpoint base | What it contains |
|---|---|---|
| **System logs** | `/api/v1/admin/logs` | Broad application/request/event log — every `LoggingService` write (categories like `REQUEST`, `PARTNER`, `AUTH`, `SYSTEM`), with level, endpoint, status code, duration, client IP, correlation id, and a free-form `log_metadata` blob. |
| **Operation logs** | `/api/v1/admin/operation-logs` | The admin audit trail ("who did what") — one row per privileged action (e.g. `partner.rotate_api_key`, `partner.sftp_provision`) with `before_state` / `after_state` JSON snapshots and the acting admin. |

#### System Health & Overview (dashboard header widget)

`GET /api/v1/admin/logs/overview?hours=24`

One call that powers a "System Health" card at the top of the admin area. It
**merges both log tables** and derives a coarse health status. Important: health
is computed from log **level** (ERROR / CRITICAL / WARNING), **not** from a
request error rate — the platform logs business events and exceptions, not every
successful request, so a request-based rate would read ~0 and mislead.

**Time range — the `hours` query param.** Pass the window as a number of hours.
The same endpoint backs every range selector in the UI; map your dropdown to these
values. `hours=0` means **all time** (no lower bound). The response echoes
`all_time` (bool) and `bucket_granularity` so the chart can label its axis.

| UI label | `hours` |
|---|---|
| Last hour | `1` |
| Last 24 hours (day) | `24` |
| Last 3 days | `72` |
| Last week | `168` |
| Last month | `720` |
| Last 3 months | `2160` |
| Last 6 months | `4320` |
| Last year | `8760` |
| All time | `0` |

```http
GET /api/v1/admin/logs/overview?hours=168    # last week
GET /api/v1/admin/logs/overview?hours=0       # all time
```

```js
const RANGES = {
  "1h": 1, "24h": 24, "3d": 72, "1w": 168,
  "1mo": 720, "3mo": 2160, "6mo": 4320, "1y": 8760, "all": 0,
};
const res = await fetch(`/api/v1/admin/logs/overview?hours=${RANGES[selected]}`, { headers: authHeaders });
```

The `timeseries` granularity adapts automatically so the series never explodes:
**hourly** for `hours ≤ 72`, **daily** for `≤ 2160`, and **monthly** for longer
windows or all time. The chosen granularity is returned as `bucket_granularity`
(`"hour"` | `"day"` | `"month"`), and each point's `bucket` is a string in that
unit (e.g. `"2026-06-18 15:00"`, `"2026-06-18"`, or `"2026-06"`).

```json
{
  "success": true,
  "data": {
    "window_hours": 24,
    "generated_at": "2026-06-18T15:20:00",
    "status": "degraded",
    "system_logs": {
      "status": "degraded",
      "total_all_time": 4821,
      "total_in_window": 36,
      "error_count": 0,
      "critical_count": 0,
      "warning_count": 7,
      "error_rate_percent": 0.0,
      "by_level": { "INFO": 29, "WARNING": 7 },
      "by_category": { "PARTNER": 12, "ADMIN_ACTION": 22, "SIMILARITY": 5 },
      "avg_duration_ms": 16.7,
      "slow_request_count": 0,
      "recent_attention": [
        { "id": 858, "level": "WARNING", "category": "INTERNAL", "action": "http_exception",
          "message": "404 Not Found", "endpoint": "/api/v1/...", "status_code": 404,
          "created_at": "2026-06-18T03:38:35" }
      ],
      "timeseries": [
        { "bucket": "2026-06-18 14:00", "total": 20, "errors": 0, "warnings": 3 },
        { "bucket": "2026-06-18 15:00", "total": 16, "errors": 0, "warnings": 4 }
      ]
    },
    "operations": {
      "total_in_window": 41,
      "active_admins": 3,
      "top_actions": [
        { "action": "partner.issue_api_key", "count": 19 },
        { "action": "partner.rotate_api_key", "count": 8 }
      ]
    }
  }
}
```

**`status`** is `healthy` (no errors/warnings in window), `degraded` (some
warnings or errors), or `critical` (any CRITICAL log, or error rate ≥ 10%). Drive
the card's colour from it. Render `timeseries` as a sparkline (total + errors),
`recent_attention` as an "needs attention" list (each item links to
`/admin/logs/{id}`), and `operations.top_actions` as an "admin activity" strip.

> `GET /api/v1/admin/logs/stats?hours=` still exists as a lighter subset (level
> distribution + counts) if you only need numbers without the series/activity blocks.

#### System logs — list with filters

`GET /api/v1/admin/logs`

Query params (all optional; omit to skip the filter):

| Param | Type | Notes |
|---|---|---|
| `page` | int | default `1` |
| `page_size` | int | default `50`, max `500` |
| `level` | string | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` \| `CRITICAL` |
| `category` | string | exact match, e.g. `REQUEST`, `PARTNER`, `AUTH`, `SYSTEM` |
| `action` | string | substring match |
| `endpoint` | string | substring match |
| `q` | string | free-text search over message / action / endpoint |
| `client_ip` | string | exact match |
| `correlation_id` | string | exact match (trace one request across rows) |
| `status_code` | int | exact match, e.g. `500` |
| `track_id` / `playlist_id` | int | related-entity filter |
| `min_duration` | float | min `duration_ms` (find slow requests) |
| `start_date` / `end_date` | ISO 8601 datetime | inclusive range on `created_at` |
| `order_by` | string | default `created_at` |
| `order_dir` | string | `asc` \| `desc` (default `desc`) |

```http
GET /api/v1/admin/logs?level=ERROR&q=provision&page=1&page_size=50
```

```json
{
  "success": true,
  "data": [
    {
      "id": 48213,
      "level": "ERROR",
      "category": "SYSTEM",
      "action": "SFTP_PROVISION_FAILED",
      "message": "Hetzner provisioning returned 502",
      "endpoint": "/api/v1/admin/partners/sftp/provision",
      "status_code": 500,
      "duration_ms": 1342.5,
      "client_ip": "203.0.113.10",
      "correlation_id": "b1f2...-36c",
      "log_metadata": { "partner_id": 42 },
      "created_at": "2026-06-18T14:05:11"
    }
  ],
  "pagination": { "total": 3, "pages": 1, "page": 1, "size": 50, "has_next": false, "has_prev": false }
}
```

#### System logs — detail

`GET /api/v1/admin/logs/{log_id}` → `{ success, data }` with the full row (including
`stack_trace`, `query_params`, `user_agent`, etc.). Returns `404` if not found.

#### System logs — stats (page header)

`GET /api/v1/admin/logs/stats?hours=24` → counters for the dashboard header:

```json
{
  "success": true,
  "data": {
    "total_logs": 1820,
    "level_distribution": { "INFO": 1700, "ERROR": 40 },
    "error_rate_percent": 2.2,
    "total_requests": 1500,
    "error_requests": 33,
    "period_hours": 24
  }
}
```

#### Operation (audit) logs — list with filters

`GET /api/v1/admin/operation-logs`

| Param | Type | Notes |
|---|---|---|
| `page` / `page_size` | int | default `1` / `50` (max `500`) |
| `admin_user_id` | int | filter by acting admin |
| `action` | string | substring match, e.g. `rotate_api_key` |
| `target_type` | string | exact, e.g. `partner`, `api_key`, `sftp_user`, `user` |
| `target_id` | string | exact id of the affected resource |
| `correlation_id` | string | exact match |
| `start_date` / `end_date` | ISO 8601 | inclusive range |
| `order_dir` | string | `asc` \| `desc` (default `desc`) |

```json
{
  "success": true,
  "data": [
    {
      "id": 991,
      "admin_user_id": 1,
      "admin_email": "ops@resomix.com",
      "action": "partner.rotate_api_key",
      "target_type": "api_key",
      "target_id": "77",
      "before_state": null,
      "after_state": { "new_key_prefix": "rmx_live_ab12cd34" },
      "ip_address": "203.0.113.10",
      "correlation_id": "b1f2...-36c",
      "created_at": "2026-06-18T14:06:02"
    }
  ],
  "pagination": { "total": 1, "pages": 1, "page": 1, "size": 50, "has_next": false, "has_prev": false }
}
```

#### Operation log — detail

`GET /api/v1/admin/operation-logs/{log_id}` → `{ success, data }` with the full audit
record including the complete `before_state` / `after_state` JSON. Returns `404` if not found.

**Frontend notes**
- Build a single "Logs" page with a tab switch between **System** and **Audit (Operations)**.
- Drive the table from the `pagination` block; pass the same filter params back on page change.
- For the detail drawer, call the `/{log_id}` endpoint (don't rely on the list row) so you get `stack_trace` / full state.
- `correlation_id` links the two tables — clicking it can cross-filter both views to trace one request end to end.
- All timestamps are UTC ISO 8601 without a `Z` suffix; render with an explicit UTC assumption.

---

## Standard Response Envelope

All successful responses are wrapped in:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Errors return:

```json
{
  "success": false,
  "error": "Human-readable description"
}
```

Async jobs (`202 Accepted`) skip the envelope and return a flat status object with a `job_id` or `ingest_log_id` to poll.

---

## Typical Admin Workflow: Onboard a Partner and Publish Tracks

```
1. POST /api/v1/admin/partners/              — Create partner record
2. POST /api/v1/admin/partners/api-keys/issue — Issue API key (save it)
3. POST /api/v1/admin/partners/sftp/provision  — Set up SFTP folder
4. Partner uploads CSV + audio files via SFTP  — SFTPGo triggers ingestion automatically
   — OR —
   POST /api/v1/admin/ingestion/trigger        — Trigger manually if needed
5. GET  /api/v1/admin/ingestion/logs           — Monitor ingestion status
6. POST /api/v1/admin/processing/jobs/embeddings — Generate embeddings (env=live)
7. GET  /api/v1/admin/processing/jobs/{job_id} — Poll until completed
8. GET  /api/v1/admin/tracks?partner_id=42     — List tracks with processing status
9. POST /api/v1/admin/tracks/{id}/set-live     — Set each track live in FAISS
```
