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

## 3. Findings

Seven things worth knowing. F1 to F5 came from reading the code before the run: none is a fault in
the pipeline, four are behaviours to work with, and F1 is a small reporting improvement **awaiting
approval**.

**F6 and F7 came out of the first real upload attempt and are different in kind.** F6 is a genuine
blocker for partner onboarding, found because this is the first end-to-end partner upload anyone has
made. F7 is a property of the Electrobuzz catalogue rather than of our software. Neither blocks this
test, and both are worth acting on regardless of it.

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

### F6. The SFTP hostname we give partners does not reach the SFTP server

**Found 2026-08-21, on the first real upload attempt. Blocks partner onboarding, not this test.**

The admin panel hands partners `media.resomix.com` port `2022`. That hostname is
Cloudflare-proxied, and Cloudflare proxies HTTP and HTTPS only, so port 2022 reaches an edge
with nothing listening. The connection does not fail, it hangs.

Measured:

| Target | Result |
|---|---|
| `135.181.218.143:2022` | open, `SSH-2.0-SFTPGo_2.6.4` |
| `media.resomix.com:2022` | times out |
| `rmedia` / `sftp` / `ftp` `.resomix.com` | no DNS record |

SFTPGo itself is healthy. There is simply no hostname that routes to it, so **no partner
following the credentials screen can upload anything**. It went unnoticed because this is the
first end-to-end partner upload.

**Fix: a small TCP proxy in front, so the media box is never exposed.**

A grey-cloud `sftp.resomix.com` pointed straight at the box would route correctly, but it
publishes the origin IP to every partner, permanently. Cloudflare Spectrum would hide it with no
new infrastructure, but arbitrary TCP ports are Enterprise-tier and the cost is not justified
for this.

So: a small VPS running HAProxy in TCP mode, listening on 2022 and forwarding to the media box
**over a Hetzner private network**. Then `sftp.resomix.com` points at the proxy, the media box
can deny 2022 on its public interface entirely, and the origin never appears in a partner's SFTP
client. The proxy holds nothing and is disposable, and the media box can be moved or rebuilt
without reissuing anyone's credentials.

**One detail that is not optional.** The auth hook supports a per-partner `filters.allowed_ip`.
Behind a plain TCP proxy every connection appears to come *from the proxy*, which silently
breaks that allowlist — and it fails **open**, letting any address through for a partner who has
one configured. It also flattens all connection logging to a single IP. Enable **PROXY protocol
v2** on HAProxy and SFTPGo's matching `proxy_protocol` setting, and verify a real client IP
reaches the log rather than assuming it does.

*Not viable:* Cloudflare Tunnel. Free and hides the origin, but the client side needs
`cloudflared access tcp` running locally, which cannot be asked of partners using ordinary SFTP
clients.

**Related, pre-existing:** the origin answers `:80` and `:443` from the public internet, so the
Cloudflare protection on `media.resomix.com` is already bypassable by IP. That is the same class
of gap closed on the admin side with the ufw lockdown, and is worth closing here too:
restrict 80/443 to Cloudflare ranges, leave 2022 open. Publishing an SFTP hostname does not make
this worse, but it does make the origin easier to find.

**For this test:** use the IP directly. Nothing is blocked.

### F7. Most Electrobuzz files carry no ISRC

**Found 2026-08-21. 7 of the first 10 tracks had no ISRC in their tags.**

ISRC is a required manifest column, format-checked, and cannot be invented: it is the identifier
the partner catalogue keys on, and fabricating values would corrupt both the catalogue and any
later matching. Files without one are left out of the manifest.

If 70% holds across the sample, the 5,000 selected tracks yield roughly 1,500 ingestible, and
the 50-track trial becomes about 15.

**Settled: Electrobuzz has no ISRCs to supply.** The only metadata that exists is what the files
carry in their own tags. There is no other source to join against. Measured on the first 100
selected tracks: **29 usable, 71 skipped**, so roughly 30% yield holds.

Note this is a fact about the Electrobuzz catalogue, not about our pipeline. Our ingestion reads
everything from the manifest CSV and never touches the files' tags; it is the *partner* who has
to produce a manifest, and here the tags are the only thing they can build one from.

**The product question this raises.** ISRC is a distribution identifier. This partner is
similarity-only, where the requirement is audio plus enough metadata to describe it. Making ISRC
mandatory means a real catalogue like this can onboard about 30% of its tracks, and the other 70%
are refused for want of an identifier that similarity never uses.

Worth a decision from George: keep ISRC mandatory and accept that partners without one cannot
fully onboard, or allow a partner-supplied unique id in its place when ISRC is absent. That is a
product call, not a bug, and it does not block this test.

**For the test:** the ~30% that do carry an ISRC are plenty. The test is about ingestion
mechanics, not catalogue size.

### F8. Provisioned partner folders were owned by the wrong user, so no upload could ever succeed

**Found 2026-08-21, on the first real upload. Blocked every partner. Fixed in code, needs deploy.**

Provisioning created `live/` and `test/` then ran a hardcoded `chown -R 1000:1000`
(`resomix-similarity-open/app/api/internal.py`). That literal dates from when SFTPGo ran in
Docker as uid 1000. On a native install it runs as the `sftpgo` system user, which on the media
box is **999:988**, while **1000 is `ubuntu`**.

