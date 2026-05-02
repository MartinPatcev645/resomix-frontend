# FastAPI Models Inventory (Final Verified)

This document provides a comprehensive, surgically verified list of all SQLAlchemy models in the Resomix FastAPI backend. Every column and table name has been cross-referenced with the source code.

---

## [1. Core Entities]

### **User**
- **Table**: `users`
- **File**: `app/models/user.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `uuid`: String(36) (Unique, Index, NOT NULL) -- Public identifier for external API references.
  - `username`: String(50) (Unique, Index, NOT NULL) -- Unique login handle.
  - `email`: String(100) (Unique, Index, NOT NULL) -- Primary contact and login email.
  - `password_hash`: String(255) (NOT NULL) -- Securely hashed password.
  - `name`: String(100) (Nullable) -- User's full display name.
  - `profile_picture`: String(255) (Nullable) -- Path to avatar image.
  - `language`: String(10) (Default: "en") -- Preferred UI language.
  - `timezone`: String(50) (Default: "UTC") -- User's local timezone.
  - `is_email_verified`: Boolean (NOT NULL, Default: False) -- Verification status of email address.
  - `is_two_factor_enabled`: Boolean (NOT NULL, Default: False) -- 2FA activation status.
  - `two_factor_method`: Enum("email", "app") (NOT NULL, Default: "email") -- Method used for 2FA (email or app).
  - `stripe_customer_id`: String(255) (Unique, Nullable) -- Linked Stripe customer ID for billing.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Account creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last profile update timestamp.

- **Usage & Purpose**:
  - **Repositories**: `UserRepository` (CRUD, profile lookups), `UserSessionRepository` (refresh tokens, sessions).
  - **Services**: `UserService` (profile management, 2FA, settings), `AuthService` (registration, login, password resets).
  - **Controllers**: `auth.py` (identity endpoints), `users.py` (profile management).
  - **Role**: Central identity entity; linked to almost all user-generated content (playlists, orders, logs).

### **Track**
- **Table**: `tracks`
- **File**: `app/models/track.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `uuid`: String(36) (Unique, Index, NOT NULL) -- Public identifier for external API references.
  - `release_id`: BigInteger (FK: `releases.id`, Nullable, Index) -- Foreign key to parent release.
  - `label_id`: BigInteger (FK: `labels.id`, Nullable, Index) -- Foreign key to owner label.
  - `genre_id`: BigInteger (FK: `genres.id`, Nullable, Index) -- Foreign key to primary genre.
  - `user_id`: BigInteger (FK: `users.id`, Nullable, Index) -- Foreign key to uploader user.
  - `party_id`: String(100) (FK: `parties.party_id`, Nullable, Index) -- Foreign key to content owner party.
  - `isrc`: String(30) (NOT NULL, Index) -- International Standard Recording Code.
  - `title`: String(1024) (NOT NULL, Index) -- Primary track name.
  - `resource_ref`: String(100) (Nullable) -- External provider reference ID.
  - `proprietary_id`: String(100) (Nullable) -- Private catalog identifier.
  - `version_title`: String(512) (Nullable) -- Version name (e.g., 'Remix').
  - `display_artist`: String(512) (Nullable) -- Formatted artist string for UI.
  - `track_number`: SmallInteger (Nullable) -- Sequence index on release.
  - `disk_number`: SmallInteger (Default: 1) -- Disk sequence index.
  - `duration_seconds`: Integer (Nullable) -- Track length in total seconds.
  - `duration_iso`: String(30) (Nullable) -- Duration in ISO 8601 format.
  - `duration_sec`: Numeric(8, 3) (Nullable) -- High-precision duration in seconds.
  - `bpm`: SmallInteger (Nullable, Index) -- Tempo in beats per minute.
  - `musical_key`: String(10) (Nullable, Index) -- Detected musical key.
  - `key_signature`: String(10) (Nullable) -- Technical key signature.
  - `audio_language`: String(2) (Default: "xx") -- Primary language of audio content.
  - `language_of_lyrics`: String(10) (Nullable) -- Language used in lyrics.
  - `genre`: String(255) (Column: "genre", Nullable) -- Legacy genre string.
  - `sub_genre`: String(255) (Nullable) -- Secondary genre classification.
  - `price_cents`: Integer (Default: 99) -- Default sale price in cents.
  - `mix_name`: String(150) (Default: "Original Mix") -- Mix variant description.
  - `file_path`: String(1024) (NOT NULL) -- Internal storage path for master audio.
  - `preview_path`: String(500) (Nullable) -- Path to low-quality preview audio.
  - `audio_path`: String(1024) (Nullable) -- Optimized streaming path.
  - `file_size`: BigInteger (Nullable) -- Master file size in human-readable format.
  - `file_size_bytes`: BigInteger (Nullable) -- Master file size in raw bytes.
  - `audio_codec`: String(50) (Nullable) -- Audio compression type (e.g., 'FLAC').
  - `bit_depth`: SmallInteger (Nullable) -- Audio resolution bit depth.
  - `sample_rate`: Integer (Nullable) -- Audio sampling frequency in Hz.
  - `channels`: SmallInteger (Nullable) -- Number of audio channels.
  - `p_line_year`: Integer (Nullable) -- Phonographic rights year.
  - `p_line_text`: String(512) (Nullable) -- Phonographic rights holder text.
  - `deal_terms`: JSON (Nullable) -- JSON-formatted licensing conditions.
  - `parental_warning`: Enum("NoAdviceAvailable", "NotExplicit", "Explicit", "ExplicitContentEdited") (Default: "NotExplicit") -- Advisory classification.
  - `is_explicit`: Boolean (Default: False) -- Explicit content flag.
  - `is_instrumental`: Boolean (Default: False) -- Instrumental track flag.
  - `is_active`: Boolean (Default: True, Index) -- Visibility and availability status.
  - `track_type`: String(50) (Default: "electrobuzz", Index) -- Catalog classification (e.g., 'upload').
  - `ingestion_source`: Enum("ddex", "cc_by", "user_upload", "csv") (Default: "user_upload") -- Origin of the track metadata.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Metadata creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last metadata update timestamp.

