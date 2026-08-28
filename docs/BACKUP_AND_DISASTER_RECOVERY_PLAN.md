# Backup and disaster recovery: design and implementation plan

Written 2026-08-25 by Muhammad Usman Naeem, after reading the storage layer in
`basic_fastapi_server_resomix`, `resomix-similarity-open` and `resomix-analysis-service`.

Sections 1 to 4 are what I found and what has to be protected. Section 5 onward is the
proposed system. Section 11 is the disaster recovery drill. Section 12 is the decisions I need
from you before building.

---

## 1. What I found

There is no automated backup today. The only backup code in the codebase is
`database/manage.py backup`, a manual CLI wrapper around `mysqldump` that writes to a local
`backups/` folder on the same box as the database. That is not a backup, it is a copy: if the
Alwyzon box is lost, the dump is lost with it.

Three facts from the code that shape everything below.

**Storage is fully partner-scoped.** `resomix-similarity-open/app/core/partner_paths.py` is the
single source of truth. Everything a partner owns, including consumer uploads under system
partner 1, lives under one tree:

```
{PARTNER_SFTP_ROOT}/{slug}/
├── test/  live/                     partner's own SFTP uploads
└── internal/                        server-managed
    ├── embeddings/maest/{uuid}.npy
    ├── embeddings/discogs/{uuid}.npy
    ├── indexes/faiss_{engine}_{partner_id}.index
    ├── catalog/{engine}_catalog_{partner_id}.json
    ├── previews/{uuid}.mp3
    ├── segments/{uuid}/             HLS .ts + hls.m3u8
    ├── peaks/{uuid}.json
    ├── covers/{uuid}.jpg
    ├── playlist_covers/{uuid}.jpg
    └── raw/{uuid}.{ext}             the original uploaded file
```

The legacy flat `MAEST_UPLOAD_FULL_VECTORS_DIR` / `DISCOGS_UPLOAD_VECTORS_DIR` settings still
exist in config but **nothing calls them any more** (`vector_repository.py` defines the loaders,
no caller remains). Uploads write through `partner_paths.embedding_path()` like everything else
(`similarity_service.py:444`). So the backup scope is one tree, not two.

**`.partner_slugs.json` is a single point of failure.** Hetzner is DB-less. The integer
`partner_id` to folder-slug mapping lives only in `{PARTNER_SFTP_ROOT}/.partner_slugs.json`. It
is a few kilobytes. **Without it, every path helper falls back to the integer id and no
existing file resolves.** Losing this file while keeping 500 GB of embeddings means losing the
embeddings. It must be in every backup, and it is worth also storing a copy in the database.

**MariaDB is InnoDB throughout** (confirmed in the migrations). So `mysqldump
--single-transaction` gives a consistent snapshot without locking writes. This matters: the
`tracks` and `apple_music_tracks` tables are in the millions of rows and a locking dump would
be an outage.

---

## 1a. Measured, 2026-08-26

Both boxes scanned. Numbers below are real, not estimated.

**Database (Alwyzon):** 4.64 GB across 84 tables, all InnoDB. `mysqldump --single-transaction`
compresses to **601 MB in 77 s**. Largest tables: `tracks` 2.07M rows, `audio_files` 1.96M,
`track_processing_status` 1.93M, `release_tracks` 1.89M, `apple_music_tracks` 1.70M.
`TOKEN_ENCRYPTION_KEY` is explicitly set, and exactly **2 rows** in
`user_service_connections` depend on it.

**File tree (media):** `/srv/sftp` is ZFS (`tank/data/resomix-sftp`, 9.5 TB pool, 2.1 TB used).
Single-pass scan: **8,056,309 files, 2,092.07 GB**.

| In scope | Files | GB |
|---|---|---|
| partner 1 `000000000000` (consumer): embeddings, indexes, catalog, raw, segments, peaks, covers, playlist_covers | 4,061,601 | 297.08 |
| partner 4 `1d0ffc5112e2`: embeddings, indexes, catalog | 721,694 | 3.77 |
| partner 6 `b3a56a4e427d`: embeddings, indexes, catalog, covers, raw | 19,589 | 28.85 |
| analysis `var/results` | 502 | 0.26 |
| **total** | **4,803,386** | **329.96** |

