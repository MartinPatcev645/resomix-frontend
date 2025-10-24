# Tidal Playlist Transfer Feature

## Overview

The Tidal Transfer feature allows users to transfer their Resomix playlists to their personal Tidal accounts. This feature integrates with the latest Tidal API (OAuth 2.1 PKCE and Playlist API v2) to search for tracks and create playlists in the user's Tidal library.

## Features

- **OAuth PKCE Authentication**: Secure user authentication through Tidal OAuth 2.1 with PKCE flow
- **Intelligent Track Matching**: Advanced track search algorithm with fallback strategies
- **Batch Processing**: Efficient handling of large playlists with Tidal's API limits
- **Comprehensive Reporting**: Detailed transfer statistics including success/failure counts
- **Custom Playlist Names**: Option to specify custom names for transferred playlists
- **Caching System**: Prevents repeated searches by caching Tidal track IDs

## API Endpoint

### POST `/tidal/transfer-playlist/`

Transfer a Resomix playlist to user's Tidal account.

#### Request Body

```json
{
  "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
  "access_token": "BQC4YqJ...",
  "playlist_name": "My Resomix Playlist"
}
```

#### Parameters

- **playlist_id** (required): UUID of the Resomix playlist to transfer
- **access_token** (required): Valid Tidal OAuth access token
- **playlist_name** (optional): Custom name for the Tidal playlist

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "tidal_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
    "tidal_playlist_url": "https://listen.tidal.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
    "tidal_playlist_name": "My Resomix Playlist",
    "total_tracks": 25,
    "tracks_added": 22,
    "tracks_not_found": 3,
    "not_found_tracks": [
      "Artist Name - Track Title",
      "Another Artist - Another Track"
    ],
    "transfer_time_seconds": 45.2
  },
  "message": "Successfully transferred playlist to Tidal. 22 tracks added, 3 tracks not found."
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired Tidal access token"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Playlist with ID 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

**Error (422):**
```json
{
  "success": false,
  "error": "Playlist 550e8400-e29b-41d4-a716-446655440000 has no tracks to transfer"
}
```

**Error (429):**
```json
{
  "success": false,
  "error": "Tidal API rate limit exceeded. Please try again later."
}
```

## Frontend Integration Guide

### Step 1: Generate PKCE Parameters (Frontend)

```javascript
const code_verifier  = base64url(crypto.getRandomValues(32));
const code_challenge = base64url(await sha256(code_verifier));
const state          = crypto.randomUUID();
sessionStorage.pkce  = JSON.stringify({ code_verifier, state });
```

### Step 2: Redirect User to TIDAL Login (Frontend)

Build the authorization URL as follows (do not use fetch, use a browser redirect):

```
https://login.tidal.com/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Ftidal
    &scope=user.read%20playlists.read%20playlists.write
    &code_challenge=... (S256)
    &code_challenge_method=S256
    &state=...
```

- Add `collection.read`, `collection.write` if you also need to read/write favourites.
- The user will be redirected to the TIDAL login/consent screen.

### Step 3: Handle OAuth Callback (Frontend)

After login, TIDAL will redirect back to your frontend with `?code=...&state=...` in the URL.

### Step 4: Exchange Code for Token (Frontend → Backend)

POST the following to your backend:

```json
{
  "code": "...",
  "code_verifier": "...",
  "state": "..."
}
```

### Step 5: Backend Exchanges Code for Token (Backend → TIDAL)

POST to:

```
POST https://auth.tidal.com/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=YOUR_CLIENT_ID
&code_verifier={code_verifier}
&redirect_uri=https://app.example.com/auth/tidal
&code={code}
```

Response:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

### Step 6: Backend Subscription Check (Recommended)

Check the user's subscription status before proceeding:

```
GET https://api.tidal.com/v2/users/me
Authorization: Bearer {access_token}
```

- Ensure `subscriptionStatus` is `ACTIVE` or `TRIAL`.
- If not, return an error to the frontend (TIDAL no longer has a free tier as of April 2024).

### Step 7: Playlist Transfer (Backend)

1. **Search each track** (cache results!):
   - `GET /v2/catalog/US/search?query={artist%20track}&types=TRACKS&limit=1`
2. **Create playlist**:
   - `POST /v2/users/{userId}/playlists` → returns `playlistId`.
3. **Batch add tracks**:
   - `POST /v2/playlists/{playlistId}/items` with up to 100 `trackIds` per call.
4. Return success JSON to the frontend.

### Step 8: UI Feedback (Frontend)

Show the user a summary, e.g.:

> “93 / 100 tracks copied – 7 missing from TIDAL catalogue”

