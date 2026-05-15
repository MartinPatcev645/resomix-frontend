# Resomix Frontend API Integration Guide

This guide details the integration points for the Resomix Frontend to communicate with the Backend API. It provides a comprehensive list of endpoints, required headers, request payloads, and expected responses based on the current implementation.

## Base URL
The API base URL typically depends on the environment:
- Local Development: `http://localhost:8001`
- Production: `https://api.resomix.com` (or as configured)

---

## Authentication & Headers

The API supports two main forms of authentication:
1. **Public API Key**: Used for anonymous/public endpoints (like search, waitlist, and telemetry).
   - **Header**: `X-API-KEY: <your-api-key>`
   - **Query Parameter**: `?api_key=<your-api-key>` (Supported for frontend flexibility)
2. **JWT Bearer Token**: Used for user-specific actions (like profile management, favorites, ratings, checkout).
   - **Header**: `Authorization: Bearer <your-access-token>`

**Note on Cookies**: The refresh token is managed automatically via an `HttpOnly` cookie set by the server upon login/registration. You do not need to manage it manually in JavaScript.

---

## 1. Authentication (`/auth`)

### 1.1 Register
- **URL**: `POST /auth/register`
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
- **URL**: `POST /auth/login`
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
  *(Also sets `refresh_token` in an HttpOnly cookie).*
  *If 2FA is enabled, it returns `{"requires_2fa": true, "user_id": "...", "method": "email"}`.*