| Excluded | Files | GB | Why |
|---|---|---|---|
| `sftp:live` + `test` (p6) | 49,895 | 771.37 | Partner holds the master |
| `{slug}/processing/` (p1+p6) | 53,359 | 654.70 | SFTP-exposed batch snapshots, derived from partner source audio we already exclude |
| `_backup_open_tracks` (p1) | 3,150,150 | 336.25 | **Orphan. Not referenced anywhere in the codebase.** See below |
| `ingestion`, `internal/processing` | 20 | 0.04 | Job result JSONs, regenerable |
| **total** | **3,253,424** | **1,762.36** | |

In scope is **15.8%** of the tree. Reconciles to 2,092.06 GB against the reported 2,092.07 GB.

**Sizing conclusion: BX31 (10 TB, €20.80/mo) not BX41.** 330 GB now, roughly 30 GB/month of
in-scope growth (the 891 GB written in the last 30 days was almost entirely partner 6's
ingestion, which is out of scope). Even with eight snapshots and no dedup that is years of
headroom, and Hetzner allows a tier upgrade in place.

**The binding constraint is file count, not bytes.** 3.96M of the in-scope files are partner 1
embeddings averaging ~4 KB. The first backup will be dominated by traversal and index building,
not transfer. This is the case restic is good at and naive rsync is bad at.

**Two things to resolve before building:**

1. `_backup_open_tracks`, 336 GB / 3.15M files, `grep` finds no reference in `app/` or
   `scripts/`. Almost certainly a manual copy of the decommissioned open-CC catalogue. Removing
   it would cut 39% of the tree's file count, which speeds up every future scan.
2. `.partner_slugs.json` lists partners 1, 2, 4, 6 but **partner 2's directory does not exist**.
   Safe direction (stale entry, not a missing one) but it must be correct before anything is
   built that trusts this file.

---

## 2. What must be backed up

Ordered by how badly its loss hurts.

### Tier 1: irreplaceable, small

| What | Where | Size | Why |
|---|---|---|---|
| MariaDB `resomix_db` | Alwyzon box, localhost:3306 | GBs (compresses hard) | Every relationship in the product. Files without it are anonymous blobs |
| `.partner_slugs.json` | `{PARTNER_SFTP_ROOT}/` (media box) | KB | Without it nothing resolves. See above |
| `.env` of all four services | each box | KB | **Not currently backed up anywhere.** See section 4 |

### Tier 2: irreplaceable, large

| What | Where | Why |
|---|---|---|
| **Every partner's embeddings** | `{slug}/internal/embeddings/{maest,discogs}/*.npy` | Regenerating means re-running the GPU over the entire catalogue. For 2M tracks that is weeks of GPU time, and for partner audio we may no longer hold the source |
| **Consumer uploads, everything** | system partner 1: `internal/raw/`, `segments/`, `peaks/`, `previews/`, `covers/`, `playlist_covers/`, `embeddings/` | `raw/` is the user's original file. We are the only copy. If it is gone the user's track is gone |
| **Analysis results** | `resomix-analysis-service/var/results/*.json.gz` | Kept forever by design. Re-running is GPU time we would rather not spend, and results are surfaced in the product long after upload |

### Tier 3: rebuildable, include only if cheap

| What | Rebuild cost | Recommendation |
|---|---|---|
| `indexes/faiss_*.index` | Minutes to hours, from the embeddings we do keep | **Include.** They are small relative to embeddings and they cut recovery time from hours to minutes |
| `catalog/*.json` | Same pass as the index | **Include**, same reasoning |
| Elasticsearch index | The Python reindex job from the DB | Exclude. Documented rebuild already exists |
| GPU model weights | Re-download | Exclude |

