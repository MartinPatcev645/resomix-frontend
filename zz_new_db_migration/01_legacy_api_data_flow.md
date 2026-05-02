# Phase 1: Legacy API & Data Flow Mapping

This document outlines the tasks accomplished by the existing FastAPI application, mapping the current API endpoints and their entire data flows to the legacy database models defined in `models_inventory.md`. 

This serves as the functional baseline. In Phase 2, we will map how the **new database schema** will support these existing functionalities.

---

## 1. Identity & Authentication (`app/api/routers/auth.py`, `users.py`)

### Tasks Accomplished
- **Registration & Login**: Onboarding new users via email/password or OAuth (Google, Spotify).
- **Session Management**: Issuing JWTs and refresh tokens for stateless/stateful hybrid auth.
- **Profile Management**: Updating user settings, avatars, and 2FA configurations.

### Data Flow & Model Mapping
- **`User`**: The central entity read/written during all auth operations.
- **`UserSession`**: Created on login, verified on subsequent requests, and updated/deleted on refresh/logout.
- **`UserToken`**: Created and emailed for password resets or email verification flows.
- **`UserAuthProvider`**: Read/written when a user logs in via a third-party social provider.

---

## 2. Core Catalog & Discovery (`tracks.py`, `albums.py`, `artists.py`, `search.py`, `similarity.py`)

### Tasks Accomplished
- **Catalog Browsing**: Fetching lists of tracks, recent releases, and artist discographies.
- **Deep Searching**: Querying the catalog by BPM, Musical Key, Genre, or ISRC.
- **Music Discovery**: Generating similar track recommendations based on audio features.

### Data Flow & Model Mapping
- **`Track`**: The primary read-heavy model. Queried for metadata, audio paths (`file_path`, `preview_path`), and technical specs (BPM, Key).
- **`Release` & `ReleaseTrack` (implicit)**: Queried to group tracks into Albums/EPs via `release_id`.
- **`Artist` & `RecordingArtist`**: Queried to fetch main and featured artists for a given track or release.
- **`Label` & `Genre`**: Used for filtering and categorization in search endpoints.
- **`TrackFormat`**: Queried to display available audio formats (e.g., MP3 vs WAV) and their respective prices.

---

## 3. Playlists & Curation (`playlists.py`, `playlist_engagement.py`)

### Tasks Accomplished
- **Playlist Management**: Creating, updating, and deleting custom playlists.
- **Track Curation**: Adding, reordering (`position`), or removing tracks from a playlist.
- **Forking**: Copying an existing public playlist into a user's own library.
- **Engagement & Feedback**: Liking/following playlists, and rating tracks or playlists.

### Data Flow & Model Mapping
- **`Playlist`**: Created/updated with basic metadata (`name`, `is_public`). Updates `num_tracks` and `play_time` cache. Tracks lineage via `fork_id`.
- **`PlaylistTrack`**: Junction table heavily manipulated to maintain the exact order of tracks in a playlist using the `position` float column.
- **`PlaylistEngagement`**: Written when a user hits the "Like" or "Follow" endpoints for a playlist.
- **`TrackRating` & `PlaylistRating`**: Written when users submit star ratings or reviews for specific catalog items.

---

## 4. E-Commerce & Transactions (`purchases.py`, `admin/promo.py`)

*(Note: Phase 2 of the roadmap intends to shift cart logic to Redis, but this maps the current DB-backed flow).*

### Tasks Accomplished
- **Shopping Cart**: Adding tracks to a cart for future purchase.
- **Checkout & Payment**: Converting a cart into an order via Stripe integration.
- **Library Access**: Verifying which tracks a user has successfully purchased.

### Data Flow & Model Mapping
- **`Cart` & `CartItem`**: Read/written as users browse the store. Locks in the `price_cents` from `TrackFormat`.
- **`Order`**: Created upon checkout initialization. Tracks the `stripe_session_id` and final status (`paid`, `failed`).
- **`Purchase`**: Created post-checkout (often via Stripe webhook). Acts as the immutable receipt linking the `User` to the `TrackFormat` or `Release`.
- **`PromoCode`**: Read during checkout to calculate `discount_cents` on the `Order`.

---

## 5. Streaming & Telemetry (`telemetry.py`, `preview.py`)

### Tasks Accomplished
- **Audio Delivery**: Serving HLS streams (`.m3u8`) or direct audio files.
- **Royalty Tracking**: Logging exactly who listened to what, from where, and for how long.
- **Rate Limiting**: Preventing abuse of streaming or download APIs.

### Data Flow & Model Mapping
- **`ConsumptionEvent`**: Heavily written to by background workers. Captures `event_category` (start, skip, complete), `duration_seconds`, `isrc`, `client_ip`, and `source_device`. Critical for DSRF compliance.
- **`SystemLog`**: Written to by middleware to track API latency, errors, and request paths.
- **`OperationType` & `UserOperationLimit`**: Read and incremented to enforce quotas (e.g., max downloads per day).
- **`UserSubscription`**: Read to verify if a user has an active Stripe subscription to bypass certain paywalls.

---

## 6. Integrations & Platform Transfers (`spotify_transfer.py`, `apple_music_transfer.py`)

### Tasks Accomplished
- **OAuth Linkage**: Connecting Resomix to a user's Spotify account.
- **Playlist Import**: Ingesting third-party playlists into the Resomix ecosystem.

### Data Flow & Model Mapping
- **`SpotifyApp`**: Read to get the global client ID.
- **`UserSpotifyApp`**: Written to store the user's specific access/refresh tokens.
- **`PlaylistTransferTrack`**: Used to map a Spotify/Apple Track ID to a Resomix `Track` during the import process.

---

## 7. Admin & Support (`feedback.py`, `contact.py`, `waitlist.py`)

### Tasks Accomplished
- **User Support**: Handling "Contact Us" forms and application feedback.
- **Early Access**: Managing the pre-launch waitlist.

### Data Flow & Model Mapping
- **`Feedback` & `Contact`**: Written by public endpoints, read by admin endpoints to manage resolution `status`.
- **`Waitlist`**: Written when a user submits their email; updated by admins to approve/reject.
- **`Role`, `Permission`, `UserRole`**: Evaluated by decorators to ensure the requester has admin privileges before fetching this data.
---

## 8. DDEX Ingestion Pipeline (Background Tasks)

### Tasks Accomplished
- **Metadata Ingestion**: Parsing DDEX ERN XMLs to update catalog.

### Data Flow & Model Mapping
- **`Message`**: Tracks DDEX ERN MessageHeader metadata for auditing ingestion sources.
