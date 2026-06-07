# Partner Processing Pipeline — Admin-Controlled Ingestion, Processing & Track Lifecycle

> Scope: SFTP folder reconciliation (§0) · processing DB tables (§A) · Hetzner batch-embeddings &
> remove-vector (§B/§G4) · admin processing jobs (§C) · admin ingestion-flow control (§F) ·
> admin set-live/stop track control (§G) · .env-driven Hetzner paths (§H) · full success +
> intentional-error tests for every route.

> ### ⚠️ UPDATE (June 2026) — Partner-scoping refactor impact
>
> This plan was written **before** the partner-scoped storage refactor landed. Since then,
> all server-managed assets on Hetzner moved from flat/global directories into a single
> per-partner tree, resolved exclusively through `app/core/partner_paths.py`:
>
> ```
> {partner_data_root}/{partner_id}/internal/
>     embeddings/{maest,discogs}/{uuid}.npy
>     previews/{uuid}.mp3
>     segments/{uuid}/{uuid}_NNN.ts + hls.m3u8
>     peaks/{uuid}.json
>     indexes/faiss_{engine}_{partner_id}.index
>     catalog/{engine}_catalog_{partner_id}.json
> ```
>
> **What this changes in the sections below (the old absolute paths are now WRONG):**
> 1. **§B (batch-embeddings) — save paths:** use `partner_paths.embedding_path(partner_id, engine, uuid)`
>    (→ `internal/embeddings/{engine}/{uuid}.npy`) and `partner_paths.preview_path(partner_id, uuid)`
>    (→ `internal/previews/{uuid}.mp3`). Do **not** write to the legacy global
>    `{partner_data_root}/{pid}/embeddings/...` or `upload_tracks_preview_audio_location`.
> 2. **§B (audio source):** the SFTP layout is `partner_paths.sftp_dir(partner_id, env)` =
>    `{partner_sftp_root}/{partner_id}/{test|live}` — there is no `incoming/` subfolder.
>    Pass the `env` ("test"/"live") through the request, default "live".
> 3. **§C peaks (`POST /playlist_peaks`)** now **requires `partner_id`** in the body.
> 4. **§C segments (`POST /previews-segment/`)** — the old `source` enum
>    ("uploads"/"monthly"/"similarity") selector is **gone**; the endpoint now **requires
>    `partner_id`** and reads previews from `partner_paths.preview_path(partner_id, uuid)`
>    and writes segments to `partner_paths.segments_dir(partner_id, uuid)`. The §C-segments
>    "RISK to confirm" note about which dir `source="similarity"` reads is now moot.
> 5. **§C faiss_index (`POST /internal/ingest/add-vector`)** already passes `partner_id` and
>    reads `.npy` from `partner_paths.embedding_path(...)`. No change beyond ensuring the
>    embeddings job wrote to the partner-scoped path (point 1).
> 6. **Gap-4 (upload vs ingested):** partner *uploads* are stored under the same partner tree
>    but are **never FAISS-indexed** and are **excluded from similarity results** (DB filter
>    `track_type != UPLOAD`). This admin pipeline only processes **ingested/catalog** tracks.
>
> The DB-table design (§A), job/state machine (§C), and router wiring (§C "register router")
> are unaffected and remain valid. Update only the path/endpoint-shape details above when
> implementing.

---

## §0. SFTP Folder Structure — Reconciliation (MUST FIX FIRST)

> Discovered during investigation: the codebase currently has **two conflicting SFTP folder
> conventions**. Production readiness requires picking one and making every endpoint agree.

### The conflict