I am recommending against your "embeddings only" scope on one point: including `indexes/` and
`catalog/` too. They are derived, so in principle skippable, but they are a small fraction of
the embedding volume and they are what stands between "restored" and "actually serving
queries". The saving is not worth the extra hours in a real incident.

---

## 3. What is deliberately excluded, and the risk of each

| Excluded | Why it is safe | Residual risk |
|---|---|---|
| Partner `test/` and `live/` SFTP folders | The partner's own source audio. They hold the master copy and can re-send | If a partner also loses their copy, their catalogue audio is unrecoverable. Worth stating in the partner contract |
| The ~1.98M Apple catalogue audio | We never hosted it. Playback uses Apple preview URLs | None |
| Redis (DB 0 Alwyzon, DB 4 analysis) | Cache, Celery queue, entitlement cache | **Usage counters reset.** A user who had consumed 8 of 10 monthly playlists gets a fresh 10. Acceptable, but it is a conscious data loss, not an oversight |
| `var/work`, `var/gpu_cache` | Scratch and a local-only cache | None. Note `results/_by_sha256` is only populated when `env == "local"`, so in production it is empty and needs no special handling |

---

## 4. The gap that will bite you in a real incident

**Nothing backs up the service `.env` files, and they are required to bring the system back.**

`EDGE_JWT_SECRET` is shared three ways (Alwyzon + media + analysis), and
`HETZNER_INTERNAL_API_KEY` / `PREVIEW_HMAC_SECRET` / `PREVIEW_FERNET_SECRET` are shared between
media and Alwyzon. Without them the services cannot authenticate to each other, and you would be
reconstructing secrets during an outage.

**To be precise about what is and is not encrypted, because it matters for scoping:**

*No audio file is encrypted at rest.* Previews, HLS segments and raw uploads are plain files on
disk. On the media box `PREVIEW_FERNET_SECRET` only encrypts an **expiry timestamp** inside a
preview URL (the `xpi` query param, `app/utils/security.py`), and that verification path is
currently marked disabled in `app/api/audio.py` and `app/api/segment.py`. Losing that secret
breaks in-flight URLs; the user re-requests and gets a new one. **No data loss.**

*One thing genuinely is encrypted at rest, and it is in the database, not the files.*
`app/utils/security_utils.py::_secret_cipher()` uses `TOKEN_ENCRYPTION_KEY`, **falling back to
`PREVIEW_FERNET_SECRET` when unset**, to encrypt third-party user tokens stored in
`user_service_connections.access_token_enc` (currently the Apple Music user token,
`apple_music_transfer_service.py:663`).

So the real risk is narrow but sharp: **restoring the database without that key leaves those
columns permanently undecryptable.** Every affected user has to reconnect Apple Music. It also
fails silently, because `decrypt_secret()` swallows `InvalidToken` and returns `None`, so
nothing alarms.

That is still a reason to back up the secrets, but for the database column, not for the audio.
Check whether `TOKEN_ENCRYPTION_KEY` is actually set in production or whether it is silently
falling back to `PREVIEW_FERNET_SECRET`, because that changes which single value must survive.

Recommendation: an encrypted `secrets/` component in the same backup run, one age-encrypted
tarball of the four `.env` files, with the age private key held **outside** the backup system,
in a password manager that at least two people can reach. This is a ten-line addition and it is
the difference between a four-hour recovery and a two-day one.

---

## 5. Recommended architecture

### 5.1 Where backups go

**They must not live on a box that holds the data.** Primary destination: a
**Hetzner Storage Box** (BX21 or larger). Same datacentre network so transfer is fast and free,
supports SSH/rsync/restic natively, and costs a fraction of block storage.

Secondary, for the database dumps only (they are small): a second provider, for example
Backblaze B2. This gives 3-2-1: the live data, a Hetzner copy, and an off-provider copy of the
one component that is irreplaceable and cheap to duplicate.

### 5.2 The tool: use restic, do not hand-roll

Your sketch was: keep checksums, compare, transfer, verify, then replace the existing copy.
That is the right instinct and it describes what **restic** already does, with two important
improvements.

