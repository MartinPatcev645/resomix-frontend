# Phase 2: Database Schema Mapping (Legacy to New)

This document maps the legacy tables from `models_inventory.md` to the finalized production tables in `new_database.sql`. It details exactly how existing models have been restructured, what tables replace them, and highlights entirely new tables introduced to support B2B/DSP features.

## 1. Identity & Rights Management

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`User`** | `users` | **Unchanged**. Core authentication columns remain identical. |
| **`Artist`** | `contributors` | **Renamed & Expanded**. Replaces `artists`. Now acts as a master identity table for Artists, Composers, and Publishers. Added crucial rights fields (`isni`, `ipi`, `ipn`, `dpid`, `pro_affiliation`). |
| **`Label`** | `labels` | **Unchanged**. Still maps to `parties`. |
| **`Party`** | `parties` | **Unchanged**. Core DDEX distributor grouping. |

## 2. The Music Core (Major Architectural Shift)

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`Track`** | `tracks` | **Modified**. Heavy refactoring. `duration_seconds` replaced by `duration_ms`. Technical audio specs (codec, bitrate, sample rate, channels, file paths) **removed**. Legacy foreign keys (`release_id`, `label_id`, `genre_id`, `user_id`) **removed**. Now focuses purely on the "metaphysical" composition/recording metadata. |
| **`Release`** | `releases` | **Modified**. Represents albums/singles. Tracks are no longer hardcoded via foreign key on the track itself; they are mapped via `release_tracks`. |
| **`RecordingArtist`**| `track_contributors` | **Renamed & Expanded**. Replaces `recording_artists`. Now supports detailed royalty splits (`royalty_type`, `ownership_share`) and granular roles (Composer, Producer, Remixer) instead of just display order. |
| *(N/A)* | `release_contributors` | **New**. Junction mapping `releases` to `contributors` for album-level credits. |
| *(N/A)* | `release_tracks` | **New**. Junction mapping `tracks` to `releases`. Resolves the issue of a single track appearing on multiple releases (e.g., Single + Album + Deluxe). Adds `disc_number`, `track_number`, and `release_context`. |

## 3. File & Asset Management (Domain Separation)

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| *(Legacy Unified)* | `audio_files` | **New**. Extracted from legacy `Track` and `files` tables. Stores strict streaming/master audio assets (`mime_type`, `stored_path`, `duration_seconds`, `audio_codec`, `sample_rate`, etc.). Mapped to `track_id`. |
| *(Legacy Unified)* | `image_files` | **New**. Extracted from legacy unified `files` table. Stores artwork and cover assets with image-specific specs (`image_width`, `color_depth`). |
| *(Legacy Unified)* | `document_files`| **New**. Extracted from legacy unified `files` table. Stores DDEX XMLs, lyrics, and legal PDFs. |
| **`TrackFormat`** | *(Removed)* | **Replaced**. Functionality superseded by `audio_files` mapping and commerce updates. |
| *(Legacy Junction)* | `release_files` | **Modified**. Now maps `release_id` to `image_file_id` (specifically targeting `image_files` for cover art) instead of a generic `file_id`. |

## 4. E-Commerce & Transactions

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`Order`** | `orders` | **Restored**. Immutable financial ledger of user checkouts remains intact. |
| **`PromoCode`** | `promo_codes` | **Restored**. Maintains discount code logic. |
| **`Purchase`** | `purchases` | **Modified**. Now strictly requires `order_id` as a foreign key to ensure every purchase ties back to a financial ledger entry. |
| **`Cart`** | `carts` | **Modified**. Added `promo_code_id` foreign key to track applied discounts during the shopping session. |
| **`CartItem`** | `cart_items` | **Enhanced**. Added `release_id` column to support "Complete My Album" grouping tags alongside `track_id`. |

## 5. Streaming & Ecosystem Telemetry

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`ConsumptionEvent`** | `consumption_events`| **Modified**. Dropped `track_format_id`. Added heavy denormalization (`isrc`, `label_id`) and `session_id` indexing specifically optimized for DSRF reporting and bot-fraud prevention. |
| **`Playlist`** | `playlists` | **Unchanged**. |
| **`PlaylistTrack`** | `playlist_tracks` | **Unchanged**. |
| **`SystemLog`** | `system_logs` | **Unchanged**. |

## 6. DSP B2B / Licensing (Entirely New Domain)

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`Message`** | `messages` | **Unchanged**. DDEX ERN MessageHeader metadata. |
| *(N/A)* | `deals` | **New**. Commercial terms and licensing logic from DDEX DealList. |
| *(N/A)* | `release_deals` | **New**. Mapping specific deals to releases. |
| *(N/A)* | `deal_territories` | **New**. Geographic restrictions/permissions for a deal. |
| *(N/A)* | `deal_use_types` | **New**. Permitted usage models (Stream, Download) for a deal. |
| *(N/A)* | `royalty_rates` | **New**. Detailed financial terms (Fixed, RevenueShare). |
| *(N/A)* | `generated_reports` | **New**. Metadata for monthly label royalty reports. |
| *(N/A)* | `label_payouts` | **New**. Tracking disbursement status for label revenue. |
| *(N/A)* | `ingestion_errors` | **New**. Granular DDEX node-level failure reporting. |
| *(N/A)* | `acr_infringement_logs`| **New**. Automated Content Recognition match results for copyright. |
| *(N/A)* | `manual_takedowns` | **New**. Admin-driven content removal records. |
| *(N/A)* | `sftp_users` | **New**. Virtual users for labels to upload content via SFTP. |

## 7. Integrations & Admin Support

| Legacy Model | New Table in `new_database.sql` | Action / Changes |
|---|---|---|
| **`UserSubscription`** | `user_subscriptions` | **Unchanged**. |
| **`Role`, `Permission`, `UserRole`** | `roles`, `permissions`, `user_roles` | **Unchanged**. |
| **`SpotifyApp`, `UserSpotifyApp`** | `spotify_apps`, `user_spotify_apps` | **Unchanged**. |
| **`Waitlist`, `Contact`, `Feedback`** | `waitlist`, `contact`, `feedback` | **Unchanged**. |
| **`TrackRating`, `PlaylistRating`** | `track_ratings`, `playlist_ratings` | **Unchanged**. |

---

### Key Architectural Shifts to Note for Code Update:
1. **The Audio Extraction**: Code that previously fetched `track.file_path` or `track.audio_codec` directly from the `Track` model must now perform a JOIN (or relationship load) to `audio_files`.
2. **The Contributor Shift**: Anywhere the code loaded `artists` via `recording_artists` must be rewritten to load `contributors` via `track_contributors`, accounting for `role` and `royalty_type`.
3. **The Release Hierarchy**: Tracks no longer have a `release_id` column. To find which release a track belongs to (or to list tracks on an album), the code MUST traverse the new `release_tracks` junction table. This is the biggest structural change for the catalog API.
4. **Unified Files Deprecation**: Any legacy logic writing to a single `files` table must route to `audio_files`, `image_files`, or `document_files` based on asset type. `release_files` specifically points to `image_file_id`.
