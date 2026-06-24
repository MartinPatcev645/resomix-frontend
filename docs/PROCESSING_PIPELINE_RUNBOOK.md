# Processing Pipeline — Runbook & Single Source of Truth

> **Scope:** the end-to-end **ingestion → processing** pipeline and its four background jobs
> (**transcode → embeddings ∥ peaks ∥ segments**), how it is built, how to operate it, and how
> to test it **both locally and against running (production) processes**.
> **Audience:** anyone (including future-you, manually) operating or extending this system.
> **Companion docs:** `docs/ingestion_pipeline_v2_plan.md` (the design/decisions),
> `docs/ingestion_v2_handoff.md` (per-stage handoff),
> `resomix-similarity-open/docs/reference/INGESTION_PIPELINE_REDESIGN.md` (the merged spec incl. §9 playback).
>
> **Two repos / two roles — memorise this split, it governs the whole doc:**
> - **Alwyzon** = `basic_fastapi_server_resomix` — the **control plane**. Owns the **database**,
>   auth, the SFTP hooks, orchestration, Celery jobs, partner records. **Never touches partner files.**
> - **Hetzner / Media** = `resomix-similarity-open` — owns the **partner files on disk** and does
>   all **heavy processing** (validation, transcode, embeddings, peaks, segments, FAISS). **DB-less.**
>
> ⚠️ Values marked **`VERIFY`** are from earlier notes and must be confirmed against the live box.

---

## 0. Quick reference (cheat sheet)

| | **Alwyzon** (control plane) | **Hetzner / Media** | **GPU** |
|---|---|---|---|
| Repo | `basic_fastapi_server_resomix` | `resomix-similarity-open` | (embedding model server) |
| Repo path (prod) | `~/usman/basic_fastapi_server_resomix` (user `alwyzon`) | `~/usman/resomix-similarity-open` (user `ubuntu`) | — |
| Run script (prod) | `python run_alwyzon.py` | `python run.py` | — |
| Owns | DB, auth, orchestration, Celery | partner files, heavy compute, FAISS | MAEST/Discogs embeddings |
| Local port | **8001** | **8004** | **8006** |
| **Prod** port | **8001** | **8002** | **8005** |
| Prod host | `193.219.97.122` (`tracklizer`) | `135.181.218.143` (`media.resomix.com` `VERIFY`) | `46.4.100.18` |
| Background work | **Celery + Redis** (persist, finalize, webhooks) | **FastAPI in-process BackgroundTasks** (no Celery) | n/a |
| Auth to it | `X-API-KEY: <RESOMIX_API_KEY>` (admin) | `Authorization: Bearer <HETZNER_INTERNAL_API_KEY>` (internal) | internal |

**Local keys/paths (verified on this machine):**
- Admin key (`settings.api_key`, from env `RESOMIX_API_KEY`): the `bearer-resomix-api-…` value — read it with
  `cd basic_fastapi_server_resomix && .venv/bin/python -c "from app.core.config import settings; print(settings.api_key)"`