- **Usage & Purpose**:
  - **Repositories**: `TrackRepository` (complex searching by BPM/Key/ISRC, relationship loading).
  - **Services**: `TrackService` (metadata management), `TrackUploadService` (ingestion, file processing), `SimilarityService` (discovery).
  - **Controllers**: `tracks.py` (public catalog), `telemetry.py` (stream tracking), `search.py`.
  - **Role**: Primary musical asset; handles audio file paths, technical metadata, and is the target for streaming and sales.

### **Release**
- **Table**: `releases`
- **File**: `app/models/release.py`
- **Columns**:
  - `id`: BigInteger (PK, AI) -- Unique database identifier.
  - `artist_id`: BigInteger (FK: `artists.id`, Nullable, Index) -- Foreign key to primary artist.
  - `label_id`: BigInteger (FK: `labels.id`, Nullable, Index) -- Foreign key to releasing label.
  - `party_id`: String(100) (FK: `parties.party_id`, Index) -- Foreign key to owner party.
  - `message_id`: String(255) (FK: `messages.message_id`, Index) -- Linked DDEX ingestion message ID.
  - `release_ref`: String(100) (Nullable) -- External provider release reference.
  - `ern_version`: String(10) (Nullable) -- DDEX ERN version used during ingestion.
  - `raw_xml_path`: String(500) (Nullable) -- Path to original DDEX XML source.
  - `icpn`: String(30) (Nullable, Index) -- International Code Product Number.
  - `upc_ean`: String(20) (Nullable) -- Universal Product Code / EAN.
  - `grid`: String(30) (Nullable) -- Global Release Identifier.
  - `catalog_number`: String(100) (Nullable, Index) -- Label's internal catalog identifier.
  - `title`: String(1024) (NOT NULL) -- Primary release title.
  - `subtitle`: String(1024) (Nullable) -- Secondary release title information.
  - `description`: String (Nullable) -- Textual product description.
  - `display_artist`: String(512) (Nullable) -- Formatted artist string for UI.
  - `release_type`: Enum("Album", "EP", "Single") -- Classification (Album, EP, Single).
  - `release_date`: Date (Nullable) -- Official commercial street date.
  - `original_release_date`: Date (Nullable) -- Historical first release date.
  - `ingested_at`: DateTime (Server Default) -- Timestamp of database entry.
  - `p_line_year`: Integer (Nullable) -- Phonographic rights year.
  - `p_line_text`: String(512) (Nullable) -- Phonographic rights holder.
  - `c_line_year`: Integer (Nullable) -- Copyright rights year.
  - `c_line_text`: String(512) (Nullable) -- Copyright rights holder.
  - `genre`: String(255) (Nullable) -- Primary genre classification.
  - `sub_genre`: String(255) (Nullable) -- Secondary genre classification.
  - `p_line`: String(255) (Nullable) -- Full P-line string.
  - `c_line`: String(255) (Nullable) -- Full C-line string.
  - `parental_warning`: Enum("NoAdviceAvailable", "NotExplicit", "Explicit", "ExplicitContentEdited") -- Advisory classification.
  - `is_compilation`: Boolean (Default: False) -- Compilation product flag.
  - `is_active`: Boolean (Default: True, Index) -- Commercial availability status.
  - `price_cents`: Integer (Nullable) -- Release-level sale price in cents.
  - `artwork_path`: String(1024) (Nullable) -- Master artwork storage path.
  - `cover_image`: String(255) (Nullable) -- Web-optimized cover image path.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Metadata creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last metadata update timestamp.

- **Usage & Purpose**:
  - **Repositories**: `ReleaseRepository` (fetching by UPC/ICPN, track count aggregation).
  - **Services**: `AlbumService` (release organization, metadata grouping).
  - **Controllers**: `albums.py` (album-level endpoints), `metadata.py`.
  - **Role**: Commercial product container; groups tracks into albums/singles and manages product-level metadata (Catalog No, ICPN).