So each partner folder was chowned *away* from the only user that has to write into it. Mode
`2770` grants owner and group; `sftpgo` matched neither, landing in "other" with no access. Every
upload failed with `EACCES` at the first byte.

Measured before the fix:

```
drwxrws--- 2 1000 1000  test          <- partner folder, owned by ubuntu
drwxrwsr-x 5  999  988  ..            <- partners root, correctly owned by sftpgo
sudo -u sftpgo touch .../test/probe   -> Permission denied
```

**Why it went unnoticed:** provisioning reported success, the folders looked right, and login
worked. The failure only appeared on the first byte written, and until this test no partner had
ever completed an upload.

**Fix (done in code):** ownership is now read off the partners root with `os.stat` rather than
hardcoded, so a new partner folder always matches the tree it lives in whatever the local user
numbering is. If the parent cannot be stat'd it skips the chown and logs, rather than guessing.

**Still to do:**
- [ ] Deploy the media service so new partners provision correctly.
- [ ] Backfill any partner provisioned before the fix:
      `sudo chown -R 999:988 /srv/sftp/partners/<slug> && sudo chmod -R 2770 /srv/sftp/partners/<slug>`
- [ ] Confirm the media service's user is in the shared group, or it cannot read the uploads it
      has to move to `processing/`: `getent group 988 && id ubuntu`. On this box `ubuntu` is
      already a member of `sftpgo(988)`, so this is satisfied.

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

## 6. Fixes and improvements

### Blocking partner onboarding (found by this test, not by the review)

**F8 — folder ownership.** Fixed in code. Needs the media service deployed, plus a one-line
backfill for partners provisioned before the fix. Without it no partner can upload at all.

**F6 — SFTP hostname.** Needs a decision, then roughly half a day: a small TCP proxy VPS,
`sftp.resomix.com` pointed at it, PROXY protocol enabled both ends, and the media box's public
2022 closed. Without it no partner can reach the server. The test itself is unblocked by using
the origin IP directly.

**Media origin exposure.** Pre-existing and separate: the box answers `:80` and `:443` publicly,
so Cloudflare on `media.resomix.com` is bypassable by IP today. Same shape as the admin CF Access
gap closed earlier with ufw. Restrict 80/443 to Cloudflare ranges, leave 2022 to the proxy.

### From the code review

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

## 7. Run log

**Partner `test_electrobuzz_5000`** — uuid `bad9def3-99ad-478f-a875-b3a56a4e427d`,
slug `b3a56a4e427d`, **partner id 6**, plan Enterprise, similarity-only.

### Phase 1 — dry run into `test/`, 2026-08-21 — PASSED

10 paths in, 3 uploaded (7 skipped for no ISRC, see F7). Ingest run **#10**, status COMPLETED,
stage READY, 3/3 done, 0 failed.

Timeline: `RECEIVED 12:21:55 → VALIDATING 12:21:55 → READY 12:23:07`. MOVED, PERSISTING,
TRANSCODING, INGESTED, EMBEDDING, INDEXED and FINALIZING all skipped, which is correct for a
`test/` batch (F3) and confirms the dry-run path behaves as designed.

**What this proves:** SFTPGo's upload hook fires, the concurrency guard admits the batch, the
`ingest_logs` row is created and staged, the handoff to media works, the manifest parses, every
ISRC and optional field passes validation, ffprobe reads all three files, and clamAV is happy.
That is the whole front half of the pipeline.

**Two blockers had to be cleared first**, neither of them in the pipeline: F6 (the SFTP hostname
does not route) and F8 (folder ownership made every upload impossible). Both were found by this
run and are written up above.

**Timing datapoint:** 72 seconds for 3 files / ~41 MB. Mostly fixed overhead at this size, but
the per-track slope is the number that matters for the 5,000-track run, so **measure it on the
50-track live pass** and extrapolate before committing to the full batch.

### Phase 2 — live run into `live/` — not yet run

Expect MOVED and TRANSCODING to stay greyed even though both happen. That is F1, not a failure.
Watching for it is the cheapest confirmation of that finding.

| # | Phase | What happened | Stage reported | Root cause | Fixed? |
|---|---|---|---|---|---|
| 1 | 1 | SFTP connect hung with no output | n/a, never started | F6 hostname is Cloudflare-proxied | workaround: origin IP |
| 2 | 1 | Upload failed `EACCES` on first byte | n/a, never started | F8 folders chowned to uid 1000, SFTPGo is 999 | yes, in code + backfilled |

---

## 8. Notes for whoever runs this

- Every pipeline timestamp is **UTC**. The Alwyzon box is UTC; the media box is **Europe/Berlin**, so
  its journal and nginx logs are two hours ahead. `journalctl --since` parses in the box's local zone
  even when `--utc` is passed, so pass `TZ=UTC` or an explicit zone.
- Batches are serialised per partner. If one wedges, the next `.done` is rejected outright, so clear
  the stuck row before retrying (F4).
- The backup is the only recovery route once a batch has moved out of `live/` (F5).
