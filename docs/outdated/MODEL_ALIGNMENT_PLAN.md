# Model Alignment & Synchronization Roadmap (V3 - Final)

This document outlines the comprehensive phased approach to synchronize SQLAlchemy models, repositories, and services with the finalized database schema (`new_database.sql`).

---

## Phase 1: Core Catalog Alignment (COMPLETED)
*Goal: Fix broken relationships and naming mismatches across the entire stack.*

### 🛠️ Model Changes
- [x] **Track Model (`track.py`)**
    - [x] Remove redundant `TrackArtist` class.
    - [x] Update `artists` relationship to use `secondary="recording_artists"`.
    - [x] Rename `type` field to `track_type`.
    - [x] Update `album_id` to `release_id` (matching SQL).
    - [x] Update docstring to match actual `new_database.sql` schema.
- [x] **Release Model (`release.py`)**
    - [x] Add missing `p_line` and `c_line` columns.
    - [x] Change `is_compilation` and `is_active` from `Integer` to `Boolean`.
- [x] **Genre Model (`genre.py`)**
    - [x] Add `parent_id` column and self-referential relationship.

### 🔗 Downstream Effects (Business Logic)
- [x] **Repositories**: 
    - [x] Update `playlist_repository.py`, `similarity_repository.py`, and `track_repository.py` to replace `JOIN track_artists` with `JOIN recording_artists` in raw SQL queries.
    - [x] Update `cart_repository.py` to use `RecordingArtist` associations.
    - [x] Renamed `album_repository.py` to `release_repository.py`.
- [x] **Services**:
    - [x] Update `TrackUploadService` to use `release_id` instead of `album_id`.
    - [x] Update `TrackUploadService` to use `RecordingArtist` junction instead of `TrackArtist`.
    - [x] Update `SearchService` (Demo Mode) to join on `recording_artists` and filter by `track_type`.

---

## Phase 2: Ingestion & Metadata Foundation
*Goal: Bridge the gap between the Seeder and the Application.*

### 🛠️ Model Changes
- [ ] **[NEW] IngestLog Model (`ingest_log.py`)**
    - [ ] Map to `ingest_log` table (used by seeder).
- [ ] **Message Model (`message.py`)**
    - [ ] Add proper `ForeignKey("ingest_log.id")` and relationship.
- [ ] **[NEW] IngestionError Model (`ingestion_error.py`)**
    - [ ] Map to `ingestion_errors` table.
- [ ] **[NEW] Resource Model (`resource.py`)**
    - [ ] Map to `resources` table.

### 🔗 Downstream Effects (Business Logic)
- [ ] **Metadata Service**: 
    - [ ] Potentially update `MetadataService` to link extracted metadata to an `IngestLog` record.

---

## Phase 3: Rights & Deals (New Functionality)
*Goal: Lay the groundwork for DDEX compliance and royalty calculations.*

### 🛠️ Model Changes
- [ ] **[NEW] Rights Models**: Create `RightsController`, `Contributor`, `RecordingContributor`, `PublisherShare`.
- [ ] **[NEW] Deal Models**: Create `Deal`, `DealTerritory`, `DealUseType`, `RoyaltyRate`, `ReleaseDeal` junction.

### 🔗 Downstream Effects (Business Logic)
- [ ] **Future-Proofing**: These models enable future development of the royalty calculation engine without database migrations.

---

## Phase 4: Telemetry & Analytics Alignment
*Goal: Ensure playback reporting is consistent with industry-standard naming.*

### 🛠️ Model Changes
- [ ] **ConsumptionEvent Model (`consumption_event.py`)**
    - [ ] Rename `timestamp` to `event_timestamp` (matching SQL).
- [ ] **Rating Models (`rating.py`)**
    - [ ] Verify `TrackRating` and `PlaylistRating` against SQL (especially nullable fields).
- [ ] **Playlist Models (`playlist.py`)**
    - [ ] Ensure `playlist_type` ENUM matches SQL exactly.

### 🔗 Downstream Effects (Business Logic)
- [ ] **Model Methods**: Update `ConsumptionEvent.to_dict()` to return `event_timestamp`.
- [ ] **Repositories**: Update `telemetry_repository.py` if any queries use the renamed field.

---

## Phase 5: E-Commerce & Admin Infrastructure
*Goal: Fix Stripe gaps and complete the platform management system.*

### 🛠️ Model Changes
- [ ] **Ecommerce Models (`ecommerce.py`)**
    - [ ] Remove `payment_intent_id` and `base_currency` from `Order` (or add to SQL).
    - [ ] Remove `stripe_coupon_id` and `stripe_promo_code_id` from `PromoCode` (or add to SQL).
- [ ] **[NEW] Admin & Reporting Models**:
    - [ ] Create `ManualTakedown`, `SFTPUser`, `GeneratedReport`, `LabelPayout`, `ACRInfringementLog`.

### 🔗 Downstream Effects (Business Logic)
- [ ] **Purchase Service**: Update `handle_dispute` in `purchase_service.py` to match the final column naming decision.
- [ ] **Order Service**: Ensure `stripe_session_id` is correctly persisted during fulfillment.

---

## Final Verification
1. **Migrations**: Ensure `alembic` is satisfied with the model changes.
2. **Seeding**: Run `make seed` to ensure insertion logic still flows.
3. **API Tests**: Run search and track retrieval endpoints to verify `recording_artists` joins.