### **Artist**
- **Table**: `artists`
- **File**: `app/models/artist.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `party_id`: String(100) (FK: `parties.party_id`, NOT NULL, Index) -- Foreign key to owner party.
  - `full_name`: String(512) (NOT NULL, Index) -- Artist's primary display name.
  - `isni`: String(30) (Nullable) -- International Standard Name Identifier.
  - `ipn`: String(30) (Nullable) -- International Performer Number.
  - `artist_type`: Enum("MainArtist", "FeaturedArtist", "Remixer", "Composer", "Lyricist", "Producer", "Conductor", "Orchestra", "Other") -- Primary artistic role classification.

- **Usage & Purpose**:
  - **Repositories**: `ArtistRepository` (name-based lookups, party-based filtering).
  - **Services**: `ArtistService` (metadata enrichment).
  - **Controllers**: `artists.py` (artist profiles and search).
  - **Role**: Represents performers and creators; linked to tracks via `RecordingArtist` and releases via `artist_id`.

### **Label**
- **Table**: `labels`
- **File**: `app/models/label.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `party_id`: String(100) (FK: `parties.party_id`, NOT NULL, Index) -- Foreign key to owner party.
  - `name`: String(255) (NOT NULL, Index) -- Label's official brand name.
  - `is_active`: Boolean (NOT NULL, Default: True) -- Operational status flag.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.

- **Usage & Purpose**:
  - **Repositories**: `LabelRepository` (lookup by party_id, name search).
  - **Services**: `MetadataService` (categorizing content by label).
  - **Role**: Represents the record label or publisher; essential for licensing, rights management, and brand categorization.

### **Party**
- **Table**: `parties`
- **File**: `app/models/party.py`
- **Columns**:
  - `id`: Integer (PK, AI) -- Unique database identifier.
  - `party_id`: String(100) (Unique, Index, NOT NULL) -- Unique alphanumeric party identifier.
  - `party_name`: String(255) (NOT NULL) -- Official name of the organization/person.
  - `dpid`: String(100) (Nullable) -- Digital Provider Identification Number.
  - `email`: String(255) (Nullable) -- Primary contact email for the party.
  - `is_active`: Boolean (NOT NULL, Default: True) -- Account status flag.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last update timestamp.

### **Genre**
- **Table**: `genres`
- **File**: `app/models/genre.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `name`: String(100) (Unique, Index, NOT NULL) -- Unique genre name.
  - `description`: Text (Nullable) -- Detailed category description.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.

- **Usage & Purpose**:
  - **Repositories**: `GenreRepository` (fetching hierarchical genres).
  - **Services**: `MetadataService` (track classification).
  - **Role**: Musical classification for search, filtering, and discovery.

---

## [2. Playlist & Engagement]

### **Playlist**
- **Table**: `playlists`
- **File**: `app/models/playlist.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `uuid`: String(36) (Unique, Index, NOT NULL) -- Public identifier for external API references.
  - `user_id`: BigInteger (FK: `users.id`, Nullable, Index) -- Foreign key to owner user.
  - `name`: String(150) (NOT NULL) -- Playlist display name.
  - `is_public`: Boolean (NOT NULL, Default: False) -- Visibility status.
  - `type`: Enum("custom", "similarity", "waiting_segments") -- Classification (custom, similarity, etc.).
  - `seed_track_id`: BigInteger (FK: `tracks.id`, Nullable) -- Track ID used to generate similarity.
  - `fork_id`: String(36) (FK: `playlists.uuid`, Nullable) -- UUID of the parent playlist if forked.
  - `forked_at`: DateTime (Nullable) -- Timestamp of the fork operation.
  - `fork_count`: Integer (NOT NULL, Default: 0) -- Number of times this playlist has been forked.
  - `num_tracks`: Integer (NOT NULL, Default: 0) -- Cached count of tracks in playlist.
  - `play_time`: Integer (NOT NULL, Default: 0) -- Cached total duration in seconds.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.

- **Usage & Purpose**:
  - **Repositories**: `PlaylistRepository` (CRUD, fork logic, track aggregation).
  - **Services**: `PlaylistService` (management, HLS playlist generation), `SimilarityService` (automated creation).
  - **Controllers**: `playlists.py` (user/public playlists), `search.py`.
  - **Role**: User-curated or system-generated track collections; tracks fork history and total duration.

### **PlaylistTrack**
- **Table**: `playlist_tracks`
- **File**: `app/models/playlist.py`
- **Columns**:
  - `playlist_id`: BigInteger (PK, FK: `playlists.id`) -- Foreign key to owner playlist.
  - `track_id`: BigInteger (PK, FK: `tracks.id`, Index) -- Foreign key to included track.
  - `position`: DECIMAL(12, 6) (NOT NULL) -- Decimal ordering value.
  - `score`: DECIMAL(10, 8) (Nullable) -- Similarity score if applicable.

- **Usage & Purpose**:
  - **Repositories**: `PlaylistRepository` (managed as part of playlist operations).
  - **Role**: Junction table linking tracks to playlists; stores high-precision order (`position`) and similarity metrics (`score`).

