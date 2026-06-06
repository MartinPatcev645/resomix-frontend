# Partner Processing Pipeline — Admin-Controlled Track Processing

## Context

The earlier session added a call to `POST /internal/ingest/add-vector` directly inside `ingestion_service.py` immediately after CSV ingestion. This is **incorrect**: `add-vector` requires `.npy` embedding files to already exist on Hetzner's disk, but at ingestion time only metadata has been saved to MariaDB — no audio processing has happened yet. The call silently returns 404 for every track and wastes HTTP requests.

The real pipeline for partner-ingested tracks is:

```
SFTP upload (audio + CSV)
  → CSV ingestion → MariaDB (done ✅)
  → [missing] Embedding generation (reads audio from disk, calls embed_server, saves .npy)
  → [missing] Preview MP3 generation (concurrent with embeddings)
  → [missing] Peaks generation (reads audio/preview from disk)
  → [missing] Segment/HLS generation (from preview MP3)
  → [missing] FAISS indexing via add-vector (only after .npy exists)
```

None of this middle pipeline is triggered, tracked, or admin-controllable. This plan adds:
1. Fix: remove the premature `add-vector` call from ingestion
2. Two new DB tables to track processing state per-track and per-job
3. One new Hetzner endpoint for batch embedding generation from disk
4. New admin routes in B2B to trigger and monitor each pipeline stage

---

## Fix: Remove Premature `add-vector` Call

**File**: `basic_fastapi_server_resomix/app/services/ingestion_service.py`

Remove the entire block at **lines 407–437** (the `_sim_url`/`_api_key` httpx loop that calls `add-vector` for each track × engine). Replace it with the new `track_processing_status` row creation described below. ✅ Verified: this block lives in the success branch immediately after the `track.indexed` webhook loop (line 395–405), inside `try:` / before the `except Exception` at line 439.

Also remove `import httpx` (line 19) and `from app.core.config import settings` (line 21). ✅ Verified safe: `httpx` is used ONLY in this block; `settings.` appears nowhere else in the file. Both are dead after removal.

⚠️ Note on the replacement row-creation snippet: `tracks_to_insert` is `List[(Track, audio_fn)]` and `track.id` is already populated (the success loop at line 355–357 does `db.add(track)` + `await db.flush()`). So the `TrackProcessingStatus` rows can be created in that same loop (cleanest) or in a follow-up loop before the final `await db.commit()` at line 379. Prefer adding them inside the existing `for track, audio_fn in tracks_to_insert:` loop right after `db.add(new_audio)`, then the existing commit persists everything atomically.

---

## A. New DB Tables — `basic_fastapi_server_resomix` (Alwyzon)

### Table 1: `track_processing_status`

One row per track, tracks the state of each pipeline stage.

**File to create**: `app/models/track_processing_status.py`

```python
class TrackProcessingStatus(Base):
    __tablename__ = "track_processing_status"

    id              Mapped[int]            # PK, unsigned INT, autoincrement
    track_id        Mapped[int]            # FK → tracks.id, unique, indexed
    partner_id      Mapped[int]            # FK → partners.id, indexed
    ingest_log_id   Mapped[int | None]     # FK → ingest_logs.id, nullable
    audio_filename  Mapped[str | None]     # original audio filename from CSV batch

    embedding_status  Mapped[str]  # Enum: pending/processing/completed/failed, default="pending"
    peaks_status      Mapped[str]  # Enum: pending/processing/completed/failed, default="pending"
    segments_status   Mapped[str]  # Enum: pending/processing/completed/failed, default="pending"
    faiss_indexed     Mapped[bool]  # default=False

    embedding_error   Mapped[str | None]   # TEXT, nullable
    peaks_error       Mapped[str | None]
    segments_error    Mapped[str | None]

    embedding_completed_at  Mapped[datetime | None]
    peaks_completed_at      Mapped[datetime | None]
    segments_completed_at   Mapped[datetime | None]
    faiss_indexed_at        Mapped[datetime | None]

    created_at  Mapped[datetime]  # server_default
    updated_at  Mapped[datetime]  # onupdate
```

### Table 2: `partner_processing_jobs`

One row per admin-triggered batch job.

**File to create**: `app/models/partner_processing_job.py`

```python
class PartnerProcessingJob(Base):
    __tablename__ = "partner_processing_jobs"

    id             Mapped[int]         # PK, BIGINT unsigned, autoincrement
    partner_id     Mapped[int]         # FK → partners.id, indexed
    ingest_log_id  Mapped[int | None]  # FK → ingest_logs.id — scope this job to a specific batch
    job_type       Mapped[str]         # Enum: embeddings/peaks/segments/faiss_index
    status         Mapped[str]         # Enum: pending/running/completed/failed/partial, default="pending"
    total_tracks   Mapped[int]         # how many tracks to process
    processed_tracks Mapped[int]       # default=0, incremented as each track completes
    failed_tracks  Mapped[int]         # default=0
    error_details  Mapped[dict | None] # JSON — list of per-track errors for failed ones
    triggered_by   Mapped[str | None]  # admin username or "system"
    created_at     Mapped[datetime]
    started_at     Mapped[datetime | None]
    completed_at   Mapped[datetime | None]
```

