# Partner-Scoped Storage Refactor — Change Report

**Date:** 2026-06-06
**Scope:** Two server programs
- **Hetzner media server** — `resomix-similarity-open` (port 8004, `python run.py`)
- **Alwyzon B2B server** — `basic_fastapi_server_resomix` (port 8001, `make api`)

**Baseline commits (work below is uncommitted on top of these):**
- Hetzner: `d5877b6` — "Aligned gaps in plan" (2026-06-03)
- Alwyzon: `5681ab9` — "Aligned gaps in plan" (2026-06-03)

**Test status after changes:**
- Hetzner: **30 / 30 pass**
- Alwyzon: **222 / 222 pass** (39 unit + 183 live-server integration, both app servers + MariaDB + Redis running)

**Goal of the refactor:** move the Hetzner media server from flat, global, UUID-keyed
storage to a fully **partner-scoped** layout where every server-generated asset lives under
one partner folder. A partner can be off-boarded by deleting its directory. Every request
must carry or resolve a `partner_id`. The existing ~51k open catalog becomes `partner_id = 1`.

Target layout (all under `settings.partner_data_root`):

```
{partner_data_root}/{partner_id}/
├── test/                       # SFTP-exposed sandbox uploads
├── live/                       # SFTP-exposed production uploads
└── internal/                   # server-managed, never exposed to the partner
    ├── embeddings/{maest,discogs}/{uuid}.npy
    ├── indexes/faiss_{engine}_{partner_id}.index
    ├── catalog/{engine}_catalog_{partner_id}.json
    ├── previews/{uuid}.mp3
    ├── segments/{uuid}/        # HLS .ts + hls.m3u8 per track
    ├── peaks/{uuid}.json
    ├── covers/{uuid}.jpg
    └── raw/{uuid}.{ext}
```

---

# 1. Hetzner Media Server (`resomix-similarity-open`)

29 files modified, 2 new files. (`+816 / −981` lines — the layout collapsed many
hard-coded global directory branches into single `partner_paths` calls.)

## 1.1 New foundation

### `app/core/partner_paths.py`  *(NEW — single source of truth)*
The whole refactor pivots on this module. It builds **every** on-disk partner path so the
layout is defined in exactly one place.

- Root helpers: `partner_root`, `internal_root`, `sftp_root`, `sftp_dir(pid, "test"|"live")`.
- Asset helpers: `embeddings_dir`, `embedding_path`, `index_path`, `catalog_path`,
  `previews_dir`/`preview_path`, `segments_root`/`segments_dir`, `peaks_dir`/`peaks_path`,
  `covers_dir`/`cover_path`, `raw_dir`/`raw_path`.