### **UserPlaylistEngagement**
- **Table**: `user_playlist_engagements`
- **File**: `app/models/playlist_engagement.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`) -- Foreign key to user.
  - `playlist_id`: BigInteger (PK, FK: `playlists.id`) -- Foreign key to playlist.
  - `is_favorite`: Boolean (NOT NULL, Default: False) -- Heart/Favorite status.
  - `is_following`: Boolean (NOT NULL, Default: False) -- Subscription status.
  - `favorite_at`: DateTime (Nullable) -- Timestamp of favoriting.
  - `unfavorite_at`: DateTime (Nullable) -- Timestamp of unfavoriting.
  - `followed_at`: DateTime (Nullable) -- Timestamp of following.
  - `unfollowed_at`: DateTime (Nullable) -- Timestamp of unfollowing.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Record creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last interaction update.

- **Usage & Purpose**:
  - **Repositories**: `PlaylistEngagementRepository` (tracking hearts/follows).
  - **Services**: `PlaylistEngagementService` (personalization logic).
  - **Controllers**: `playlist_engagement.py`.
  - **Role**: Captures user-to-playlist relationships (Favoriting and Following).

### **PlaylistTransferTrack**
- **Table**: `playlist_transfer_tracks`
- **File**: `app/models/playlist_transfer_track.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `track_id`: BigInteger (FK: `tracks.id`, Unique, Index, NOT NULL) -- Linked internal track ID.
  - `spotify_id`: String(100) (Nullable, Index) -- Corresponding ID on Spotify.
  - `apple_music_id`: String(100) (Nullable, Index) -- Corresponding ID on Apple Music.
  - `tidal_id`: String(100) (Nullable, Index) -- Corresponding ID on Tidal.
  - `last_synced_at`: DateTime (Nullable) -- Last cross-platform sync timestamp.

- **Usage & Purpose**:
  - **Repositories**: `PlaylistTransferTrackRepository`.
  - **Services**: `SpotifyTransferService`, `AppleMusicTransferService`, `TidalTransferService`.
  - **Role**: Mapping table for cross-platform playlist migration; links internal tracks to external service IDs.

---

## [3. E-Commerce & Monetization]

### **TrackFormat**
- **Table**: `track_formats`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `track_id`: BigInteger (FK: `tracks.id`, NOT NULL) -- Foreign key to parent track.
  - `audio_format`: Enum("mp3", "wav", "flac", "aiff") -- Encoding type (mp3, wav, etc.).
  - `price_cents`: Integer (NOT NULL) -- Sale price for this specific variant.
  - `file_path`: String(500) (Nullable) -- Path to the formatted audio file.
  - `file_size`: BigInteger (Nullable) -- Master file size in human-readable format.
  - `is_generated`: Boolean (Default: False) -- Flag indicating if variant was auto-generated.
  - `last_downloaded_at`: DateTime (Nullable) -- Last customer download timestamp.

- **Usage & Purpose**:
  - **Repositories**: `CartRepository`, `OrderRepository` (linkage).
  - **Role**: Defines purchasable audio variants (WAV, MP3) for a track; stores pricing and variant-specific file paths.

### **PromoCode**
- **Table**: `promo_codes`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `code`: String(50) (Unique, NOT NULL) -- Alphanumeric discount code.
  - `discount_type`: Enum("percentage", "fixed_amount") -- Calculation method (percentage or fixed).
  - `discount_value`: Integer (NOT NULL) -- Value of the discount in cents or percent.
  - `max_uses`: Integer (Nullable) -- Usage limit threshold.
  - `uses_count`: Integer (Default: 0) -- Current redemption count.
  - `expires_at`: DateTime (Nullable) -- Validity expiration timestamp.
  - `is_active`: Boolean (Default: True) -- Activation status flag.
  - `stripe_coupon_id`: String(255) (Unique, Nullable) -- Linked Stripe coupon identifier.
  - `stripe_promo_code_id`: String(255) (Unique, Nullable) -- Linked Stripe promotion code identifier.

- **Usage & Purpose**:
  - **Repositories**: `OrderRepository` (validation).
  - **Services**: `OrderService` (applying discounts during checkout).
  - **Controllers**: `admin/promo.py` (management).
  - **Role**: Marketing discount codes; integrated with Stripe for financial transaction management.

### **Order**
- **Table**: `orders`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, NOT NULL) -- Foreign key to purchasing user.
  - `stripe_session_id`: String(255) (Unique, Nullable) -- Stripe Checkout session identifier.
  - `promo_code_id`: BigInteger (FK: `promo_codes.id`, Nullable) -- Foreign key to applied promo code.
  - `subtotal_cents`: Integer (NOT NULL) -- Order total before discounts.
  - `discount_cents`: Integer (Default: 0) -- Total savings applied.
  - `total_cents`: Integer (NOT NULL) -- Final amount charged to customer.
  - `status`: Enum("pending", "paid", "failed", "refunded") -- Current lifecycle state of the order.
  - `payment_intent_id`: String(255) (Unique, Nullable) -- Stripe Payment Intent identifier.
  - `base_currency`: String(3) (Default: "USD") -- Currency used for the transaction.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Order placement timestamp.

- **Usage & Purpose**:
  - **Repositories**: `OrderRepository`.
  - **Services**: `OrderService` (orchestrates payment flows and inventory allocation).
  - **Role**: High-level transaction record; tracks payment status (`paid`, `failed`) and Stripe identifiers.

### **Purchase**
- **Table**: `purchases`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `order_id`: BigInteger (FK: `orders.id`, NOT NULL) -- Foreign key to parent order.
  - `user_id`: BigInteger (FK: `users.id`, Nullable, Index) -- Foreign key to owning user.
  - `track_format_id`: BigInteger (FK: `track_formats.id`, Nullable) -- Foreign key to purchased track variant.
  - `source_playlist_id`: BigInteger (FK: `playlists.id`, Nullable) -- Reference to playlist where item was found.
  - `release_id`: BigInteger (FK: `releases.id`, Nullable) -- Foreign key to purchased release.
  - `price_cents`: Integer (Nullable) -- Sale price at time of purchase.
  - `purchased_at`: DateTime (NOT NULL, Server Default) -- Completion timestamp.

- **Usage & Purpose**:
  - **Repositories**: `PurchaseRepository`.
  - **Services**: `PurchaseService` (verifying ownership for downloads/streaming).
  - **Controllers**: `purchases.py`.
  - **Role**: Line-item record for successful transactions; links users to owned track formats or releases.

### **Cart**
- **Table**: `carts`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, NOT NULL) -- Foreign key to owner user.
  - `promo_code_id`: BigInteger (FK: `promo_codes.id`, Nullable) -- Foreign key to pending promo code.
  - `status`: Enum("active", "pending_checkout", "completed", "abandoned") -- Current state of the shopping session.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Cart initialization timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last item modification timestamp.

- **Usage & Purpose**:
  - **Repositories**: `CartRepository`.
  - **Services**: `CartService` (item management, checkout preparation).
  - **Role**: Transient shopping container; stores pending items before conversion to an Order.

### **CartItem**
- **Table**: `cart_items`
- **File**: `app/models/ecommerce.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `cart_id`: BigInteger (FK: `carts.id`, NOT NULL) -- Foreign key to parent cart.
  - `track_format_id`: BigInteger (FK: `track_formats.id`, NOT NULL) -- Foreign key to added track variant.
  - `source_playlist_id`: BigInteger (FK: `playlists.id`, Nullable) -- Reference to playlist context.
  - `price_cents`: Integer (NOT NULL) -- Snapshotted price at time of adding.
  - `added_at`: DateTime (NOT NULL, Server Default) -- Record creation timestamp.

