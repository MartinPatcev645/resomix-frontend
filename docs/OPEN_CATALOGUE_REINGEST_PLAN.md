# Re-ingesting the open catalogue through the partner pipeline

> **Created 2026-08-22.** Goal: bring the ~300–400k tracks added to the Electrobuzz source in the
> last year into the platform, by routing them through the **partner ingestion pipeline** rather
> than the old per-track HTTP pipeline, then promoting the Apple-matched ones into partner 1.
>
> Written after the partner ingestion pipeline was proven end to end at ~5,000 tracks
> (see `PARTNER_INGESTION_TEST_PLAN.md`).

---

## 0. The short version

1. Work out the true resume date from the **database**, not from a year-old run log.
2. Create a **fresh partner** and ingest everything newer than that date, in batches, through the
   partner SFTP pipeline. Validation relaxed, since this is our own content.
3. Run the **existing Apple matching** scripts over the result.
4. **Promote** the Apple-matched tracks into partner 1: move the vectors, repoint the DB rows,
   populate `apple_music_tracks`.

Steps 2 and 4 are the new work. Step 3 already exists and is unchanged.

---

## 1. Answering the question first: do we store the original paths?

**Yes, in two different places, and they mean different things.** This was verified in code, not
assumed.

| Column | Written by | Holds | Notes |
|---|---|---|---|
| `audio_files.stored_path` | `track_upload_service.py:607` (`full_path` when supplied) | For `type='open'`: the **original Vegerra path**. For partner ingestion: `internal/raw/<uuid>.<ext>` | Has a UNIQUE key `uq_audio_path (partner_id, stored_path(512))` |
| `tracks.source_file_path` | **Only** `scripts/apple_music/insert_matched_tracks.py` | The original path, described there as "the ONLY ref back to the Electrobuzz master" | `String(600)`, nullable. Nothing in the running app writes it |

So the open pipeline does save the real path: `open_tracks_pipeline_controller` passes
`full_path=path` into `upload_track_to_database_with_uuid`, which sets
`stored_path = full_path if full_path else secure_filename`. There is also a duplicate check that
queries on that path, so it is load-bearing, not decorative.

**Why the first run of `catalogue_high_water_mark.py` found nothing.** It defaults to
`--type electrobuzz`, and the 2M live tracks are `type='open'` (`TrackType.OPEN`, `models/constants.py`).
It matched only the 4,967 tracks of the ingestion test partner, whose `stored_path` is
`internal/raw/<uuid>.mp3` and carries no date. Nothing is missing; the filter was wrong:

```bash
python scripts/catalogue_high_water_mark.py --type open --top 5 --show-roots
```

Confirm the shape first, in case `asset_class` differs for open tracks:

```sql
SELECT t.type, COUNT(*) AS tracks FROM tracks t GROUP BY t.type ORDER BY tracks DESC;

SELECT t.type, af.asset_class, LEFT(af.stored_path, 130) AS sample
  FROM tracks t JOIN audio_files af ON af.track_id = t.id
 WHERE t.type = 'open' ORDER BY af.id DESC LIMIT 5;
```

If `asset_class` is not `Master` for open tracks, that filter in the script needs relaxing. The
`jsonl` fallback is not needed.

---

## 2. Why route through the partner pipeline at all

The old open pipeline is **one HTTP request per track**, each carrying the audio file, doing
metadata extraction, preview generation and a DB write inline. The October 2025 run shows what that
costs at scale: **861 failures out of 24,019**, almost all server-side (607 × HTTP 500, 226 × 503,
9 × 502). Those tracks are simply absent, and nothing retried them.

The partner pipeline is batch-oriented, resumable, and now proven: bulk SFTP upload, one manifest,
all-or-nothing validation, atomic move, chunked DB persist with per-record isolation, transcode and
embedding as restartable jobs with per-track status. At 4,738 tracks it ran **0 failures** in
4h 31m wall clock.

At 300–400k tracks the difference is not stylistic. It is the difference between a run you can
resume and one you cannot.

---

## 3. Step A — establish the resume point

**Do not trust the run logs.** `monthly_pipeline/_tracks/MM-YYYY_success.txt` records what a run
*believed* it sent, up to a year ago, and October's 861 failures are exactly the case where belief
and reality diverge.

```bash
# On Alwyzon. Derives every date from the path string; never consults created_at.
python scripts/catalogue_high_water_mark.py --type open --top 5 --show-roots
```

For comparison only, the electrobuzz-side answer from the run logs:

```bash
# On the electrobuzz box.
python3 monthly_pipeline/last_ingested_date.py --top 5 --show-roots
# -> HIGH-WATER MARK: 2025-10-31
```

**If the two disagree, the DB wins**, and the difference is itself a finding: it is tracks a run
logged as sent that never landed. Expect roughly the October failure count.