- Validation guards: `validate_partner_id` (positive int), `_validate_engine`
  (maest/discogs), `_validate_uuid` (rejects `..`, `/`, `\`) → path-traversal-safe.
- Shared assets: `is_reserved_segment`, `shared_segments_root`, `shared_segment_path`
  for the global filler/`deleted` segments (`silent_2005`, `deleted`) that every partner
  shares.
- `ensure_partner_dirs(pid)` creates the full internal skeleton; `ensure_parent(path)`.

### `app/core/config.py`
- Added `shared_assets_root` setting (`SHARED_ASSETS_ROOT`, default `/srv/resomix/shared`)
  for global/shared assets (e.g. the `silent_2005` filler segment) used by all partners.

## 1.2 Authentication / partner resolution

### `app/utils/edge_auth.py`  *(+99 lines)*
- Extracted `_extract_client_ip(request)` (X-Forwarded-For → X-Real-IP → client.host),
  reused by both dependencies.
- **New `require_partner_id` dependency** — the core of partner isolation at serving
  endpoints:
  - **Allowlisted internal IPs** (Alwyzon server-to-server): the `partner_id` query
    param is **required and authoritative** (400 if missing/invalid).
  - **External clients**: `partner_id` is read from the **verified Edge JWT claim**;
    any `partner_id` query param is ignored, so a client cannot reach another partner's
    assets by editing the URL (403 on missing/invalid token or missing claim).

## 1.3 Repositories — re-pointed at `partner_paths`

### `app/repositories/partner_faiss_repository.py`
- Index path now `partner_paths.index_path(pid, engine)`; rebuild reads
  `partner_paths.embeddings_dir(pid, engine)`. (Indexes moved under `internal/`.)

### `app/repositories/partner_catalog_repository.py`
- Catalog path now `partner_paths.catalog_path(pid, engine)`.

## 1.4 Serving / processing services — `partner_id` threaded through

Every method below gained a leading `partner_id` parameter and resolves paths via
`partner_paths` instead of the global `settings.*_location`; constructors stopped caching
global directories.

| Service | Key changes |
|---|---|
| `app/services/audio_service.py` | `get_file_path`, `get_segment_file_path`, `serve_audio_simple`, `serve_segment_simple`, `serve_audio` now take `partner_id`. Segment serving honors `is_reserved_segment` → `shared_segment_path` for `silent_2005`/`deleted`. |
| `app/services/peaks_service.py` (v1) | `find_audio_file`, `get_peaks_file_path`, `peaks_file_exists`, `load_existing_peaks`, `generate_peaks`, `get_or_generate_peaks(_simple)` all partner-scoped. Audio source is now `partner_paths.preview_path`. |
| `app/services/peaks_service_v2.py` | Same as v1 plus `get_peaks_v2_file_path` (`{uuid}.v2.json` under `peaks/`), `peaks_v2_file_exists`, `load_existing_peaks_v2`, `save_peaks_v2`, `get_or_generate_peaks_rich` — all partner-scoped. |
| `app/services/segmentation_service.py` | **Removed the `source` enum dir-selection** (`monthly`/`uploads`/`similarity`). Now `find_audio_file(pid, uuid)` → `preview_path`, output → `segments_dir`. `segments_already_exist`, `_process_single_uuid`, `_process_batch`, `create_segments`, `create_segments_progress` all take `partner_id`. |
| `app/services/hls_service.py` | `find_hls_playlist_file(pid, uuid)` → `segments_dir/hls.m3u8`; `generate_combined_playlist(pid, uuids, ...)`. |
| `app/services/cover_service.py` | `find_cover_file(pid, uuid)` → `covers_dir`; `serve_cover_image(_simple)(pid, uuid)`. UUID validated via `partner_paths._validate_uuid`. |
| `app/services/preview_service.py` | `generate_preview(pid, file_bytes, original_id)` writes to `preview_path`. |
| `app/services/upload_track_preview_service.py` | Dropped cached global dirs; writes previews/segments/raw/covers via `partner_paths`. |
| `app/services/playlist_peaks_service.py` | `get_missing_peaks_uuids(pid, ...)`, `generate_peaks_for_playlist(pid, ...)`, `_generate_peaks_for_single_track(pid, uuid)`, `get_peaks_status(pid, ...)`. |
| `app/services/deletion_service.py` | `delete_track(partner_id, track_uuid)` (arg order fixed, `partner_id` now required). Deletes embeddings (both engines), preview, segments (stub-rewrites `hls.m3u8`), covers + raw (glob `{uuid}.*`). **Retains peaks** by design. Emits masked audit events. |
| `app/services/embedding_preview_service.py` | `generate_embedding_preview(..., partner_id=OPEN_TRACKS_PARTNER_ID=1)`. Embedding/preview/segment/peaks all routed through `partner_paths`. Removed dead helpers (`save_vector_to_file`, `get_embeddings_directory_path`, `get_previews_directory_path`, `get_preview_embedding`, `_ensure_production_directories_exist`). Stage-B segmentation no longer uses `source=`. |
| `app/services/similarity_service.py` | `query_by_uuid_for_partner` and upload asset generation resolve vectors via `partner_paths.embedding_path` / `embeddings_dir`. `_generate_upload_assets(partner_id, ...)` saves preview/cover/peaks under the partner. `query_by_upload_full(partner_id, ...)` saves embeddings per-partner. |

## 1.5 API endpoints — `partner_id` now required

| Endpoint (file) | How `partner_id` arrives |
|---|---|
| `GET /signed-audio/segment/`, HEAD, `POST .../hls-m3u8/`, `POST /previews-segment/` (`app/api/segment.py`) | `Depends(require_partner_id)` (replaces `require_edge_token`). Missing-UUID fallback simplified — checks `preview_path` per partner, single `create_segments(pid, uuids)` call. |
| `GET` audio serving (`app/api/audio.py`) | `Depends(require_partner_id)` |
| `GET /peaks/`, `/peaks-rich/`, `POST /playlist_peaks` (`app/api/peaks.py`) | `Depends(require_partner_id)` |
| `GET` cover image (`app/api/cover.py`) | `Depends(require_partner_id)` |
| `POST /generate-preview/` (`app/api/preview.py`) | `partner_id: int = Form(...)` |
| `POST /similarity/query-by-upload/` (`app/api/similarity.py`) | `partner_id: int = Form(...)` |
| `DELETE /delete-track/{uuid}` (`app/api/deletion.py`) | `partner_id: int = Query(...)` |
| `POST /internal/partner/provision`, `/internal/ingest/add-vector` (`app/api/internal.py`) | provision now creates `sftp_dir(test)` + `sftp_dir(live)` + `ensure_partner_dirs`; **bug fix** — `add-vector` now reads `partner_paths.embedding_path` (`internal/embeddings/{engine}/{uuid}.npy`) instead of a flat `embeddings/{engine}/` path that no other code wrote to. |

## 1.6 Tests (Hetzner)

| File | Change |
|---|---|
| `tests/conftest.py` | Peaks mocks updated to partner-scoped signatures: `mock_generate_peaks(self, partner_id, audio_file_path, uuid)`, `mock_get_or_generate_peaks_rich(self, partner_id, uuid, cutoff_hz=None)` (resolves via `partner_paths.preview_path`). |
| `tests/test_audio_processing.py` | Rewritten for partner-scoped serving: `PARTNER_ID=777`, helpers writing previews/covers under `partner_paths`, JWTs now carry a `partner_id` claim, all serving requests pass `partner_id`. |
| `tests/test_partner_isolation.py` | Provision test asserts `internal/` layout (`embeddings/{maest,discogs}`, `indexes`, `catalog`) + SFTP `test`/`live`; vector writes use `partner_paths.embeddings_dir`. |
| `tests/test_pipeline_and_failures.py` | `partner_id` form field added to the two `/similarity/query-by-upload/` tests; `delete-track` test passes `?partner_id=` and seeds files via `partner_paths.{preview,peaks,segments}`. |
| `technical/gaps_partner_scoped.md` *(NEW)* | The refactor plan / decision log. |

> `monthly_pipeline_logs.txt` also shows as modified — runtime log output only, no code.

---

# 2. Alwyzon B2B Server (`basic_fastapi_server_resomix`)

The Alwyzon **production** partner-scoping code (sending `partner_id` to Hetzner, the
new `/internal/ingest/*` routes, tenant isolation) was already committed in the `5681ab9`
baseline. The only uncommitted change in this session is a stale-test fix:

### `tests/unit/services/test_similarity_service_partner.py`
- `rebuild_faiss_indexes` is asserted to call the current route
  **`/internal/ingest/rebuild-index`** (was the obsolete `/admin/similarity/rebuild-index/`)
  in both the `partner_id` and no-`partner_id` cases. The production code already used the
  new route; the test was lagging. (`+4 / −4`.)

### `docs/may_2026/gaps_admin_control.md` *(NEW, untracked)*
- Plan for the admin-controlled processing pipeline (not yet implemented — see gaps).

**Already-present (committed) Alwyzon behavior verified by the live integration run:**
auth flows, partner management lifecycle, audio search/similarity scoping, SQLi
protection, tenant isolation, RBAC, weekly gate — all green (222/222).

---

# 3. Overall Status & Production-Readiness Assessment

## 3.1 What is done and verified ✅

- **Central path resolver** (`partner_paths.py`) is the single source of truth; all
  services and endpoints resolve through it. Path-traversal is guarded.
- **Every Hetzner serving + processing endpoint requires `partner_id`** and enforces
  isolation (internal IP → trusted query param; external → verified JWT claim).
- **Storage isolation proven by tests** — an asset written for partner A is not found for
  partner B; 50-way concurrency test passes with correct per-partner results.
- **Off-boarding model** — deleting `{partner_data_root}/{partner_id}` removes everything
  for that partner (no shared cross-partner files except the explicit `shared/` reserved
  segments).
- **Real bug fixed** — `add-vector` was reading a flat embeddings path that nothing wrote
  to; now aligned with `internal/embeddings/{engine}`.
- **Both servers boot and all tests pass** (Hetzner 30/30; Alwyzon 222/222 against the
  live stack: app servers + MariaDB:3307 + Redis:6379 + SFTPGo via docker).

## 3.2 Gaps still open before full production rollout ⚠️

These are **known, planned, and intentionally out of this session's scope** — but they
block end-to-end production for *external* partners and for the existing 51k catalog.

1. **Valet-token flow for external playback (NOT implemented).** *(task #6)*
   `require_partner_id` already verifies a `partner_id` JWT claim, but **nothing mints that
   token yet.** The planned Alwyzon endpoint `POST /api/v1/partner/playback-token`
   (Bearer API key → short-lived HS256 valet JWT signed with the shared `EDGE_JWT_SECRET`,
   claims `partner_id`/`scope:"playback"`/1h exp) **does not exist** (`grep` found no
   `playback-token`/`valet` in Alwyzon). **Impact:** external partner playback and the
   frontend serving the partner-1 catalog cannot obtain a `partner_id` token. Internal
   server-to-server calls (which pass `partner_id` directly) already work.

2. **Partner-1 migration of the existing 51k open catalog (NOT done).** *(task #7)*
   - `scripts/migrate_partner1.py` **does not exist.**
   - The legacy global assets (previews/segments/peaks/covers/vectors) still live in the
     old `settings.*_location` globals and have **not** been relocated to
     `{partner_data_root}/1/internal/…`.
   - **`monthly_pipeline_service.py` still writes to global paths** (`settings.catalog_file`,
     `settings.index_file`, `settings.monthly_dir`, …) — it was **not** re-pointed at
     `partner_paths`. Only the per-track `embedding_preview_service` defaults to partner 1.
   - **Impact:** serving the open catalog through the new partner-scoped endpoints would
     404 until the migration runs and the monthly pipeline is re-pointed to partner 1.

3. **Admin-controlled processing pipeline (separate plan, NOT implemented).**
   Per `docs/may_2026/gaps_admin_control.md`: the `track_processing_status` /
   `partner_processing_jobs` tables, the Hetzner `POST /internal/process/batch-embeddings`
   endpoint, and the B2B admin routes that trigger/monitor embedding→peaks→segments→FAISS
   stages are **not built**. Today partner-ingested tracks have no admin-driven path from
   "metadata in MariaDB" to "embeddings + previews on disk + indexed."

4. **Business-logic confirmation needed — upload similarity search scope.**
   `query-by-upload` saves embeddings under the partner, but the **search itself still uses
   the global combined catalog** (`_combined_search` on `self.catalog`), not the partner
   index. `query-by-uuid` correctly uses the partner index. Confirm whether upload queries
   are *meant* to search the global catalog or should be partner-scoped.

## 3.3 Bottom line

The **partner-scoped storage architecture on Hetzner is complete, internally consistent,
isolation-tested, and fully green**, and Alwyzon's committed integration with it passes
end-to-end. The system is **ready for internal/server-to-server production testing**
(Alwyzon → Hetzner with explicit `partner_id`).

It is **not yet ready for external-partner or existing-51k-catalog production traffic**
until three planned items land: **(1)** the valet-token mint endpoint on Alwyzon, **(2)**
the partner-1 migration script **and** re-pointing the monthly pipeline to partner 1, and
**(3)** (if needed) the admin processing pipeline. Item **(4)** is a quick business-rule
confirmation, not necessarily code.

None of the open items are regressions or surprises — they are the remaining, already-
documented tasks (#6 and #7, plus the separate admin-pipeline plan).