- **Usage & Purpose**:
  - **Services**: `CartService`.
  - **Role**: Junction linking specific track formats to a user's cart with locked-in pricing.

### **UserSubscription**
- **Table**: `user_subscriptions`
- **File**: `app/models/purchase.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`, NOT NULL) -- Unique foreign key to user.
  - `stripe_subscription_id`: String(255) (Unique, NOT NULL) -- Stripe Subscription identifier.
  - `subscribed_at`: DateTime (NOT NULL, Server Default) -- Start timestamp of subscription.

- **Usage & Purpose**:
  - **Services**: `PurchaseService` (subscription status checking).
  - **Role**: Tracks recurring Stripe subscriptions for tiered feature access.

---

## [4. Telemetry & Logs]

### **ConsumptionEvent**
- **Table**: `consumption_events`
- **File**: `app/models/consumption_event.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `event_category`: Enum("stream_start", "stream_complete", "stream_skip", "download_success") (NOT NULL) -- Type of telemetry event (start, skip, etc.).
  - `track_id`: BigInteger (FK: `tracks.id`, Nullable, Index) -- Foreign key to involved track.
  - `track_format_id`: BigInteger (FK: `track_formats.id`, Nullable, Index) -- Foreign key to specific format played.
  - `isrc`: String(15) (Nullable) -- Snapshotted ISRC for reporting.
  - `label_id`: Integer (FK: `labels.id`, Nullable) -- Snapshotted label ID for reporting.
  - `user_id`: BigInteger (FK: `users.id`, Nullable) -- Foreign key to listener.
  - `country_code`: String(2) (Nullable) -- Geographic origin of the event.
  - `client_ip`: String(45) (Nullable) -- IP address of the listener.
  - `playback_context`: String(50) (Nullable) -- UI section where playback started (e.g., 'playlist').
  - `source_device`: Enum("web", "ios", "android", "desktop", "other") -- Hardware category used for streaming.
  - `session_id`: String(36) (Nullable, Index) -- Unique playback session identifier.
  - `duration_seconds`: Integer (NOT NULL) -- Amount of audio consumed in seconds.
  - `timestamp`: DateTime (NOT NULL, Server Default, Index) -- Event occurrence timestamp.

- **Usage & Purpose**:
  - **Repositories**: `TelemetryRepository`.
  - **Services**: `TelemetryService`, `TelemetryWorker` (background processing).
  - **Controllers**: `telemetry.py`.
  - **Role**: Core analytics model; logs every playback event for DSRF-compliant royalty reporting.

### **SystemLog**
- **Table**: `system_logs`
- **File**: `app/models/log.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `correlation_id`: String(36) (Nullable, Index) -- ID for tracing requests across logs.
  - `method`: String(10) (Nullable) -- HTTP method used in the request.
  - `endpoint`: String(255) (Nullable, Index) -- API route name.
  - `path`: String(1024) (Nullable) -- Full request URL path.
  - `query_params`: Text (Nullable) -- Raw query string data.
  - `status_code`: Integer (Nullable, Index) -- HTTP response status.
  - `response_size`: BigInteger (Nullable) -- Size of response body in bytes.
  - `duration_ms`: Numeric(10, 2) (Nullable) -- Execution time in milliseconds.
  - `level`: Enum("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL") (Index) -- Log severity (INFO, ERROR, etc.).
  - `category`: String(50) (Nullable, Index) -- Functional area of the system.
  - `action`: String(100) (Nullable, Index) -- Specific operation performed.
  - `message`: Text (Nullable) -- Human-readable log message.
  - `client_ip`: String(45) (Nullable) -- Requesting client IP address.
  - `user_agent`: String(255) (Nullable) -- Client browser/app identification.
  - `referer`: String(255) (Nullable) -- Originating page URL.
  - `cpu_percent`: Numeric(5, 2) (Nullable) -- System CPU usage at time of log.
  - `memory_percent`: Numeric(5, 2) (Nullable) -- System memory usage at time of log.
  - `track_id`: BigInteger (FK: `tracks.id`, Nullable, Index) -- Contextual track reference.
  - `playlist_id`: BigInteger (FK: `playlists.id`, Nullable, Index) -- Contextual playlist reference.
  - `artist_id`: BigInteger (FK: `artists.id`, Nullable, Index) -- Contextual artist reference.
  - `log_metadata`: JSON (Nullable) -- Structured JSON with extra details.
  - `stack_trace`: Text (Nullable) -- Error stack trace for debugging.
  - `created_at`: DateTime (NOT NULL, Server Default, Index) -- Log entry timestamp.