### Migration

**File to create**: `alembic/versions/{hash}_add_partner_processing_tables.py`

Create both tables following the existing Alembic pattern (see `ef7999c3c2ca_add_stripe_columns.py` as reference). Add `downgrade()` that drops both tables in reverse order.

### Wire into ingestion

**File**: `app/services/ingestion_service.py`

After the DB commit for successful tracks (replacing the removed `add-vector` block), create one `TrackProcessingStatus` row per track:

```python
from app.models.track_processing_status import TrackProcessingStatus
for track, audio_fn in tracks_to_insert:
    db.add(TrackProcessingStatus(
        track_id=track.id,
        partner_id=partner_id,
        ingest_log_id=log_entry.id,
        audio_filename=audio_fn,
    ))
await db.commit()
```

---

## B. New Hetzner Endpoint — Batch Embeddings From Disk

**File**: `resomix-similarity-open/app/api/internal.py`

Add `POST /internal/process/batch-embeddings` (protected by `verify_internal_api_key`).

**Request schema** (add to `app/schemas/internal.py`):
```python
class BatchEmbeddingItem(BaseModel):
    track_uuid: str
    audio_filename: str   # just the filename, no path

class BatchEmbeddingsRequest(BaseModel):
    partner_id: int
    tracks: List[BatchEmbeddingItem]

class BatchEmbeddingResult(BaseModel):
    track_uuid: str
    status: str            # "success" | "failed"
    error: str | None
    embedding_maest: bool  # was maest .npy written?
    embedding_discogs: bool

class BatchEmbeddingsResponse(BaseModel):
    status: str
    partner_id: int
    total: int
    succeeded: int
    failed: int
    results: List[BatchEmbeddingResult]
```