---

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Tidal Configuration
TIDAL_CLIENT_ID=your_tidal_client_id_here
```

**Note**: For PKCE flow, only the `TIDAL_CLIENT_ID` is required. Do not use or expose `client_secret` in the frontend.

## Technical Implementation Details

### Architecture

The Tidal transfer feature follows a clean architecture pattern:

1. **API Router** (`app/api/routers/tidal_transfer.py`) - Handles HTTP requests
2. **Controller** (`app/controllers/tidal_transfer_controller.py`) - Coordinates business logic
3. **Service** (`app/services/tidal_transfer_service.py`) - Implements core transfer logic
4. **Repository** (`app/repositories/playlist_transfer_track_repository.py`) - Handles data persistence
5. **Schemas** (`app/schemas/tidal_transfer.py`) - Validates request/response data

### Key Features

#### Track Search Algorithm
- Uses Tidal's official API v2 for track search
- Implements intelligent query cleaning to remove remix info, featuring artists, etc.
- Calculates similarity scores between search queries and results
- Falls back to title-only search if artist+title search fails
- Caches successful matches to prevent repeated searches

#### Playlist Creation
- Uses Tidal's official Playlist API v2 endpoints for playlist creation and modification
- Creates private playlists by default
- Supports custom playlist names and descriptions
- Handles batch track additions with appropriate rate limiting (up to 100 tracks per call)

#### Error Handling
- Comprehensive error handling for authentication, rate limiting, and API errors
- User-friendly error messages
- Proper HTTP status codes
- Detailed logging for debugging

#### Caching System
- Caches Tidal track IDs in `playlist_transfer_tracks` table
- Prevents repeated API calls for the same tracks
- Supports batch cache operations for performance
- Includes cache invalidation and updates

### Database Schema

The feature uses the existing `playlist_transfer_tracks` table with an added `tidal_id` column:

```sql
CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id        BIGINT UNSIGNED NOT NULL,
    spotify_id      VARCHAR(100) NULL,
    apple_music_id  VARCHAR(100) NULL,
    beatport_id     VARCHAR(100) NULL,
    deezer_id       VARCHAR(100) NULL,
    tidal_id        VARCHAR(100) NULL,  -- New column for Tidal support
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    KEY idx_ptt_tidal (tidal_id)  -- New index for Tidal queries
);
```

### Dependencies

The feature requires the following Python packages:
- `aiohttp` - For async HTTP requests to Tidal API
- `fastapi` - Web framework
- `pydantic` - Data validation
- `sqlalchemy` - Database ORM

## API Limitations and Considerations

### Tidal API Constraints
- **Official API**: Now supports search, catalog, and playlist operations
- **Rate Limiting**: Tidal enforces rate limits (see developer docs for details)
- **Regional Availability**: Track availability varies by region

### Best Practices
1. **Rate Limiting**: Implement client-side rate limiting to avoid API limits
2. **Error Handling**: Always handle authentication errors gracefully
3. **User Feedback**: Provide clear feedback about transfer progress and results
4. **Token Management**: Implement proper token refresh logic
5. **Caching**: Leverage the built-in caching system for better performance
6. **Subscription Check**: Always verify the user has an active or trial subscription before attempting playlist operations

## Troubleshooting

### Common Issues

**403 Bearer token is missing or empty**
- Ensure you are using `https://login.tidal.com/authorize` for the login redirect, not `auth.tidal.com/v1/oauth2/authorize`.
- Check that the access token is present and valid.

**403 Token missing required scope**
- Add `user.read` to your scope string, along with `playlists.read` and `playlists.write`.

**403 User has no valid subscription**
- Check `/users/me.subscriptionStatus` first and prompt user to start trial/paid plan.

**429 Rate Limited**
- Implement exponential backoff
- Reduce concurrent request limits
- Cache results to minimize API calls

**Track Not Found**
- Expected behavior due to catalog differences
- Provide user feedback about missing tracks
- Consider alternative search strategies

### Debugging

Enable detailed logging by setting the logger level:

```python
import logging
logging.getLogger('app.services.tidal_transfer_service').setLevel(logging.DEBUG)
```

## Security Considerations

1. **Never store client secrets** in frontend code
2. **Use PKCE flow** for OAuth (no client secret required)
3. **Validate all tokens** on the backend
4. **Implement proper CORS** policies
5. **Use HTTPS** in production
6. **Store tokens securely** (consider httpOnly cookies for production)

## Future Enhancements

1. **Batch Operations**: Improve batch processing for large playlists
2. **Advanced Matching**: Implement more sophisticated track matching algorithms
3. **User Preferences**: Allow users to configure transfer preferences
4. **Sync Features**: Implement two-way sync between Resomix and Tidal

## Support

For issues related to the Tidal transfer feature:

1. Check the logs for detailed error messages
2. Verify Tidal API credentials and permissions
3. Ensure all required dependencies are installed
4. Test with a small playlist first
5. Contact the development team with specific error details

---

**Note**: This feature uses the official Tidal API v2 endpoints for all playlist operations. Monitor Tidal's developer platform for updates and changes to the API.

---

## Implementation Summary: Tidal Integration (Backend)