| Your requirement | How restic satisfies it |
|---|---|
| Keep a checksum per file, compare, only move what changed | Content-addressed chunking. Unchanged files are not re-read or re-sent |
| Verify after transfer | `restic check --read-data-subset` re-hashes stored data and fails loudly |
| Keep 3 latest, then 1w, 2w, 3w, 1m, 2m | `restic forget --keep-last 3 --keep-weekly 3 --keep-monthly 2` |
| Maintain a log | `--json` output gives structured per-run metrics to store in the DB |
| Replace existing after verification | **Better:** restic snapshots are append-only and immutable. Nothing is ever overwritten |

That last row is a real correction to the design. "Replace the existing backup once the new one
verifies" means that during the replace window you have exactly one copy, and a failure there
loses both. Immutable snapshots with retention pruning never have that window. Deduplication
means eight snapshots of a mostly-static embedding tree cost barely more than one.

Restic also encrypts everything at rest by default, which matters because these backups contain
user audio and personal data.

If you would rather not add restic, the fallback is `rsync --link-dest` hardlink snapshots plus
a sha256 manifest. It works, but you write and maintain the retention, verification and
encryption yourself, and hardlinked trees share corruption across snapshots.

### 5.3 Components

Each nightly run produces four independent restic snapshots, tagged so they can be pruned and
restored separately:

| Component | Source | Tag |
|---|---|---|
| `db` | `mysqldump --single-transaction --routines --triggers` piped straight to `restic backup --stdin` | `db` |
| `media-embeddings` | every partner's `internal/embeddings/`, `indexes/`, `catalog/`, plus `.partner_slugs.json` | `media` |
| `media-uploads` | system partner 1's `internal/{raw,segments,peaks,previews,covers,playlist_covers}` | `uploads` |
| `analysis-results` | `resomix-analysis-service/var/results/` | `analysis` |
| `secrets` | age-encrypted tar of the four `.env` files | `secrets` |

Piping mysqldump to stdin avoids ever writing a multi-GB plaintext dump to local disk.

---

## 6. Retention

Your specification, expressed as a keep-set:

```
3 most recent  +  1 week  +  2 weeks  +  3 weeks  +  1 month  +  2 months
```

restic expresses this directly:

```
restic forget --tag db \
  --keep-last 3 --keep-weekly 3 --keep-monthly 2 \
  --prune
```

`--keep-last 3` covers the three most recent. `--keep-weekly 3` covers the 1, 2 and 3 week
points. `--keep-monthly 2` covers the 1 and 2 month points. Eight restore points, matching your
spec exactly.

Two safety rules to add on top, because retention bugs destroy backups:

1. **Never prune in the same run that a backup failed.** If tonight's backup did not complete
   and verify, skip the forget step entirely. Otherwise a week of failures silently prunes you
   down to nothing.
2. **Refuse to prune below a floor.** If the keep-set computes to fewer than 3 snapshots for a
   tag, abort and alarm. This catches clock skew and misconfiguration.

---

## 6a. The partner tree is on ZFS, which changes the design for the better

Measured 2026-08-26: `/srv/sftp` is not on the root filesystem. It is its own ZFS dataset,
`tank/data/resomix-sftp`, **9.5 TB with 2.1 TB used**. The 165 GB figure on `/dev/md2` is the
root filesystem and is unrelated.

This is good news and it upgrades two parts of the plan.

**Snapshot first, then back up from the snapshot.** A backup that walks a live tree for several
hours captures a moving target: a track uploaded at hour three appears half-written, or its
`raw/` is captured but its `segments/` are not. ZFS snapshots are instantaneous and
copy-on-write, so:

```bash
zfs snapshot tank/data/resomix-sftp@backup-$(date -u +%Y%m%dT%H%M%SZ)
restic backup /srv/sftp/.zfs/snapshot/backup-.../partners ...
zfs destroy tank/data/resomix-sftp@backup-...
```

The snapshot is frozen, so restic reads a consistent instant no matter how long it takes. This
removes a real class of restore bug rather than merely reducing it.

**Two tiers, and the cheap one covers the common case.** There is 7.4 TB free on that pool.