**Endpoint logic**:
1. For each `(track_uuid, audio_filename)`:
   a. Resolve audio path: `Path(settings.partner_sftp_root) / str(partner_id) / "incoming" / audio_filename`
      - **Path-traversal guard**: reject if `audio_filename` contains `/`, `\`, or `..`, or if the resolved path is not under the partner's incoming dir → return that track as `status="failed"` (or 400 for the whole request per the path-traversal test).
   b. Read audio bytes from disk in a threadpool (`run_in_threadpool`). Missing file → that track `status="failed"`, continue.
   c. Generate dual embeddings via the instance method `embedding_service.generate_dual_embeddings_from_bytes(audio_bytes, filename=audio_filename)`.
      - ⚠️ CORRECTION: there is no bare `generate_dual_embeddings(file_bytes)`. The module-level fn is `generate_dual_embeddings(audio_bytes, filename, embed_server, embed_endpoint)`; the instance wrapper `generate_dual_embeddings_from_bytes()` on the global `embedding_service` handles initialization + `embed_server`/`embed_endpoint` config. Use the instance wrapper.
      - Returns `(maest (1,768), discogs (1,1280), timings)`.
   d. Save MAEST vector: `{partner_data_root}/{partner_id}/embeddings/maest/{track_uuid}.npy` (use `save_vector_to_file` from `embedding_preview_service.py`, or `np.save` + `os.makedirs`).
   e. Save Discogs vector: `{partner_data_root}/{partner_id}/embeddings/discogs/{track_uuid}.npy`
   f. Also generate + save a preview MP3.
      - ⚠️ CORRECTION: there is no `preview_service.generate_preview_bytes()`. Use `process_audio_to_mp3_bytes(input_audio_bytes=audio_bytes, bitrate="128k", ffmpeg_exe=settings.ffmpeg_exe, timeout_seconds=300)` imported from `app/services/preview_service.py`, then write the returned bytes to `{upload_tracks_preview_audio_location}/{track_uuid}.mp3`. (This mirrors `EmbeddingPreviewService._generate_preview_from_original`.)
   g. Append result to list
2. Return `BatchEmbeddingsResponse` with per-track results

**Error handling**: wrap each track in try/except, log and add to `failed` count — do not abort the batch.

**Existing services to reuse** (verified):
- `app/services/embedding_service.py` → `embedding_service.generate_dual_embeddings_from_bytes(audio_bytes, filename)` (global instance)
- `app/services/preview_service.py` → `process_audio_to_mp3_bytes(...)` for the preview MP3
- `app/services/embedding_preview_service.py` → `save_vector_to_file(vector, filename, vectors_dir_path)` helper
- `app/core/config.py` → `partner_sftp_root` (default `/srv/sftp/partners`), `partner_data_root` (default `/srv/resomix/partners`), `upload_tracks_preview_audio_location`, `embed_server`, `embed_endpoint`, `ffmpeg_exe` — all confirmed to exist

---

## C. New B2B Admin Routes — Processing Control

**New file**: `app/api/routers/admin/processing.py`

⚠️ CORRECTION — router prefix & auth: Because endpoint #4 (`/admin/processing/jobs/{job_id}`) is **not** partner-scoped, the router cannot use a `{partner_id}` prefix. Use `prefix="/admin"` and write full per-route paths (`/partners/{partner_id}/processing/...` and `/processing/jobs/{job_id}`). Auth follows the existing admin pattern: `current_admin: User = Depends(require_admin)` where `require_admin` is imported from `app.api.dependencies.auth` (NOT a bare `require_admin()` call). DB session via `Depends(get_database_session)` from `app.api.dependencies.database`. `triggered_by` = `current_admin.username` (or email).

**New service**: `app/services/partner_processing_service.py`

### Endpoints

#### 1. `GET /api/v1/admin/partners/{partner_id}/processing/status`
Returns aggregate counts per stage:
```json
{
  "partner_id": 5,
  "total_tracks": 340,
  "embeddings": { "pending": 120, "completed": 200, "failed": 20 },
  "peaks":       { "pending": 200, "completed": 140, "failed":  0 },
  "segments":    { "pending": 200, "completed": 140, "failed":  0 },
  "faiss_indexed": 140
}
```
Queries `track_processing_status` with GROUP BY.

#### 2. `POST /api/v1/admin/partners/{partner_id}/processing/jobs`
Start a new processing job. Body:
```json
{
  "job_type": "embeddings",        // embeddings | peaks | segments | faiss_index
  "ingest_log_id": 42              // optional — scope to a specific batch
}
```
**Guard for `faiss_index`**: before creating the job, verify that no tracks in scope have `embedding_status != completed`. If any do, return 422 with message "Embeddings must complete before FAISS indexing."

Service logic for each `job_type` (⚠️ corrected request shapes & timeouts — all verified against the Hetzner routers):
- **embeddings**: create job → `POST /internal/process/batch-embeddings` (Bearer `hetzner_internal_api_key`) with `{partner_id, tracks:[{track_uuid, audio_filename}]}` → update `track_processing_status.embedding_status` per result → mark job completed/partial. Use a long client timeout (embeddings are CPU/GPU-bound; suggest 300s+, or make this fire-and-forget with the Hetzner endpoint reporting back).
- **peaks**: create job → `POST /playlist_peaks` with body `{"track_uuids": [...]}` (field name is `track_uuids`, NOT `uuids`). ⚠️ The endpoint validates each UUID is a **24-char hex string** and accepts **1–100** tracks per request → chunk >100 and validate format. It IS fire-and-forget (returns immediately, peaks generated in a background task) → mark `peaks_status=completed` optimistically → job = completed.
- **segments**: create job → `POST /previews-segment/` with body `{"uuids": [...]}` (field name is `uuids`, max **300** per request). ⚠️ This endpoint is **NOT immediate** — it blocks for up to **90 seconds** (`await asyncio.sleep(90)`) returning partial progress, then continues in the background. The HTTP client timeout for this call MUST be > 90s (use 120s). Also: segments require the preview MP3 to already exist (the batch-embeddings step writes it to `upload_tracks_preview_audio_location`), so segments must run AFTER embeddings. ⚠️ RISK to confirm at implementation: `/previews-segment/` runs `create_segments(..., source="similarity")` — verify the "similarity" source reads previews from `upload_tracks_preview_audio_location` (UPLOADS); if it reads a different dir, partner previews won't be found.
- **faiss_index**: create job → `POST /internal/ingest/add-vector` (Bearer auth) for each track with `embedding_status=completed`, once per engine (`maest`, `discogs`) → update `faiss_indexed` → job = completed/partial. The `.npy` files now exist (written by the embeddings job), so the previous 404 problem is resolved.

#### 3. `GET /api/v1/admin/partners/{partner_id}/processing/jobs`
List all jobs for the partner, newest first. Supports `?job_type=` and `?status=` filters.

#### 4. `GET /api/v1/admin/processing/jobs/{job_id}`
Get a specific job with full `error_details`.

### Register router

⚠️ CORRECTION — routers are NOT registered in `app/main.py`. The actual registration lives in **`app/api/routers/__init__.py`**, in the `v1_routers` list (each tuple `(router, V1_PREFIX)` where `V1_PREFIX = "/api/v1"`). To wire the new router:
1. `app/api/routers/admin/__init__.py` — add `from .processing import router as admin_processing_router` and append `"admin_processing_router"` to `__all__`.
2. `app/api/routers/__init__.py` — add `from .admin.processing import router as admin_processing_router` and add `(admin_processing_router, V1_PREFIX)` to the `v1_routers` list.
(No edit to `app/main.py` is needed — it iterates `v1_routers`.)

---

## D. Update Route Wiring Checklist

| Call | From | To | Auth | Status after this plan |
|---|---|---|---|---|
| `POST /internal/ingest/add-vector` | B2B (processing job) | Media server | Bearer key | ✅ Called only when embeddings confirmed |
| `POST /internal/process/batch-embeddings` | B2B (processing job) | Media server | Bearer key | 🆕 New endpoint |
| `POST /playlist_peaks` | B2B (processing job) | Media server | Origin header | ✅ Existing — body `{track_uuids:[...]}`, 1–100 24-char-hex UUIDs, fire-and-forget |
| `POST /previews-segment/` | B2B (processing job) | Media server | Origin header | ✅ Existing — body `{uuids:[...]}`, max 300, ⚠️ blocks up to 90s (client timeout >90s) |

---

## E. Tests to Add

### B2B — `tests/api/test_partner_processing.py`

| Test | What it checks |
|---|---|
| `test_create_embeddings_job_success` | POST with valid partner_id + job_type="embeddings" → 200, job created with status=pending |
| `test_create_faiss_job_blocked_when_embeddings_pending` | POST job_type="faiss_index" when tracks have embedding_status=pending → 422 guard fires |
| `test_create_faiss_job_allowed_when_embeddings_complete` | POST job_type="faiss_index" when all embeddings complete → 200 |
| `test_get_processing_status_counts` | GET status returns correct aggregate counts per stage |
| `test_list_jobs_filters` | GET jobs with ?job_type= and ?status= filters return correct subsets |
| `test_get_job_by_id` | GET /jobs/{id} returns full job including error_details JSON |
| `test_processing_job_cross_partner_denied` | Admin of partner A cannot GET jobs for partner B (403) |

### B2B — `tests/unit/services/test_partner_processing_service.py`

| Test | What it checks |
|---|---|
| `test_track_processing_status_created_after_ingestion` | After `process_ingestion_batch`, `track_processing_status` rows exist for all tracks with all stages pending |
| `test_no_add_vector_called_during_ingestion` | Confirm `add-vector` is NOT called during ingestion (mock httpx, assert not called) |

### Hetzner — `tests/test_batch_embeddings.py`

| Test | What it checks |
|---|---|
| `test_batch_embeddings_creates_npy_files` | Mock embed_server, mock audio read; confirm .npy files written to correct partner paths |
| `test_batch_embeddings_missing_audio_file` | One track has no audio file → that track returns status=failed, others succeed |
| `test_batch_embeddings_embed_server_error` | embed_server returns 500 → that track fails gracefully, job continues |
| `test_batch_embeddings_path_traversal_blocked` | audio_filename="../../../etc/passwd" → 400 |

---

## Files to Create/Edit

| Action | File |
|---|---|
| Create | `basic_fastapi_server_resomix/app/models/track_processing_status.py` |
| Create | `basic_fastapi_server_resomix/app/models/partner_processing_job.py` |
| Create | `basic_fastapi_server_resomix/alembic/versions/{hash}_add_partner_processing_tables.py` |
| Create | `basic_fastapi_server_resomix/app/services/partner_processing_service.py` |
| Create | `basic_fastapi_server_resomix/app/api/routers/admin/processing.py` |
| Edit   | `basic_fastapi_server_resomix/app/services/ingestion_service.py` (remove add-vector block, add status row creation) |
| Edit   | `basic_fastapi_server_resomix/app/models/__init__.py` (register new models) |
| Edit   | `basic_fastapi_server_resomix/app/main.py` (register processing router) |
| Create | `resomix-similarity-open/app/schemas/internal.py` (add batch embedding schemas) |
| Edit   | `resomix-similarity-open/app/api/internal.py` (add batch-embeddings endpoint) |

---

## Verification

1. Run migrations → confirm both tables exist in DB
2. Ingest a CSV batch → confirm `track_processing_status` rows created, `embedding_status=pending` for all
3. Confirm NO HTTP call made to Hetzner during ingestion (check logs)
4. POST `job_type=embeddings` for that partner → confirm Hetzner receives the batch request, .npy files written
5. GET processing status → confirm `embeddings.completed` count matches
6. POST `job_type=faiss_index` before embeddings → confirm 422 guard
7. POST `job_type=faiss_index` after embeddings → confirm `faiss_indexed=true` for tracks
8. Run all new tests: `pytest tests/api/test_partner_processing.py tests/unit/services/test_partner_processing_service.py -v`
