# Partner Ingestion: End-to-End Test Plan (Electrobuzz)

> **Created 2026-08-19.** Goal: prove the reworked partner ingestion pipeline handles a real
> catalogue batch end to end, from SFTP upload through to tracks being queryable via the API and
> visible in admin. Dry run at **50 tracks** first, then the full **5,000**.
>
> Test partner: **`test_electrobuzz_5000`**, created solely for this and deleted afterwards.

---

## 0. Status at a glance

*Last updated 2026-08-21, after the first live run (29 tracks).*

The test found **eight faults that no dry run could have found**, and every one of them would have
hit the first real partner. All eight are fixed. Detail for every item is in section 3; this table
is the summary.

### Fixed during the test

| # | What was wrong | Impact if left | State |
|---|---|---|---|
| **F8** | Provisioning chowned partner folders to uid 1000, but SFTPGo runs as `sftpgo` (999) | No partner could upload a single byte | Fixed, deployed, backfilled |
| **F9** | The media status endpoint never returned `processing_dir` | Every live batch dead-ends at INGESTED: no transcode, no embeddings, no index | Fixed, deployed |
| **F10** | No endpoint could start a transcode job, and the admin button offered for it re-ran ingestion instead | Any transcode failure is unrecoverable from the UI | Fixed and deployed; used successfully to resume run #11 |
| **F11** | clamAV could not read a single partner file, and ingestion treated every failed scan as clean | Uploads were never virus-scanned, and nothing anywhere said so | Host fixed and verified; code fixed |
| **F12** | ffmpeg was handed a `.tmp` output path and could not infer a container, so every transcode aborted. The error was then truncated to the ffmpeg banner | No track could ever be transcoded, and the reason was unreadable | Fixed, deployed, transcode now 29/29 |
| **F13** | The code that advances a batch to READY was behind a condition that is never true, so batches stopped at INGESTED | INGESTED counts as active, so **a partner who ingests one batch can never upload another** | Fixed, deployed, batch now READY |
| **F15** | A track deactivated by a failed stage is never reactivated when the retry succeeds | All 29 tracks sat at `is_active=false`, so **similarity 404'd for the whole catalogue**. Any transient failure drops tracks permanently | Fixed in code; needs deploy + one SQL for run #11 |
| **F14** | A partner's ingested catalogue was invisible to `/search_tracks/` | Search is ES-backed and ingestion never writes to ES, so the documented route to a `track_id` returned nothing for a partner's own catalogue | Fixed in code: partner-scoped search now goes to the DB |

These stack rather than compete. F9 stopped the batch before transcode, so F12 could not be found
until F9 was fixed, F10 meant there was no way to retry once it had been, and F15 only became
visible after F12's failure had already deactivated everything. Each fix exposed the next fault.
All of them are invisible to a `test/` dry run by construction, which is why the pipeline looked
healthy for months. F11 and F16 were invisible to any run at all: one announced itself only in the
journal, the other only in a field nobody reads.

**Note the last three took a different kind of looking.** F13, F14 and F15 all sat behind jobs that
reported success. Watching the pipeline run would never have surfaced them; only querying the result
as a partner would.

**One ordering constraint.** The F11 code change is fail-closed: an unscannable file now fails the
batch. Apply the clamd host fix and verify it before deploying, or every batch will be rejected.
Done and verified on the media box on 2026-08-21.

**Where the test stands.** Run #11 is **READY**: 29/29 transcoded, 29/29 embedded, 29 tracks
recorded, all jobs completed, `--verify` fully green. That is the first partner batch in the
project's history to complete the pipeline end to end.

**The partner API is green.** `scripts/partner_api_smoke.py` against the live key, 2026-08-21:
**11 passed, 0 failed, 0 warnings.** Auth, tenant isolation, unauthenticated refusal, search,
similarity, `top_sk` validation, unknown-id handling and the per-key rate limit all behave. Sample
similarity output for a 29-track catalogue:

```
seed: Regis - Clean Air
  0.6750  Tim Paris, Sex Judas - Version B Original Mix
  0.6642  Ignacio Tardieu - Arapaima
  0.6588  Luca Agnelli - 7 O' Clock (Luca Agnelli Remix)
```

Rate limiting confirmed live: 30 concurrent requests against a 10 rps key returned 27 x 200 and
3 x 429. Note the limiter is a token bucket of capacity `rps * 2` that refills during the burst, so
"more than 20 got through" is expected rather than a fault, and the script's ceiling accounts for it.

Remaining before Phase 4 (5,000 tracks): review `logs.json` in the batch folder, and answer the
embeddings throughput question, since that stage projects to roughly 4.8 h at 5,000.

### Needs a decision

| # | What | Why it needs you | Estimate |
|---|---|---|---|
| **F6** | The SFTP hostname we hand partners is Cloudflare-proxied, which does not carry SFTP | No partner can connect. The test works around it with the origin IP, which we do not want to give out | ~half a day |
| **F7** | Only ~30% of Electrobuzz files carry an ISRC, which ingestion requires | A real catalogue onboards a third of itself. Product call: keep ISRC mandatory, or accept a partner-supplied id for similarity-only partners | Decision only |
| **F1** | `MOVED` reaches the partner's log but not the admin timeline | Cosmetic accuracy in the admin view. Was already awaiting approval before this run | 1.5 h |

### Behaviours to work with, not faults

**F2** `.done` must arrive over SFTP, not be written on the box. **F3** the built-in dry run is
shallower than it looks. **F4** one active batch per partner, by design. **F5** take the backup
before `.done`, because the move empties `live/`.

### Also open, pre-existing

The media box answers `:80` and `:443` publicly, so Cloudflare on `media.resomix.com` is bypassable
by IP. Same shape as the admin CF Access gap closed earlier. Separate from this test.

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
  allowlist, and clamAV scanning. All-or-nothing: one bad row fails the whole batch. *The clamAV
  half had never actually scanned anything and passed every file regardless, see F11. Fixed, but
  the host fix has to be applied before the code change is deployed.*
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
  from `processing/<dt>/`. Auto-spawned after persist and runs concurrently with embedding. *Had
  never once run to completion before 2026-08-21, see F12.*
