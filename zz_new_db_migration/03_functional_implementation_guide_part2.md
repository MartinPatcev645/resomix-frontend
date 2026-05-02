# Phase 3: Functional Implementation Guide
## Part 2: Core Catalog & Discovery

This document outlines the file-by-file codebase updates required to support the new `new_database.sql` schema for the **Core Catalog & Discovery** domain. This is the most complex refactoring phase, as it involves fundamentally changing how files, tracks, and releases relate to each other.

### 1. Overview of Changes
The catalog domain has undergone a major normalization process:
- **Files are Domain-Separated**: The monolithic `files` table is gone. Assets are now strongly typed into `audio_files`, `image_files`, and `document_files`.
- **Tracks are Decoupled**: The `tracks` table no longer stores technical metadata, and it no longer directly references a `release_id` or `label_id`.
- **Relationship Shift**: Track-to-Release and Track-to-Contributor relationships are now managed entirely through junction tables (`release_tracks`, `track_contributors`).
- **Discovery & Playlists**: Playlists, track ratings, and user engagements (favorites/follows) are structured with `INT UNSIGNED` foreign keys and optimized for fast lookups.

---

### 2. File-by-File Implementation Plan

#### A. SQLAlchemy Models (`app/models/`)

**1. `app/models/track.py`**
*   **Target Models**: `Track`, `TrackContributor` (New)
*   **Required Updates**:
    *   **Primary Keys**: Update `id` to `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Removed Columns**: Delete `duration_seconds`, `duration_iso`, `file_size_bytes`, `checksum_md5`, `checksum_sha256`, `audio_codec`, `sample_rate`, `bit_depth`, `channels`, `release_id`, `label_id`, `genre_id`.
    *   **Added Columns**: Add `duration_ms` (`INTEGER(unsigned=True)`).
    *   **New Junction Model**: Create the `TrackContributor` model to map `track_id` and `person_id` (both `INT UNSIGNED`).
    
**2. `app/models/genre.py`**
*   **Target Models**: `Genre`
*   **Required Updates**:
    *   **Primary Keys**: Update `id` to `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Note**: `genre_id` has been removed from `tracks`. Tracks are now classified via Playlist/Release context rather than a strict, single `genre_id`.

**3. `app/models/release.py`**
*   **Target Models**: `Release`, `ReleaseTrack` (New), `ReleaseContributor` (New)
*   **Required Updates**:
    *   **Primary Keys**: Update `id` to `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **New Junction Models**: 
        - Create `ReleaseTrack` to map `release_id` and `track_id`, including `disc_num` and `track_num`.
        - Create `ReleaseContributor` to map `release_id` and `person_id`.

**4. `app/models/file.py` (Major Refactor)**
*   **Target Models**: Remove `File`. Create `AudioFile`, `ImageFile`, `DocumentFile`.
*   **Required Updates**:
    *   **AudioFile**: Link specifically to `track_id` (`INT UNSIGNED`). Store audio-specific metadata (`audio_codec`, `duration_ms`).
    *   **ImageFile**: Standalone table. Store image-specific metadata (`image_width`, `color_depth`).
    *   **DocumentFile**: Standalone table with optional `track_id`.

**5. `app/models/playlist.py` & Engagements (New additions)**
*   **Target Models**: `Playlist`, `PlaylistTrack`, `UserTrackEngagement`, `TrackRating`
*   **Required Updates**:
    *   **Primary Keys**: Update `id` to `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Foreign Keys**: Ensure `user_id`, `track_id`, and `playlist_id` use `Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey(...))`. 
    *   **Engagements**: Ensure `UserTrackEngagement` uses a composite primary key (`user_id`, `track_id`) to prevent duplicate favorites.

#### B. Pydantic Schemas (`app/schemas/`)

**1. `app/schemas/track.py`**
*   **Required Updates**:
    *   Remove legacy fields (e.g., `release_id`, `duration_seconds`).
    *   Add nested schemas to represent `contributors` (mapped via junction) and `audio_files` (mapped via foreign key on `audio_files`).

**2. `app/schemas/release.py`**
*   **Required Updates**:
    *   Add a nested list of `ReleaseTrack` schemas to accurately return the tracklist, sorted by `disc_num` and `track_num`.

#### C. Data Access Layer (`app/repositories/`)

**1. `app/repositories/track_repository.py`**
*   **Target Functions**: `get_track_with_metadata()`
*   **Required Updates**:
    *   **Async execution**: Require `AsyncSession` for executing the queries via `await session.execute(select(...))`.
    *   Rewrite `JOIN` logic using SQLAlchemy 2.0 explicit joins (`select(Track).join(AudioFile)...`). Instead of joining a generic `files` table, explicitly join `audio_files` where `asset_class='Master'`.
    *   Instead of joining `artists`, join `track_contributors` to get the master artist list.

**2. `app/repositories/release_repository.py`**
*   **Target Functions**: `get_release_tracks()`
*   **Required Updates**:
    *   Rewrite logic to query the `release_tracks` junction table ordered by `disc_num` and `track_num`.

**3. `app/repositories/file_repository.py`**
*   **Target Functions**: `save_file_record()`, `get_file_by_id()`
*   **Required Updates**:
    *   Split the repository into `AudioFileRepository`, `ImageFileRepository`, etc., ensuring type-safe inserts into the specialized tables.

**4. `app/repositories/playlist_repository.py`**
*   **Target Functions**: `get_playlist_tracks()`, `add_track_to_playlist()`
*   **Required Updates**:
    *   Rewrite `JOIN` logic to traverse `playlist_tracks` correctly. Position must now be stored as `DECIMAL(12,6)` to allow efficient re-ordering without massive updates.

#### D. Business Logic (`app/services/`)

**1. `app/services/catalog_service.py` (or similar)**
*   **Target Functions**: `create_track()`, `create_release()`
*   **Required Updates**:
    *   When creating a track, the duration must be saved as `duration_ms`.
    *   Creating a release now requires a multi-step transaction: 
        1. Insert `Release`.
        2. Insert `ImageFile` for the cover art.
        3. Insert into `release_files` to map the cover art to the release.
        4. Insert into `release_tracks` for every track included in the release.

#### E. API Routers (`app/api/routers/`)

**1. `app/api/routers/tracks.py` & `releases.py`**
*   **Required Updates**:
    *   Ensure the API payload validation correctly accepts the updated Pydantic schemas. The frontend client will need to adapt to receiving `duration_ms` instead of `duration_seconds` and navigating nested contributor arrays.

---

### 3. Migration Checklist & Secondary Verification

To ensure catalog integrity is maintained, verify the following:
- [ ] **Type Match Check**: Are all `track_id`, `release_id`, `playlist_id`, and `person_id` foreign keys updated to `INT UNSIGNED`?
- [ ] **Data Loss Check**: Do the SQLAlchemy relationships correctly specify `cascade="all, delete-orphan"` for `ReleaseTrack` and `TrackContributor` to prevent orphaned rows?
- [ ] **Audio Relationship**: Does `Track` have a `uselist=True` relationship to `AudioFile` to handle multiple asset classes (e.g., 'Master' vs 'StreamingProfile')?
- [ ] **Cover Art Map**: Is the cover art lookup explicitly routing through `release_files` -> `image_files`?