- **Usage & Purpose**:
  - **Repositories**: `LogRepository`.
  - **Services**: `LoggingService`.
  - **Role**: Centralized observability; captures request/response cycles, errors, and system performance metrics.

---

## [5. Auth & RBAC]

### **Role**
- **Table**: `roles`
- **File**: `app/models/user.py`
- **Columns**:
  - `id`: Integer (PK, AI) -- Unique database identifier.
  - `name`: String(50) (Unique, NOT NULL) -- Unique role name (e.g., 'Admin').
  - `description`: String(255) (Nullable) -- Scope of the role's authority.

- **Usage & Purpose**:
  - **Repositories**: `UserRepository` (relationship management).
  - **Services**: `AuthService`.
  - **Role**: RBAC roles (Admin, Label, Artist, User) for coarse-grained access control.

### **Permission**
- **Table**: `permissions`
- **File**: `app/models/user.py`
- **Columns**:
  - `id`: Integer (PK, AI) -- Unique database identifier.
  - `code`: String(50) (Unique, NOT NULL) -- Unique capability code (e.g., 'view_logs').
  - `description`: String(255) (Nullable) -- Detailed action allowed by this permission.

- **Usage & Purpose**:
  - **Role**: Fine-grained capability definitions (e.g., `upload_track`, `access_admin`).

### **RolePermission**
- **Table**: `role_permissions`
- **File**: `app/models/user.py`
- **Columns**:
  - `role_id`: Integer (PK, FK: `roles.id`) -- Link to role.
  - `permission_id`: Integer (PK, FK: `permissions.id`) -- Link to permission.

- **Usage & Purpose**:
  - **Role**: Junction mapping specific permissions to roles.

### **UserRole**
- **Table**: `user_roles`
- **File**: `app/models/user.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`) -- Link to user.
  - `role_id`: Integer (PK, FK: `roles.id`) -- Link to role.

- **Usage & Purpose**:
  - **Role**: Junction mapping users to their assigned roles.

### **UserToken**
- **Table**: `user_tokens`
- **File**: `app/models/user.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, NOT NULL) -- Foreign key to owner user.
  - `token`: String(255) (NOT NULL, Index) -- Secure random token string.
  - `token_type`: Enum("email_verification", "password_reset", "2fa") -- Purpose of the token (reset, verify).
  - `expires_at`: DateTime (NOT NULL) -- Token invalidation timestamp.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.

- **Usage & Purpose**:
  - **Services**: `AuthService` (email verification, password reset flows).
  - **Role**: Manages security tokens for transient, one-time authentication actions.

### **UserSession**
- **Table**: `user_sessions`
- **File**: `app/models/user.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, NOT NULL, Index) -- Foreign key to logged-in user.
  - `session_id`: String(36) (Unique, Index, NOT NULL) -- Unique public session identifier.
  - `refresh_token_hash`: String(255) (Nullable) -- Hashed refresh token for rotation.
  - `user_agent`: String(255) (Nullable) -- Client browser/app identification.
  - `ip_address`: String(45) (Nullable) -- Last known IP address.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Login timestamp.
  - `expires_at`: DateTime (Nullable, Index) -- Session expiration timestamp.
  - `revoked_at`: DateTime (Nullable, Index) -- Manual logout/revocation timestamp.

