# Partner Ingestion: End-to-End Test Plan (Electrobuzz)

> **Created 2026-08-19.** Goal: prove the reworked partner ingestion pipeline handles a real
> catalogue batch end to end, from SFTP upload through to tracks being queryable via the API and
> visible in admin. Dry run at **50 tracks** first, then the full **5,000**.
>
> Test partner: **`test_electrobuzz_5000`**, created solely for this and deleted afterwards.

---

## 0. Status at a glance

*Last updated 2026-08-21, after the first live run (29 tracks).*

The test found **four faults that no dry run could have found**. Three blocked partner onboarding
outright, the fourth is a security gap. All four are fixed. Detail for every item is in section 3;
this table is the summary.

### Fixed during the test

| # | What was wrong | Impact if left | State |
|---|---|---|---|
| **F8** | Provisioning chowned partner folders to uid 1000, but SFTPGo runs as `sftpgo` (999) | No partner could upload a single byte | Fixed, deployed, backfilled |
| **F9** | The media status endpoint never returned `processing_dir` | Every live batch dead-ends at INGESTED: no transcode, no embeddings, no index | Fixed, deployed |
| **F10** | No endpoint could start a transcode job, and the admin button offered for it re-ran ingestion instead | Any transcode failure is unrecoverable from the UI | Fixed, backend deployed, frontend pending |
| **F11** | clamAV could not read a single partner file, and ingestion treated every failed scan as clean | Uploads were never virus-scanned, and nothing anywhere said so | Fixed in code; **host fix must be applied first** |

F9 and F10 are the heart of it. Both are invisible to a `test/` dry run by construction, which is
why the pipeline looked healthy for months. Only a real live batch could surface them. F11 was
invisible to any run at all, because it announced itself only in the journal.

**One ordering constraint.** The F11 code change is fail-closed: an unscannable file now fails the
batch. Apply the clamd host fix and verify it before deploying, or every batch will be rejected.

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
  half is wired up but does not currently work, and fails open without reporting it, see F11.*
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

Eleven, in the order they were found. **F1 to F5** came from reading the code before the run: none
is a fault, four are behaviours to work with, and F1 is a small reporting improvement awaiting
approval. **F6 to F11** came from actually running it, and four of those are real faults that no
amount of code reading had caught.

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

**One manual step remains, for run #11 only.** Its `processing_dir` cannot self-heal, because
`_refresh_log_from_hetzner` returns early for terminal logs and so never asks the fixed endpoint:
`UPDATE ingest_logs SET processing_dir = '20260821T073130Z' WHERE id = 11;`

### Awaiting approval

**F11, the virus scan does not work and hides it. Decision needed.** The host-side half is
minutes: give `clamav` read access to the partner tree, by group membership or an AppArmor rule,
whichever the diagnostic in F11 points at. The half that needs a decision is what ingestion should
do when a scan cannot complete. Today it passes silently. The proposal is to keep the per-file
fail-open but carry an AV summary into the job state and the ingest log, so "0 of 29 scanned"
is visible in admin and a whole-batch failure needs a human. **2 to 3 hours.** Not implemented
yet on purpose: making ingestion stricter mid-test could block the 5,000-track run.

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

### Phase 2: live run into `live/`, 2026-08-21. STALLED AT INGESTED (F9)

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
in the dry run. The dry run was almost entirely fixed overhead, so there is still no usable
per-track slope for the 5,000-track estimate. Take it from the re-run, and take it from
transcode and embeddings rather than from ingestion, since those are the parts that scale
with audio length.

**To resume**, in this order. The 29 tracks are already persisted, so this picks up where it
stopped rather than re-ingesting. Do **not** use "Retry Ingestion Batch": it starts a new run
against an empty `live/` and leaves this one where it is (F10).

1. Deploy the media service (F9) and Alwyzon (F10 backend), and rebuild admin (F10 frontend).
2. Backfill run #11's `processing_dir`. It cannot self-heal: `_refresh_log_from_hetzner` returns
   early for terminal logs, so the fixed endpoint is never asked about this one.
   ```sql
   -- folder name from: ls /srv/sftp/partners/b3a56a4e427d/processing/
   UPDATE ingest_logs SET processing_dir = '20260821T073130Z' WHERE id = 11;
   ```
3. Hit **Retry Transcode** on job #3 in admin. Embeddings then auto-spawn from the post-transcode
   safety net, so the rest of the chain runs unattended.

Only step 2 is specific to this run. Later batches need none of it.

| # | Phase | What happened | Stage reported | Root cause | Fixed? |
|---|---|---|---|---|---|
| 1 | 1 | SFTP connect hung with no output | n/a, never started | F6 hostname is Cloudflare-proxied | workaround: origin IP |
| 2 | 1 | Upload failed `EACCES` on first byte | n/a, never started | F8 folders chowned to uid 1000, SFTPGo is 999 | yes, in code + backfilled |
| 3 | 2 | Transcode failed instantly, `0/0` in `0s`; embeddings never spawned | INGESTED, halted | F9 status endpoint dropped `processing_dir` | deployed; run #11 needs the SQL backfill |
| 4 | 2 | No way to restart the failed transcode; its retry button re-ran ingestion instead | INGESTED, halted | F10 no transcode start endpoint + mis-wired button | backend deployed, frontend pending |
| 5 | 2 | clamAV returned `ERROR` on all 29 files; batch passed anyway, nothing reported | none, silent | F11 clamd cannot read the partner tree + fail-open by design | not fixed, awaiting decision |

---

## 8. Notes for whoever runs this

- Every pipeline timestamp is **UTC**. The Alwyzon box is UTC; the media box is **Europe/Berlin**, so
  its journal and nginx logs are two hours ahead. `journalctl --since` parses in the box's local zone
  even when `--utc` is passed, so pass `TZ=UTC` or an explicit zone.
- Batches are serialised per partner. If one wedges, the next `.done` is rejected outright, so clear
  the stuck row before retrying (F4).
- The backup is the only recovery route once a batch has moved out of `live/` (F5).
