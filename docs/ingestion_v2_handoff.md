# Ingestion Pipeline v2 — Handoff (Alwyzon + Hetzner)

> **Purpose:** a self-contained continuation brief. It records what is DONE and what
> REMAINS in **each** server, with *why / how / how-to-test* for every remaining stage.
> Read alongside the full design: `basic_fastapi_server_resomix/docs/ingestion_pipeline_v2_plan.md`.
> All pipeline timestamps are **UTC**.

## 0. Orientation (read first)

**Two repos / two roles**
- **Alwyzon** = `basic_fastapi_server_resomix` — control plane: MariaDB, auth, the SFTP
  auth/event hooks, orchestration, partner record persistence. **Owns the DB.**
- **Hetzner / Media** = `resomix-similarity-open` — owns the partner files on disk,
  does the heavy work (validation, transcode, embeddings, FAISS). **DB-less.**

**The split:** SFTPGo (on the media box) fires hooks → Alwyzon `/internal/sftp/*`.
On a `.done`, Alwyzon creates an `ingest_logs` row and HTTP-hands the job to Media
(`/internal/ingestion/run`). Media validates + writes a result JSON; Alwyzon polls it
and persists Track rows. Media never touches the DB; Alwyzon never touches the files.

**Run the tests**
- Alwyzon: `cd basic_fastapi_server_resomix && .venv/bin/python -m pytest tests/ -q`
  - Needs MariaDB up (local `127.0.0.1:3307`, via Docker). **After any new migration run
    `.venv/bin/alembic upgrade head` first.** Redis optional (guard degrades without it).
  - Current baseline: **299 passed**.
- Media: `cd resomix-similarity-open && .venv/bin/python -m pytest tests/ -q`
  - Self-contained: `conftest.py` builds a temp sandbox; no external DB. clamAV is OFF by
    default (`ANTIVIRUS_ENABLED=false`) so tests never need a daemon.
  - Current baseline: **78 passed**.

**Testing policy (MANDATORY each stage):** every stage adds unit tests in **each repo it
touches**, Alwyzon *and* Media. A stage is not "done" until both suites are green. Keep
both baselines passing at every step.

**Locked decisions (do not re-litigate)** — see plan §2 (D1–D11). Highlights:
D1 atomic same-FS move (`os.replace`); D2 Media gets its OWN local Redis + Celery worker,
HTTP contracts unchanged; D3 concurrency = **hard reject** (delete only the `.done`);
D4 128 kbps mp3 raw (keep as-is only if mp3 & ≤~133 kbps, VBR-aware); D5 extract cover art
to `internal/covers/<uuid>.jpg`, must be a real image & ≤1 MB else discard; D6 zip strict
allowlist (flat only, allowed types only, no folders/symlinks/nested, Zip-Slip + zip-bomb
caps); D7 DB is source of truth, `logs.json` is a sanitized mirror; D8 clamAV on Media;
D9 `.aiff` supported everywhere; D10 originals NOT pruned yet (future); D11 no cancel-batch
yet (admin has pause/resume).

**State machine (one batch = one `.done`):**
```
RECEIVED → VALIDATING → MOVED → TRANSCODING → INGESTED → EMBEDDING → INDEXED → FINALIZING → READY
                       (FAILED_VALIDATION / FAILED are terminal)
```
A batch is "active" (blocks new `.done`) in any non-terminal stage. **INGESTED is non-terminal**
— that's what keeps a partner blocked until the admin's embeddings reach READY.

**Folder layout (Media, per partner under `{partner_sftp_root}/<slug>/`):**
`live/` `test/` (SFTP rw) · `processing/` (SFTP read-only, NEW, Stage 5) · `internal/`
(hidden: `raw/` `covers/` `embeddings/` `indexes/` `catalog/` `previews/` `segments/`
`peaks/` `ingestion/` `processing/` job JSONs). Path helpers: `app/core/partner_paths.py`.

---

# SECTION A — ALWYZON (`basic_fastapi_server_resomix`)

## A1. DONE in Alwyzon

**Stage 2 — `ingest_logs` stage timeline**
- Migration `alembic/versions/d4e5f6a7b8c9_add_ingest_log_stage_timeline.py` adds
  `stage` (indexed), `processing_dir`, `stage_timeline` (JSON). Idempotent column+index guards.