This server implements a secure, robust, and fully compliant Tidal integration for playlist transfer, following Tidal's OAuth 2.1 PKCE and Playlist API v2 specifications. Here’s what is handled and how:

- **OAuth 2.1 PKCE Flow:**
  - The frontend initiates the PKCE flow and handles user redirection to Tidal.
  - The backend exposes `/tidal/auth/token`, which receives the authorization code, code_verifier, and redirect_uri from the frontend, and exchanges them for Tidal access and refresh tokens using the official Tidal `/token` endpoint.
  - The backend validates the user's subscription status (must be ACTIVE or TRIAL) by calling `/users/me` with the access token.

- **API Key Security:**
  - All backend endpoints are protected by an API key, which must be provided as a query parameter (`api_key`).

- **Playlist Transfer:**
  - The backend exposes `/tidal/transfer-playlist/`, which takes a Resomix playlist and a Tidal access token.
  - It creates a new playlist in the user's Tidal account using the official API v2 endpoint, searches for each track, and adds found tracks in batches (up to 100 per call).
  - Caching is used to avoid redundant Tidal searches for the same tracks.

- **Error Handling & Logging:**
  - All errors (auth, rate limit, validation, etc.) are logged and surfaced with clear, actionable messages.
  - Detailed logging is implemented for all key steps, including incoming requests, payloads, and Tidal API responses, to aid debugging and ensure frontend-backend alignment.

- **Security & Compliance:**
  - No client secrets are ever exposed to the frontend.
  - All sensitive operations (token exchange, playlist creation) are performed server-side.
  - Only official Tidal API v2 endpoints are used for all playlist and track operations.

This architecture ensures a secure, maintainable, and future-proof Tidal integration for Resomix users.












## Backend-to-Tidal API Call Flow for /tidal/transfer-playlist

This section documents the exact sequence of Tidal API calls made by the backend when a user requests a playlist transfer via `/tidal/transfer-playlist/`. Internal processing steps are summarized; all external (Tidal) API calls are shown in detail with method, endpoint, query parameters, and payload.

### 1. Internal: Fetch Playlist and Tracks
- Fetch playlist metadata and track list from the Resomix database using the provided `playlist_id`.

### 2. Tidal API: Get User Info (Country Code)
- **Method:** `GET`
- **Endpoint:** `https://openapi.tidal.com/v2/users/me`
- **Headers:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
  - `User-Agent: Resomix/1.0`
- **Query Parameters:** _None_
- **Payload:** _None_
- **Purpose:** Retrieve the user's Tidal country code (e.g., `"country": "GR"`).

### 3. Tidal API: Create Playlist
- **Method:** `POST`
- **Endpoint:** `https://openapi.tidal.com/v2/playlists`
- **Headers:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
  - `User-Agent: Resomix/1.0`
- **Query Parameters:**
  - `countryCode=<user_country>` (e.g., `countryCode=GR`)
- **Payload Example:**
```json
{
  "data": {
    "attributes": {
      "accessType": "PRIVATE", // or "PUBLIC" if public playlist is desired
      "description": "Transferred from Resomix playlist 'Playlist Name'",
      "name": "<playlist_name>"
    },
    "type": "playlists"
  }
}
```
- **Purpose:** Create a new playlist in the user's Tidal account.

### 4. Internal: Track Search and Caching
- For each track in the playlist, check the cache for an existing Tidal track ID.
- For uncached tracks, search Tidal for the best match.

### 5. Tidal API: Search for Tracks
- **Method:** `GET`
- **Endpoint:** `https://openapi.tidal.com/v2/searchresults`
- **Headers:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
  - `User-Agent: Resomix/1.0`
- **Query Parameters:**
  - `query=<artist and title>` (e.g., `query=Daft Punk One More Time`)
  - `type=track`
  - `limit=10`
  - `countryCode=<user_country>`
- **Payload:** _None_
- **Purpose:** Find the best matching Tidal track for each playlist entry.
- If no match is found, a fallback search with only the title is performed.

### 6. Tidal API: Add Tracks to Playlist
- **Method:** `POST`
- **Endpoint:** `https://openapi.tidal.com/v2/playlists/<playlist_id>/items`
- **Headers:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
  - `User-Agent: Resomix/1.0`
- **Query Parameters:** _None_
- **Payload Example (batch of up to 100 track IDs):**
```json
{
  "trackIds": ["tidal_track_id_1", "tidal_track_id_2", ...]
}
```
- **Purpose:** Add found tracks to the newly created Tidal playlist. Multiple requests are made if the playlist has more than 100 tracks.

### 7. Internal: Finalize and Respond
- Prepare a summary of the transfer (tracks added, not found, playlist URL, etc.) and return it to the frontend.

---

**Note:**
- All Tidal API calls require a valid OAuth access token with scopes: `user.read`, `playlists.read`, `playlists.write`.
- If any Tidal API call fails (e.g., 403 Forbidden), the backend logs the full request/response for debugging and returns an error to the frontend.