- **Usage & Purpose**:
  - **Repositories**: `UserSessionRepository`.
  - **Services**: `AuthService` (token rotation, logout), `UserService` (session auditing).
  - **Role**: State management for active logins; tracks devices and IP addresses for security.

### **UserAuthProvider**
- **Table**: `user_auth_providers`
- **File**: `app/models/user.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`) -- Foreign key to owner user.
  - `provider`: String(50) (PK, NOT NULL) -- Name of the OAuth provider (e.g., 'google').
  - `provider_uid`: String(100) (NOT NULL) -- Unique identifier from the external provider.

- **Usage & Purpose**:
  - **Services**: `AuthService`.
  - **Role**: Links local users to external identity providers (OAuth).

---

## [6. Interaction & Support]

### **TrackRating**
- **Table**: `track_ratings`
- **File**: `app/models/rating.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, Nullable) -- Foreign key to rating user.
  - `rating`: SmallInteger (Nullable) -- Numeric score (typically 1-5).
  - `track_id`: BigInteger (FK: `tracks.id`, NOT NULL) -- Foreign key to rated track.
  - `playlist_id`: BigInteger (FK: `playlists.id`, Nullable) -- Optional context of where track was rated.
  - `rated_at`: DateTime (NOT NULL, Server Default) -- Submission timestamp.

- **Usage & Purpose**:
  - **Repositories**: `RatingRepository`.
  - **Services**: `RatingService`.
  - **Controllers**: `ratings.py`.
  - **Role**: Stores user-submitted star ratings for specific tracks.

### **PlaylistRating**
- **Table**: `playlist_ratings`
- **File**: `app/models/rating.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, Nullable) -- Foreign key to rating user.
  - `rating`: SmallInteger (Nullable) -- Numeric score (typically 1-5).
  - `message`: Text (Nullable) -- Optional textual feedback.
  - `playlist_id`: BigInteger (FK: `playlists.id`, NOT NULL) -- Foreign key to rated playlist.
  - `rated_at`: DateTime (NOT NULL, Server Default) -- Submission timestamp.

- **Usage & Purpose**:
  - **Repositories**: `RatingRepository`.
  - **Services**: `RatingService`.
  - **Controllers**: `ratings.py`.
  - **Role**: Stores user feedback for playlists, including optional text comments.

### **Feedback**
- **Table**: `feedback`
- **File**: `app/models/feedback.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, Nullable, Index) -- Foreign key to submitting user.
  - `category`: String(50) (Nullable) -- Classification of feedback (bug, feature, etc.).
  - `message`: Text (Nullable) -- Detailed feedback text.
  - `satisfaction`: Integer (Nullable) -- Rating of overall experience.
  - `recommendation`: Integer (Nullable) -- Net Promoter Score (NPS) likelihood.
  - `status`: Enum("open", "resolved") (Default: "open") -- Current handling state (open/resolved).
  - `submitted_at`: DateTime (NOT NULL, Server Default) -- Creation timestamp.

- **Usage & Purpose**:
  - **Repositories**: `FeedbackRepository`.
  - **Services**: `FeedbackService`.
  - **Controllers**: `feedback.py`.
  - **Role**: Captures categorized user feedback and satisfaction metrics.

### **Contact**
- **Table**: `contact`
- **File**: `app/models/contact.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `user_id`: BigInteger (FK: `users.id`, Nullable, Index) -- Link to user if logged in.
  - `name`: String(100) (Nullable) -- Submitter's name.
  - `email`: String(100) (Nullable) -- Contact email address.
  - `subject`: String(150) (Nullable) -- Inquiry topic.
  - `phone`: String(20) (Nullable) -- Contact phone number.
  - `message`: Text (Nullable) -- Full message content.
  - `status`: Enum("open", "resolved") (Default: "open") -- Handling status.
  - `submitted_at`: DateTime (NOT NULL, Server Default) -- Submission timestamp.

- **Usage & Purpose**:
  - **Repositories**: `ContactRepository`.
  - **Services**: `ContactService`.
  - **Controllers**: `contact.py`.
  - **Role**: Stores "Contact Us" form submissions for support tracking.

