# Re-ingesting the open catalogue through the partner pipeline

> **Created 2026-08-22.** Goal: bring the ~300-400k tracks added to the Electrobuzz source in the
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

> **CONFIRMED against live data 2026-08-22.** 1,991,476 `electrobuzz` tracks, of which
> **1,986,509 carry a `source_file_path`**. The 4,967 without one are exactly the ingestion-test
> partner's tracks, so **100% of the real catalogue has its original Vegerra path.**
>
> **High-water mark: `2025-10-31`**, agreed independently by the database and by the electrobuzz
> run logs. The next scan starts from 2025-11-01.

**Yes, in two different places, and they mean different things.** This was verified in code, not
assumed.

**`tracks.source_file_path` is the answer.** `String(600)`, written by
`scripts/apple_music/insert_matched_tracks.py`, whose own comment calls it *"the ONLY ref back to
the Electrobuzz master"*. Sample:

```
veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Essential_House/2025/10-2025/11/VA - ...
```

**`audio_files.stored_path` is NOT the answer for this catalogue.** It holds the path of the file
*we* keep, which differs per ingestion route:

| Track set | `type` | Count | `audio_files` | `stored_path` holds |
|---|---|---|---|---|
| The main catalogue | `electrobuzz` | **1,991,476** | `StreamingProfile` preview | `internal/previews/<uuid>.mp3` |
| Old open-CC set | `open` | 48,374 | `Master` | `internal/raw/<uuid>...` |
| User uploads | `upload` | 200 | | |

`insert_matched_tracks.py` creates only a 128 kbps preview row, so the main catalogue **has no
`Master` audio file at all** and its `stored_path` never carried a date.

**Why the first two runs of `catalogue_high_water_mark.py` came back empty.** The script joined
`audio_files` on `asset_class = 'Master'`, which excluded the entire 2M by construction, and the
`--type open` retry hit the 48,374-track open-CC set whose paths are uuid-based. Neither was a
data problem. The script now reads `tracks.source_file_path` directly, with no join and no
`asset_class` filter, and prints sample paths when it finds no dates so this cannot recur silently.

The `jsonl` fallback is not needed.

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

## 3. Step A, establish the resume point

**Do not trust the run logs.** `monthly_pipeline/_tracks/MM-YYYY_success.txt` records what a run
*believed* it sent, up to a year ago, and October's 861 failures are exactly the case where belief
and reality diverge.

```bash
# On Alwyzon. Derives every date from the path string; never consults created_at.
python scripts/catalogue_high_water_mark.py --top 5 --show-roots
```

For comparison only, the electrobuzz-side answer from the run logs:

```bash
# On the electrobuzz box.
python3 monthly_pipeline/last_ingested_date.py --top 5 --show-roots
# -> HIGH-WATER MARK: 2025-10-31
```

### DONE. Both agree on `2025-10-31`.

But the per-day **counts** do not, and that is a finding in its own right:

| date | run log says | actually in DB | missing | |
|---|---|---|---|---|
| 2025-10-31 | 477 | 442 | 35 | 7.3% |
| 2025-10-30 | 832 | 767 | 65 | 7.8% |
| 2025-10-29 | 267 | 257 | 10 | 3.7% |
| 2025-10-28 | 215 | 195 | 20 | 9.3% |
| 2025-10-27 | 444 | 407 | 37 | 8.3% |
| **total** | **2,235** | **2,068** | **167** | **7.5%** |

**~7.5% of tracks the pipeline logged as SUCCESS are not in the database**, and this is on top of
October's 861 outright errors, which never entered `success.txt` at all. Across a year that is
plausibly six figures of music we believe we have and do not.

**The Apple-filter explanation is RULED OUT.** `insert_matched_tracks.py` inserts only
`is_match == "True"` records, so if that were the cause the shortfall would equal the non-match
rate. Measured on `apple_matches.jsonl`: **79.1% True, 10.4% False, 10.4% N/A**, so that filter
alone would leave **~21%** missing, not 7.5%. Whatever is happening is something else, and the
2M evidently does include non-matched tracks.

**Narrowed so far**, for 2025-10-31:

| root | run log | in DB | missing |
|---|---|---|---|
| `Electrobuzz_Music` | 461 | 426 | **35** |
| `Essential_House` | 16 | 16 | 0 |

One root is exact and the other is not, which rules out a whole-day or whole-run failure.

