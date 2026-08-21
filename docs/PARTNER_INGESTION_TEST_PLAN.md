# Partner Ingestion — End-to-End Test Plan (Electrobuzz)

> **Created 2026-08-19.** Goal: prove the reworked partner ingestion pipeline handles a real
> catalogue batch end to end, from SFTP upload through to tracks being queryable via the API and
> visible in admin. Dry run at **50 tracks** first, then the full **5,000**.
>
> Test partner: **`test_electrobuzz_5000`**, created solely for this and deleted afterwards.

---

## 1. Why

The ingestion pipeline was broken into explicit stages so a failure can be traced to the step that
caused it, and the partner notified. That has not been exercised against a real batch at scale. This
plan does that, and treats any failure as a finding to log rather than to fix on the spot.

---

## 2. State of the pipeline (verified against code 2026-08-19)

### The shape

```
partner uploads to live/ via SFTP
   └── uploads .done  ──▶ SFTPGo hook ──▶ Alwyzon POST /internal/sftp/event
                                            │  guard: partner already has an active batch?
                                            │     └─ YES → media deletes ONLY the .done, notify → STOP
                                            ▼
RECEIVED → VALIDATING → (MOVED) → PERSISTING → (TRANSCODING) → INGESTED
                                            → EMBEDDING → INDEXED → FINALIZING → READY
```

Alwyzon owns the DB and orchestration. The media box owns the files and does the heavy work, and has
no DB. Media never writes to the database; Alwyzon never touches the files.

### What is built (verified in code)

- **Concurrency guard.** One active batch per partner. A second `.done` is hard-rejected: media
  deletes only that marker, the rest of `live/` is untouched, and the partner is notified. Backed by
  a per-partner Redis lock to close the two-marker race.
- **Validation.** Manifest header and ISRC-format checks, real-audio probe via ffprobe, a maximum
  source duration, `.wav` / `.flac` / `.mp3` / `.aiff` accepted, zip handling with a strict
  allowlist, and clamAV scanning. All-or-nothing: one bad row fails the whole batch.
- **Dry-run mode.** Uploading to `test/` instead of `live/` validates and reports counts without
  persisting anything.
- **Atomic move.** On successful validation, every file is moved `live/ → processing/<UTC-dt>/` one
  `os.replace` at a time, with a same-filesystem assertion that hard-fails rather than silently
  falling back to a copy. `live/` is empty afterwards.
- **Partner-visible snapshot.** `processing/<dt>/` holds the originals, the manifest, and a
  sanitized `logs.json`. Read-only over SFTP; `internal/` stays hidden.
- **Persistence.** Track and audio-file rows written to the Alwyzon DB, guarded against
  double-persist by a lock and a staleness check.
- **Transcode.** A separate job converts each track to `internal/raw/<uuid>.mp3` at 128 kbps, read
  from `processing/<dt>/`. Auto-spawned after persist and runs concurrently with embedding.
- **Embeddings and index.** Auto-spawned, then FAISS index and catalog build.
- **Stage timeline.** `ingest_logs.stage` and `stage_timeline` (UTC) record `RECEIVED`,
  `VALIDATING`, `PERSISTING`, `INGESTED`, `EMBEDDING`, `INDEXED`, `FINALIZING`, `READY`, plus the
  failure states. Surfaced to admin and mirrored into the partner's `logs.json`.
- **Admin controls.** Ingestion trigger, batch retry, pause and resume on the processing jobs.
- **Failure reporting.** Per-row `IngestionError` records with stable codes, an `errors.txt` in the
  batch folder, and partner webhook notification.

---

## 3. Notes from reading the pipeline

Five things worth knowing before running the test. None of them is a fault in the pipeline: four are
behaviours to work with, and the first is a small reporting improvement that is **awaiting approval**
and can be picked up whenever it suits.

### F1. One stage reaches the partner's log but not the admin view (awaiting approval)

`MOVED` and `TRANSCODING` are declared in `Stage` and listed in `ORDERED_STAGES` / `ACTIVE_STAGES`,
but nothing calls `advance_stage` with either, so neither ever reaches `ingest_logs.stage_timeline`.

They are not entirely missing though, and the split matters:

- **`MOVED` is written to the partner's `logs.json`** by the media runner, straight after the atomic
  move. So the partner can see the batch reached MOVED while **admin, which reads the DB timeline,
  cannot**. A move failure shows in admin as still `VALIDATING`.