| Tier | Mechanism | Protects against | Recovery |
|---|---|---|---|
| Local | ZFS snapshots, kept on the same GFS ladder | Accidental deletion, bad migration, a partner wiping their own folder | Seconds. `cp` out of `.zfs/snapshot/` |
| Off-site | restic to the Storage Box | Box loss, disk failure, datacentre incident | Hours |

Local snapshots cost nothing but the delta and are effectively free for write-once data like
embeddings. They are **not** a backup, because they die with the box, but they resolve the
failure people actually hit weekly. Off-site restic remains the disaster tier.

If the eventual destination is a real ZFS host rather than a Storage Box, `zfs send -i` is
better again: block-level incrementals with no file walking at all. A Hetzner Storage Box cannot
receive ZFS streams, so with that destination restic-over-snapshot is the right pairing.

---

## 7. Consistency: the ordering detail that decides whether a restore works

The database dump and the file snapshot are taken at different moments. Whichever runs second
sees state the first did not.

**Always dump the database first, then snapshot the files.**

- DB first, files second: a track uploaded in between appears as a file with no database row. It
  is orphaned and invisible. Harmless.
- Files first, DB second: a track uploaded in between appears as a database row pointing at a
  file that is not in the backup. On restore the product shows a broken track. A real fault.

Record both timestamps on the run so a restore knows its true consistency point.

---

## 8. The Alwyzon control plane

All runs originate at Alwyzon, as you asked. This mirrors the existing partner-processing
pattern exactly (`app/models/partner_processing_job.py` +
`app/api/routers/admin/processing.py` + `app/services/hetzner_service.py`), so it is a shape the
codebase already knows.

### 8.1 New tables

```
backup_runs
  id, uuid, trigger ('scheduled'|'manual'), triggered_by_user_id NULL,
  status ('pending'|'running'|'verifying'|'succeeded'|'partial'|'failed'),
  started_at, finished_at, db_snapshot_at, files_snapshot_at,
  total_bytes_added, total_files_changed, error, created_at

backup_components
  id, run_id FK, component ('db'|'media-embeddings'|'media-uploads'|'analysis-results'|'secrets'),
  status, started_at, finished_at,
  files_scanned, files_changed, bytes_processed, bytes_added_to_repo,
  snapshot_id (restic short id), verified BOOL, checksum_failures INT,
  error, log_excerpt TEXT
```

One row per component means a partial failure is visible as exactly that: the DB succeeded,
media-uploads failed, and you know precisely what to retry.

### 8.2 Flow

1. Celery beat fires at 03:00 (server time), or an admin POSTs the manual trigger.
2. Alwyzon creates a `backup_runs` row, status `running`.
3. **Component `db`**: runs locally on the Alwyzon box, since the database is local. Streams
   mysqldump into restic. Records `db_snapshot_at`.
4. **Components on Hetzner**: Alwyzon POSTs `/internal/backup/start` on the media box with the
   run uuid and component name, authenticated with the existing `HETZNER_INTERNAL_API_KEY`
   bearer pattern. The media box runs the job detached and returns immediately.
5. Alwyzon polls `/internal/backup/status/{run_uuid}` and folds the reported metrics into
   `backup_components`, the same way `_refresh_processing_job_from_hetzner` already works.
6. When all components report success, Alwyzon runs the verification pass, then the retention
   prune, then marks the run `succeeded`.
7. On any component failure: run is `partial` or `failed`, **prune is skipped**, and an alert
   fires.

### 8.3 New endpoints

On Alwyzon, `app/api/routers/admin/backups.py`, new RBAC permissions `backup:read` and
`backup:manage` added to `app/core/rbac.py`:

```
POST   /api/v1/admin/backups/run              trigger manually (backup:manage)
GET    /api/v1/admin/backups/runs             paginated history (backup:read)
GET    /api/v1/admin/backups/runs/{uuid}      one run with its components
GET    /api/v1/admin/backups/status           dashboard summary (backup:read)
POST   /api/v1/admin/backups/verify           on-demand deep verify (backup:manage)
GET    /api/v1/admin/backups/snapshots        restore points per component
```