**Early indication, needs confirming:** spot-checking the day's DB list suggests whole *releases*
are absent (e.g. `Dani Sbert - Instinto Crudo`, `Marco Bailey - Drivetonik`) rather than scattered
tracks. That distinction is the diagnosis: **a whole release missing points at the upload step, and
scattered tracks point at the DB write.**

**To settle it**, dump the DB paths and diff against the success logs with
`monthly_pipeline/diff_log_vs_db.py`, which reports exactly that split:

```sql
SELECT source_file_path FROM tracks
 WHERE type = 'electrobuzz' AND source_file_path IS NOT NULL AND source_file_path <> ''
 INTO OUTFILE '/tmp/db_paths.txt';
```

```bash
# on the electrobuzz box, after copying the dump across
python3 monthly_pipeline/diff_log_vs_db.py --db /tmp/db_paths.txt --date 2025-10-31
python3 monthly_pipeline/diff_log_vs_db.py --db /tmp/db_paths.txt          # all ten months
```

**Decision this forces (see also section 8):** does Step B ingest *everything filed after
2025-10-31*, or *everything not already in the DB*? The second sweeps up these historical gaps for
free, since it is a set-subtraction either way. The first is smaller and faster. This is a product
call about whether the gaps matter.

**Deliverable:** a single date. Confirmed: **2025-11-01 onward is in scope.**

---

## 4. Step B, ingest into a fresh partner

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

**Exclude what is already in.** The DB is the authority: pull every `source_file_path` for
`type='electrobuzz'` and subtract. `select_ingest_tracks.py --exclude <file>` already does
set-subtraction against a path list, so export the DB paths to a file and pass it in.

```sql
SELECT source_file_path FROM tracks
 WHERE type = 'electrobuzz' AND source_file_path IS NOT NULL AND source_file_path <> '';
```

That is 1,986,509 rows, so dump it with `SELECT ... INTO OUTFILE` or a streaming client rather than
a GUI. Doing the exclusion this way rather than by date is what would also recover the 7.5% gap.

### B2. Batch size

Do **not** attempt 400k in one manifest. From the measured run:

| | 4,738 tracks | 50,000 | 400,000 |
|---|---|---|---|
| Transcode | 54 m | ~9.5 h | ~3 days |
| Embeddings (dominant) | 4 h 31 m | ~48 h | ~16 days |

Embeddings run at **3.43 s/track** and transcode overlaps inside them, so plan on the embedding
figure alone. **Batches of 20-50k** keep any single failure to hours rather than days, and the
concurrency guard means one batch must reach READY before the next `.done` is accepted anyway.

That total is the headline number for this project: **~16 days of embedding compute for 400k
tracks**, on current throughput. Whether that is acceptable, or whether the GPU step needs
batching/parallelism first, is a decision to take **before** starting, not at batch 4.

### B3. Code change 1, carry the source path through the manifest

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

**Deliberately NOT `audio_files.stored_path`.** For the main catalogue that column holds our
preview file (`internal/previews/<uuid>.mp3`), not the source; it also carries
`uq_audio_path (partner_id, stored_path(512))`. Writing source paths there for the new partner would
make the new rows disagree with the 1.99M existing ones, which is exactly what Step D then has to
reconcile. Matching what the catalogue already does is the whole point.

`source_file_path` is `String(600)`. **Check the longest real path fits before running**: a silent
truncation here breaks the Step D join.

### B4. Code change 2, per-batch relaxed validation

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

### B5. Run: the actual steps

Everything below exists and is tested. Do them in order, one batch at a time.

**Step 1. Count what is in scope.** Writes nothing.

```bash
cd ~/electrobuzz_server
python monthly_pipeline/collect_new_tracks.py --base-dir /mnt
```

Prints the total, the split by month and by root, and how many 50k batches that is. If the
count looks wrong, stop here: it is far cheaper to argue with a number than with a
half-finished ingestion. Then:

```bash
python monthly_pipeline/collect_new_tracks.py --base-dir /mnt --write \
  --exclude-db /tmp/db_paths.txt        # optional but recommended
```

`--exclude-db` is the ONLY guard against double-ingestion: `tracks` has no unique
constraint on ISRC and the validator only rejects duplicates within one batch.

**Step 2. Create the partner** in admin and provision SFTP. Record the id and slug.

**Step 3. Upload batch 1.** Note `--source-prefix`: the DB stores `veggera/...`, but the
files are read from `/mnt/vegerra/...`, and recording the mount path would break the
Apple join in Step C.