### **Waitlist**
- **Table**: `waitlist`
- **File**: `app/models/waitlist.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `email`: String(255) (Unique, Index, NOT NULL) -- Interested user's email.
  - `status`: Enum("pending", "approved", "rejected") (Index) -- Current invitation state.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Signup timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last status change.

- **Usage & Purpose**:
  - **Repositories**: `WaitlistRepository`.
  - **Services**: `WaitlistService`.
  - **Controllers**: `waitlist.py`.
  - **Role**: Manages early-access signups and approval statuses.

---

## [7. Administrative & Integration]

### **Message**
- **Table**: `messages`
- **File**: `app/models/message.py`
- **Columns**:
  - `id`: BigInteger (PK, AI) -- Unique database identifier.
  - `ingest_log_id`: BigInteger (NOT NULL) -- Link to ingestion process log.
  - `party_id`: String(100) (FK: `parties.party_id`, NOT NULL, Index) -- Foreign key to sender party.
  - `message_id`: String(255) (Unique, Index, NOT NULL) -- Unique DDEX message identifier.
  - `message_thread_id`: String(255) (Nullable) -- Thread ID for grouped messages.
  - `message_type`: String(100) (Nullable) -- DDEX message classification.
  - `ddex_version`: String(20) (Nullable) -- Schema version of the message.
  - `sender_dpid`: String(100) (Nullable) -- DDEX identifier of the sender.
  - `sender_name`: String(255) (Nullable) -- Legal name of the sender.
  - `recipient_dpid`: String(100) (Nullable) -- DDEX identifier of the recipient.
  - `recipient_name`: String(255) (Nullable) -- Legal name of the recipient.
  - `message_created_at`: DateTime (Nullable) -- Original message timestamp from XML.
  - `is_update`: Boolean (Default: False) -- Flag for supplemental metadata.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Record creation timestamp.

- **Usage & Purpose**:
  - **Role**: Tracks DDEX ERN MessageHeader metadata for auditing ingestion sources.

### **RecordingArtist**
- **Table**: `recording_artists`
- **File**: `app/models/recording_artist.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `track_id`: BigInteger (FK: `tracks.id`, NOT NULL) -- Foreign key to track.
  - `artist_id`: BigInteger (FK: `artists.id`, NOT NULL) -- Foreign key to artist.
  - `sequence_num`: SmallInteger (Default: 1) -- Display order of artist on track.
  - `artist_role`: String(100) (Default: "MainArtist") -- Classification (Main, Featured, etc.).

- **Usage & Purpose**:
  - **Repositories**: `TrackRepository`.
  - **Role**: Junction mapping tracks to artists with specific display roles and ordering.

### **OperationType**
- **Table**: `operation_types`
- **File**: `app/models/operation_limit.py`
- **Columns**:
  - `id`: Integer (PK, AI) -- Unique database identifier.
  - `code`: String(50) (Unique, Index, NOT NULL) -- Unique capability code (e.g., 'track_download').
  - `description`: String(255) (Nullable) -- Human-readable action name.

- **Usage & Purpose**:
  - **Repositories**: `OperationLimitRepository`.
  - **Role**: Defines the types of actions subject to rate limiting (e.g., 'download').

### **UserOperationLimit**
- **Table**: `user_operation_limits`
- **File**: `app/models/operation_limit.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`) -- Foreign key to user.
  - `operation_id`: Integer (PK, FK: `operation_types.id`) -- Foreign key to operation type.
  - `limit_value`: Integer (NOT NULL) -- Maximum allowed actions in window.
  - `window_seconds`: Integer (Nullable) -- Rolling time frame for the limit.
  - `usage`: Integer (NOT NULL, Server Default: 0) -- Current action count in active window.
  - `created_by`: BigInteger (FK: `users.id`, Nullable) -- Admin user who set the limit.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Limit initialization timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last usage update.

- **Usage & Purpose**:
  - **Repositories**: `OperationLimitRepository`.
  - **Services**: `OperationLimitService`, `OperationLimitEvaluator`.
  - **Role**: Tracks per-user quotas for specific system operations.

### **SpotifyApp**
- **Table**: `spotify_apps`
- **File**: `app/models/spotify_app.py`
- **Columns**:
  - `id`: BigInteger (PK, AI, Index) -- Unique database identifier.
  - `client_id`: String(100) (Unique, NOT NULL) -- Spotify API client identifier.
  - `client_secret_hash`: String(255) (NOT NULL) -- Securely hashed client secret.
  - `name`: String(100) (NOT NULL) -- Internal name for the application.
  - `description`: Text (Nullable) -- Purpose of this specific client.
  - `is_active`: Boolean (Default: True) -- Operational status.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Configuration timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last update timestamp.

- **Usage & Purpose**:
  - **Repositories**: `SpotifyAppRepository`.
  - **Services**: `SpotifyAppService`.
  - **Role**: Stores client configuration for external Spotify API applications.

### **UserSpotifyApp**
- **Table**: `user_spotify_apps`
- **File**: `app/models/spotify_app.py`
- **Columns**:
  - `user_id`: BigInteger (PK, FK: `users.id`) -- Foreign key to linked user.
  - `spotify_app_id`: BigInteger (FK: `spotify_apps.id`) -- Foreign key to Spotify app config.
  - `access_token`: Text (Nullable) -- Active OAuth access token.
  - `refresh_token`: Text (Nullable) -- OAuth refresh token for session renewal.
  - `expires_at`: DateTime (Nullable) -- Access token expiration timestamp.
  - `scopes`: Text (Nullable) -- Authorized API permission scopes.
  - `created_at`: DateTime (NOT NULL, Server Default) -- Link creation timestamp.
  - `updated_at`: DateTime (NOT NULL, Server Default, OnUpdate) -- Last token refresh timestamp.

- **Usage & Purpose**:
  - **Repositories**: `SpotifyAppRepository`.
  - **Services**: `SpotifyAppService`, `SpotifyTransferService`.
  - **Role**: Stores OAuth credentials for users linked to a specific SpotifyApp.