- **`TRANSCODING` is not written at all** on the default path. Transcoding stopped being part of
  ingestion: it is now its own `PartnerProcessingJob` auto-spawned after persist, running
  concurrently with embedding, with its own admin-visible job row. It is only written to `logs.json`
  under the legacy `INGEST_INLINE_TRANSCODE=true` fallback.

**What it costs in practice.** The move is where files leave `live/`, and recovery differs on either
side of it (see F5). If a batch ever fails there, admin would read `VALIDATING` and have to check the
media box by hand to tell which side it stopped on. Everything else about the batch is reported
normally.

*Shape of the change:* stamp `MOVED` into the DB timeline, and **remove `TRANSCODING` from the ingest
stage list** rather than stamping it, since stamping it there would now be inaccurate. The batch
legitimately reaches `INGESTED` while the transcode runs alongside embedding as a separate tracked
job.

*Scope of the impact:* `ORDERED_STAGES` is not consumed anywhere, so no progress bar, percentage or
API response is affected. Nothing in the pipeline behaves incorrectly. This is about how clearly a
move-time failure would be reported, in the event of one.

### F2. `.done` must arrive over SFTP, not be written to disk

The trigger is `POST /internal/sftp/event` with `action == "upload"` and the filename `.done`, fired
by SFTPGo. **Creating `.done` with `touch` or `cp` on the media box fires nothing at all** and the
batch simply never starts.

This constrains the script split in §5: script 2 runs on the media box and must never create the
marker. Script 1 sends it, over SFTP.

### F3. The built-in dry run is shallower than it looks

Uploading to `test/` instead of `live/` is a real dry-run mode: it validates, reports counts, and
persists nothing. Use it. But it goes **straight from VALIDATING to READY**, so it never exercises
MOVED, PERSISTING, TRANSCODING, INGESTED, or the embedding chain.

Treat `test/` as a free pre-flight on the manifest and the files. It is not a rehearsal of the
pipeline.

### F4. One active batch per partner, by design

A second `.done` while a batch is active is hard-rejected: media deletes only that marker, the rest of
`live/` is untouched, and the partner is notified. There is deliberately no cancel-batch action
(D11), since pause and resume cover the intended cases.

For this test it means the runs are strictly sequential, and a batch left in a non-terminal stage
holds the partner's slot until it resolves. Worth having a way to clear a stalled row to hand before
starting, so the "fail, fix, resume" loop in §4 is not held up waiting for one.

### F5. Take the backup before `.done`, because retry reads `live/`

`POST /admin/ingestion/logs/{log_id}/retry` creates a **new** ingest log and re-reads the partner's
`live/` folder. But a successful validation atomically moves everything out of `live/`, leaving it
empty. So retry only helps for a batch that failed **before** the move.

The backup step in §5 is therefore not a nicety, it is the recovery mechanism. Take it before `.done`
is sent, because after the move there is nothing left in `live/` to copy.

### Also noted

`INGEST_SKIP_VALIDATION=true` exists as an env flag to skip all per-file checks, commented "for our
own bulk loads only". **Leave it off for this test.** Validation is part of what is being proved.

---

## 4. Test phases

Run in order. Do not proceed to the next phase until the current one is green end to end.

### Phase 0 — Setup
- [ ] Create partner `test_electrobuzz_5000` and provision its SFTP user.
- [ ] Record the partner id and the UUID slug (its on-disk folder name).
- [ ] Confirm `live/`, `test/` and `processing/` exist under the slug, and that `internal/` is hidden
      from the SFTP user.
- [ ] Confirm `live/` and `processing/` are on the **same filesystem** (the move hard-fails otherwise,
      per D1).

### Phase 1 — Dry run, 50 tracks into `test/`
- [ ] Script 1 uploads 50 tracks plus the generated `manifest.csv` into **`test/`**.
- [ ] Script 2 validates the upload (count and filename reconciliation) and takes the backup.
- [ ] Script 1 sends `.done`.
- [ ] Expect: VALIDATING then READY, `dry_run: true`, zero rows persisted.
- [ ] Any manifest or file-format problem surfaces here, before a live batch is burned.

### Phase 2 — Live run, 50 tracks into `live/`
- [ ] Same upload, into **`live/`**.
- [ ] Monitor the stage timeline through to READY.
- [ ] Verify at each step:
  - [ ] `live/` is empty after the move, `processing/<dt>/` holds the originals, the manifest, and `logs.json`
  - [ ] `internal/raw/<uuid>.mp3` exists per track, at 128 kbps
  - [ ] Track rows persisted with the expected count
  - [ ] Embeddings and FAISS index built