| Place | Convention it assumes |
|---|---|
| `resomix-similarity-open` `app/core/partner_paths.py` → `sftp_dir(pid, env)` | `{partner_sftp_root}/{pid}/{test,live}` ✅ (post-refactor canonical) |
| Hetzner `app/api/internal.py` `POST /internal/partner/provision` | creates `test/` + `live/` ✅ (agrees) |
| Hetzner `app/api/internal.py` `POST /internal/provision-sftp-user` | creates `incoming/ processed/ error/ test/` ❌ (legacy) |
| Alwyzon `app/api/routers/internal/sftp.py` `.done` event hook | `batch_path = …/partners/{pid}/incoming` ❌ (legacy) |
| Alwyzon `app/services/sftp_service.py` `validate_incoming_batch(pid, batch_path)` | globs the `incoming/` folder ❌ (legacy) |
| Alwyzon `app/services/ingestion_service.py` `process_ingestion_batch` | reads CSV + audio from `batch_path` (whatever it's handed) — convention-neutral ✅ |

The audio files an admin processing job must read (§B batch-embeddings) live in whatever folder
the partner uploaded to. If provisioning makes `incoming/` but `partner_paths.sftp_dir()` points
at `test|live`, the embeddings job reads an **empty directory** and every track fails. This is a
hard blocker.

### The decision (canonical going forward)

Adopt the **`test` / `live`** convention everywhere. Rationale:
- It is already the post-refactor source of truth (`partner_paths.sftp_dir`, `VALID_SFTP_ENVS`).
- It matches the B2B product model: partners dry-run in `test/` (sandbox tier), then upload real
  catalog to `live/`.
- Processing/lifecycle state is tracked in **MariaDB** (`ingest_logs`, `ingestion_errors`,
  `track_processing_status`), so the legacy `processed/` + `error/` file-move folders are
  **unnecessary** — we never move files. Off-boarding stays "delete the partner folder".

```
{partner_sftp_root}/{partner_id}/
├── test/      # sandbox batches: audio files + manifest.csv + .done marker
└── live/      # production batches: audio files + manifest.csv + .done marker
```

A "batch" = a set of audio files + exactly one CSV manifest, finalized by uploading a `.done`
marker file (existing trigger). The `.done` file's directory determines the env.

### Required edits to reconcile (do these before §A–§E)

1. **Hetzner `app/api/internal.py` `/internal/provision-sftp-user`**: change the subdir list from
   `["incoming","processed","error","test"]` to `["test","live"]`. Keep chown/chmod. This makes it
   agree with `/internal/partner/provision`.
2. **Hetzner `tests/test_sftp_provisioning.py`**: update `mock_mkdir.call_count == 4` → `== 2`, and
   any assertion naming `incoming/processed/error` → `test/live`.
3. **Alwyzon `app/api/routers/internal/sftp.py` `.done` hook**: derive `env` from the event body's
   uploaded path (`body.get("path")`/`virtual_path` — if it contains `/live/` use `live`, if
   `/test/` use `test`, default `live`). Set
   `batch_path = f"{settings.sftp_base_path}/partners/{partner_id}/{env}"`. Pass `env` through to
   `validate_incoming_batch` and `process_ingestion_batch`.
4. **Alwyzon `app/services/sftp_service.py` `validate_incoming_batch`**: rename param semantics to a
   generic env-scoped `batch_path` (already generic) — no logic change needed beyond the caller now
   passing the `test|live` path. (Keep partial-upload + checksum + CSV-header checks.)
5. **Alwyzon `app/services/ingestion_service.py` `process_ingestion_batch`**: add an `env: str =
   "live"` param and persist it on each `TrackProcessingStatus` row (new `sftp_env` column, see §A)
   so the §C embeddings job knows which env folder to read audio from.
6. **Alwyzon `app/services/sftp_service.py` `provision_partner_sftp`**: home_dir stays
   `{settings.sftp_base_path}/partners/{partner.id}` (matches Hetzner `partner_sftp_root` default
   `/srv/sftp/partners` → `sftp_root(pid)`); the Hetzner side creates `test/live` under it. No
   path change, but assert the home_dir and the Hetzner `partner_sftp_root` resolve to the same
   place in `.env` (see §H).

---

## §0b. `test` vs `live` Ingestion Semantics (dry-run vs persist)

The two env folders behave **fundamentally differently** — this drives every downstream branch.

### `test/` = full dry-run + report, then discard
Goal: tell the partner/admin "would this batch succeed?" **without** persisting anything.
1. Validate the CSV (headers, ISRC, required fields, audio presence) — same checks as live.
2. Actually run **embedding + preview + segment generation** so audio that *parses* but *fails to
   process* (corrupt, unsupported codec, silent) is caught — but generate into a **temp dir**.
3. Produce a **report** (per-track ok/fail + reason) persisted to `ingest_logs`
   (status `COMPLETED`/`FAILED`) + `ingestion_errors` rows.
4. **Delete every generated artifact** (the temp embeddings/preview/segments). **Never** touch the
   partner's original uploaded files.
5. Do **NOT** create `tracks`, `audio_files`, `track_processing_status`, or FAISS rows. The whole
   DB write is the IngestLog + IngestionError report only (wrap track inserts in a rollback).

Implementation: ingestion runs in `dry_run=True` mode when `env=="test"`; the Hetzner
`/internal/process/batch-embeddings` call is made with `env="test"` → Hetzner generates to a
`tempfile.TemporaryDirectory()`, validates, and deletes — writing **nothing** under `partner_paths`.

### `live/` = validate + full persist
1. Validate (same checks).
2. Persist `tracks` + `audio_files`(Master) + `track_processing_status` rows (existing live path).
3. Admin (or auto) runs the processing jobs (§C): embeddings → peaks → segments → faiss_index,
   each persisting artifacts to `partner_paths` **and** registering a file-table row (§A2).
4. Admin sets tracks live (§G).

> `batch-embeddings` therefore needs the `env` flag (already added to its schema) to choose
> persist vs temp-and-delete. The §C embeddings job passes `env` from `track_processing_status.sftp_env`.

---

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
0. **Reconcile the conflicting SFTP folder conventions** (`incoming/processed/error/test` vs the
   canonical `test/live`) so provisioning, ingestion, and the processing job all read the same dir (§0)
1. Fix: remove the premature `add-vector` call from ingestion
2. Two new DB tables to track processing state per-track and per-job (incl. `sftp_env`), **plus**
   registering every generated artifact into the existing `audio_files`/`image_files`/`document_files`
   tables so the admin UI can browse them and we get analytics (§A2)
2b. `test/` = dry-run (validate + generate-to-temp + report + delete); `live/` = full persist (§0b)
3. One new Hetzner endpoint for batch embedding generation from disk (env-driven persist vs
   temp-and-delete) (+ a `remove-vector` for "stop")
3b. Jobs are **fire-and-forget**: POST returns a job id immediately; a background worker updates the
   job + per-track status rows (§C "Execution model")
4. New admin routes in B2B to trigger and monitor each pipeline stage (§C)
5. **Admin ingestion-flow control** — list/inspect/trigger/retry batches from the UI (§F)
6. **Admin track control** — set tracks live / stop them in search without deleting (§G)
7. **.env-driven path patterns on Hetzner** so local vs production differences are config, not code (§H)

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
    sftp_env        Mapped[str]            # "test" | "live" — which SFTP env the audio lives in (default "live")

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

### A2. Artifact registry — reuse `audio_files` / `image_files` / `document_files`

> Per product feedback: every **generated** asset should also get a row in the existing file
> tables so the **frontend admin panel can list them** and we get analytics for free. These tables
> already carry `partner_id`, `track_id`, `ingest_log_id`, `party_id`, `stored_path`, `mime_type`,
> `file_size_bytes`, checksums — exactly what a file browser needs.

Mapping of each generated artifact → table + categorizer:

| Artifact | Table | Categorizer value | mime_type |
|---|---|---|---|
| Uploaded master audio (already created by ingestion) | `audio_files` | `asset_subtype="master"` (asset_class stays `Master`) | audio/wav\|mpeg\|flac |
| Preview MP3 | `audio_files` | `asset_subtype="preview"` (asset_class `StreamingProfile`) | audio/mpeg |
| HLS playlist (`hls.m3u8`, one row per track) | `audio_files` | `asset_subtype="hls"` (asset_class `StreamingProfile`) | application/vnd.apple.mpegurl |
| Cover art | `image_files` | — | image/jpeg\|png |
| MAEST embedding `.npy` | `document_files` | `doc_type="embedding_maest"` | application/octet-stream |
| Discogs embedding `.npy` | `document_files` | `doc_type="embedding_discogs"` | application/octet-stream |
| Peaks `.json` | `document_files` | `doc_type="peaks"` | application/json |
| Ingestion report / manifest CSV | `document_files` | `doc_type="ingest_report"` / `"manifest_csv"` | text/csv |

**Schema churn (kept minimal, additive, nullable):**
- `audio_files`: add `asset_subtype VARCHAR(50) NULL` (existing `asset_class` enum is left untouched
  to avoid an enum ALTER on a populated table).
- `document_files`: add `doc_type VARCHAR(50) NULL`.
- `image_files`: no change needed (cover is the only image kind today; can categorize later).

**When rows are written:** only on the **live** path, as each processing job stage *completes*
(idempotent upsert keyed on `stored_path`, which already has a UNIQUE index). The test/dry-run path
writes **none** of these. Use a small helper in `partner_processing_service.py`:
`_register_artifact(db, table, *, track, ingest_log_id, partner_id, party_id, stored_path,
mime_type, size, subtype)` that does get-or-create by `stored_path`.

> Source of truth split (no duplication): `track_processing_status` = **stage state machine**
> (pending/processing/completed/failed, errors, timestamps, control). File tables = **artifact
> registry** (where the bytes are, how big, checksum) for the admin file browser + analytics. A
> stage is "done" per the status table; the file row is the evidence/locator.

### Migration

**File to create**: `alembic/versions/{hash}_add_partner_processing_tables.py`

- `revision = "<new hash>"`, `down_revision = "ef7999c3c2ca"` (current head — verified).
- Hand-write `upgrade()`/`downgrade()` following `ef7999c3c2ca_add_stripe_columns.py` — **do NOT use
  `alembic revision --autogenerate`** (per instruction). Use `op.create_table(...)` for the two new
  tables and `op.add_column(...)` for `audio_files.asset_subtype` + `document_files.doc_type`.
- `downgrade()` drops the two added columns then both tables in reverse order.
- Run with `.venv/bin/alembic upgrade head` (NOT a generate step). Verify with
  `docker exec -i resomix-test-db mariadb -uroot -ptest -e "SHOW TABLES FROM resomix_db LIKE '%processing%';"`
- **Update the seed** (`scripts/seed_data.py`) if it pre-creates partner/track fixtures, so a fresh
  seed leaves the new tables in a consistent (empty/pending) state.

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
        sftp_env=env,            # "test" | "live" — threaded from the .done hook (§0.5)
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
    env: str = "live"            # "test" | "live" — which SFTP env folder to read audio from
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

> **env-driven persist vs dry-run (§0b):** if `env=="test"`, all generated outputs (.npy ×2,
> preview .mp3, any segments) are written into a `tempfile.TemporaryDirectory()` and **deleted**
> when the request returns — nothing under `partner_paths` is created or modified. The response
> still reports per-track success/failure so the caller can build a dry-run report. If
> `env=="live"`, write to the partner-scoped `partner_paths` locations as below and keep them.
> Audio is **always** read from `partner_paths.sftp_dir(partner_id, env)` (so `test/` audio is
> validated against, just not persisted as artifacts).

1. For each `(track_uuid, audio_filename)`:
   a. Resolve audio path: `partner_paths.sftp_dir(partner_id, env) / audio_filename` where `env` is
      "test"/"live" from the request (default "live"). (Was: `{partner_sftp_root}/{pid}/incoming/...`.)
      - **Path-traversal guard**: reject if `audio_filename` contains `/`, `\`, or `..`, or if the resolved path is not under the partner's SFTP dir → return that track as `status="failed"` (or 400 for the whole request per the path-traversal test).
   b. Read audio bytes from disk in a threadpool (`run_in_threadpool`). Missing file → that track `status="failed"`, continue.
   c. Generate dual embeddings via the instance method `embedding_service.generate_dual_embeddings_from_bytes(audio_bytes, filename=audio_filename)`.
      - ⚠️ CORRECTION: there is no bare `generate_dual_embeddings(file_bytes)`. The module-level fn is `generate_dual_embeddings(audio_bytes, filename, embed_server, embed_endpoint)`; the instance wrapper `generate_dual_embeddings_from_bytes()` on the global `embedding_service` handles initialization + `embed_server`/`embed_endpoint` config. Use the instance wrapper.
      - Returns `(maest (1,768), discogs (1,1280), timings)`.
   d. Save MAEST vector to `partner_paths.embedding_path(partner_id, "maest", track_uuid)`
      (→ `internal/embeddings/maest/{track_uuid}.npy`). Use `partner_paths.ensure_parent(...)` then `np.save`.
   e. Save Discogs vector to `partner_paths.embedding_path(partner_id, "discogs", track_uuid)`.
   f. Also generate + save a preview MP3.
      - ⚠️ CORRECTION: there is no `preview_service.generate_preview_bytes()`. Use `process_audio_to_mp3_bytes(input_audio_bytes=audio_bytes, bitrate="128k", ffmpeg_exe=settings.ffmpeg_exe, timeout_seconds=300)` imported from `app/services/preview_service.py`, then write the returned bytes to `partner_paths.preview_path(partner_id, track_uuid)` (→ `internal/previews/{track_uuid}.mp3`). (Was: `{upload_tracks_preview_audio_location}/{track_uuid}.mp3`.)
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

### Execution model — fire-and-forget (per product feedback)

Every job-creating route **returns immediately** with the new `partner_processing_jobs` row
(`status="pending"`, `id`), and the actual Hetzner calls run in the background. Poll status via
endpoint #4.

- The POST handler: validate guards → INSERT job row (`status="pending"`) → schedule the worker via
  FastAPI `BackgroundTasks.add_task(...)` → return `{job_id, status:"pending"}` (HTTP 202).
- The worker (in `partner_processing_service`): open its **own** `AsyncSessionLocal()` (the request
  session is closed by the time it runs), set `status="running"` + `started_at`, do the work,
  update `processed_tracks`/`failed_tracks`/`error_details` as it goes, then set
  `status` ∈ {`completed`,`partial`,`failed`} + `completed_at`. On unhandled exception → `failed`
  with the traceback summary in `error_details`.
- The worker updates `track_processing_status` per track **and** registers file-table rows (§A2)
  for live artifacts. All writes are idempotent so a retried job is safe.
- Concurrency guard: refuse to start a new job of the same `job_type` for the same
  `(partner_id, ingest_log_id)` while one is already `pending`/`running` → 409.

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
Returns **HTTP 202** with `{job_id, status:"pending"}` immediately (fire-and-forget; see Execution model). The work happens in the background and is observable via endpoint #4.

**Guard for `faiss_index`**: before creating the job, verify that no tracks in scope have `embedding_status != completed`. If any do, return 422 with message "Embeddings must complete before FAISS indexing."

**Artifact registration (live only):** as each stage completes for a track, the worker upserts the
corresponding file-table row (§A2): embeddings job → 2× `document_files` (maest/discogs) + 1×
`audio_files` preview; peaks job → `document_files` peaks; segments job → `audio_files` hls. The
test/dry-run path registers nothing.

Service logic for each `job_type` (⚠️ corrected request shapes & timeouts — all verified against the Hetzner routers):
- **embeddings**: create job → `POST /internal/process/batch-embeddings` (Bearer `hetzner_internal_api_key`) with `{partner_id, env, tracks:[{track_uuid, audio_filename}]}` (`env` taken from the in-scope `track_processing_status.sftp_env` — all rows in one batch share an env) → update `track_processing_status.embedding_status` per result → mark job completed/partial. Use a long client timeout (embeddings are CPU/GPU-bound; suggest 300s+, or make this fire-and-forget with the Hetzner endpoint reporting back).
- **peaks**: create job → `POST /playlist_peaks` with body `{"partner_id": <pid>, "track_uuids": [...]}` (field name is `track_uuids`, NOT `uuids`; **`partner_id` is now required**). ⚠️ The endpoint validates each UUID is a **24-char hex string** and accepts **1–100** tracks per request → chunk >100 and validate format. It IS fire-and-forget (returns immediately, peaks generated in a background task) → mark `peaks_status=completed` optimistically → job = completed.
- **segments**: create job → `POST /previews-segment/` with body `{"partner_id": <pid>, "uuids": [...]}` (field name is `uuids`, max **300** per request; **`partner_id` is now required**). ⚠️ This endpoint is **NOT immediate** — it blocks for up to **90 seconds** (`await asyncio.sleep(90)`) returning partial progress, then continues in the background. The HTTP client timeout for this call MUST be > 90s (use 120s). Also: segments require the preview MP3 to already exist; the batch-embeddings step writes it to `partner_paths.preview_path(partner_id, uuid)`, and `/previews-segment/` now reads previews from the same partner-scoped path (the old `source` selector is gone), so segments simply must run AFTER embeddings — the dir-mismatch risk no longer applies.
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
| `POST /playlist_peaks` | B2B (processing job) | Media server | Origin header | ✅ Existing — body `{partner_id, track_uuids:[...]}` (**partner_id now required**), 1–100 24-char-hex UUIDs, fire-and-forget |
| `POST /previews-segment/` | B2B (processing job) | Media server | Origin header | ✅ Existing — body `{partner_id, uuids:[...]}` (**partner_id now required**), max 300, ⚠️ blocks up to 90s (client timeout >90s) |

---

## F. Admin Ingestion-Flow Control

The `.done` SFTP hook auto-ingests, but the admin UI also needs to **trigger, monitor, and
re-run** ingestion without the partner re-uploading — and without a dev SSHing in. These routes
live in the same processing router (`app/api/routers/admin/processing.py`, `prefix="/admin"`,
auth `require_admin` + `require_permission("partners:manage")`, DB via `get_database_session`).

#### F1. `GET /api/v1/admin/partners/{partner_id}/ingestion/logs`
List `ingest_logs` for the partner, newest first. Filters: `?status=` (PROCESSING/COMPLETED/FAILED),
`?env=` (test/live). Returns `id, batch_filename, package_folder, status, track_count,
error_message, started_at, completed_at`. Reuse a new `IngestLogRepository` or query inline.

#### F2. `GET /api/v1/admin/ingestion/logs/{ingest_log_id}`
One log + its `ingestion_errors` rows (row_num, error_code, error_message, severity,
reference_node). 404 if not found; 403 if the log's `partner_id` ≠ a partner the admin may view.

#### F3. `POST /api/v1/admin/partners/{partner_id}/ingestion/trigger`
Manually kick off validation+ingestion for an env folder (the "ingest now" button). Body:
```json
{ "env": "live" }     // "test" | "live", default "live"
```
Service: resolve `batch_path = {sftp_base_path}/partners/{pid}/{env}`, then run the same
`validate_incoming_batch` → `process_ingestion_batch(..., env=env)` pipeline used by the hook,
in a FastAPI `BackgroundTasks`. Returns `{ "status": "started", "env": env, "batch_path": … }`.
Intentional errors: env not in {test,live} → 422; partner not found → 404.

#### F4. `POST /api/v1/admin/partners/{partner_id}/ingestion/{ingest_log_id}/retry`
Re-run ingestion for a previously FAILED batch (same `package_folder`/env stored on the log).
422 if the log is not in FAILED status. This addresses "set things live or stop stuff" — recover
from a bad batch from the UI rather than a shell.

---

## G. Admin Track Control — Set-Live / Stop

"Set things live or stop stuff from the UI" = toggle a track's visibility in similarity search
**without deleting** it. `tracks.is_active` (Boolean, indexed) is the live/stopped switch; FAISS
membership is the physical switch. Both must move together.

> **Search-visibility invariant:** a track is *live* when `is_active=True` **and** its vectors are
> in the partner FAISS index. *Stopped* = `is_active=False` **and** vectors removed from FAISS (so
> it cannot surface even if a stale index lingers). Enrichment already filters `track_type !=
> UPLOAD` (Gap 4); add `is_active=True` to the similarity-enrichment query as defense-in-depth.

Same router/auth as above.

#### G1. `POST /api/v1/admin/partners/{partner_id}/tracks/set-live`
Body:
```json
{ "track_ids": [1,2,3] }      // or { "ingest_log_id": 42 } to set a whole batch live
```
Per track: require `track_processing_status.faiss_indexed == True` (else 422 "track not indexed;
run faiss_index job first"); set `tracks.is_active = True`. Returns counts `{set_live, skipped}`.

#### G2. `POST /api/v1/admin/partners/{partner_id}/tracks/stop`
Set `tracks.is_active = False` for the given `track_ids` and call Hetzner
`POST /internal/ingest/remove-vector` (Bearer key) per track×engine to pull the vectors from FAISS.
⚠️ **Verify** a `remove-vector` internal endpoint exists on Hetzner; if not, add it next to
`add-vector` (it should call `partner_faiss_repository.remove_vector` + `partner_catalog_repository`
removal). Returns `{stopped, faiss_removed}`.

#### G3. `GET /api/v1/admin/partners/{partner_id}/tracks`
Paginated track listing for the admin UI with the live/stopped + processing state joined:
`track_id, uuid, isrc, title, display_artist, is_active, track_type, embedding_status,
faiss_indexed`. Filters `?is_active=`, `?faiss_indexed=`, `?search=`. This is the screen the admin
drives set-live / stop from.

#### G4. `add_vector` / `remove_vector` symmetry (Hetzner)
- `POST /internal/ingest/add-vector` — exists ✅ (used by faiss_index job).
- `POST /internal/ingest/remove-vector` — **add if missing.** Request `{partner_id, track_uuid,
  engine}`; remove the id64 from the partner FAISS index and drop the catalog row; idempotent
  (missing → 200 no-op, not 404, so "stop" is safe to retry).

---

## TODO (deferred — NOT in this pass)

> Per product feedback: **manually** provision the first few partners for now; do not build the
> self-serve SFTPGo admin yet. Captured here so it isn't lost.

- **Admin-driven SFTPGo provisioning UI.** SFTPGo is already running in Docker and fully functional;
  it exposes everything we need via its REST API (`settings.sftpgo_admin_url`). A future admin panel
  should let an operator, per partner: create the SFTPGo virtual user; choose which folders to
  auto-create and which to **hide** from the partner; restrict **allowed upload file types**
  (extensions/MIME); set the **max storage quota**; set IP allow-lists; rotate the SFTP password /
  public key. The Alwyzon `sftp_service.provision_partner_sftp` + Hetzner
  `/internal/provision-sftp-user` already cover the create path; this TODO is the richer control
  surface. **Out of scope for this pass.**

---

## H. .env-Driven Path Patterns (Hetzner)

Per the requirement "within Hetzner use .env for paths or path patterns because things differ
between local and production." Status + actions:

- ✅ Already .env-driven via `validation_alias` in `resomix-similarity-open/app/core/config.py`:
  - `PARTNER_SFTP_ROOT` → `partner_sftp_root` (default `/srv/sftp/partners`)
  - `PARTNER_DATA_ROOT` → `partner_data_root` (default `/srv/resomix/partners`)
  - `SHARED_ASSETS_ROOT` → `shared_assets_root` (used by `partner_paths.shared_segments_root`)
- ✅ `partner_paths.py` resolves **every** on-disk path from these settings — no hardcoded
  absolute paths. The §B batch-embeddings endpoint MUST go through `partner_paths` (not string
  concatenation) so local vs prod differences are absorbed by `.env`.
- 🆕 **Action:** ensure `resomix-similarity-open/.env.example` documents `PARTNER_SFTP_ROOT`,
  `PARTNER_DATA_ROOT`, `SHARED_ASSETS_ROOT` (with local-dev sample values, e.g. a `tmp/` tree) so a
  fresh deploy knows what to set. Confirm `conftest.py` already overrides these to a sandbox
  `tmp_path` (it does for `partner_data_root`; add `partner_sftp_root` + `shared_assets_root` if
  the SFTP/segment tests touch disk).
- 🆕 **Cross-server path agreement:** Alwyzon's `SFTP_BASE_PATH` (default `/srv/sftp`, used as
  `{base}/partners/{pid}`) must resolve to the same physical tree as Hetzner's `PARTNER_SFTP_ROOT`
  (`/srv/sftp/partners`). Document this coupling in both `.env.example` files: Alwyzon
  `SFTP_BASE_PATH=/srv/sftp` ⇔ Hetzner `PARTNER_SFTP_ROOT=/srv/sftp/partners`.

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

### B2B — `tests/api/test_admin_ingestion_control.py` (§F)

| Test | What it checks |
|---|---|
| `test_list_ingestion_logs_success` | GET logs returns the partner's `ingest_logs`, newest first |
| `test_list_ingestion_logs_status_env_filters` | `?status=FAILED&env=live` returns only matching rows |
| `test_get_ingestion_log_detail_with_errors` | GET `/ingestion/logs/{id}` includes `ingestion_errors` rows |
| `test_get_ingestion_log_not_found` | unknown id → 404 |
| `test_get_ingestion_log_cross_partner_denied` | admin scoped to partner A → 403 for partner B's log |
| `test_trigger_ingestion_success` | POST trigger with env=live → 200 `{status:"started"}`, background task scheduled |
| `test_trigger_ingestion_bad_env` | env="prod" → 422 |
| `test_trigger_ingestion_partner_not_found` | unknown partner → 404 |
| `test_retry_ingestion_only_when_failed` | retry on COMPLETED log → 422; on FAILED log → 200 |

### B2B — `tests/api/test_admin_track_control.py` (§G)

| Test | What it checks |
|---|---|
| `test_set_live_success` | tracks with `faiss_indexed=True` → `is_active=True`, counts returned |
| `test_set_live_blocked_when_not_indexed` | track with `faiss_indexed=False` → 422 / skipped count |
| `test_set_live_by_ingest_log` | `{ingest_log_id}` sets the whole batch live |
| `test_stop_track_sets_inactive_and_removes_vector` | `is_active=False` + Hetzner remove-vector called (mock httpx) |
| `test_stop_is_idempotent` | stopping an already-stopped track → 200 no-op |
| `test_list_tracks_with_state` | GET tracks returns joined `is_active` + `embedding_status` + `faiss_indexed` |
| `test_list_tracks_filters` | `?is_active=false&faiss_indexed=true` returns correct subset |
| `test_track_control_cross_partner_denied` | set-live/stop on another partner's track → 403 |

### SFTP reconciliation (§0)

| Test | Repo | What it checks |
|---|---|---|
| `test_provision_sftp_user_creates_test_live` | Hetzner `tests/test_sftp_provisioning.py` | `mkdir` called for `test/` + `live/` only (`call_count == 2`), no `incoming/processed/error` |
| `test_done_hook_derives_env_live` | B2B `tests/api/test_sftp_hook_env.py` | `.done` under `/live/` → `process_ingestion_batch(env="live", batch_path=…/live)` |
| `test_done_hook_derives_env_test` | B2B `tests/api/test_sftp_hook_env.py` | `.done` under `/test/` → env="test" path |
| `test_done_hook_defaults_env_live` | B2B | ambiguous path → defaults to `live` |
| `test_ingestion_persists_sftp_env` | B2B `tests/unit/services/test_partner_processing_service.py` | `TrackProcessingStatus.sftp_env` set from the batch env |

### B2B — test/live semantics, artifact registry, fire-and-forget

| Test | What it checks |
|---|---|
| `test_test_env_is_dry_run_no_persist` | env="test" batch → IngestLog report written, NO `tracks`/`audio_files`/`track_processing_status` rows persisted |
| `test_test_env_calls_hetzner_dry_run` | env="test" → batch-embeddings called with `env="test"` (mock httpx), no partner_paths writes asserted |
| `test_live_env_persists_tracks` | env="live" batch → tracks + audio_files(Master) + track_processing_status rows created |
| `test_artifact_rows_registered_on_live_embeddings` | after embeddings job (live), `document_files` rows (maest/discogs) + `audio_files` preview row exist with correct `doc_type`/`asset_subtype` |
| `test_artifact_upsert_idempotent` | re-running a job does not duplicate file rows (unique on stored_path) |
| `test_job_returns_202_immediately` | POST job → 202 with `{job_id, status:"pending"}` before work completes (mock worker) |
| `test_job_status_transitions_to_completed` | background worker flips job pending→running→completed and sets processed_tracks |
| `test_duplicate_running_job_rejected` | second job of same type for same (partner, ingest_log) while one running → 409 |

### Hetzner — `tests/test_batch_embeddings.py`

| Test | What it checks |
|---|---|
| `test_batch_embeddings_creates_npy_files` | Mock embed_server, mock audio read; confirm .npy files written to correct partner paths (env-scoped read via `sftp_dir(pid, env)`) |
| `test_batch_embeddings_missing_audio_file` | One track has no audio file → that track returns status=failed, others succeed |
| `test_batch_embeddings_embed_server_error` | embed_server returns 500 → that track fails gracefully, job continues |
| `test_batch_embeddings_path_traversal_blocked` | audio_filename="../../../etc/passwd" → 400 |
| `test_batch_embeddings_respects_env` | env="test" reads from `sftp_dir(pid,"test")`, env="live" from `live/` |
| `test_batch_embeddings_test_env_does_not_persist` | env="test" → no `.npy`/preview written under `partner_paths`; temp dir cleaned up; per-track result still returned |
| `test_batch_embeddings_live_env_persists` | env="live" → `.npy` ×2 + preview present under `partner_paths` after the call |

### Hetzner — `tests/test_remove_vector.py` (§G4, if remove-vector added)

| Test | What it checks |
|---|---|
| `test_remove_vector_success` | existing vector → removed from index + catalog, 200 |
| `test_remove_vector_missing_is_noop` | unknown uuid → 200 no-op (idempotent), not 404 |
| `test_remove_vector_requires_internal_key` | no Bearer key → 401/403 |

---

## Files to Create/Edit

| Action | File |
|---|---|
| **§0 SFTP reconciliation** | |
| Edit   | `resomix-similarity-open/app/api/internal.py` (`/internal/provision-sftp-user` subdirs → `test/live`) |
| Edit   | `resomix-similarity-open/tests/test_sftp_provisioning.py` (mkdir count 4→2, names test/live) |
| Edit   | `basic_fastapi_server_resomix/app/api/routers/internal/sftp.py` (derive env, env-scoped batch_path) |
| Edit   | `basic_fastapi_server_resomix/app/services/ingestion_service.py` (add `env` param, persist `sftp_env`) |
| **§A–§E processing pipeline** | |
| Create | `basic_fastapi_server_resomix/app/models/track_processing_status.py` (incl. `sftp_env` column) |
| Create | `basic_fastapi_server_resomix/app/models/partner_processing_job.py` |
| Edit   | `basic_fastapi_server_resomix/app/models/audio_file.py` (+`asset_subtype`), `document_file.py` (+`doc_type`) |
| Create | `basic_fastapi_server_resomix/alembic/versions/{hash}_add_partner_processing_tables.py` (down_revision `ef7999c3c2ca`; hand-written; adds 2 tables + 2 columns; run `alembic upgrade head`) |
| Edit   | `basic_fastapi_server_resomix/scripts/seed_data.py` (keep seed consistent with new tables) |
| Create | `basic_fastapi_server_resomix/app/services/partner_processing_service.py` |
| Create | `basic_fastapi_server_resomix/app/api/routers/admin/processing.py` (§C + §F + §G routes) |
| Edit   | `basic_fastapi_server_resomix/app/services/ingestion_service.py` (remove add-vector block, add status row creation) |
| Edit   | `basic_fastapi_server_resomix/app/models/__init__.py` (register new models) |
| Edit   | `basic_fastapi_server_resomix/app/api/routers/__init__.py` + `app/api/routers/admin/__init__.py` (register processing router — NOT main.py) |
| Create | `resomix-similarity-open/app/schemas/internal.py` (add batch embedding schemas, incl. `env`) |
| Edit   | `resomix-similarity-open/app/api/internal.py` (add batch-embeddings endpoint + remove-vector §G4) |
| **§F/§G admin control** | |
| Create | `basic_fastapi_server_resomix/app/services/partner_processing_service.py` (ingestion-trigger + track set-live/stop logic) |
| Edit   | `basic_fastapi_server_resomix/app/repositories/` (IngestLog + Track listing queries as needed) |
| **§H .env paths** | |
| Edit   | `resomix-similarity-open/.env.example` (document `PARTNER_SFTP_ROOT`, `PARTNER_DATA_ROOT`, `SHARED_ASSETS_ROOT`) |
| Edit   | `basic_fastapi_server_resomix/.env.example` (document `SFTP_BASE_PATH` ⇔ Hetzner coupling) |
| Edit   | `resomix-similarity-open/tests/conftest.py` (sandbox overrides for `partner_sftp_root`, `shared_assets_root` if needed) |

---

## Verification

0. **SFTP reconciliation:** provision a partner → confirm only `test/` + `live/` exist under the
   SFTP home (no `incoming/processed/error`); upload a `.done` under `live/` → confirm ingestion
   reads `…/live` and `TrackProcessingStatus.sftp_env == "live"`.
1. Run migrations → confirm both tables exist in DB
2. Ingest a CSV batch → confirm `track_processing_status` rows created, `embedding_status=pending` for all
3. Confirm NO HTTP call made to Hetzner during ingestion (check logs)
4. POST `job_type=embeddings` for that partner → confirm Hetzner receives the batch request (with `env`), .npy files written under `partner_paths.embedding_path(...)`
5. GET processing status → confirm `embeddings.completed` count matches
6. POST `job_type=faiss_index` before embeddings → confirm 422 guard
7. POST `job_type=faiss_index` after embeddings → confirm `faiss_indexed=true` for tracks
8. **§F:** GET ingestion logs + detail; POST trigger (env=live) → background ingest runs; retry a FAILED log → re-runs
9. **§G:** POST set-live for indexed tracks → `is_active=True`; POST stop → `is_active=False` + Hetzner remove-vector called; GET tracks shows joined state
10. **§H:** with `PARTNER_DATA_ROOT`/`PARTNER_SFTP_ROOT` pointed at a temp tree, the whole flow works without code changes
11. Run all new tests:
    `pytest tests/api/test_partner_processing.py tests/api/test_admin_ingestion_control.py tests/api/test_admin_track_control.py tests/api/test_sftp_hook_env.py tests/unit/services/test_partner_processing_service.py -v`
    and Hetzner: `.venv/bin/python -m pytest tests/test_batch_embeddings.py tests/test_remove_vector.py tests/test_sftp_provisioning.py -v`