```bash
cd ~/electrobuzz_server/ingest_selection
nohup env INGEST_SFTP_HOST=<origin-ip> INGEST_SFTP_PORT=2022 \
  INGEST_SFTP_USER=partner_<slug> INGEST_SFTP_PASSWORD='...' \
  python -u ingest_upload.py \
    --paths ../monthly_pipeline/new_tracks.txt \
    --rows 50000 --offset 0 \
    --source-prefix '/mnt/vegerra=veggera' \
    --env live \
  > batch1.log 2>&1 &
```

Do NOT pass `--auto-done` on the first batch: send `.done` by hand after the media box has
reconciled, so the first batch is verified before 50k files are committed. Later batches
can use it.

Write down the `Next batch: --offset N` line. It is how batch 2 avoids re-uploading batch 1.

**Step 4. Reconcile and back up**, on the media box:

```bash
cd /home/ubuntu/usman/resomix-similarity-open
.venv/bin/python scripts/ingest_validate.py --slug <slug> --env live --validate --backup
```

**Step 5. Commit the batch with relaxed validation.** This is the one step that is NOT the
normal partner flow: `.done` would start a standard ingestion, so trigger it from admin
instead so `trusted_source` can be set.

```
POST /api/v1/admin/ingestion/trigger
{ "partner_id": <id>, "env": "live", "trusted_source": true }
```

Skips ffprobe and the AV scan (hours at 50k, and they prove nothing about content we
already serve) while still reconciling the manifest against the folder in full.

**Step 6. Watch it.** ~48 h per 50k batch, dominated by embeddings at 3.43 s/track;
transcode overlaps inside that.

```bash
.venv/bin/python scripts/ingest_validate.py --partner-id <id> --status
journalctl -u resomix-media --since today --no-pager | grep "rebuilt"
```

The vector count must equal the running total. Wait for **READY** before batch 2: the
concurrency guard rejects a second `.done` while one batch is active.

**Step 7. Repeat** from step 3 with the printed `--offset`.

### B5b. Reference: the original single-batch sequence

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

## 5. Step C, Apple matching

**Unchanged.** `scripts/apple_music/PRODUCTION_RUN.md` is the reference.

```
DB --export_tracks_jsonl.py--> tracks_input.jsonl --run_apple_matching.py--> apple_matches.jsonl
```

`export_tracks_jsonl.py` needs pointing at the new partner rather than the old catalogue. Everything
downstream keys on `uuid` + `file_path`, which is why Step B3 exists.

---

## 6. Step D, promote the matched tracks into partner 1

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

For each accepted match, repoint `partner_id` from the new partner to 1. `type` is already
`electrobuzz` on both sides (partner ingestion sets it in `ingestion_persist._persist_one`, and the
live 1.99M are `electrobuzz`), so no change there, an earlier draft of this plan had that wrong.

**The asset shape differs between old and new rows, and this is the real work of D2:**

| | existing 1.99M | freshly ingested |
|---|---|---|
| `audio_files` rows | one `StreamingProfile` preview | one `Master` |
| `stored_path` | `internal/previews/<uuid>.mp3` | `internal/raw/<uuid>.<ext>` |
| file on disk | preview only | full transcode in the partner's raw store |

So a promoted track has an asset the existing catalogue never has. Before writing D2, **check what
the frontend actually reads**, if it expects a `StreamingProfile` at `internal/previews/<uuid>.mp3`,
promotion must either create that row and move the file, or the reader must learn to accept a
`Master`. Neither is hard; picking the wrong one silently breaks playback for the new tracks only,
which is the kind of thing that surfaces weeks later.

`track_processing_status`: transcode/embedding already completed; peaks/segments stay pending, which
matches how `insert_matched_tracks.py` leaves them.

**Non-matched tracks stay on the scratch partner.** Decide separately whether they are eventually
promoted, kept, or deleted.

### D3. Apple metadata

`apple_music_tracks`, keyed by `track_id`. `insert_matched_tracks.py` already writes this shape and
is the model to follow.

### D4. Order of operations

Vectors first, then DB rows. If the DB is repointed first and the vector merge then fails, partner 1
has tracks that return no neighbours, the F15 shape of failure, silent and user-visible. The
reverse order is harmless: a vector in the index with no partner-1 row is simply never returned.

---

## 6b. Where the data lands, table by table

What partner ingestion writes today, and what the promotion in Step D has to reconcile.

**Ingestion writes (per track), in `ingestion_persist._persist_one`:**