- [ ] End-to-end checks once READY:
  - [ ] Tracks returned by the partner-facing API
  - [ ] Tracks searchable, and similarity returns them
  - [ ] Admin: partner detail, ingestion logs, stage timeline, track list all correct
  - [ ] `logs.json` in `processing/<dt>/` matches the DB timeline and leaks no host paths

### Phase 3 — Fix and re-prove
- [ ] Log every failure in §7 rather than fixing inline.
- [ ] For each fix, run a **localised** test of that specific step first.
- [ ] Then re-run **Phase 2 from scratch** on a clean batch. A partial resume does not count.

### Phase 4 — Full run, 5,000 tracks
- [ ] After Phase 2 has passed end to end with no outstanding findings.
- [ ] Same sequence, 5,000 tracks.
- [ ] Watch for scale-only failures: timeouts, memory on the transcode and embedding steps, FAISS
      build time, and any per-file work that is linear where it should be batched.

### Phase 5 — Teardown
- [ ] Delete partner `test_electrobuzz_5000` and confirm its folder, DB rows, embeddings and index
      are all removed.

---

## 5. The two scripts

### Script 1 — uploader (runs locally, talks SFTP)

Reads a text file of local audio paths, one per line.

1. For each path, extract tags using the **same** extractor Alwyzon uses,
   `app/services/metadata_service.py::extract_metadata`, so the manifest matches what the platform
   would have read.
2. Build `manifest.csv` with the required headers: `isrc`, `title`, `audio_filename`,
   `display_artist`. Report and skip any track missing an ISRC rather than inventing one, since the
   validator enforces the ISRC format.
3. Upload the audio files and `manifest.csv` over SFTP into the chosen env (`test/` or `live/`).
4. **Stop.** Do not send `.done`.
5. Separate `--send-done` flag, run only after script 2 reports clean, which uploads the `.done`
   marker over SFTP (see F2).

### Script 2 — validator and backup (runs on the media box)

Flag-driven, each check invocable on its own.

- `--validate-ingestion` — light checks only. Count the files in the env folder, parse
  `manifest.csv`, and reconcile the two by filename in both directions. Report extras and missing.
  No audio decoding.
- `--backup` — copy the env folder to a backup location on the same box, so a failed batch does not
  need re-uploading. Must run **before** `.done` (F5).
- `--status` — read the current batch stage via the proper ingestion routes, for periodic polling.
- `--verify-ready` — once READY, exercise the end-to-end checks in Phase 2: API returns the tracks,
  search and similarity find them, admin endpoints are correct.

---

## 6. Improvements raised by this review (separate from the test run)

**F1 — report `MOVED` in the admin view. Awaiting approval. ~1 - 2 hours.**

Stamp `MOVED` into the DB timeline and drop `TRANSCODING` from the ingest stage list. Touches three
files: `ingestion_runner.py` on media (write an intermediate job state at the move),
`ingestion_service.py` on Alwyzon (read the stage while the job is still running rather than
returning early), and `ingestion_stages.py` (the stage list). **No migration, no API change, no
frontend change.**

No dedicated verification needed. It can be confirmed by watching the stage timeline on the next test
run, or by deliberately failing a batch at the move to see it reported.

Independent of the test schedule. Can be picked up whenever it suits, before or after Phase 4.

**Docs housekeeping.** `ingestion_pipeline_v2_plan.md` and `ingestion_v2_handoff.md` were last
touched 2026-06-19 and still describe Stages 4 to 7 as not started, which no longer matches the code.
Worth refreshing before either is used as a status reference.

---

## 7. Findings log (fill in during the run)

| # | Phase | What happened | Stage reported | Root cause | Fixed? |
|---|---|---|---|---|---|
| | | | | | |

---

## 8. Notes for whoever runs this

- Every pipeline timestamp is **UTC**. The Alwyzon box is UTC; the media box is **Europe/Berlin**, so
  its journal and nginx logs are two hours ahead. `journalctl --since` parses in the box's local zone
  even when `--utc` is passed, so pass `TZ=UTC` or an explicit zone.
- Batches are serialised per partner. If one wedges, the next `.done` is rejected outright, so clear
  the stuck row before retrying (F4).
- The backup is the only recovery route once a batch has moved out of `live/` (F5).