**Deliverable:** a single date. Everything filed after it is in scope.

---

## 4. Step B — ingest into a fresh partner

### Why a fresh partner and not straight into partner 1

- Partner 1 is the live frontend catalogue. A 400k-track ingestion that goes wrong there is visible
  to users; in a scratch partner it is not.
- The partner pipeline scopes everything by `partner_id`: FAISS index, raw store, embeddings, SFTP
  home. A fresh partner gets a clean, isolated index that can be inspected before promotion.
- Rollback is `DELETE FROM tracks WHERE partner_id = X` plus removing one directory tree.

### B1. Build the file list

Reuse `select_ingest_tracks.py`'s conventions, but the input is the *new* material rather than a
random sample: every path under the source roots whose date is after the Step A high-water mark.
`monthly_pipeline/monthly_cron.py` already knows how to walk `YYYY/MM-YYYY` folders and apply the
same filters (audio extensions only, skip `._*`, skip files under 1000 KB); that scan logic is the
thing to reuse.

**Exclude what is already in.** The DB is the authority: pull every `stored_path` for `type='open'`
and subtract. `select_ingest_tracks.py --exclude <file>` already does set-subtraction against a path
list, so export the DB paths to a file and pass it in.

### B2. Batch size

Do **not** attempt 400k in one manifest. From the measured run:

| | 4,738 tracks | 50,000 | 400,000 |
|---|---|---|---|
| Transcode | 54 m | ~9.5 h | ~3 days |
| Embeddings (dominant) | 4 h 31 m | ~48 h | ~16 days |

Embeddings run at **3.43 s/track** and transcode overlaps inside them, so plan on the embedding
figure alone. **Batches of 20–50k** keep any single failure to hours rather than days, and the
concurrency guard means one batch must reach READY before the next `.done` is accepted anyway.

That total is the headline number for this project: **~16 days of embedding compute for 400k
tracks**, on current throughput. Whether that is acceptable, or whether the GPU step needs
batching/parallelism first, is a decision to take **before** starting, not at batch 4.

### B3. Code change 1 — carry the source path through the manifest

Today the manifest has no path column, and `ingestion_persist._stored_path_for()` writes
`internal/raw/<uuid><ext>`. For these tracks we want the original path preserved, so the promotion
in Step D can join back to `apple_matches.jsonl` (which keys on `uuid` + `file_path`).

**Proposed, smallest version:**

- Add an **optional** manifest column `source_path`. Optional matters: partner-supplied manifests
  must keep working untouched.
- `ingestion_runner.validate_batch()` passes it into the record it returns, alongside `isrc`,
  `title` etc. No validation beyond a length cap.
- `ingestion_persist._persist_one()` writes it to **`tracks.source_file_path`**, which is the column
  that already exists for exactly this purpose and is what `insert_matched_tracks.py` populates.

**Deliberately NOT `audio_files.stored_path`.** That column is a real lookup key for open tracks
(`similarity_repository.py:93`, `WHERE af.stored_path = :track_path`) and it carries
`uq_audio_path (partner_id, stored_path(512))`. Repurposing it for partner tracks would change the
meaning of a column the similarity path depends on. `source_file_path` is free, purpose-built, and
`String(600)` — check the longest real path fits before running.

### B4. Code change 2 — per-batch relaxed validation

`INGEST_SKIP_VALIDATION=true` already exists and does what is wanted (parse the manifest, skip
ffprobe, skip AV, accept every parseable row). **But it is read from `os.getenv` inside
`run_ingestion_job`, so it is process-wide.** Setting it would relax validation for *every partner*
on the media server for as long as it is set. That is not acceptable on a box that also serves real
partners.

**Proposed:** make it per-batch instead of per-process. The ingestion run request already crosses
from Alwyzon to media as JSON, so it can carry a flag, with the env var kept as the fallback so
nothing existing changes. Admin-only, never partner-settable.

**What to keep even when relaxed.** The manifest-to-files reconciliation is the whole point of this
mode, so keep: required headers, ISRC format when present, in-batch duplicate ISRC, file present on
disk, extra-file detection, and the extension allowlist. Drop only ffprobe and the AV scan. That is
what "just compare the csv and tracks and then we're good to go" means in practice, and it still
catches a truncated upload.

**Worth stating plainly:** the AV scan exists because ingestion accepts files from outside. For our
own catalogue, on our own disk, already served to users, skipping it is defensible. For a real
partner it is not, which is why this must not be a global switch.

### B5. Run

Per batch, the sequence proven in the ingestion test:

```bash
# electrobuzz box
python ingest_upload.py --paths <batch>.txt --rows <N> --offset <M> --env live --auto-done
# media box, before .done if not using --auto-done
python scripts/ingest_validate.py --slug <slug> --env live --validate --backup
# poll
python scripts/ingest_validate.py --partner-id <id> --status
```