- `app/models/b2b.py` → `IngestLog` has those 3 columns. Coarse `status`
  (PENDING/PROCESSING/COMPLETED/FAILED) is UNCHANGED — `stage` is the fine-grained layer.
- `app/services/ingestion_stages.py` — `Stage` constants, `ORDERED_STAGES`,
  `ACTIVE_STAGES`, `TERMINAL_STAGES`, `advance_stage(log, stage)` (stamps UTC, reassigns a
  **new** dict so the JSON column is flagged dirty), `is_terminal`, `sanitized_logs_json(log)`
  (partner-safe builder: batch/status/stage/track_count/stages_utc only — no paths/ids).
- `app/services/ingestion_service.py` stamps stages: `RECEIVED` on create → `VALIDATING`
  on hand-off → `INGESTED` (live) / `READY` (test dry-run) / `FAILED_VALIDATION` / `FAILED`.
- Tests: `tests/unit/services/test_ingestion_stages.py` (4).

**Stage 3 — per-partner concurrency guard (hard reject)**
- `app/services/hetzner_service.py` → `reject_done(partner_id, home_dir, env)` calls Media.
- `app/services/ingestion_service.py`:
  - `has_active_batch(db, partner_id)` → active row (stage ∈ ACTIVE_STAGES, or legacy
    stage-NULL + status PROCESSING).
  - `acquire_partner_ingest_lock` / `release_partner_ingest_lock` — Redis `SET NX EX 60`
    per-partner; **degrades to a no-op sentinel (`_NO_REDIS_TOKEN`) when Redis is absent**.
  - `reject_duplicate_done(...)` — calls Media reject + emits `ingestion.rejected` webhook;
    creates **no** row.
  - `start_ingestion_job` split into `create_ingest_log` (row + RECEIVED, commit) and
    `dispatch_to_media` (Hetzner hand-off + VALIDATING/FAILED + webhook). `start_ingestion_job`
    is kept as a thin wrapper for direct callers/tests.
- `app/api/routers/internal/sftp.py` event hook: acquire lock → `has_active_batch`; if active
  **or** lock held → `reject_duplicate_done` + return; else **create the row under the lock**
  (closes the two-`.done` race), release lock, hand off in a background task.
- Tests: `tests/unit/services/test_ingestion_guard.py` (3) + `test_sftp_event_rejects_done_when_batch_active`
  in `tests/api/b2b/test_sftp_ingestion_flow.py`.

> Note: the persistence side that consumes Media's result is `apply_ingestion_result` in
> `ingestion_service.py` — it already maps validation `errors[]` → `IngestionError` rows and
> sets terminal stages. New error codes from Stage 4 flow through here automatically.

## A2. REMAINING in Alwyzon (by stage)

### Stage 4 (Alwyzon part) — error-code severities
- **Why:** Stage 4's new validation rejections (zip/av/real-audio/mismatch) come back in the
  result JSON `errors[]`. Alwyzon should classify the *new* codes as `critical` so the admin
  UI surfaces them correctly.
- **How:** in `apply_ingestion_result` (the `remote_status == "failed"` branch) the `severity`
  list currently flags a fixed set of codes critical. Add the new codes:
  `DISALLOWED_ZIP_ENTRY`, `ZIP_CONTAINS_FOLDER`, `ZIP_SYMLINK`, `ZIP_BOMB`, `AV_INFECTED`,
  `NOT_AUDIO`, `EXTRA_FILE_NOT_IN_MANIFEST`. (Codes must match exactly what Media emits.)
- **Tests:** `tests/api/admin/test_admin_processing.py` already drives `apply_ingestion_result`
  with a fabricated failed-state dict — add a case feeding one of each new code and assert the
  `IngestionError` row's `error_severity == "critical"`.

### Stage 5 (Alwyzon part) — expose `processing/` read-only over SFTP
- **Why:** the partner must be able to *see and download* the `processing/<dt>/` snapshot but
  not modify it (D7, trust doc).
