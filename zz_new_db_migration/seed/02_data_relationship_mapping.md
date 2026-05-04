# Data Relationship Mapping (Zero-Gap Specification)

This document provides a detailed map of the relational and logical dependencies within the Resomix database. It ensures that seed data generation maintains perfect integrity across all 51 tables.

## 1. The Global Root: The Party System
Almost all music-related entities must belong to a **Party** (Distributor or Content Owner).

*   **Party** (`parties`): The top-level entity (e.g., "ArgoRhythm").
*   **Owned Entities**: Labels, Contributors, Tracks, Releases, and IngestLogs MUST have a `party_id` matching a valid Party.
*   **Relational Rule**: If a `Track` and a `Release` are part of the same delivery, they must share the same `party_id`.

## 2. The Ingestion Lifecycle (The "ERN" Chain)
This chain tracks how a DDEX ERN message turns into a commercial product.

1.  **IngestLog** (`ingest_log`): Represents a physical folder/batch received (e.g., via SFTP).
2.  **Message** (`messages`): The specific DDEX XML metadata container.
    *   *Link*: Linked to `IngestLog` via `ingest_log_id`.
3.  **Release** (`releases`): The commercial product.
    *   *Link*: Linked to `Message` via `message_id`.
4.  **Deal** (`deals`): The licensing terms (where, when, and how it can be sold).
    *   *Link*: Linked to `Message` via `message_id`.
    *   *Logical Rule*: A Release is only "Live" if it has at least one valid `Deal`.

## 3. The Creative Graph (Tracks & Contributors)
We move away from string-based artist fields to a fully normalized network.

### Track-Level
*   **Track** -> **TrackContributor** -> **Contributor**.
*   *Roles*: `MainArtist`, `FeaturedArtist`, `Remixer`, `Producer`, `Composer`.
*   *Logical Rule*: Every track MUST have at least one `MainArtist`.

### Release-Level
*   **Release** -> **ReleaseContributor** -> **Contributor**.
*   *Purpose*: Defines the "Album Artist."
*   *Logical Rule*: Often matches the `MainArtist` of the tracks, but can be a "Various Artists" contributor.

### Classification
*   **Genre** -> **Genre** (Self-referencing parent/child).
*   *Logical Rule*: A "Techno" genre might have a parent "Electronic."

## 4. Asset Integrity (The Files)
Every track requires physical assets to be functional.

*   **AudioFile**:
    *   *Streaming*: Every track should have at least one `StreamingProfile` (HLS/MPEG-DASH).
    *   *Master*: Every track should have one `Master` (FLAC/WAV).
*   **ImageFile**:
    *   *Artwork*: Linked to `Release` for covers or `Track` for individual track art.
    *   *Profiles*: Linked to `Contributor` for artist headshots.

## 5. The Commerce & User Funnel
The path from discovery to ownership.

1.  **User**: The central consumer entity.
2.  **Cart** -> **CartItem**: Active shopping state.
    *   *Constraint*: A `CartItem` must link to a `Track`.
3.  **Order**: The finalized transaction.
4.  **Purchase**: The historical record of ownership.
    *   *Logic*: A `Purchase` can be a single `Track` OR an entire `Release` (Album).
    *   *Attribution*: `source_playlist_id` captures which playlist inspired the purchase.

## 6. Playlists & Engagement
How users interact with the catalog.

*   **Playlist** -> **PlaylistTrack** -> **Track**.
*   *Ordering*: `PlaylistTrack.position` ensures a specific playback sequence.
*   *Scoring*: `PlaylistTrack.score` (used by the similarity engine).

## 7. Telemetry & Reporting (DSRF Readiness)
The data required for royalty reporting.

*   **ConsumptionEvent**:
    *   *Mandatory Links*: `track_id` (what was played), `user_id` (who played it).
    *   *Metadata Resolution*: Must store the `isrc` and `label_id` at the time of the event to ensure reports are accurate even if the track metadata changes later.

## 8. Seed Data Logical Constraints
When generating data, the following constraints must be strictly followed:
1.  **Date Consistency**: `Deal.deal_start_date` < `ConsumptionEvent.timestamp`.
2.  **Asset Presence**: Any `Track` in a `Playlist` or `Cart` MUST have a corresponding `StreamingProfile` in `audio_files`.
3.  **Ownership Consistency**: The `label_id` on a `Track` (via its `Release`) must belong to the same `party_id` as the `Track`.
