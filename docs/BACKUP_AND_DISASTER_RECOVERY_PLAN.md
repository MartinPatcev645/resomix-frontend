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

| Phase | Work | Depends on |
|---|---|---|
| 0 | Provision the Storage Box. Initialise the restic repo. Store the repo password and the age key in the password manager | Your decision on destination |
| 1 | Backup scripts on each box: `backup_db.sh`, `backup_media.sh`, `backup_analysis.sh`, `backup_secrets.sh`. Each emits JSON metrics on stdout | Phase 0 |
| 2 | Run them by hand. Confirm sizes, timings, and that the first full transfer completes | Phase 1 |
| 3 | Media box endpoints `/internal/backup/{start,status}` | Phase 2 |
| 4 | Alwyzon: migration for the two tables, service, admin router, RBAC permissions | Phase 3 |
| 5 | Celery beat schedule, retention, alerting | Phase 4 |
| 6 | Admin UI in `resomix-web` admin app | Phase 4 |
| 7 | **The DR drill (section 11).** Not optional, and not the last thing you do | Phase 2 is enough to start |

Phase 7 can begin as soon as phase 2 produces one good snapshot. Do not wait until the UI is
finished to discover the restore does not work.

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