| Table | Row | Notes |
|---|---|---|
| `tracks` | 1 | `uuid` (generated on media), `isrc` (may be ''), `title`, `display_artist`, `duration_ms`, `bpm`, `musical_key`, `genre_id`/`sub_genre_id` (resolved), `partner_id`, `type='electrobuzz'`, `ingestion_source='csv'`, `is_active` default true, **`source_file_path`** (new) |
| `audio_files` | 1 | `asset_class='Master'`, `stored_path='internal/raw/<uuid>.<ext>'`, `original_filename`, `file_size_bytes`, `mime_type` |
| `track_processing_status` | 1 | `transcode_status`, `embedding_status`, `peaks_status`, `segments_status`, `faiss_indexed`, `ingest_log_id`, `sftp_env` |
| `ingest_logs` | 1 per batch | stage timeline, counts, `processing_dir` |
| `genres`, `parties` | get-or-create | |

**The existing 1.99M look different**, because `insert_matched_tracks.py` built them:

| | existing 1.99M | freshly ingested |
|---|---|---|
| `audio_files` | one **`StreamingProfile`** preview | one **`Master`** |
| `stored_path` | `internal/previews/<uuid>.mp3` | `internal/raw/<uuid>.<ext>` |
| on disk | preview only | full 128 kbps transcode in the partner raw store |
| `source_file_path` | the Vegerra path | the Vegerra path (via the new `source_path` column) |
| `apple_music_tracks` | one row per matched track | none until Step C/D |
| `releases` / `release_tracks` | populated | not written by partner ingestion |

**So Step D has three gaps to close, not one:** `partner_id`, the asset shape, and the
release rows. `type` is already `electrobuzz` on both sides.

**Decide before writing D2:** does the frontend read the `Master`, or must promotion also
create a `StreamingProfile` row and move the file to `internal/previews/<uuid>.mp3`?
Getting this wrong breaks playback for the new tracks only, which surfaces weeks later.

---

## 7. Code changes: what is BUILT and what is left

### Built and tested

| # | Change | Where |
|---|---|---|
| 1 | `source_path` manifest column, carried through to `tracks.source_file_path`, capped at the column's 600 chars so MySQL cannot truncate silently | `ingest_upload.py`, `ingestion_runner.py`, `ingestion_persist.py` |
| 2 | `--source-prefix LOCAL=CATALOGUE` on the uploader, so the manifest records `veggera/...` and not the `/mnt/vegerra/...` mount path | `ingest_upload.py` |
| 3 | **`trusted_source`**, per batch, admin-only: skips ffprobe + antivirus and nothing else | ingest request schema, `ingestion_runner.py`, `hetzner_service.py`, `ingestion_service.py`, admin trigger |
| 4 | `collect_new_tracks.py`: scans the five roots for months after the cut-off, reusing the pipeline's own filters, and prints the count | `monthly_pipeline/` |

**75 tests pass** in `resomix-similarity-open`.

**On `trusted_source`, the important distinction.** It is NOT an alias for
`INGEST_SKIP_VALIDATION`, and the two must not be confused:

| | `INGEST_SKIP_VALIDATION` | `trusted_source` |
|---|---|---|
| scope | env var, **process-wide, every partner** | one batch, admin-only |
| ffprobe + AV | skipped | skipped |
| file present on disk | **NOT checked** | **checked** |
| extra file in folder | **NOT checked** | **checked** |
| headers, ISRC format, dup ISRC | **NOT checked** | **checked** |

The env var accepts a manifest row whose audio file is not even there. On a 400k load that
would ingest a truncated upload as a complete batch and nothing would say so. Use
`trusted_source`. Covered by four tests, including one that documents the difference.

### Left to build

| # | Change | When |
|---|---|---|
| 5 | Promotion scripts: vectors, DB rows, Apple metadata | Step D. Do not write until Step B has produced data to promote |

---

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
2. **Asset shape on promotion.** The 1.99M have only a `StreamingProfile` preview; freshly
   ingested tracks have a `Master`. Does the frontend need a preview row created and the file moved
   to `internal/previews/<uuid>.mp3`, or can it read the `Master`? Settles the shape of D2.
   (`type` is NOT a question: both sides are `electrobuzz`.)
3. **The historical gap.** Two holes, not one: October's ~850 outright errors, and the **~7.5% of
   logged-successful tracks that are not in the DB** (section 3). Ingest by "everything not already
   in the DB" rather than "everything after 2025-10-31" and both are recovered for free. Worth
   diagnosing the 7.5% first, since if it is the Apple match filter then those tracks were excluded
   deliberately and re-ingesting them changes what the catalogue contains.
4. **Non-matched tracks after Step C**, promote, keep, or delete?
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