### 1.3 Verify 2FA
- **URL**: `POST /auth/verify-2fa`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "user_id": "uuid-from-login-response",
    "code": "123456"
  }
  ```
- **Returns**: Same as Login response.

### 1.4 Refresh Token
- **URL**: `POST /auth/refresh`
- **Auth Required**: No (relies on HttpOnly cookie)
- **Returns**: `200 OK` with a new `access_token`.

### 1.5 Logout
- **URL**: `POST /auth/logout`
- **Auth Required**: No (relies on HttpOnly cookie)
- **Returns**: `200 OK` with success message. Clears the HttpOnly cookie.

### 1.6 Logout All Devices
- **URL**: `POST /auth/logout-all`
- **Auth Required**: Yes (JWT Bearer)
- **Returns**: `200 OK`

### 1.7 Password Reset
- **Request Link**: `POST /auth/password-reset` `{"email": "..."}`
- **Confirm Reset**: `POST /auth/password-reset-confirm` `{"token": "...", "new_password": "..."}`

---

## 2. User Profile (`/users`)

### 2.1 Get My Profile
- **URL**: `GET /users/me`
- **Auth Required**: Yes (JWT Bearer)
- **Returns**: Complete user profile data.

### 2.2 Update Profile
- **URL**: `PATCH /users/me`
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
- **URL**: `POST /users/me/change-password`
- **Auth Required**: Yes (JWT Bearer)
- **Body**:
  ```json
  {
    "current_password": "oldPassword123!",
    "new_password": "newStrongPassword123!"
  }
  ```

### 2.4 Manage Sessions
- **Get Sessions**: `GET /users/me/sessions` (Requires JWT)
- **Revoke Session**: `DELETE /users/me/sessions/{session_id}` (Requires JWT)

### 2.5 2FA Settings
- **Enable 2FA**: `POST /users/me/enable-2fa` `{"method": "email"}` (Requires JWT)
- **Disable 2FA**: `POST /users/me/disable-2fa` `{"password": "current_password"}` (Requires JWT)

### 2.6 Delete Account
- **URL**: `DELETE /users/me`
- **Auth Required**: Yes (JWT Bearer)
- **Body**: `{"password": "current_password"}`

---

## 3. Search (`/search_tracks`)

### 3.1 Search Tracks
- **URL**: `GET /search_tracks/`
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

## 4. Similarity (`/similarity` & `/get_similarity`)

### 4.1 Upload & Get Similarity
- **URL**: `POST /get_similarity/`
- **Auth Required**: API Key (JWT optional; if provided, links upload to user)
- **Form Data**:
  - `file`: Audio file (max 100MB)
- **Query Params**:
  - `top_sk`: 10, 20, 50, or 100 (default: 20)
- **Returns**: Information about the uploaded track and a list of similar tracks.

### 4.2 Get Similarity by Track ID
- **URL**: `POST /get_selection_similarity/`
- **Auth Required**: API Key (JWT optional)
- **Body**:
  ```json
  {
    "track_id": 123,
    "top_sk": 20
  }
  ```

### 4.3 Segment Status Poll
- **URL**: `GET /segment_status/{playlist_uuid}`
- **Auth Required**: API Key
- **Returns**: `{"segmentation_completed": true/false}`
- **Description**: Checks if segment preview processing completed for a playlist.

---

## 5. Playlists (`/playlists`)

### 5.1 Fork Public Playlist
- **URL**: `POST /playlists/fork/{playlist_id}`
- **Auth Required**: Yes (JWT Bearer)
- **Description**: Copies a public playlist to the user's account.

### 5.2 Get User Playlists
- **URL**: `GET /playlists/get-all-playlists/`
- **Auth Required**: Yes (JWT Bearer)
- **Query Params**: `page`, `page_size`, `play_time`, `num_tracks`, `start_date`, `end_date`, `is_public`, `own_favorites`, `all_favorites`
- **Returns**: Paginated list of user's playlists.

### 5.3 Rename / Change Visibility
- **Rename**: `PUT /playlists/rename/` `{"playlist_id": "...", "new_name": "..."}`
- **Visibility**: `PUT /playlists/visibility/` `{"playlist_id": "...", "is_public": true/false}`
- **Auth Required**: JWT (Optional but highly recommended to verify ownership)

### 5.4 Get Playlist Similarity Data
- **URL**: `GET /playlists/similarity/{playlist_id}`
- **Auth Required**: API Key (JWT optional to view own private playlists)
- **Returns**: Playlist formatted like similarity endpoint response.

### 5.5 Get HLS M3U8 (Audio Streaming)
- **URL**: `GET /playlists/similarity-hls/{playlist_id}.m3u8`
- **Auth Required**: API Key (JWT optional to view own private playlists)
- **Returns**: `application/vnd.apple.mpegurl` file content with signed URLs.

### 5.6 Get Playback Session (Edge Auth)
- **URL**: `POST /playlists/{playlist_id}/play-session`
- **Auth Required**: API Key
- **Returns**: `{"playback_url": "..."}` with JWT token appended.

---

## 6. External Transfers (`/spotify`, `/apple-music`, `/tidal`)

### 6.1 Spotify Transfer
- **Get Client ID**: `GET /spotify/app-client-id` (Requires JWT)
  - Returns: `{"client_id": "...", "app_name": "..."}`
- **Transfer**: `POST /spotify/transfer-playlist/` (Requires JWT)
  - Body: `{"playlist_id": "uuid", "access_token": "spotify-token", "playlist_name": "Optional"}`

### 6.2 Apple Music Transfer
- **Get Dev Token**: `GET /apple-music/developer-token/`
  - Returns: `{"token": "...", "expires_at": 123456789}`
- **Transfer**: `POST /apple-music/transfer-playlist/`
  - Body: `{"playlist_id": "uuid", "music_user_token": "apple-token", "playlist_name": "Optional"}`

### 6.3 Tidal Transfer
- **Exchange Token**: `POST /tidal/auth/token`
  - Body: `{"code": "auth-code", "code_verifier": "...", "redirect_uri": "..."}`
- **Transfer**: `POST /tidal/transfer-playlist/`
  - Body: `{"playlist_id": "uuid", "access_token": "tidal-token", "playlist_name": "Optional"}`

---

## 7. Playlist Engagement (`/playlist`)

### 7.1 Favorites
- **Add**: `POST /playlist/add-favorite/{playlist_id}` (Requires JWT)
- **Remove**: `POST /playlist/remove-favorite/{playlist_id}` (Requires JWT)

### 7.2 Follows
- **Follow**: `POST /playlist/follow/{playlist_id}` (Requires JWT)
- **Unfollow**: `POST /playlist/unfollow/{playlist_id}` (Requires JWT)

---

## 8. Ratings (`/ratings`)

### 8.1 Track Ratings
- **Rate**: `POST /ratings/tracks/`
  ```json
  {
    "track_id": "uuid",
    "playlist_id": "uuid",
    "rating": 1  // 1=similar, 0=not similar
  }
  ```
  *(Requires JWT or API Key + manual user_id)*
- **Get**: `GET /ratings/tracks/{track_id}/playlist/{playlist_id}`
- **Delete**: `DELETE /ratings/tracks/{track_id}/playlist/{playlist_id}`

### 8.2 Playlist Ratings
- **Rate**: `POST /ratings/playlists/`
  ```json
  {
    "playlist_id": "uuid",
    "rating": 3, // 0-3 stars
    "message": "Optional review"
  }
  ```
  *(Requires JWT or API Key + manual user_id)*
- **Get**: `GET /ratings/playlists/{playlist_id}`
- **Delete**: `DELETE /ratings/playlists/{playlist_id}`
- **Stats**: `GET /ratings/playlists/{playlist_id}/stats` (API Key only)

### 8.3 Rating Statistics
- **Track Stats**: `GET /ratings/tracks/{track_id}/stats`
  - Returns: `{"total_ratings": 100, "rating_distribution": {"0": 20, "1": 80}}`
- **Playlist Stats**: `GET /ratings/playlists/{playlist_id}/stats`
  - Returns: `{"total_ratings": 50, "average_rating": 2.5, "rating_distribution": {"0": 5, "1": 10, "2": 15, "3": 20}}`

---

## 9. Cart & Checkout (`/cart`, `/checkout`)

### 9.1 Cart Operations (Requires JWT)
- **Get Cart**: `GET /cart`
- **Add Item/Playlist**: `POST /cart/add`
  ```json
  {
    "items": [{"track_id": "uuid", "source_playlist_id": "uuid"}],
    // OR
    "playlist_id": "uuid"
  }
  ```
- **Remove Track**: `DELETE /cart/remove/{track_id}`
- **Remove Playlist**: `DELETE /cart/remove-playlist/{playlist_id}`
- **Clear Cart**: `DELETE /cart/clear`

### 9.2 Promo Code (Requires JWT)
- **Apply**: `POST /cart/promo` `{"code": "SUMMER25"}`

### 9.3 Checkout (Requires JWT)
- **Init Checkout**: `POST /checkout/init` `{"cart_id": 123}` (Phase 2 pre-flight)
- **Create Stripe Session**: `POST /checkout/create-session`

---

## 10. Telemetry (`/telemetry`)

### 10.1 Sync Telemetry
- **URL**: `POST /telemetry/sync`
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
- **URL**: `POST /waitlist/`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**: `{"email": "user@example.com"}`

### 11.2 Check Status
- **URL**: `POST /waitlist/status`
- **Auth Required**: API Key (`X-API-KEY`)
- **Body**: `{"email": "user@example.com"}`

---

## 12. Contact & Support (`/contact`)

### 12.1 Submit Contact Form
- **URL**: `POST /contact/`
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

## 13. Feedback (`/feedback`)

### 13.1 Submit Feedback
- **URL**: `POST /feedback/`
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
  *(Requires JWT or API Key + manual user_id)*

---

## 14. Preview (`/preview`)

### 14.1 Get Preview URL
- **URL**: `GET /preview/get_preview/`
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

## 15. Metadata (`/metadata`)

### 15.1 Extract Metadata
- **URL**: `POST /metadata/`
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

## 17. Admin & B2B Operations (`/admin`, `/monthly_pipeline`, `/open_tracks_pipeline`)

These endpoints are typically used by the internal admin dashboard or B2B integrations and require API key authentication (`X-API-KEY`).

### 17.1 Partner Management (`/admin/partners`)
- **Get Current Partner Info**: `GET /partner/me` (API Key Required)
  - Returns: `{"id": 1, "name": "...", "tier": "...", "is_active": true}`
- **Create Partner**: `POST /admin/partners/`
- **List Partners**: `GET /admin/partners/` (supports `page`, `page_size`, `tier`, `is_active`)
- **Update Partner**: `PATCH /admin/partners/{partner_id}`
- **Delete Partner**: `DELETE /admin/partners/{partner_id}`
- **Issue API Key**: `POST /admin/partners/api-keys/issue`
- **List API Keys**: `GET /admin/partners/api-keys/{partner_id}`
- **Revoke API Key**: `POST /admin/partners/api-keys/revoke`
- **Rotate API Key**: `POST /admin/partners/api-keys/rotate`

### 17.2 User Management (Admin)
- **Search Users**: `GET /users/search` (Requires API Key)
  - Query Params: `q` (email/username/UUID), `limit` (default 20)
  - Returns: List of matching user profiles.

### 17.3 Operation Limits (`/admin/operation-limits`)
- **List Types**: `GET /admin/operation-limits/operation-types`
- **List User Limits**: `GET /admin/operation-limits/`
- **Get User Limit**: `GET /admin/operation-limits/{user_identifier}/{operation_code}`
- **Upsert Limit**: `PUT /admin/operation-limits/`
- **Delete Limit**: `DELETE /admin/operation-limits/{user_identifier}/{operation_code}`

### 17.3 Admin Playlist Management (`/admin/playlist`)
- **List Playlists**: `GET /admin/playlist/` (supports filters: `search`, `is_public`, `type`, `sort_by`, etc.)
- **Get Detail**: `GET /admin/playlist/{uuid}`
- **Delete Single**: `DELETE /admin/playlist/delete/{playlist_id}`
- **Batch Delete**: `POST /admin/playlist/batch-delete` `{"ids": [1, 2, 3]}`
- **Export CSV**: `POST /admin/playlist/export`
- **Visibility**: `POST /admin/playlist/visibility/{id}` `{"is_public": true}`
- **Batch Visibility**: `POST /admin/playlist/batch-visibility` `{"ids": [1, 2], "is_public": true}`

### 17.4 Admin Waitlist Management (`/admin/waitlist`)
- **List**: `GET /admin/waitlist/`
- **Update Status**: `POST /admin/waitlist/update-status/{waitlist_id}` `{"status": "approved"}`
- **Batch Delete**: `POST /admin/waitlist/batch-delete`
- **Export CSV**: `POST /admin/waitlist/export`

### 17.5 Admin Contact & Feedback (`/admin/contact`, `/admin/feedback`)
- **List Contacts**: `GET /admin/contact/`
- **Mark Contact Status**: `POST /admin/contact/mark-status/{contact_id}` `{"status": "resolved"}`
- **List Feedback**: `GET /admin/feedback/`
- **Feedback Stats**: `GET /admin/feedback/stats`
- **Mark Feedback Status**: `POST /admin/feedback/mark-status/{feedback_id}` `{"status": "resolved"}`

### 17.6 Spotify Apps (Admin) (`/admin/spotify-apps`)
- **List Apps**: `GET /admin/spotify-apps/`
- **Create App**: `POST /admin/spotify-apps/`
- **List User Associations**: `GET /admin/spotify-apps/users`
- **Upsert Association**: `PUT /admin/spotify-apps/users` `{"user_identifier": "...", "spotify_app_id": 1}`

### 17.7 Admin Similarity (`/admin/similarity`)
- **Rebuild Index**: `POST /admin/similarity/rebuild-index` (Query param: `partner_id`)

### 17.8 Promo Codes (Admin) (`/admin/promo`)
- **Create Promo**: `POST /admin/promo/create`
  - Body: `{"code": "...", "discount_type": "percentage", "discount_value": 20}`

### 17.9 Ingestion Pipelines (`/monthly_pipeline`, `/open_tracks_pipeline`)
- **Monthly Track**: `POST /monthly_pipeline/track/`
- **Monthly Update Embeddings**: `POST /monthly_pipeline/update_embeddings/`
- **Open Tracks Track**: `POST /open_tracks_pipeline/track/`
- **Open Tracks Update Embeddings**: `POST /open_tracks_pipeline/update_embeddings/`

### 17.10 Dummy / Testing Endpoints (`/dummy`)
- **Dummy HLS**: `GET /dummy/dummy-hls/{playlist_id}.m3u8`
  - Returns a static HLS M3U8 file regardless of ID. Useful for frontend player testing.

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