On the media box, `resomix-similarity-open/app/api/internal.py`:

```
POST   /internal/backup/start
GET    /internal/backup/status/{run_uuid}
```

### 8.4 What the admin sees

The dashboard summary should answer, at a glance, the only question that matters: *if the box
died right now, what would we lose and how fast could we recover?*

- Last successful run per component, with age. Red if the DB is older than 26 hours
- **Current RPO**: the age of the newest verified restore point
- Restore points available per component, with their dates, so the GFS ladder is visible
- Repository size, and growth over the last 30 days
- Last verification pass: when, and result
- Last DR drill: when, and the measured RTO. Red if older than 90 days
- Per-run history: duration, bytes added, files changed, checksum failures, errors

That "last DR drill" tile is deliberate. It is the one metric that stops an untested backup
system from quietly rotting.

---

## 9. Alerting

A backup system that fails silently is worse than none, because it produces confidence without
protection.

- Any component failure, or a run that does not complete within 6 hours: email the admin
- **A missing run is the important alarm.** A separate check runs at 09:00 and alerts if no
  successful `db` run exists in the last 26 hours. This catches the case where the scheduler
  itself is dead, which no in-job alert can catch
- Verification failure or any non-zero `checksum_failures`: alert immediately, treat as an
  incident

---

## 10. Implementation plan

| # | Work | Estimate |
|---|---|---|
| 0 | Repo and tooling setup: backup scripts repo, SSH keys, restic repo init, keys stored in the password manager | 1h |
| 1 | Backup scripts on each box: `backup_db.sh`, `backup_media.sh`, `backup_analysis.sh`, `backup_secrets.sh`. Locking, error handling, JSON metrics on stdout | 3h - 4h |
| 2 | Run them by hand. Confirm sizes, timings, and that the first full transfer completes | 2h - 3h |
| 3 | Media box endpoints `/internal/backup/{start,status}`, detached runner, status reporting | 2h - 4h |
| 4 | Alwyzon: migration for the two tables, service, orchestration, poll loop, admin router, RBAC, tests | 5h - 7h |
| 5 | Celery beat schedule, retention with the two safety rules, missing-run alarm, alerting | 2h - 4h |
| 6 | Admin UI in the `resomix-web` admin app | 2h - 4h |
| 7 | **The DR drill (section 11).** Not optional, and not the last thing you do | 7h - 9h |
| 8 | Bug resolution from steps 2 and 7 | 5h - 7h |
| | **Total** | **29h - 43h** |

**The destination is assumed to already exist.** Step 0 no longer includes provisioning it. It
must be reachable before step 2 can complete, so decide it early even though no build time is
allocated to it.

**You are protected after step 2, not after step 8.** Steps 0 to 2 are 6h - 8h and at the end of
them there are real, verified, off-box, encrypted backups running nightly. Everything after is
control, visibility and confidence. Land those three first if the budget is tight.

**Work hours are not wall-clock.** The first full upload runs for as long as it runs, unattended.
The estimate in step 2 is attended time.

Step 7 can begin as soon as step 2 produces one good snapshot. Do not wait until the UI is
finished to discover the restore does not work. Step 8 covers bugs in the backup system itself;
faults it uncovers in the product get reported with their own estimate rather than absorbed.

---

## 11. Disaster recovery simulation

The purpose is not to prove the backup ran. It is to measure **RTO** (how long to get back) and
**RPO** (how much data is lost), and to find the steps nobody documented.

### 11.1 Setup

Provision a throwaway Hetzner CX box. **Never restore onto a production box.** Give it no access
to production Redis, and point it at nothing that can write to live data.

### 11.2 The drill

Time every step from the moment you declare the simulated disaster.

**Step 1: restore the database**
```bash
restic restore latest --tag db --target /restore
mysql -u root -p resomix_db_restored < /restore/dump.sql
```
Record: dump size, restore duration, row counts of `tracks`, `apple_music_tracks`, `users`,
`playlists`.