- **Embeddings and index.** Auto-spawned, then FAISS index and catalog build.
- **Stage timeline.** `ingest_logs.stage` and `stage_timeline` (UTC) record `RECEIVED`,
  `VALIDATING`, `PERSISTING`, `INGESTED`, `EMBEDDING`, `INDEXED`, `FINALIZING`, `READY`, plus the
  failure states. Surfaced to admin and mirrored into the partner's `logs.json`.
- **Admin controls.** Ingestion trigger, batch retry, pause and resume on the processing jobs, and
  (since 2026-08-21) retry on a failed transcode, see F10.
- **Failure reporting.** Per-row `IngestionError` records with stable codes, an `errors.txt` in the
  batch folder, and partner webhook notification.

---

## 3. Findings

Thirteen, in the order they were found. **F1 to F5** came from reading the code before the run:
none is a fault, four are behaviours to work with, and F1 is a small reporting improvement awaiting
approval. **F6 to F13** came from actually running it, and six of those are real faults that no
amount of code reading had caught. F13 in particular was only found by *verifying* the run rather
than watching it, since every job reported success.

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
breaks that allowlist, and it fails **open**, letting any address through for a partner who has
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

### F9. The media server never returned `processing_dir`, so every live batch stalled at INGESTED

**Found 2026-08-21, on the first live run (run #11). Blocked every live ingestion. Fixed in code,
needs deploy.**

This is the one the test was built to catch. Nothing before it had ever run a live batch, so
nothing had ever needed this field.

The media runner moves a validated live batch into `processing/<dt>/` and writes that folder name
into the job's result JSON as `processing_dir`. Alwyzon reads it back on the next poll, stores it
on the ingest log, and the transcode job uses it to locate the moved files. That is the only
record of where the batch went.

The `/internal/ingestion/status/{partner_id}/{job_id}` endpoint built its response from an
explicit field list that **did not include `processing_dir`**. The runner wrote it, the JSON on
disk had it, and the API dropped it. Alwyzon's `state.get("processing_dir")` was therefore always
`None`, the column stayed `NULL`, and the auto-spawned transcode job aborted on its first line:

```
{"error": "no processing_dir on ingest log; cannot locate sources"}
```

The same response was also dropping `report_path`, the partner-visible validation report link that
Alwyzon puts in the failure notification. Silent, and lower stakes, but the same omission.

**What it looks like when it happens.** The batch reaches INGESTED and stops. Tracks are in the
database and files are safely in `processing/<dt>/`, so nothing is lost, but transcode shows FAILED
with `0/0` in `0s`, the pipeline banner reads "halted, needs review", and embeddings never spawn at
all: they are only spawned when the transcode hand-off is accepted. So one missing string takes out
the entire second half of the pipeline.

**Why it went unnoticed:** the field is only ever populated on a live run, `test/` runs skip the
move by design and correctly report `processing_dir: null`, and Phase 1 passed cleanly for exactly
that reason. Every dry run in the project's history looked healthy.

**Fix (done in code):** `processing_dir` and `report_path` are now on `IngestionStatusResponse` and
passed through in `internal.py`. Both are cheap scalars and are returned even on light
`include_records=false` polls, since Alwyzon persists `processing_dir` from whichever poll first
sees the job completed, and that is normally a light one.

**Still to do:**
- [ ] Deploy the media service.
- [ ] Backfill run #11, which cannot self-heal: `_refresh_log_from_hetzner` returns early for
      logs in `COMPLETED`/`FAILED`, so a terminal log is never polled again and the fixed
      endpoint will never be asked. One row, by hand (see Phase 2 in the run log).

### F10. A failed transcode had no way back, and the admin button for it did the wrong thing

**Found 2026-08-21, while working out how to recover from F9. Fixed in code, needs deploy.**

Two separate problems that only show up together, and only once a transcode has actually failed,
which before run #11 had never happened.

**There was no endpoint to start a transcode job.** Admin has
`/processing/jobs/{job_id}/resume` (embeddings only, rejects anything else with a 400) and
`/processing/jobs/{stage}` (peaks and segments only, 404 for anything else). Transcode was only
ever spawned automatically from `finalize_successful_ingestion`. That runs exactly once per batch,
so once transcode failed, nothing could start it again.

**The button offered for it called the ingestion retry.** On a failed transcode row the admin UI
shows a circular-arrow tooltipped "Retry Ingestion Batch", wired to
`POST /ingestion/logs/{log_id}/retry`. That does not resume anything: it creates a **new** ingest
log pointed at `live/`. After a successful move `live/` is empty, so the new run fails on "No CSV
manifest found" while the original batch stays stuck exactly where it was. The retry button on the
ingest-log table and the one on the transcode row were the same action.

Worth noting `retry_ingestion` calls `start_ingestion_job`, which does **not** check
`has_active_batch`; only the SFTP hook does. So the admin path can open a second run for a partner
that already has an active batch, bypassing the F4 concurrency guard.

**Why it matters beyond F9:** any transcode failure has this shape. A genuinely corrupt file, an
ffmpeg OOM, a media server restart mid-job. The batch is persisted, the audio is on disk, and the
pipeline simply has no way forward, because embeddings only spawn once transcode reports
`completed` or `partial`.

**Fix (done in code):**
- `/processing/jobs/{job_id}/resume` now accepts transcode as well as embeddings and routes it to
  `start_transcode_job`. Safe to re-run: `only_pending` filters on `transcode_status`, so files
  that already produced an mp3 are not redone, and the existing job row is reused rather than
  duplicated.
- `start_transcode_job` clears `completed_at` and `error_details` on entry, so a retried job stops
  displaying the previous failure. Mirrors what `resume_embeddings_job` already did.
- The admin button on paused/failed transcode rows now calls resume instead of the ingestion
  retry, and is labelled "Retry Transcode". The ingest-log table keeps its own retry, which is
  where re-ingesting genuinely belongs.

**Not changed:** `start_ingestion_job` still skips the concurrency guard. Left alone deliberately,
since admin sometimes needs to force a run, but it is worth a look separately.

### F11. The virus scan has never scanned anything, and it fails open silently

**Found 2026-08-21, from the run #11 journal. Fixed in code; needs the host fix applied first.**

The good news first: validation is real. The journal confirms `skip_validation=False` and
`probe+AV on 29 file(s) with 12 worker(s) (av=True)`, so `INGEST_SKIP_VALIDATION` is off and the
expensive tier did run. The speed was ffprobe being header-only across 12 workers, not a skip.

But every one of the 29 files produced:

```
AV scan did not complete for <file> (treating as clean): unexpected status ERROR
```

**29 of 29.** Not a hiccup on a few files, a total failure that ingestion then waved through.

**Why it passes anyway.** `_validate_one_file` in `ingestion_runner.py` deliberately fails open: a
scan that errors is treated as a scanner problem rather than a virus, so the file is marked clean
and a warning is logged. Per file that is a defensible choice. What is not defensible is that a
batch where **100% of scans failed** looks identical to a batch that was scanned and came back
clean. Nothing reaches the ingest log, the admin view, the partner, or `logs.json`. Only the
journal knows, and only if someone greps it.

So `ANTIVIRUS_ENABLED=true` currently buys nothing but a false sense of coverage. Note the config
default is `False`, so this is enabled deliberately on the media box, which makes the silence worse.

**Why clamd returns ERROR.** `clamd.scan(path)` asks the daemon to open the file itself. clamd runs
as its own user (`clamav`), and `ERROR` is what it returns when it cannot read the path. There were
two candidate causes, and **both turned out to be true at once**, which is why neither fix alone
would have worked:

1. **Permissions.** Partner directories are mode `2770` owned by `sftpgo` (gid 988, whose only
   member was `ubuntu`). `clamav` is uid 110 / gid 111 with no supplementary groups, so it landed in
   "other" with no access. Confirmed by `sudo -u clamav test -r` failing on a partner file. Not a
   side effect of the F8 fix: `2770` excluded "other" under the old `1000:1000` ownership too, so
   the scan has been failing since long before this test.
2. **AppArmor.** The `/usr/sbin/clamd` profile does not cover `/srv/sftp/`. `dmesg` carries explicit
   denials, some from an earlier partner, so this has been happening across partners and not just
   this batch:
   ```
   apparmor="DENIED" operation="open" profile="/usr/sbin/clamd"
     name="/srv/sftp/partners/000000000000/live/…mp3" requested_mask="r" denied_mask="r"
   ```

**Host fix (both are required).**

```bash
sudo usermod -aG sftpgo clamav                                    # 1. DAC
grep -q 'local/usr.sbin.clamd' /etc/apparmor.d/usr.sbin.clamd     # 2. MAC: confirm the include
echo '/srv/sftp/partners/** r,' | sudo tee -a /etc/apparmor.d/local/usr.sbin.clamd
sudo apparmor_parser -r /etc/apparmor.d/usr.sbin.clamd
sudo systemctl restart clamav-daemon                              # picks up the new group too
```

Supplementary groups are read at process start, so the restart is what makes the group change take
effect, not just the `usermod`.

**Verify before deploying the code**, because the code change below is fail-closed and a still-broken
scanner would then reject every batch:

```bash
clamdscan /srv/sftp/partners/<slug>/processing/<dt>/manifest.csv   # expect "OK", not "ERROR"
sudo dmesg | grep -i apparmor | grep -i clam | tail -3             # expect nothing new
```

**Code fix (done).** The per-file fail-open is gone. `_validate_one_file` now returns three
distinguishable outcomes rather than two: scanned and clean, scanned and infected, and **could not
be scanned**. The third feeds the existing per-row error list, so it rejects the batch and names the
offending file and manifest row exactly like `NOT_AUDIO` or `MISSING_ISRC` already do. No new status
field, no new surface to maintain.

- New code `AV_SCAN_FAILED`, distinct from `AV_INFECTED`, because a missing verdict is not a
  detection and must not be reported to a partner as one.
- Message names the file and carries the scanner's own reason, e.g. *"File 'x.mp3' could not be
  virus-scanned (unexpected status ERROR). It cannot be accepted without a completed scan."*
- `AV_INFECTED`'s message changed from "Antivirus scan failed for 'x'" to "Antivirus scan found a
  threat in 'x'", which is what it always meant.
- The **zip** path had the mirror-image bug: it tested `clean` without checking `success`, so a scan
  that merely failed was reported to the partner as an infected archive. It now uses the same two
  codes.
- `AV_SCAN_FAILED` added to Alwyzon's critical-severity list alongside `AV_INFECTED`.
- With `ANTIVIRUS_ENABLED=false` nothing is scanned and nothing is rejected, unchanged.

Files: `resomix-similarity-open/app/services/ingestion_runner.py`,
`basic_fastapi_server_resomix/app/services/ingestion_service.py`. Tests updated in
`tests/test_ingestion_runner.py`: the old `..._fails_open` test asserted the behaviour we just
removed, so it now asserts the file is rejected, named, and **not** labelled an infection. A new
test covers AV disabled. 64 pass.

**Consequence worth stating plainly.** Ingestion is now stricter than it was this morning: a batch
containing one unscannable file fails whole, like any other validation error. That is the correct
posture for content we redistribute, but it means the clamd host fix is a hard prerequisite for the
5,000-track run, not a nice-to-have.

**Still to do:** everything ingested before today was accepted unscanned, including run #11's 29
tracks. Once clamd works, sweep what is already on disk:
`sudo clamdscan -r /srv/sftp/partners/ | tail -5`.

### F12. Transcode could never have worked: ffmpeg was asked to write a file it could not name

**Found 2026-08-21, on the first transcode that ever ran. Fixed in code, needs deploy.**

With F9 and F10 fixed, the transcode job finally started for real, and failed **29 of 29**.

**The cause.** `transcode_one_track` writes to a temp sibling and atomically renames it into place,
so a concurrent reader never sees a half-written file. Sensible, and the overlapped embedding job
depends on it. But the temp name is `<uuid>.mp3.tmp`, and `_transcode_to_mp3` passed that straight to
ffmpeg as the output path. ffmpeg picks its output container from the file extension, `.tmp` means
nothing to it, and it aborts before encoding a single frame:

```
[NULL @ 0x…] Unable to find a suitable output format for '…/<uuid>.mp3.tmp'
…/<uuid>.mp3.tmp: Invalid argument
```

Nothing to do with the files, the codec, or permissions. Every source format, every file, instantly.

**Why it survived this long.** Transcode had never actually run: `INGEST_INLINE_TRANSCODE` is off by
default, and the standalone job was unreachable because of F9. On top of that, the D4 fast path
copies an mp3 already at or below ~133 kbps with `shutil.copy2` instead of invoking ffmpeg, so a
batch of low-bitrate mp3s would have appeared to work. This batch is 320 kbps mp3s and flacs, so
every single file took the ffmpeg branch.

**The second fault, which is why the cause was invisible.** The error was captured as
`r.stderr[:300]`. ffmpeg opens with about a kilobyte of version banner and build configuration and
puts the actual failure at the *end*, so all 29 admin entries contained nothing but the ffmpeg
version string and half the `configure` line. The failure was being reported in full and truncated
down to exactly the part that carries no information.

**Fix (done in code):**
- `-f mp3` added to the ffmpeg invocation, so the container is stated explicitly and the output
  filename no longer matters. This keeps the atomic-rename design rather than working around it.
- New `_ffmpeg_error()` takes the *tail* of stderr, strips the banner and `lib*` version lines, and
  returns the last few meaningful lines capped at 500 chars. Applies to every future ffmpeg failure,
  not just this one.

File: `resomix-similarity-open/app/services/ingestion_runner.py`. 64 tests pass.

**Retrying after the deploy picks the failed tracks back up.** `_collect_targets` filters on
`transcode_status != "completed"`, so all 29 are collected again; it does not filter for `pending`
specifically. No cleanup needed before hitting retry.

### F13. The batch could never reach READY, so one successful upload blocked the partner forever

**Found 2026-08-21, by `--verify` after the first fully successful run. Fixed in code, needs deploy.**

Everything worked and the batch still did not finish:

```
Admin: ingestion logs
 FAIL  stage is 'INGESTED', expected READY
Admin: tracks              29 track(s) recorded          OK
Admin: processing jobs     embeddings: completed         OK
                           transcode:  completed         OK
On-disk artefacts          internal/raw: 29 mp3
```

**The cause is a guard that can never be true.** When the embeddings job finalizes,
`apply_embeddings_result` advances the ingest log through the last four stages:

```python
log = await db.get(IngestLog, job.ingest_log_id)
if log and log.status != "COMPLETED":          # <- never true
    advance_stage(log, Stage.EMBEDDING)
    advance_stage(log, Stage.INDEXED)
    advance_stage(log, Stage.FINALIZING)
    advance_stage(log, Stage.READY)
```

But under v2 ingestion is the gate, and `finalize_successful_ingestion` sets
`log_entry.status = "COMPLETED"` at the moment it stamps `INGESTED`. So by the time embeddings
finish, the status is *always* already `COMPLETED`, the condition is *always* false, and the block
is unreachable. The guard was written for the older semantics, where `COMPLETED` meant the whole
pipeline was done, and was never revisited when INGESTED became the gate.

**Why this is the most serious of the lot.** `INGESTED` is in `ACTIVE_STAGES`, and
`has_active_batch` is what the `.done` hook checks. A batch parked at INGESTED counts as active
forever, so **a partner who successfully ingests one batch can never upload another one**. Their
second `.done` is hard-rejected by the concurrency guard, with no way to clear it short of editing
the database. Nothing times it out: the staleness check only covers `PERSISTING`.

It also means the `ingestion.completed` webhook carrying `stage: READY` never fires, so a partner
integrating against our webhooks never learns their batch finished.

**Fix (done in code).** Guard on the stage rather than the status:

```python
if log and log.stage not in TERMINAL_STAGES:
```

`TERMINAL_STAGES` is `{READY, FAILED_VALIDATION, FAILED}`, which keeps the block idempotent, so
re-running embeddings for an already-READY batch re-stamps nothing. `log.status = "COMPLETED"`
stays for legacy rows; it is simply redundant now.

File: `basic_fastapi_server_resomix/app/services/partner_processing_service.py`.

**Recovering run #11 after the deploy.** Job #4 is terminal and terminal jobs are never re-polled,
so the fixed code will not run for it on its own. Re-trigger embeddings for the batch, which is
cheap because the media runner skips any track whose `.npy` already exists:

Admin, Embedding stage, **Trigger Embeddings Job**:
- Partner `test_electrobuzz_5000`, Run Mode **Live**, Ingest Log ID **11**
- Index into FAISS: **on**
- Skip tracks that already have embeddings: **off**

That last switch matters. Left on, `_collect_targets` filters out all 29 as already completed, the
job short-circuits to "nothing to do" without ever calling `apply_embeddings_result`, and the stage
stays at INGESTED. Off, the 29 are re-handed to media, media skips the existing files, the job
finalizes normally, and the now-reachable block advances the batch to READY.

**Cosmetic, not fixed:** the four stages are stamped in immediate succession at the end, so
EMBEDDING, INDEXED and FINALIZING all carry the same timestamp as READY rather than the moment each
actually happened. The timeline is therefore accurate about order but not about duration. Same
family as F1 and worth folding into that work if it is approved.

### F14. A partner's ingested catalogue is invisible to search

**Found 2026-08-21, by the partner API smoke test. Not fixed, needs a decision.**

`/api/v1/search_tracks/` returns `{"tracks": []}` for every query against a partner catalogue that
has just been ingested and is READY. Tried `original mix`, `remix`, `mix`, `a`: all empty, HTTP 200.

**Why.** Search is Elasticsearch-backed. `search_service.py` treats a zero-hit ES response as
authoritative and deliberately does *not* fall back to the database:

```python
# ES succeeded with zero hits is a real answer — don't fall back.
if not uuids:
    return {"tracks": []}
```

And nothing in the application ever writes to that index. The only writer is `app/utils/es_index.py`,
driven by an external rebuild that sources the Electrobuzz catalogue and stamps every document
`type: "electrobuzz"`. Partner ingestion has no ES step at any stage. So a partner's tracks are in
MariaDB and in FAISS, but never in Elasticsearch, and search will keep returning nothing for them
until the next full rebuild happens to include them, which for a partner catalogue it never does.

**Why it matters.** Search is one of the three documented core partner endpoints, and the partner
docs specify it as the way to obtain a `track_id`: *"`track_id` | yes | Track UUID (from search)"*.
So the documented path to similarity begins with an endpoint that cannot see the caller's own
catalogue. There is also no partner-facing "list my tracks" endpoint (`/my-tracks/` requires a
logged-in user, not an API key), so a partner has no supported way to discover their own track ids
at all.

**Options, for a decision:**
1. **Index on ingest.** Add an ES upsert to the ingestion pipeline, most naturally at the same
   point that already stamps `INDEXED`. Correct and permanent, but it is new pipeline work and the
   index currently assumes a single `electrobuzz` document type.
2. **Fall back to the database when ES has no hits for a partner-scoped query.** Small and quick,
   and the DB search path already exists and already takes `partner_id`. Weakens the "zero hits is
   a real answer" guarantee, though only for partner queries.
3. **Add a partner-facing catalogue listing endpoint.** Solves track-id discovery regardless of
   search, and is arguably missing anyway.

Worth noting the three are not exclusive, and 3 is the one a partner will ask for first.

### F15. A track deactivated by a failed stage is never reactivated when the retry succeeds

**Found 2026-08-21, chasing a similarity 404 on every track. Fixed in code, needs deploy.**

Every partner API call to `/similarity/search` returned
`Track with ID '…' not found or path is missing`, for all 29 tracks. The tracks exist, the mp3s
exist, the vectors exist, the FAISS index was rebuilt with 29 vectors. Admin shows why:

```
"is_active": false,          <- on all 29
"transcode_status": "completed",
"embedding_status": "completed",
"updated_at": "2026-08-21T08:11:34"
```

`async_get_track_path_by_uuid` filters `Track.is_active.isnot(False)`, so an inactive track 404s
before similarity is ever reached.

**Why they are inactive.** `_apply_track_results_bulk` deactivates any track whose transcode or
embedding **failed**, which is correct: no mp3 or no vector means the track is unusable and must
leave the catalogue. The F12 transcode failure at 10:11:33 did exactly that to all 29. But there is
**no counterpart on success**. The retry at 10:17:54 set every status column back to `completed`
and left `is_active = false` untouched. `08:11:34` in the admin dump is that deactivation, and
nothing has written to those rows since.

So a retry recovers the *reporting* and not the *track*. Any transient failure, one bad ffmpeg run,
a media restart mid-job, permanently removes tracks from the catalogue even after a clean retry, and
the only route back is the per-track admin "set live" button. There is no batch equivalent.

**Fix (done in code).** Reactivate the tracks that just recovered, scoped precisely: only rows whose
current status for *this* stage is literally `"failed"`. A track an admin deliberately stopped has
`is_active=false` with a *completed* status, so it is never resurrected by an unrelated re-run.

```python
recovered = select(TrackProcessingStatus.track_id).where(
    TrackProcessingStatus.id.in_(ok_tps),
    getattr(TrackProcessingStatus, status_col) == "failed",
)
```

**Second, stronger guarantee: the batch is now explicitly published at READY.** Relying on
`is_active` having defaulted `True` at insert and nothing having knocked it over since is a weak
promise, and F12 is proof of how easily it breaks. So the block that advances a batch to READY now
also activates that batch's tracks:

```sql
UPDATE tracks SET is_active = 1
 WHERE id IN (SELECT track_id FROM track_processing_status
               WHERE ingest_log_id = ? AND partner_id = ?
                 AND transcode_status = 'completed'
                 AND embedding_status = 'completed')
   AND is_active IS NOT true
```

Gated on the track's **own** stages having completed, so a track that genuinely failed transcode or
embedding stays inactive and out of the catalogue, and a partial batch publishes only its good
tracks. `peaks`/`segments` are deliberately not required: they affect playback only, their failure
never deactivates a track, and for a similarity-only partner they never run. It executes exactly
once per batch, because the enclosing guard is `TERMINAL_STAGES`, so it can never fight an admin who
stops a track later.

Between the two, a successful ingestion now ends with its tracks live by construction rather than by
luck.

File: `basic_fastapi_server_resomix/app/services/partner_processing_service.py`.

**Recovering run #11.** The fix cannot help retroactively, because the statuses already read
`completed`, so nothing is left for it to recognise as recovered. The vectors are already in the
index (`rebuilt maest index (29 vectors)`, same for discogs), so only the flag needs correcting:

```sql
UPDATE tracks SET is_active = 1 WHERE partner_id = 6 AND is_active = 0;
```

Using admin "set live" per track would also work and would additionally re-add each vector, but
that is 29 clicks to redo work already done.

### F16. `faiss_indexed` stays false even though the vectors are indexed

**Found 2026-08-21. Not fixed, reporting only.**

All 29 tracks show `"faiss_indexed": false, "faiss_indexed_at": null`, while the media journal
shows `rebuilt maest index (29 vectors)` and `rebuilt discogs index (29 vectors)`. The vectors are
genuinely in the index; the flag is simply not being set.

`_apply_track_results_bulk` only sets `faiss_indexed=True` for tracks whose per-track result carries
`maest_indexed` or `discogs_indexed`. The embeddings runner does a **bulk index rebuild** at the end
of the job rather than per-track adds, so those per-track flags are never present and the column
stays false for the whole batch.

Harmless functionally, but it means admin reports a batch as unindexed when it is indexed, which is
exactly the kind of thing that sends someone chasing a non-existent bug later. Either set the flag
for the whole batch when a rebuild reports success, or drop the column in favour of asking the index.

### F17. A legitimate filename was rejected as path traversal, costing a real track

**Found 2026-08-21, batch A of the repeat-ingestion test. Fixed in code, needs deploy.**

Batch A embedded **99 of 100**. The one failure:

```json
{"track_uuid": "a18d5180-4a91-4277-a258-07d849241848",
 "message": "Path traversal detected in uuid/filename"}
```

`_embed_one` rejected the track because `_has_path_traversal` returns true for any value
containing `..`, `/` or `\`. A filename cannot contain `/` and still exist on disk, and the batch
had already passed validation (which resolves `audio_dir / audio_filename` and requires the file to
exist), so the trigger is the `..` substring: an Electrobuzz title with an ellipsis, something along
the lines of `Sometimes i feel like....mp3`.

**Two things are wrong with that check as applied to a filename.**

1. `..` is only traversal when it forms a whole path *segment*. `a..b.mp3` is a perfectly ordinary
   filename. The substring test rejects safe names.
2. In this code path the filename **never touches the filesystem**. `_find_raw_audio` locates the
   audio by **uuid** (`raw_dir.glob(f"{track_uuid}.*")`); `filename` is passed on only to
   `_get_content_type_for_filename` for a MIME type and as the multipart field name in the HTTP
   call to the GPU embed server. So it was guarding a hazard that does not exist here, and the
   guard that does matter, on the uuid, is untouched by this.

**Fix (done in code).** Split the two, because they are genuinely different questions:

- `_has_path_traversal` stays exactly as it was and still guards `track_uuid`, which really is used
  to build a path. The other two call sites (both uuids) are unchanged.
- New `_is_unsafe_basename` guards the filename: rejects a path separator or a bare `.` / `..`,
  permits `..` inside a name, and treats empty as fine since the caller falls back to the on-disk
  name.
- The error message now names the offending filename instead of saying "uuid/filename", so the next
  person does not have to work out which of the two it meant.

Covered by a predicate test over both safe titles and hostile inputs.

File: `resomix-similarity-open/app/api/internal.py`.

**The affected track recovers on its own.** An embedding failure deactivates the track
(`_DEACTIVATE_ON_FAIL`), so it is currently inactive and out of the catalogue. Re-running embeddings
for the batch after the deploy will succeed and, thanks to F15, reactivate it automatically. This is
the first time the F15 recovery path gets exercised by a real failure rather than a contrived one.

### Also noted

`INGEST_SKIP_VALIDATION=true` exists as an env flag to skip all per-file checks, commented "for our
own bulk loads only". It is **off** on the media box, confirmed in the run #11 journal.

The move log reads `moved 31 file(s)` for a 29-track batch. That is correct: 29 audio files plus
`manifest.csv` plus the `.done` marker.

The transcode failure banner reads "Pipeline halted, N/A failure rate exceeds 5% threshold" because
it divides 0 by 0 when the job dies before collecting any targets. Cosmetic, but it misdescribes
the failure to whoever reads it next.

---

## 4. Test phases

Run in order. Do not proceed to the next phase until the current one is green end to end.

### Phase 0: Setup
- [ ] Create partner `test_electrobuzz_5000` and provision its SFTP user.
- [ ] Record the partner id and the UUID slug (its on-disk folder name).
- [ ] Confirm `live/`, `test/` and `processing/` exist under the slug, and that `internal/` is hidden
      from the SFTP user.
- [ ] Confirm `live/` and `processing/` are on the **same filesystem** (the move hard-fails otherwise,
      per D1).

### Phase 1: Dry run, 50 tracks into `test/`
- [ ] Script 1 uploads 50 tracks plus the generated `manifest.csv` into **`test/`**.
- [ ] Script 2 validates the upload (count and filename reconciliation) and takes the backup.
- [ ] Script 1 sends `.done`.
- [ ] Expect: VALIDATING then READY, `dry_run: true`, zero rows persisted.
- [ ] Any manifest or file-format problem surfaces here, before a live batch is burned.

### Phase 2: Live run, 50 tracks into `live/`
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

### Phase 3: Fix and re-prove
- [ ] Log every failure in §7 rather than fixing inline.
- [ ] For each fix, run a **localised** test of that specific step first.
- [ ] Then re-run **Phase 2 from scratch** on a clean batch. A partial resume does not count.

### Phase 4: Full run, 5,000 tracks
- [ ] After Phase 2 has passed end to end with no outstanding findings.
- [ ] Same sequence, 5,000 tracks.
- [ ] Watch for scale-only failures: timeouts, memory on the transcode and embedding steps, FAISS
      build time, and any per-file work that is linear where it should be batched.

### Phase 5: Teardown
- [ ] Delete partner `test_electrobuzz_5000` and confirm its folder, DB rows, embeddings and index
      are all removed.

---

## 5. The two scripts

### Script 1: uploader (runs locally, talks SFTP)

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

### Script 2: validator and backup (runs on the media box)

Flag-driven, each check invocable on its own.

- `--validate-ingestion`: light checks only. Count the files in the env folder, parse
  `manifest.csv`, and reconcile the two by filename in both directions. Report extras and missing.
  No audio decoding.
- `--backup`: copy the env folder to a backup location on the same box, so a failed batch does not
  need re-uploading. Must run **before** `.done` (F5).
- `--status`: read the current batch stage via the proper ingestion routes, for periodic polling.
- `--verify-ready`: once READY, exercise the end-to-end checks in Phase 2: API returns the tracks,
  search and similarity find them, admin endpoints are correct.

---

## 6. Fixes and improvements

### Done: code written, in the repos

Every one of these was found by running the pipeline, not by reading it.

**F8, folder ownership.** Provisioning now reads ownership off the partners root with `os.stat`
instead of a hardcoded `1000:1000`, so a new partner folder always matches the tree it lives in.
*Deployed 2026-08-21, and the existing partner backfilled by hand.*

**F9, `processing_dir` never returned.** Added `processing_dir` and `report_path` to
`IngestionStatusResponse` and passed both through in `internal.py`. Returned even on light
`include_records=false` polls, because Alwyzon persists the value from whichever poll first sees
the job completed, and that is normally a light one. *Deployed 2026-08-21.*
Files: `resomix-similarity-open/app/schemas/internal.py`, `.../app/api/internal.py`.

**F10, no way to restart a failed transcode.** Three changes:
`/processing/jobs/{job_id}/resume` now accepts transcode as well as embeddings and routes it to
`start_transcode_job`; `start_transcode_job` clears `completed_at` and `error_details` on entry so
a retried job stops showing the previous failure; and the admin button on paused or failed
transcode rows now calls resume rather than the ingestion retry, labelled "Retry Transcode". The
ingest-log table keeps its own retry, which is where re-ingesting genuinely belongs.
*Backend deployed 2026-08-21, frontend pending.*
Files: `app/api/routers/admin/processing.py`, `app/services/partner_processing_service.py`,
`resomix-web/apps/admin/src/components/pipeline/StagePanel.tsx`. `pnpm --filter admin build` passes.

**F11, the virus scan accepted everything unscanned.** Two host causes, both real at once: `clamav`
was not in the `sftpgo` group, and AppArmor denies `clamd` any read under `/srv/sftp/`. Fixed on the
host with a group add plus a profile rule. In code, a scan that cannot complete is no longer treated
as clean: it produces a per-row `AV_SCAN_FAILED` naming the file and the reason, through the same
error path every other validation failure already uses, so no new status field or surface was added.
The zip path had the mirror-image bug and now shares the two codes. *Code written, host fix required
before deploying.*
Files: `resomix-similarity-open/app/services/ingestion_runner.py`,
`app/services/ingestion_service.py`, `tests/test_ingestion_runner.py`. 64 tests pass.

**F12, transcode had never worked.** ffmpeg was given a `<uuid>.mp3.tmp` output path and cannot
infer a container from `.tmp`, so it aborted on every file before encoding anything. Fixed with an
explicit `-f mp3`. The reason was unreadable because the error was captured as `stderr[:300]`, which
is pure ffmpeg banner; a new `_ffmpeg_error()` now takes the informative tail instead, for every
ffmpeg failure and not just this one. *Code written, needs deploy.*
File: `resomix-similarity-open/app/services/ingestion_runner.py`. 64 tests pass.

**F13, batches could never reach READY.** The block that advances a batch through EMBEDDING,
INDEXED, FINALIZING and READY was guarded by `log.status != "COMPLETED"`, but v2 sets that status at
INGESTED, so the guard was never true and the block never ran. Batches parked at INGESTED, which is
in `ACTIVE_STAGES`, so the concurrency guard would have blocked the partner's every subsequent
upload. Now guarded on `log.stage not in TERMINAL_STAGES`, which is both correct and idempotent.
*Code written, needs deploy.*
File: `basic_fastapi_server_resomix/app/services/partner_processing_service.py`.

**Tooling fix.** `ingest_validate.py` was reading a `data.items` envelope the admin API does not
use, so `--verify` reported every admin check as `None` and silently skipped the jobs check
entirely by iterating an empty list. It now reads the real
`{"pagination": {...}, "<resource>": [...]}` shape, tolerates four alternatives, fails loudly on an
empty job list, and prints where to get an admin token on a 401 or 403.
File: `resomix-similarity-open/scripts/ingest_validate.py`.

**Two manual steps remain.**

1. Run #11's `processing_dir` cannot self-heal, because `_refresh_log_from_hetzner` returns early
   for terminal logs and so never asks the fixed endpoint:
   `UPDATE ingest_logs SET processing_dir = '20260821T073130Z' WHERE id = 11;`
2. Everything ingested before today was accepted unscanned. Once clamd works, sweep the existing
   files: `sudo clamdscan -r /srv/sftp/partners/ | tail -5`.

### Awaiting approval

**F6, SFTP hostname. ~half a day.** A small TCP proxy VPS, `sftp.resomix.com` pointed at it,
PROXY protocol enabled both ends, and the media box's public 2022 closed. Without it no partner can
reach the server. The test itself is unblocked by using the origin IP directly.

**F7, ISRC. Decision only, no code.** ISRC is a distribution identifier and this partner is
similarity-only, which never uses it. Requiring it means a real catalogue onboards 30% of itself.
Either keep it mandatory and accept that, or allow a partner-supplied unique id in its place when
ISRC is absent.

**Media origin exposure.** Pre-existing and separate: the box answers `:80` and `:443` publicly,
so Cloudflare on `media.resomix.com` is bypassable by IP today. Same shape as the admin CF Access
gap closed earlier with ufw. Restrict 80/443 to Cloudflare ranges, leave 2022 to the proxy.

### From the code review

**F1, report `MOVED` in the admin view. Awaiting approval. ~1 - 2 hours.**

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

**Partner `test_electrobuzz_5000`**: uuid `bad9def3-99ad-478f-a875-b3a56a4e427d`,
slug `b3a56a4e427d`, **partner id 6**, plan Enterprise, similarity-only.

### Phase 1: dry run into `test/`, 2026-08-21. PASSED

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

### Phase 2: live run into `live/`, 2026-08-21. PASSED after six fixes

Run **#11**, partner 6, 29 tracks. The first half is clean and everything it proves is real.

```
RECEIVED   07:31:30 UTC
VALIDATING 07:31:30
PERSISTING 07:31:52     29 rows validated, moved to processing/<dt>/
INGESTED   07:31:53     29/29 tracks in the database, 0 failed
transcode  07:31:54     FAILED, 0/0, 0s
```

Backed up first, per F5: 30 files / 573.4 MB to
`/srv/resomix/ingest_backups/partnerb3a56a4e427d_live_20260821T073112Z`.

**Passed:** the concurrency guard, the manifest contract, the audio probe, the atomic move out of
`live/`, and the DB persist. 23 seconds from `.done` to 29 tracks committed. MOVED and TRANSCODING
stayed greyed as predicted, confirming F1.

**Failed:** transcode, immediately, on F9. Embeddings never spawned, which is downstream of the
same cause and not a second fault. The virus scan also failed, on all 29 files, but ingestion
treated that as a pass and reported nothing (F11).

**Validation was checked, not assumed.** The whole expensive tier finished inside one second for
573 MB, which did not look believable, so the journal was read rather than trusted:

```
validating .../live/manifest.csv (skip_validation=False)
probe+AV on 29 file(s) with 12 worker(s) (av=True)
AV scan did not complete for <file> (treating as clean): unexpected status ERROR    ×29
moved 31 file(s) live/ → .../processing/20260821T073130Z
partner=6 job=11 done status=completed valid=29 errors=0
```

Half reassuring, half not. `INGEST_SKIP_VALIDATION` is off and the manifest, format, ISRC and
ffprobe checks all genuinely ran: the speed was ffprobe being header-only across 12 workers. But
**the clamAV scan failed on all 29 files and ingestion passed them anyway**, which is F11 and the
reason the second was enough. Take the "audio probe passed" claim below as verified, and treat the
virus scan as never having run.

**Timing so far:** 23s for 29 tracks through validate + move + persist, against 72s for 3 tracks
in the dry run. The dry run was almost entirely fixed overhead, so ingestion itself gives no usable
per-track slope. The parts that scale with audio length are transcode and embeddings.

**Measured on the successful run:**

| Stage | 29 tracks | Naive 5,000 projection |
|---|---|---|
| Ingestion (validate + move + persist) | 23 s | mostly fixed overhead, does not scale with audio |
| Transcode | **22 s**, 12 workers | **~1 h** |
| Embeddings | **1 m 40 s** | **~4.8 h** |

Transcode timings come from the journal, not the admin duration field, which was wrong for this run:
`10:17:54 → 10:18:16`, `succeeded=29 failed=0`, `workers=12`. The failed F12 attempt at `10:11:33`
started and finished in the same second, which is ffmpeg aborting before encoding anything.

**Embeddings dominate, by roughly 5 to 1.** 100 s for 29 tracks is about 3.4 s each, and nothing in
that path is obviously batched, so 5,000 extrapolates to the best part of a working day. Before
committing to Phase 4, that is the number worth attacking or at least planning around:

- Does the GPU embed-server batch requests, or is it one track per call?
- Would overlap mode help? This run took the single-pass `auto:post-transcode` path because
  embeddings were spawned by the safety net. A normal run overlaps the two, which hides the ~1 h of
  transcode inside the ~4.8 h of embedding but does not shrink the embedding itself.
- Is the FAISS build at the end linear in catalogue size, or does it rebuild from scratch?

Both projections are linear extrapolations from 29 tracks. They are the right order of magnitude for
planning, not commitments.

**How it was resumed** (all five fixes deployed, then one manual step):

1. Media and Alwyzon deployed, admin rebuilt.
2. clamd given read access to the partner tree, verified with `clamdscan` before deploying the
   fail-closed F11 change.
3. Run #11's `processing_dir` backfilled by hand, the only step specific to this run:
   `UPDATE ingest_logs SET processing_dir = '20260821T073130Z' WHERE id = 11;`
4. **Retry Transcode** on job #3.

**Result: the whole chain ran.**

| Stage | Job | Result |
|---|---|---|
| Transcode | #3 | **29/29, 0 failed** |
| Embeddings | #4, `auto:post-transcode` | **29/29, 0 failed, 1m 40s** |

The post-transcode safety-net spawn fired on its own, exactly as designed, so embeddings needed no
intervention. This is the first time in the project's history that a partner batch has gone from
SFTP upload through to embeddings.

**Note the transcode duration shown in admin, "46m 28s", is wrong and now fixed.** It came from the
F10 change preserving `started_at` across a retry, so the figure spans the original 07:31:54 failure
through every fix and deploy in between rather than the run itself. `start_transcode_job` now resets
`started_at` on each attempt, since it always re-collects and re-hands the outstanding work and is
therefore a fresh attempt, not a continuation. Real transcode duration for this batch has to come
from the journal:
`journalctl -u resomix-media --since "2026-08-21 10:00" --no-pager | grep TranscodeRunner`

| # | Phase | What happened | Stage reported | Root cause | Fixed? |
|---|---|---|---|---|---|
| 1 | 1 | SFTP connect hung with no output | n/a, never started | F6 hostname is Cloudflare-proxied | workaround: origin IP |
| 2 | 1 | Upload failed `EACCES` on first byte | n/a, never started | F8 folders chowned to uid 1000, SFTPGo is 999 | yes, in code + backfilled |
| 3 | 2 | Transcode failed instantly, `0/0` in `0s`; embeddings never spawned | INGESTED, halted | F9 status endpoint dropped `processing_dir` | deployed; run #11 needs the SQL backfill |
| 4 | 2 | No way to restart the failed transcode; its retry button re-ran ingestion instead | INGESTED, halted | F10 no transcode start endpoint + mis-wired button | backend deployed, frontend pending |
| 5 | 2 | clamAV returned `ERROR` on all 29 files; batch passed anyway, nothing reported | none, silent | F11 clamd blocked by BOTH group perms and AppArmor + fail-open by design | host fixed + verified, code fixed |
| 6 | 2 | Transcode failed 29/29; every error message was just the ffmpeg version banner | INGESTED, halted | F12 ffmpeg cannot infer a container from a `.tmp` output path; stderr truncated head-first | deployed, transcode then 29/29 |
| 7 | 2 | Transcode reported a duration of "46m 28s" for a run of a few minutes | cosmetic | F10 fix preserved `started_at` across a retry, so the figure spanned the gap between attempts | yes, `started_at` resets per attempt |
| 8 | 2 | `--verify` reported every admin check as `None` | n/a, tooling | `ingest_validate.py` assumed a `data.items` envelope; the admin API returns `{"pagination": {...}, "<resource>": [...]}` | yes, plus fallbacks and a loud fail on an empty job list |
| 9 | 2 | Everything succeeded but the batch stayed at INGESTED | INGESTED, never READY | F13 the stage advance sits behind `status != "COMPLETED"`, which is set at INGESTED and so is never true | deployed; batch re-triggered and now READY |

---

## 8. Notes for whoever runs this

- Every pipeline timestamp is **UTC**. The Alwyzon box is UTC; the media box is **Europe/Berlin**, so
  its journal and nginx logs are two hours ahead. `journalctl --since` parses in the box's local zone
  even when `--utc` is passed, so pass `TZ=UTC` or an explicit zone.
- Batches are serialised per partner. If one wedges, the next `.done` is rejected outright, so clear
  the stuck row before retrying (F4).
- The backup is the only recovery route once a batch has moved out of `live/` (F5).
- `--status` and `--verify` need an admin JWT in `ALWYZON_ADMIN_TOKEN`. Read
  `resomix-admin-access-token` from localStorage while logged in to admin. Without it the admin
  checks all return 403 while the on-disk checks still pass, which looks like a pipeline failure
  and is not one.