Uses `--rows`/`--offset` so batches never overlap, per-file error isolation, progress output, and
skip-existing on re-upload. All added during the ingestion test.

---

## 5. Step C — Apple matching

**Unchanged.** `scripts/apple_music/PRODUCTION_RUN.md` is the reference.

```
DB --export_tracks_jsonl.py--> tracks_input.jsonl --run_apple_matching.py--> apple_matches.jsonl
```

`export_tracks_jsonl.py` needs pointing at the new partner rather than the old catalogue. Everything
downstream keys on `uuid` + `file_path`, which is why Step B3 exists.

---

## 6. Step D — promote the matched tracks into partner 1

The part with the least existing code and the most care required. Three things move:

### D1. Vectors

**Both indexes are uuid-keyed.** The main catalogue's `catalog.json` is an id64→uuid mapping
(`similarity_service.py`: *"Catalog loaded - N UUIDs indexed (id64 -> uuid mapping)"*), and the
partner indexes are keyed by uuid too. So this is a **merge, not a re-key**: the `.npy` files move
from the partner's embeddings dir into the main store and the main index is rebuilt.

The rebuild is cheap at partner scale (~15 s for 4,967 vectors) but the main index is ~2M vectors,
so **measure it once before relying on it.**

> **Verify before executing.** This is the one assumption in the plan not yet proven by a run.
> Confirm the main index build accepts uuid-keyed vectors from a partner store unchanged.

### D2. Database rows

For each accepted match, repoint `partner_id` from the new partner to 1, and set `type='open'` (or
`electrobuzz`, matching whatever the frontend queries — **check which**, since
`insert_matched_tracks.py` used `electrobuzz` while the live 2M are `open`).

Also to decide per row:
- `audio_files.stored_path` — for partner-1 consistency this should become the original path, which
  means `uq_audio_path (partner_id, stored_path(512))` must not collide with an existing row.
- `track_processing_status` — transcode/embedding already completed; peaks/segments stay pending.

**Non-matched tracks stay on the scratch partner.** Decide separately whether they are eventually
promoted, kept, or deleted.

### D3. Apple metadata

`apple_music_tracks`, keyed by `track_id`. `insert_matched_tracks.py` already writes this shape and
is the model to follow.

### D4. Order of operations

Vectors first, then DB rows. If the DB is repointed first and the vector merge then fails, partner 1
has tracks that return no neighbours — the F15 shape of failure, silent and user-visible. The
reverse order is harmless: a vector in the index with no partner-1 row is simply never returned.

---

## 7. Code changes this plan needs

| # | Change | Where | Size |
|---|---|---|---|
| 1 | Optional `source_path` manifest column → `tracks.source_file_path` | `ingestion_runner.py`, `ingestion_persist.py` | small |
| 2 | Per-batch relaxed validation, replacing the process-wide env var | ingest request schema, `ingestion_runner.py` | small |
| 3 | Build the "new since date X" file list, excluding what the DB already has | new script, electrobuzz box | medium |
| 4 | Promotion scripts (vectors, rows, Apple metadata) | new, Alwyzon + media | **largest, and the least specified** |

Items 1 and 2 are needed before the first batch. Item 4 is not needed until Step D and should not be
written until Step B has actually produced data to promote.

---

## 8. Open questions, to settle before starting

1. **The 16-day embedding figure.** Acceptable, or does GPU throughput need work first? This is the
   single biggest input to the schedule and it is answerable today from the measured 3.43 s/track.
2. **`type` for promoted tracks:** `open` or `electrobuzz`? The live 2M are `open`;
   `insert_matched_tracks.py` writes `electrobuzz`. Whatever the frontend actually queries wins.
3. **October 2025's ~850 lost tracks.** Re-run them from `10-2025_errors.json` before this project,
   or fold them into it? They are a known hole in the catalogue either way.
4. **Non-matched tracks after Step C** — promote, keep, or delete?
5. **Disk.** 400k tracks at ~20 MB is ~8 TB of originals in the partner's `processing/`, plus mp3s
   and two `.npy` per track. **Check this before batch 1.** The 4,738-track batch used ~95 GB.
6. **Duplicate handling.** `tracks` has no unique constraint on ISRC and the validator only rejects
   duplicates within one batch. Across 400k in many batches, the DB exclusion list from B1 is the
   only thing preventing re-ingestion. Verify it is exact.

---

## 9. What is already proven, and what is not

**Proven** (`PARTNER_INGESTION_TEST_PLAN.md`, ~5,000 tracks): SFTP upload, validation, atomic move,
DB persist, transcode, embeddings, FAISS index accumulation across repeat batches, partner API
search and similarity, rate limiting, and recovery from an interrupted upload.

**Not proven:** anything at 50k+ per batch; the total disk footprint; the vector merge into the main
index; and the promotion scripts, which do not exist yet.