**Step 2: restore the files**
```bash
restic restore latest --tag media    --target /restore/media
restic restore latest --tag uploads  --target /restore/media
restic restore latest --tag analysis --target /restore/analysis
```
Confirm `.partner_slugs.json` is present before anything else. If it is missing, stop: the
drill has already found a fatal flaw.

**Step 3: restore secrets**
```bash
age -d -i ~/age-key.txt /restore/secrets.tar.age | tar x
```

**Step 4: bring up the services** pointed at the restored data, with `RESOMIX_ENV=staging`.

**Step 5: the verification suite.** This is the part that actually proves something. Automate it
as `scripts/dr_verify.py`:

1. **Slug map integrity**: every `partner_id` in the restored `partners` table resolves through
   `.partner_slugs.json` to a directory that exists
2. **Embedding coverage**: sample 500 random active tracks from the DB. For each, assert the
   `.npy` exists, loads, and has the expected dimension (`MAEST_DIM`, `DISCOGS_DIM`). Report the
   miss rate. **Anything above zero is a finding**
3. **Upload completeness**: sample 100 consumer uploads. For each, assert `raw/`, `peaks/` and a
   playable `segments/{uuid}/hls.m3u8` all exist
4. **Analysis results**: sample 100 analysis ids from the DB, assert the `.json.gz` exists,
   decompresses and parses
5. **End to end**: run one similarity query and confirm it returns ranked results. Fetch one HLS
   manifest and pull the first segment. Fetch one analysis result through the API
6. **Referential drift**: count rows referencing files that do not exist, and files with no row.
   The first number should be zero (see section 7's ordering rule). The second should be small
   and is harmless

**Step 6: record the numbers.** RTO, RPO, miss rates, and every step that was not in the runbook.
Write them into `backup_runs` as a drill record so the admin dashboard can show the date.

**Step 7: destroy the box.**

### 11.3 Cadence

First drill before the system is declared done. Then quarterly, and after any change to the
storage layout. The admin tile goes red at 90 days.

### 11.4 Also test the boring failures

Full restores are the rare case. Rehearse these too, they are what you will actually use:

- Restore a single deleted user upload from three weeks ago
- Restore one table after a bad migration
- Recover from a partially failed run: confirm prune was correctly skipped

---

## 12. Decisions I need from you

1. **Destination.** Hetzner Storage Box is my recommendation. Do you want the second off-provider
   copy of the DB dumps as well? It is a few euros a month and it is the only protection against
   losing the Hetzner account itself
2. **restic, or hand-rolled rsync?** I recommend restic for the reasons in 5.2. Hand-rolling is
   viable but you own the retention and verification logic forever
3. **Indexes and catalogs**: include them, against your original scope? My recommendation is yes,
   for recovery time
4. **Secrets backup**: confirm you want this, and who else holds the age key. One key holder is a
   single point of failure that defeats the purpose
5. **Retention floor**: how much total storage should I budget? I need a rough current size of
   `{PARTNER_SFTP_ROOT}` and `var/results` from the boxes to size the Storage Box. I have not
   run anything on the servers, so I cannot measure it from here
6. **Backup window**: 03:00 server time assumed. Confirm this does not collide with the
   Elasticsearch reindex timer or the analysis restart job

---

## Appendix: sizing command

Run these on the boxes and send me the output, and I will size the destination and estimate the
first full transfer:

```bash
# media box
du -sh /srv/sftp/partners
du -sh /srv/sftp/partners/*/internal/embeddings
du -sh /srv/sftp/partners/*/internal/{raw,segments,peaks,previews} 2>/dev/null
du -sh /home/ubuntu/usman/resomix-analysis-service/var/results
```

```bash
# alwyzon box
mysql -e "SELECT table_name, ROUND(data_length/1024/1024) AS data_mb, ROUND(index_length/1024/1024) AS idx_mb, table_rows FROM information_schema.tables WHERE table_schema='resomix_db' ORDER BY data_length DESC LIMIT 15;"
```