- Internal key (`HETZNER_INTERNAL_API_KEY`, identical on both repos' `.env`): `RESOMIX_INTERNAL_…`
- Alwyzon → media base URL: `settings.similarity_server_url` (env `SIMILARITY_SERVER_URL` / `HETZNER_URL`) = `http://localhost:8004` locally.
- Media partner files root (`PARTNER_SFTP_ROOT`): `resomix-similarity-open/dev_partner_data/sftp/partners/<slug>/` locally; **`/srv/sftp/...` in prod `VERIFY`**.

**The five commands you will use most:**
```bash
# 1. Apply DB migrations (ALWYZON only — Media is DB-less). Run after EVERY pull/model change.
cd basic_fastapi_server_resomix && .venv/bin/alembic upgrade head

# 2. Start the Alwyzon Celery worker (REQUIRED for persist/finalize/webhooks).
cd basic_fastapi_server_resomix && .venv/bin/celery -A app.tasks worker --loglevel=info

# 3. Run unit tests.
cd basic_fastapi_server_resomix && .venv/bin/python -m pytest tests/ -q       # needs DB + `alembic upgrade head`
cd resomix-similarity-open    && .venv/bin/python -m pytest tests/ -q          # self-contained, no DB

# 4. Health-check a running server.
curl -s http://localhost:8001/health   # Alwyzon
curl -s http://localhost:8004/health   # Media

# 5. Tail a manually-started process's log (see §7 for how we start them).
tail -f /tmp/<service>.log
```

---

## 1. What this pipeline does (intention)

A partner uploads audio + a CSV manifest over SFTP and drops a `.done` marker. From there the
system, with **no manual step**, turns each track into: a storage-friendly **128 kbps mp3**, a
**similarity vector** (so it is searchable), and — for *playback* partners — a **waveform** and
**HLS streaming segments**. Every stage is validated, auditable, resumable, and scale-safe
(designed for 50k–1M tracks per partner).

---

## 2. Architecture & data flow

```
 PARTNER SFTP upload (live/) ─ .done ─┐
                                      ▼  (SFTPGo hook on the MEDIA box → Alwyzon /internal/sftp/*)
 ALWYZON: create ingest_logs row ──▶ POST media /internal/ingestion/run
                                      ▼
 MEDIA: validate (CSV→fields→files→ffprobe→clamAV, fail-fast) → atomic move live/→processing/<UTC>/ → write result JSON
                                      ▼  (Alwyzon polls /internal/ingestion/status)
 ALWYZON: stage=PERSISTING → Celery task `persist_and_finalize_ingestion`
          → inserts Track/AudioFile/TrackProcessingStatus (chunked, idempotent) → ingest_log COMPLETED
          → AUTO-SPAWN the jobs (no admin click):
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │  TRANSCODE job  (processing/<dt>/<file> → internal/raw/<uuid>.mp3, 128k, atomic)    │  CPU (3/4 cores)
 │      │ each mp3 written ──readiness──▶ consumed by:                                 │
 │      ├─▶ EMBEDDINGS job (raw mp3 → MAEST+Discogs .npy → FAISS)   overlaps transcode │  GPU
 │      └─(after transcode, ONLY if service_mode==similarity_playback)                 │
 │          ├─▶ PEAKS job    (raw mp3 → internal/peaks/<uuid>.v2.json)                 │  CPU
 │          └─▶ SEGMENTS job (raw mp3 → internal/segments/<uuid>/ : .ts + hls.m3u8)    │  CPU
 └──────────────────────────────────────────────────────────────────────────────────┘
   Each job: MEDIA runs it as an in-process background task, writes internal/processing/<job_id>.json.
   ALWYZON polls /status; on terminal → claims (status='finalizing') → Celery task `finalize_processing_job`
   → applies per-track status in bulk → job completed|partial|failed.
```

**Key principle:** Media does the work and writes JSON state files; Alwyzon owns the DB and reads
those JSONs back. Media **never** writes the DB; Alwyzon **never** writes partner files.

---

## 3. Status — what is DONE and what REMAINS (2026-06-24)

### ✅ Done & verified (unit tests green + **live end-to-end tested** on the running servers)

**Ingestion gate (MEDIA):** cost-ordered fail-fast validation (CSV → field → file-exists → ffprobe
real-audio → clamAV), 30-min over-length cap, atomic `live/→processing/<UTC>/` move, zip strict-allowlist,
cover-art extraction, one-active-batch-per-partner hard reject.

**DB persist (ALWYZON):** the validated batch is inserted by a **true Celery background task**
(`persist_and_finalize_ingestion`) — chunked (fresh session/chunk), idempotent (skip-existing by uuid),
resumable, off the admin request. Handles 50k–1M without timing out.

**Four processing jobs:**
- **Transcode** (→128k mp3, atomic temp+rename) — MEDIA `transcode_runner.py`.
- **Embeddings** (→.npy + FAISS) — runs **concurrently with transcode** (GPU not idle); MEDIA `processing_runner.py`.
- **Peaks** (→`peaks/<uuid>.v2.json`, rich v2 waveform) — MEDIA `stage_runner.py`. *Playback partners only.*
- **Segments** (→`segments/<uuid>/` HLS) — MEDIA `stage_runner.py`. *Playback partners only.*

**Orchestration (ALWYZON):** auto-spawn (ingestion→transcode∥embeddings; transcode→peaks∥segments gated on
`service_mode==similarity_playback`); debounce (one active job per type/batch); the **terminal per-track
apply runs in a Celery task** (`finalize_processing_job`) in **bulk chunks** (no N-query-in-request);
failed-track handling per the **failure matrix** (transcode/embedding failure deactivates the track;
**peaks/segments failure does NOT** — playback-only); partner/admin failure notifications; lightweight
status polls (records fetched once, not every poll).

**Admin controls (ALWYZON):** trigger (`/processing/jobs/embeddings`, `/processing/jobs/{peaks|segments}`),
pause (`/jobs/{id}/pause`, all job types), resume (embeddings), list/detail (`GET /processing/jobs[/{id}]`),
batch takedown (`/tracks/stop-batch`).

**Infra fix (ALWYZON):** all async Celery tasks now use `run_async_task` (see §5/§6) — the previous
`asyncio.run` per task was broken with the shared async DB engine.

**Live tested (2026-06-24):** real peaks **v2 JSON** + real **HLS segments** generated from a real mp3;
admin trigger→debounce→poll→**automatic** background finalize; failure-no-deactivate confirmed in the DB.

### ⏳ Remaining (full *playback* go-live — §9 of the redesign doc)
1. **Enforce `service_mode` at serving** — block playback-token minting for `similarity_only` partners
   (the jobs are gated; the serving-side 403 is the missing half).
2. **Provision playback folders** by `service_mode` at SFTP provision time.
3. **Set partner 1 (open tracks) → `similarity_playback`** and **backfill** its peaks/segments
   (use the manual trigger — proven working).
4. Optional: a knob to cap the embedding "artifact" `document_files` rows for very large partners.

> Search-only onboarding is unblocked today. Playback needs items 1–3.

---

## 4. Stage-by-stage reference (where each thing lives)

### 4.1 Files on the MEDIA box (per partner, by **slug** not id)
Root: `PARTNER_SFTP_ROOT/<slug>/` (local: `resomix-similarity-open/dev_partner_data/sftp/partners/<slug>/`; prod `/srv/sftp/...` `VERIFY`). Partner 1's slug is `000000000000`.

| Path | Written by | Read by |
|---|---|---|
| `live/` | partner (SFTP) | validation |
| `processing/<UTC-dt>/` | move step (the moved originals + `logs.json`) | transcode |
| `internal/raw/<uuid>.mp3` | **transcode** (128k, atomic) | embeddings, peaks, segments |
| `internal/embeddings/{maest,discogs}/<uuid>.npy` | **embeddings** | FAISS rebuild, search |
| `internal/peaks/<uuid>.v2.json` | **peaks** | peaks serving endpoint |
| `internal/segments/<uuid>/{<uuid>_000.ts, hls.m3u8}` | **segments** | HLS playback serving |
| `internal/covers/<uuid>.jpg` | transcode (cover extract) | cover serving |
| `internal/processing/<job_id>.json` | every job runner (its live state) | Alwyzon `/status` polls |
| `internal/ingestion/<job_id>.json` | validation runner | Alwyzon ingestion poll |

> Compute the exact path on the box with:
> `cd resomix-similarity-open && .venv/bin/python -c "from app.core import partner_paths as p; print(p.raw_path(<PID>,'<uuid>','mp3'))"`

### 4.2 DB tables on ALWYZON
- `ingest_logs` — one per batch. `stage`, `stage_timeline` (UTC), `status` (PROCESSING→PERSISTING→COMPLETED/FAILED), `processing_dir`, `track_count`.
- `tracks` — `is_active` (False = excluded from catalog/search).
- `track_processing_status` (TPS) — per-track per-stage: `{transcode,embedding,peaks,segments}_status` (+ `_error`, `_completed_at`), `faiss_indexed`. All four `*_status` columns are **indexed**.
- `partner_processing_jobs` — one row per job. `job_type` (free string: transcode|embeddings|peaks|segments), `status` (pending→running→[paused]→finalizing→completed|partial|failed), `finalizing_at` (claim timestamp for the background finalize), counters, `error_details` (JSON, capped failure sample).
- `partners.service_mode` — `similarity_only | similarity_playback` (gates peaks/segments).

### 4.3 Endpoints
**MEDIA internal** (`Authorization: Bearer <internal key>`), base `…/internal`:
`POST /process/{transcode,embeddings,peaks,segments}/run` · `POST /process/.../pause/{partner_id}/{job_id}` ·
`GET /process/.../status/{partner_id}/{job_id}` (transcode/embeddings accept `?include_records=false`) ·
`POST /ingestion/run` · `POST /ingestion/status/{pid}/{jid}?include_records=` · `POST /ingest/remove-vectors-batch`.

**ALWYZON admin** (`X-API-KEY: <admin key>`), base `…/api/v1/admin` (also `…/admin`):
`POST /processing/jobs/embeddings` · `POST /processing/jobs/{peaks|segments}` · `POST /processing/jobs/{job_id}/pause` ·
`POST /processing/jobs/{job_id}/resume` · `GET /processing/jobs` · `GET /processing/jobs/{job_id}` ·
`POST /tracks/stop-batch` · ingestion-control endpoints under `/ingestion/...`.

---

## 5. Coding practices & conventions (how to extend safely)

**General**
- **Match the surrounding code.** Mirror an existing sibling (a new job → copy the transcode/peaks pattern).
- **Alwyzon owns the DB; Media owns files.** Never add a DB call to Media, never add a file write to Alwyzon.
- **Idempotent + resumable everywhere.** Jobs skip a track whose output already exists; re-running is safe.
- **Per-track work is bulk + chunked, never N-queries-in-a-request.** Use
  `partner_processing_service._apply_track_results_bulk` (one bulk SELECT + bulk UPDATEs per chunk, own session).
- **Heavy work goes to a background task, never the HTTP request.** Alwyzon: Celery. Media: FastAPI `BackgroundTasks`.

**Adding a new MEDIA job (e.g. a 5th stage)**
1. Add a per-track generator + a `run_<x>_job` to a runner (copy `stage_runner.py`; it reads `raw/<uuid>.mp3`, skips-existing).
2. Add `/process/<x>/{run,pause,status}` to `app/api/internal.py` (copy the peaks endpoints; reuse `StageRunRequest`/`StageStatusResponse`).
3. Keep the **job-state JSON shape** identical (`status,total,processed,succeeded,failed,results[]`) so Alwyzon polls it unchanged.

**Adding the ALWYZON side of a job**
1. `hetzner_service`: `start_<x>`, `pause_<x>`, `get_<x>_status` (copy the `_start_stage`/`_pause_stage`/`_get_stage_status` helpers).
2. `partner_processing_service`: add the stage to `_STAGE_FIELDS`; add `start_<x>_job` / `pause_<x>_job` / `apply_<x>_result`.
   Decide if a **failure deactivates** the track — add to `_DEACTIVATE_ON_FAIL` only if a failure makes the track unusable for *search* (transcode/embeddings yes; playback-only stages **no**).
3. `processing_tasks.finalize_processing_job` + the admin poll (`_refresh_processing_job_from_hetzner`): add the new `job_type` to the routing.
4. Auto-spawn (if applicable) in `apply_transcode_result`, gated as needed (e.g. `_partner_wants_playback`).

**⚠️ Celery async tasks — MANDATORY pattern.** A Celery task that runs async code **must** use
`from app.tasks.async_runner import run_async_task` and call `run_async_task(_async_core(...))`.
**Never `asyncio.run(...)`** — the shared async SQLAlchemy engine binds its pool to the first event loop,
so a bare `asyncio.run` per task makes the **2nd task in a worker crash** with
`RuntimeError: <Queue …> is bound to a different event loop`.

**Migrations (ALWYZON only)**
- Every model change to a DB table needs an Alembic migration. Write them **idempotent** (check
  `information_schema` before `add_column`/`create_index`) — see `alembic/versions/f6a7b8c9d0e1_*` for the template.
- `down_revision` must point at the **current single head** (`.venv/bin/alembic heads`). **Never reuse a revision id** —
  a collision silently forks the history (this bit us once; verify with `alembic heads` shows ONE head).

**Tests (MANDATORY each change, in EVERY repo it touches)**
- Media tests are self-contained (no DB). Alwyzon DB tests need MySQL + `alembic upgrade head` first.
- Mocked unit tests prove **logic**; they do **not** prove wiring/migrations/event-loops. **Also do the live test** in §6.3 for anything touching endpoints, Celery, or migrations.

---

## 6. Testing

### 6.1 Unit tests (logic)
```bash
# MEDIA — self-contained (temp sandbox, clamAV off). ~150 tests.
cd resomix-similarity-open && .venv/bin/python -m pytest tests/ -q
# Targeted: tests/test_stage_runner.py (peaks/segments), test_transcode_runner.py, test_overlap_embeddings.py

# ALWYZON — needs MySQL up AND migrations applied first.
cd basic_fastapi_server_resomix && .venv/bin/alembic upgrade head
.venv/bin/python -m pytest tests/ -q
# Targeted: tests/api/admin/test_admin_processing.py (jobs, finalize, peaks/segments, gating)
```
> If Alwyzon tests fail with `Unknown column …` → you forgot `alembic upgrade head`.

### 6.2 What unit tests do NOT cover (why §6.3 exists)
Mocked tests skip: real Hetzner HTTP calls, real audiowaveform/ffmpeg, the **Celery worker event loop**,
and **whether migrations were applied**. The two worst production bugs we found were invisible to unit
tests and only appeared in §6.3. **Always run §6.3 after touching endpoints, tasks, or migrations.**

### 6.3 Live end-to-end test (running processes)

**Pre-flight (do these first, in order):**
```bash
# A. ALWYZON: migrations applied?
cd basic_fastapi_server_resomix && .venv/bin/alembic current && .venv/bin/alembic heads   # current must == head
# B. ALWYZON: Celery worker running? (REQUIRED for finalize/persist)
ps aux | grep "[c]elery -A app.tasks worker" || \
  (cd basic_fastapi_server_resomix && nohup .venv/bin/celery -A app.tasks worker --loglevel=info > /tmp/celery_worker.log 2>&1 & echo "started $!")
# C. All servers healthy?
curl -s localhost:8001/health; echo; curl -s localhost:8004/health; echo
# D. Grab keys (local)
ADMIN=$(cd basic_fastapi_server_resomix && .venv/bin/python -c "from app.core.config import settings;print(settings.api_key)")
INTERNAL=$(cd basic_fastapi_server_resomix && .venv/bin/python -c "from app.core.config import settings;print(settings.hetzner_internal_api_key)")
```

**Test 1 — MEDIA job endpoint directly (proves runner + generator + auth):**
```bash
# Place a REAL mp3 at the partner's raw path (use a real file; do NOT rely on synthetic tones for audiowaveform):
UUID="11111111-2222-3333-4444-555555555555"
RAW=$(cd resomix-similarity-open && .venv/bin/python -c "from app.core import partner_paths as p;print(p.raw_path(1,'$UUID','mp3'))")
mkdir -p "$(dirname "$RAW")" && cp /path/to/a/real.mp3 "$RAW"
# Run + poll:
curl -s -X POST localhost:8004/internal/process/peaks/run -H "Authorization: Bearer $INTERNAL" -H 'Content-Type: application/json' \
  -d "{\"job_id\":999001,\"partner_id\":1,\"env\":\"live\",\"items\":[{\"track_uuid\":\"$UUID\",\"filename\":\"x.mp3\"}]}"
sleep 3; curl -s localhost:8004/internal/process/peaks/status/1/999001 -H "Authorization: Bearer $INTERNAL"
# EXPECT: status=completed, succeeded=1; and the file exists:
ls "$(dirname "$(dirname "$RAW")")/peaks/$UUID.v2.json"
```

**Test 2 — ALWYZON admin control plane (proves orchestration + Celery finalize):**
```bash
A=localhost:8001/api/v1/admin; H="X-API-KEY: $ADMIN"
# Trigger (partner must have TPS rows; peaks needs raw mp3s to actually succeed):
curl -s -X POST "$A/processing/jobs/peaks" -H "$H" -H 'Content-Type: application/json' -d '{"partner_id":<PID>,"env":"live"}'
# → {"status":"accepted","job_id":N,...}.  Immediately re-POST → {"status":"already_running"} (debounce).
# Poll until terminal (the worker finalizes it):
for i in $(seq 1 10); do sleep 4; curl -s "$A/processing/jobs/N" -H "$H" \
  | python3 -c "import sys,json;j=json.load(sys.stdin);j=j.get('job',j);print(j['status'],j['processed_tracks'],j['failed_tracks'])"; done
# EXPECT: running → finalizing → completed|partial|failed (automatically; no manual step).
```

**Verify behaviour in the DB (ALWYZON):**
```bash
cd basic_fastapi_server_resomix && .venv/bin/python -c "
import asyncio; from sqlalchemy import text
from database.connection import AsyncSessionLocal; from app.core.context import set_admin_context
async def m():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        print((await db.execute(text('SELECT peaks_status,COUNT(*) FROM track_processing_status WHERE partner_id=<PID> GROUP BY peaks_status'))).all())
asyncio.run(m())"
# EXPECT for a partial: some 'completed', some 'failed'; the 'failed' tracks remain is_active (playback failure ≠ deactivate).
```

**Cleanup after testing:** remove any test mp3s/assets you created; a dev reseed clears DB side-effects.
Stop a worker you started: `pkill -f "celery -A app.tasks worker"`.

---

## 7. Production operations (manual: tmux / nohup)

> Processes are started **manually** (nohup). Confirmed from the live deploy 2026-06-24:
> - **Alwyzon** host `tracklizer` (`193.219.97.122`), user `alwyzon`, repo `~/usman/basic_fastapi_server_resomix`,
>   API launched with `python run_alwyzon.py` on **:8001**, worker log `/tmp/celery.log`.
> - **Media** host `135.181.218.143` (behind `media.resomix.com` `VERIFY`), user `ubuntu`,
>   repo `~/usman/resomix-similarity-open`, API launched with `python run.py` on **:8002**, log `~/usman/resomix-similarity-open/nohup.out`.
> - **GPU** embedding server `http://46.4.100.18:8005` (confirmed in the media startup log).
> - Redis on Alwyzon at `127.0.0.1:6379` (DB 0, queue `celery`).

### 7.1 ALWYZON box — what runs here (user `alwyzon`)
1. **API server** — `python run_alwyzon.py` on :8001.
2. **Redis** (Celery broker) — `redis-server` at 127.0.0.1:6379.
3. **Celery worker** — `celery -A app.tasks worker` (**REQUIRED**; without it persist/finalize/webhooks never run and jobs hang at `finalizing`/`PERSISTING`).

```bash
cd ~/usman/basic_fastapi_server_resomix && source .venv/bin/activate
ps aux | grep -E "[r]un_alwyzon|[c]elery|[r]edis-server"   # find them
# Restart the API: kill the old run_alwyzon.py PID, then:
nohup python run_alwyzon.py &                              # appends to ./nohup.out
# Restart the worker (REQUIRED on every deploy — a running worker keeps OLD code):
pkill -f "celery -A app.tasks worker"
nohup .venv/bin/celery -A app.tasks worker --loglevel=info --concurrency=4 > /tmp/celery.log 2>&1 &
tail -f /tmp/celery.log                                    # worker log
```

### 7.2 MEDIA / Hetzner box — what runs here (user `ubuntu`)
1. **API server** — `python run.py` on **:8002** (behind `media.resomix.com` `VERIFY`).
2. **clamAV daemon** (`clamd`) — validation depends on it (AppArmor profile already configured for `/srv/sftp/**` `VERIFY`).
3. **SFTPGo** — fires the SFTP hooks to Alwyzon.
4. **No Celery here** — jobs run inside the API process as FastAPI background tasks. If the API restarts
   mid-job, the in-flight job is lost but **resumable**: re-trigger it from Alwyzon (outputs skip-existing).

```bash
cd ~/usman/resomix-similarity-open && source .venv/bin/activate
ps aux | grep -E "[r]un.py|[c]lamd|[s]ftpgo"               # find them
# Restart API → kill the old run.py PID, then:
nohup python run.py &                                      # appends to ./nohup.out
tail -f nohup.out                                          # media log (watch a running job)
```

### 7.3 Deploy sequence (every release)
```
# ON BOTH BOXES: git pull (your usual mechanism)
# ON ALWYZON ONLY:
cd <ALWYZON_REPO> && .venv/bin/alembic upgrade head        # ← do NOT skip; missing migrations = 500s
#   then restart: API server, AND the Celery worker (it has stale code until restarted)
# ON MEDIA: restart the API server (picks up new runners/endpoints)
# GPU: restart only if its code changed
```
> The user runs `git pull` / commits themselves. **The two things people forget:** (a) `alembic upgrade head`,
> (b) **restarting the Celery worker** (a running worker keeps old task code until restarted).

### 7.4 Testing on running PROD processes (safely)
- Use the **internal key** for media and the **admin key** for Alwyzon (from each box's `.env`).
- Prefer a **throwaway/test partner**, not a real one. Triggering a job on a real partner is generally safe
  (idempotent, skip-existing) but **`/tracks/stop-batch` is destructive** (removes vectors + rebuilds FAISS) — never on a real partner without intent.
- For a real generation test, drop a real mp3 at that partner's `internal/raw/<uuid>.mp3` for a uuid that
  exists in the DB, then trigger. Remove it afterward.
- Watch the worker log (Alwyzon) + the media API log while polling the admin job detail.

---

## 8. Good-to-knows (gotchas that have actually bitten us)

1. **Run `alembic upgrade head` after any pull/model change (ALWYZON).** A behind DB → the running server
   500s with `Unknown column …`. Unit tests won't catch it; the live server will.
2. **The Celery worker must be running and restarted on deploy.** No worker → jobs sit at `finalizing` /
   ingest stays `PERSISTING` forever. Stale worker → it runs old task code.
3. **Async Celery tasks use `run_async_task`, never `asyncio.run`** (see §5). This was a latent crash in
   webhooks + persist + finalize.
4. **Media jobs are in-process (not Celery).** A media restart mid-job loses the in-flight run — just
   re-trigger from Alwyzon (skip-existing makes it resume).
5. **Failure matrix:** transcode/embedding failure → track `is_active=False` (out of search).
   **peaks/segments failure → track stays active** (only playback degraded). Encoded in `_DEACTIVATE_ON_FAIL`.
6. **`service_mode` gates peaks/segments.** `similarity_only` partners never auto-spawn them; the manual
   trigger (`POST /processing/jobs/{peaks|segments}`) still works (for backfill).
7. **Peaks output is the v2 rich JSON** (`peaks/<uuid>.v2.json`); the legacy full-file preview endpoint is
   set aside. Serving loads the pre-generated asset directly when it exists (no on-demand needed).
8. **Status polls are lightweight.** The poll fetches counts only; the big per-track `results` array is
   pulled **once** by the background finalize task (avoid re-downloading/​parsing 100s of MB per poll).
9. **FAISS (HNSW) can't delete in place** → any vector removal triggers a full index rebuild. Batch
   takedown removes all + rebuilds **once** (`/tracks/stop-batch` → media `/ingest/remove-vectors-batch`).
10. **All pipeline timestamps are UTC.**

---

## 9. Precautions

- **Never run `git commit` / `git push`** — the human does that. Leave changes in the working tree.
- **Migrations are additive & idempotent** — never drop/rename a column that production data uses without a plan.
- **`/tracks/stop-batch` and remove-vectors are destructive** (delete embeddings + rebuild FAISS). Confirm partner + scope first.
- **Don't trigger a full-catalog job on a 1M partner casually** — it hands the whole item list to media. Use `ingest_log_id` to scope, or expect a long run.
- **clamAV must be up on MEDIA** or validation rejects/queues batches.
- **Keys are secrets.** Read them from `.env` / `settings`; don't paste them into committed docs or code.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Admin endpoint 500 `Unknown column 'partner_processing_jobs.finalizing_at'` (or `transcode_status`) | Migrations not applied | `alembic upgrade head` (ALWYZON) |
| Job stuck at `finalizing`; ingest stuck at `PERSISTING` | Celery worker not running (or crashed) | Start/restart the worker; it auto-recovers (stale claim re-enqueues after 15 min) |
| Worker log: `Queue … bound to a different event loop` | A task using bare `asyncio.run` | Use `run_async_task` (§5); restart worker |
| Job result: per-track `"transcoded mp3 not found"` | No `internal/raw/<uuid>.mp3` (transcode didn't run / wrong partner slug) | Ensure transcode ran first; verify the raw path with `partner_paths.raw_path(...)` |
| Media call → `403` | Missing/wrong `Authorization: Bearer <internal key>` | Use `HETZNER_INTERNAL_API_KEY` (same on both repos) |
| Admin call → `403` | Missing/wrong `X-API-KEY` | Use `settings.api_key` (`RESOMIX_API_KEY`) |
| peaks/segments never auto-spawn | Partner is `similarity_only` | Set `service_mode=similarity_playback`, or trigger manually |
| `alembic heads` shows TWO heads | Duplicate/forked revision id | Fix the offending migration's `revision`/`down_revision` to a single chain |
| Embeddings job runs but `faiss_indexed` stays false | Indexing is deferred to the end-of-job FAISS rebuild | Expected; vectors are searchable after the rebuild |

---

## 11. File map (where the code is)

**ALWYZON** (`basic_fastapi_server_resomix`)
- `app/services/ingestion_service.py` — ingestion poll, persist enqueue, `finalize_successful_ingestion`.
- `app/services/ingestion_persist.py` — chunked idempotent insert.
- `app/services/partner_processing_service.py` — start/pause/apply for all 4 jobs, bulk apply, auto-spawn, `_DEACTIVATE_ON_FAIL`, `_partner_wants_playback`.
- `app/services/hetzner_service.py` — HTTP client to media (start/pause/get_status for each stage).
- `app/tasks/` — `celery_app.py`, `async_runner.py` (**the event-loop fix**), `ingestion_tasks.py` (persist), `processing_tasks.py` (finalize), `webhooks.py`.
- `app/api/routers/admin/processing.py` — admin endpoints + the poll `_refresh_processing_job_from_hetzner`.
- `app/models/{track_processing_status,partner_processing_job,partner}.py`; `alembic/versions/*`.

**MEDIA** (`resomix-similarity-open`)
- `app/services/ingestion_runner.py` — validation + `transcode_one_track`.
- `app/services/transcode_runner.py` — transcode job.
- `app/services/processing_runner.py` — embeddings job (+ shared job-state/pause helpers).
- `app/services/stage_runner.py` — **peaks + segments jobs** (`generate_one_peaks/segments`, `run_peaks/segments_job`).
- `app/services/{peaks_service_v2,segmentation_service}.py` — the actual generators.
- `app/api/internal.py` — all `/internal/process/*` + `/internal/ingestion/*` endpoints.
- `app/core/partner_paths.py` — the canonical path helpers (raw/peaks/segments/embeddings/...).

---

*Last updated 2026-06-24. Keep this current: when you add a stage or change an op, update §3, §4.3, §8, §11.*