- **How:** in `app/api/routers/internal/sftp.py` `sftp_auth_hook`, add to the returned
  `permissions`: `"/processing": ["list", "download"]`. Confirm the root `/` deny-list still
  hides `internal`/dotfolders but NOT `processing` (it has no leading dot, so it's visible).
- **Tests:** extend `tests/api/b2b/test_sftp_ingestion_flow.py` auth-hook tests — assert the
  response `permissions["/processing"] == ["list","download"]` and that it lacks `upload`/`delete`.

### Stage 7 (Alwyzon part) — finalize + notify, and `processing_dir` threading
- **Why:** when embeddings finish + index is live, the batch must reach `READY` and the partner
  must be notified; the embedding job (admin-triggered, later) needs the batch's `processing_dir`.
- **How:**
  1. When the admin triggers embeddings, look up the partner's active `ingest_logs` row and pass
     its `processing_dir` to the Media embeddings call (so Media appends to the right `logs.json`).
     Embedding trigger lives in the admin processing router/controller + `HetznerService.start_embeddings`.
  2. On the embedding-complete/index-live poll, advance the row through
     `EMBEDDING → INDEXED → FINALIZING → READY` via `advance_stage`, set `status=COMPLETED`,
     and emit a partner notification (reuse `dispatch_webhook`; email later — deferred).
  3. `processing_dir` is currently never set on the Alwyzon side — Stage 5 (Media) creates the
     `<dt>` folder; Media should return that name in its result JSON, and `apply_ingestion_result`
     should persist it onto `ingest_logs.processing_dir`. Wire that in Stage 5/7.
- **Tests:** unit-test the finalize transition (mock the embeddings status) asserting stage
  progression + a `ingestion.completed`/`ready` webhook; assert `processing_dir` is persisted from
  a fabricated result state.

### Cross-cutting (Alwyzon)
- **Celery (D2):** Alwyzon already has Celery (webhooks). No Alwyzon change needed for D2 — the
  Celery worker is a **Media** concern. Alwyzon keeps its existing HTTP calls.
- **Deferred (do NOT build now):** admin cancel-batch (D11); partner email (webhook only for now);
  prune originals (D10).

## A3. Alwyzon test gotchas
- Start MariaDB and `alembic upgrade head` before running (migrations are not auto-applied).
- The guard test seeds an active `IngestLog` then hits `/internal/sftp/event` — mock
  `HetznerService.reject_done` and `start_ingestion`, and patch `dispatch_webhook.delay`.
- Static admin auth in tests = header `{"X-API-KEY": settings.api_key}`.

---

# SECTION B — HETZNER / MEDIA (`resomix-similarity-open`)

## B1. DONE in Media

**Stage 1 — durable-execution + antivirus infra (no behavior change)**
- `app/tasks/celery_app.py` (+ `app/tasks/__init__.py`): Celery app `resomix_media`, broker =
  **local** Redis (`CELERY_BROKER_URL`), `task_acks_late=True`, UTC; `app.tasks.ping` task.
  Run: `celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2`.
- `app/core/config.py`: `media_redis_url`, `celery_broker_url`, `celery_result_backend`,
  `antivirus_enabled` (default **False**), `clamd_socket`. All dev-safe defaults.
- `app/services/antivirus_service.py`: `MediaAntivirusService` — `scan_file(path)` (clamd
  path-scan → instream → clamscan fallback) and `scan_bytes`; gated by `antivirus_enabled`
  (returns `method="disabled"`/clean when off). Result shape `{success, clean, threat, method, ...}`.
- `requirements.txt` (+`env_template.txt`): `celery`, `redis`, `clamd`.
- Tests: `tests/test_pipeline_infra.py` (5).
- Ops: documented in `docs/reference/fresh_server_setup_runbook.md` (clamd note, media `.env`
  Celery/AV vars w/ single-box Redis db `/2`,`/3`, media Celery worker systemd unit) and
  `AA_Resomix_Docs/partner_internal_docs/07_production_migration_checklist.md` §4b.

**Stage 3 — reject-done endpoint**
- `app/schemas/internal.py`: `RejectDoneRequest` / `RejectDoneResponse`.
- `app/api/internal.py`: `POST /internal/ingestion/reject-done` — deletes ONLY `.done` in the
  env folder (uses `ingestion_runner._sftp_env_dir(home_dir, env)`); returns `deleted` bool.
  Guarded by `verify_internal_api_key`.
- Tests: `tests/test_ingestion_guard.py` (3).

**Key existing code to build ON (already present, pre-v2):**
- `app/services/ingestion_runner.py` — `validate_batch(csv_path, audio_dir)` (all-or-nothing;
  CSV cols, ISRC, bpm/duration, file-exists, extension), `_promote_to_raw_store` (currently
  COPIES originals as-is into `internal/raw/<uuid>.<ext>`), `run_ingestion_job(job_id, partner_id,
  home_dir, env)` (background task → writes `internal/ingestion/{job_id}.json`).
  `_ALLOWED_AUDIO_EXT = {.wav,.flac,.mp3}` (note: **no `.aiff` yet** — Stage 4 D9).
- `app/services/preview_service.py` → `process_audio_to_mp3_bytes(input_audio_bytes, bitrate,
  ffmpeg_exe, timeout_seconds)` — REUSE this for the 128 k transcode (Stage 6).
- `app/api/internal.py` `_embed_one` / `_find_raw_audio` — embeddings read `internal/raw/<uuid>.*`,
  with a `live/`/`test/` fallback that must be REMOVED in Stage 6 (raw becomes canonical).
- `app/services/processing_runner.py` — `run_embeddings_job(...)` (parallel embeddings, pause/resume
  via control flag + `internal/processing/{job_id}.json`). Stage 7 appends timeline here.
- `mutagen` is already a dependency (use for cover-art extraction in Stage 6).

## B2. REMAINING in Media (by stage)

### Stage 4 — validation upgrade (MEDIA-heavy) ⇐ DO THIS NEXT
- **Why:** today validation only checks file existence + extension. We must reject bad batches
  *before* they touch `processing/`: prove files are real audio, catch manifest/file mismatches
  both ways, safely handle zips, and virus-scan.
- **How (all in `app/services/ingestion_runner.py`, extend `validate_batch` + a new zip step):**
  1. **`.aiff`** — add `.aiff` to `_ALLOWED_AUDIO_EXT` (D9).
  2. **Real-audio probe** — run `ffprobe` (settings.ffprobe_exe) per audio file; require an audio
     stream and `duration > 0`. Failure → error code `NOT_AUDIO`.
  3. **Mismatch BOTH ways** — current code flags manifest rows whose file is missing
     (`MISSING_AUDIO_FILE`). ADD: every audio file physically present in the batch must appear in
     the manifest, else `EXTRA_FILE_NOT_IN_MANIFEST`.
  4. **Zip (D6)** — if the upload is a `.zip`: open with `zipfile`, and BEFORE extracting, reject if
     any entry is a folder/has a path separator (`ZIP_CONTAINS_FOLDER`), is a symlink (`ZIP_SYMLINK`),
     is a disallowed type (`DISALLOWED_ZIP_ENTRY` — only `.csv` + allowed audio), or trips zip-bomb caps
     (total uncompressed size / entry count / per-entry ratio → `ZIP_BOMB`), or escapes the dir
     (Zip-Slip → `DISALLOWED_ZIP_ENTRY`). Extract to a temp/working dir, then validate as a normal batch.
  5. **clamAV** — `MediaAntivirusService().scan_file(path)` for every audio file (and every extracted
     zip entry). Not clean → `AV_INFECTED`. (No-op when `ANTIVIRUS_ENABLED=false`.)
  - Keep it **all-or-nothing** (any error → whole batch fails, matches today's contract). Codes must
    match the Alwyzon severity list (A2/Stage4).
- **Tests (Media `tests/`):** a validation matrix — good batch passes; each of
  `NOT_AUDIO` (fake bytes), `EXTRA_FILE_NOT_IN_MANIFEST`, `ZIP_CONTAINS_FOLDER`, `DISALLOWED_ZIP_ENTRY`
  (a `.txt` inside), `ZIP_BOMB` (tiny crafted), and `AV_INFECTED` (EICAR string, with AV enabled in
  that test) reject with the right code. Note ffprobe is real in tests — use a genuinely tiny valid
  wav for the happy path, or monkeypatch the probe.
- **Tests (Alwyzon):** the severity-mapping case (A2/Stage 4).

### Stage 5 — atomic move + `processing/<dt>/` (MEDIA + Alwyzon)
- **Why:** quarantine each validated batch as an immutable, partner-visible snapshot; clear `live/`.
- **How (Media):**
  1. `app/core/partner_paths.py`: add `processing_dir(partner_id)` and `processing_batch_dir(partner_id, dt)`.
  2. In `run_ingestion_job`, after validation succeeds and BEFORE raw promotion: assert
     `processing/` and `live/` share a filesystem (else hard-fail), create `processing/<UTC-dt>/`,
     `os.replace` each entry from `live/` into it (atomic), leaving `live/` empty. Use a UTC name like
     `YYYYMMDDTHHMMSSZ`. Return the `<dt>` name in the result JSON.
  3. Write the initial sanitized `logs.json` into `processing/<dt>/` (mirror the DB
     `stage_timeline`; Media can build its own minimal version of `sanitized_logs_json`).
  4. Validation + raw + embeddings now read from `processing/<dt>/`, not `live/`.
- **How (Alwyzon):** auth-hook `processing/` read-only (A2/Stage 5); persist `processing_dir`
  from the result JSON in `apply_ingestion_result`.
- **Tests (Media):** after a run, `live/` is empty, `processing/<dt>/` holds manifest+audio+logs.json;
  same-FS assertion path covered; result JSON carries `processing_dir`.
- **Tests (Alwyzon):** auth hook `processing/` perms; `processing_dir` persisted.

### Stage 6 — 128 k transcode + cover extraction (MEDIA only)
- **Why:** shrink the canonical raw store (D4); preserve validated cover art (D5).
- **How (Media, replace `_promote_to_raw_store`):**
  1. For each validated track: probe with ffprobe. If `codec==mp3` AND bitrate ≤ ~133 kbps
     (VBR-aware) → copy as-is to `internal/raw/<uuid>.mp3`. Else transcode via
     `process_audio_to_mp3_bytes(bitrate="128k")` → `internal/raw/<uuid>.mp3`. Use
     `-map_metadata 0` (keep tags), `-vn -map a:0` (drop art/video), `-nostdin`, a timeout, then
     ffprobe-validate the output (audio stream, duration>0). Never auto-trim silence.
  2. Extract embedded cover art (mutagen or `ffmpeg -an -vcodec copy`) → validate it's a real image
     (magic-byte/decode) AND ≤1 MB → save `internal/covers/<uuid>.jpg`; else discard (non-fatal).
  3. Read inputs from `processing/<dt>/`. In `app/api/internal.py` `_embed_one`, **remove the
     `live/`/`test/` fallback** (raw is canonical now; `live/` is empty post-move).
- **Tests (Media):** raw output is mp3 @~128k for a wav input; an already-128k mp3 is kept as-is;
  cover >1 MB or non-image is discarded while ingestion still succeeds; `_embed_one` finds audio via raw.

### Stage 7 — embedding stage timeline + finalize/notify (MEDIA + Alwyzon)
- **Why:** one continuous UTC audit trail across the admin-triggered embedding job; reach READY.
- **How (Media):** `run_embeddings_job` receives the batch `processing_dir` and appends
  `EMBEDDING/INDEXED/FINALIZING/READY` stamps to that `processing/<dt>/logs.json`. Convert the
  long-running ingestion + embedding steps to **Celery tasks** (D2): the existing HTTP endpoints
  enqueue `task.delay(...)` instead of `asyncio.create_task`; **preserve pause/resume** via the
  existing control-flag-in-JSON the task polls (re-enqueue on resume). Add a reaper for jobs stuck
  in `running` past a TTL.
- **How (Alwyzon):** finalize transitions + notify + `processing_dir` threading (A2/Stage 7).
- **Tests (Media):** `logs.json` gains the embedding stages with UTC times; a Celery-wrapped job
  still pauses/resumes; reaper flips a stale job to failed.
- **Tests (Alwyzon):** finalize → READY + webhook.

## B3. Media test gotchas
- `conftest.py` sets a **session-scoped** temp sandbox (not per-test) — use **unique partner ids /
  slugs** per test and clean up partition state; `partner_faiss_repository.clear_partner_indexes_cache()`
  evicts cached indexes (see `test_pipeline_and_failures.py::test_similarity_query_by_upload_success`).
- Internal endpoints need header `{"Authorization": f"Bearer {settings.hetzner_internal_api_key}"}`.
- ffmpeg/ffprobe are real in tests — keep happy-path audio tiny but valid, or monkeypatch the probe.
- Keep AV disabled except in the specific `AV_INFECTED` test (set `enabled=True` on the service there).

---

## Suggested order to finish
4 (Media validation + Alwyzon severities) → 5 (move + `processing/` exposure) → 6 (transcode + covers)
→ 7 (embedding timeline + finalize/notify + Celery conversion). Each stage: implement, add tests in
**both** repos, run **both** suites to green, then tick the stage in
`docs/ingestion_pipeline_v2_plan.md` (§6 + progress log).

## Baselines to protect
Alwyzon **299 passed** · Media **78 passed**. Never regress these.
