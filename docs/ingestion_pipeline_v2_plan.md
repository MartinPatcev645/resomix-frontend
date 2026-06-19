# Ingestion Pipeline v2 — Implementation Plan

> **Status:** approved design, build in progress.
> **Owner:** engineering.
> **Repos touched:** `basic_fastapi_server_resomix` (Alwyzon — orchestration + DB),
> `resomix-similarity-open` (Media/Hetzner — owns the files + heavy processing).
> **Created:** 2026-06-19 (UTC). All timestamps in the pipeline are **UTC**.

This document is the single source of truth for the ingestion rework. It exists so
the work survives context loss: every task carries its **intention**, the **files**
it touches, and **acceptance criteria**. Do not delete completed sections — mark them
done so the history stays visible.

---

## 1. Why we are doing this (intention)

Today ingestion reads partner uploads **directly from `live/`**, validates them
(CSV + file-exists + extension only), and copies the **originals as-is** into
`internal/raw/`. There is no quarantine snapshot, no antivirus, no zip handling, no
storage-friendly transcode, no per-stage audit trail, and nothing stops a partner
from kicking off two batches at once. v2 fixes all of that and makes the pipeline a
durable, auditable, per-partner-serialised state machine.

Goals:
1. A partner-visible **`processing/`** snapshot of each batch (read-only) for trust/audit.
2. **Atomic** hand-off from `live/` so a batch is never half-moved.
3. **128 kbps mp3** canonical raw store to save storage; originals kept (for now) in `processing/`.
4. **Strict validation** before anything is accepted: real-audio probe, manifest↔file
   reconciliation (both directions), zip strict-allowlist, **clamAV**.
5. **One active batch per partner** (hard reject the rest).
6. **Durable** execution (survives process restarts) via Celery, without changing the
   Alwyzon↔Media HTTP contract.
7. A **UTC stage timeline** persisted in the DB and mirrored to a partner-visible
   `logs.json`.

---

## 2. Locked decisions (do not re-litigate)

| # | Decision |
|---|---|
| D1 | **Atomic move** (`os.replace`, same-FS) `live/* → processing/<UTC-dt>/`. `processing/` and `live/` are **guaranteed same filesystem** in prod. Hard-fail loudly if not. |
| D2 | **Media becomes a Celery worker** with its **own local Redis broker** (do NOT reach across hosts to Alwyzon's Redis). Existing Alwyzon→Media **HTTP endpoints stay identical**; internally swap `asyncio.create_task(...)` → `task.delay(...)`. Migrate one stage at a time. |
| D3 | **Concurrency = hard reject.** A new `.done` while the partner has an active batch → Media deletes **only that `.done`** marker (nothing else in `live/`), notify "wait for current to finish". No queue. |
| D4 | **128 kbps raw transcode.** Keep file as-is **only if** codec==mp3 AND bitrate ≤ ~133 kbps (VBR-aware); else transcode. Preserve ID3 tags (`-map_metadata 0`), drop A/V art from the mp3 (`-vn`). ffprobe-validate output (audio stream, duration>0). Never auto-trim silence. |
| D5 | **Cover art preserved** → extract embedded art to `internal/covers/<uuid>.jpg`. Gates: (a) must be a **real image** (decode/magic-byte check), (b) **≤ 1 MB**. Fail either gate → discard art, continue (non-fatal). |
| D6 | **Zip strict-allowlist.** Flat only (no folders / no path separators / no dir entries), allowed entries only (`.csv` manifest + audio `.wav/.flac/.mp3/.aiff`), no symlinks, no nested zip. Any disallowed entry / folder → **reject whole batch**. Plus Zip-Slip + zip-bomb guards (size/ratio/entry-count caps). |
| D7 | **DB is the source of truth** for the lifecycle. `ingest_logs` gains `processing_dir`, `stage`, `stage_timeline`. `logs.json` in `processing/<dt>/` is a sanitized mirror. |
| D8 | **clamAV on the Media box** (files are local there). Runs in the validation phase. |
| D9 | **`.aiff` is supported everywhere** — add it to the validator's allowed audio set (SFTP filter already allows it). |
| D10 | **Originals are NOT pruned yet.** `processing/<dt>/` keeps the originals for now (safety net during early partner testing). Delete-after-raw is a **future** task. |
| D11 | **No cancel-batch for now.** Admin already has **pause/resume**. A batch that is `INGESTED` but never embedded will block the partner until an admin runs embeddings — accepted, revisit later. |

---

## 3. Target state machine

One **batch** = one `.done`. A batch is "active" from `.done` until `READY` or `FAILED*`.

```
.done uploaded
   │  Alwyzon event hook ── guard: partner already has an active batch?
   │        └─ YES → Media deletes ONLY the new .done, notify "wait"  → STOP
   ▼ (no active batch)
RECEIVED ─▶ VALIDATING     (in live/: csv, real-audio probe, manifest↔file both ways,
   │                        zip strict-allowlist+extract, clamAV)
   │            └─ fail → FAILED_VALIDATION (reason + IngestionError + logs.json) ─▶ notify
   ▼ ok
MOVED        (atomic rename live/* → processing/<UTC-dt>/, live now empty)
   ▼
TRANSCODING  (each track → internal/raw/<uuid>.mp3 @128k; art → internal/covers/<uuid>.jpg)
   ▼
INGESTED     ← "ingestion successful": Track/AudioFile rows persisted, raw ready
   ▼  (admin triggers embeddings later; batch stays active)
EMBEDDING ─▶ INDEXED ─▶ FINALIZING ─▶ READY  ─▶ notify partner
```

`FAILED_*` and `READY` are terminal (clear the active flag).

---

## 4. Data model (Alwyzon `ingest_logs`)

Add (Alembic migration, idempotent guards):
- `processing_dir VARCHAR` — the `<UTC-dt>` folder name; the link the embedding job needs.
- `stage VARCHAR` — current stage from §3.
- `stage_timeline JSON` — `{ "<stage>": "<utc_iso>" }`; serialised verbatim to `logs.json`.

Guard query for D3 (active batch): `ingest_logs WHERE partner_id = ? AND stage NOT IN
('READY','FAILED_VALIDATION','FAILED', ...terminal...)`. Plus a short **Redis lock**
keyed by partner to close the two-`.done`-in-a-row race.

`IngestionError` (existing) keeps the per-row/per-reason detail. `logs.json` is
**sanitized** (no hostnames, absolute paths, or stack traces).

---

## 5. Folder layout (Media box, per partner)

```
{partner_sftp_root}/<slug>/
├── live/          (SFTP: list+upload+download+delete)   ← partner uploads here
├── test/          (SFTP: list+upload+download+delete)   ← dry-run uploads
├── processing/    (SFTP: list+download ONLY — read-only)   ← NEW
│   └── <UTC-dt>/  one immutable snapshot per batch
│       ├── manifest.csv
│       ├── <original audio files>
│       └── logs.json    (sanitized UTC stage timeline)
└── internal/      (hidden from partner)
    ├── raw/<uuid>.mp3        128k canonical (NEW: was original-format copy)
    ├── covers/<uuid>.jpg     NEW: validated embedded art (≤1MB, real image)
    ├── embeddings/ indexes/ catalog/ previews/ segments/ peaks/
    └── ingestion/ processing/  (job-state JSONs)
```

---

## 6. Task breakdown (staged; each stage is independently shippable)

### Stage 1 — Infra on Media (no behavior change) ✅ DONE 2026-06-19
**Intention:** stand up durable execution + AV capability before wiring any stage to them.
- [x] Add **Celery + local Redis** to Media: `app/tasks/celery_app.py` (+ `app/tasks/__init__.py`), broker/result config in `app/core/config.py`, deps in `requirements.txt` + `env_template.txt`. `app.tasks.ping` task added.
- [x] Add a **`MediaAntivirusService`** (`app/services/antivirus_service.py`) — clamd path-scan + instream + clamscan fallback, gated by `ANTIVIRUS_ENABLED`. Not yet wired into the flow.
- [x] `partner_internal_docs/07_production_migration_checklist.md` §4b: install clamd, Redis, and a Celery worker (systemd unit) on the Media box.
**Acceptance:** ✅ `celery_app`+`ping` import & register; AV service imports (disabled→skipped); `app.main` imports unchanged; **Media suite 70 passed**.

### Stage 2 — DB stage timeline (Alwyzon) ✅ DONE 2026-06-19
**Intention:** make the DB the lifecycle source of truth and produce `logs.json`.
- [x] Alembic migration `d4e5f6a7b8c9`: `stage` (indexed), `processing_dir`, `stage_timeline` on `ingest_logs` (idempotent column+index guards). Model columns added to `IngestLog`.
- [x] `app/services/ingestion_stages.py`: `Stage` constants, `ACTIVE_STAGES`/`TERMINAL_STAGES`, `advance_stage()` (reassigns a new dict so the JSON column is flagged dirty; UTC), `sanitized_logs_json()` (partner-safe builder).
- [x] Wired into `ingestion_service`: `RECEIVED` on create → `VALIDATING` on hand-off → `INGESTED` (live) / `READY` (test dry-run) / `FAILED_VALIDATION` / `FAILED`. `status` semantics unchanged.
- [x] Unit tests `tests/unit/services/test_ingestion_stages.py` (4).
- [~] The **file write** of `logs.json` into `processing/<dt>/` is deferred to Stage 5 (Media owns that folder). Stage 2 delivers the DB timeline + the sanitized builder.
**Acceptance:** ✅ migration applies; `stage`/`stage_timeline` populate on a real run; helpers unit-tested; **Alwyzon suite 295 passed**. Existing `status`-based logic/tests untouched.

### Stage 3 — Concurrency guard (Alwyzon + small Media endpoint) ✅ DONE 2026-06-19
**Intention:** one active batch per partner (D3).
- [x] Media `POST /internal/ingestion/reject-done` (`RejectDoneRequest/Response`) deletes ONLY the `.done` in the env folder; rest of `live/` untouched.
- [x] Alwyzon `HetznerService.reject_done()` calls it.
- [x] `ingestion_service`: `has_active_batch` (stage ∈ ACTIVE_STAGES, or legacy stage-NULL + status PROCESSING), per-partner Redis lock (`acquire/release_partner_ingest_lock`, degrades to no-op sentinel without Redis), `reject_duplicate_done` (delete marker + `ingestion.rejected` webhook, no row). Split `start_ingestion_job` → `create_ingest_log` + `dispatch_to_media` (wrapper preserved for direct callers).
- [x] Event hook: acquire lock → `has_active_batch`; if active OR lock held → reject; else create the row **under the lock** (closes the two-`.done` race), then hand off in the background.
- [x] Tests both repos: Media `tests/test_ingestion_guard.py` (3 — reject deletes only marker / idempotent / auth); Alwyzon `tests/unit/services/test_ingestion_guard.py` (3 — lock no-op, key scoping, reject path) + `test_sftp_event_rejects_done_when_batch_active` integration.
**Acceptance:** ✅ second `.done` during an active batch → marker deleted, partner notified, no duplicate row, no ingestion started. **Alwyzon 299, Media 78 — all green.**

### Stage 4 — Validation upgrade (Media)
**Intention:** reject bad batches before they touch `processing/`.
- [ ] Add `.aiff` to validator allowed audio set (D9).
- [ ] **Real-audio probe** via ffprobe (audio stream present, duration>0).
- [ ] **Manifest↔file reconciliation both ways**: every manifest row has a file AND every file is in the manifest (flag extras).
- [ ] **Zip** strict-allowlist + extract (D6): flat-only, allowed-types-only, no symlinks/nested, Zip-Slip + zip-bomb caps.
- [ ] **clamAV** scan of every file (and extracted zip contents) via `MediaAntivirusService`.
- [ ] All failures recorded as `IngestionError` with stable codes (`DISALLOWED_ZIP_ENTRY`, `ZIP_CONTAINS_FOLDER`, `AV_INFECTED`, `NOT_AUDIO`, `EXTRA_FILE_NOT_IN_MANIFEST`, ...).
**Acceptance:** crafted bad batches (extra file, folder in zip, .txt in zip, fake audio, EICAR) all reject with the right code; clean batch passes.

### Stage 5 — Atomic move + `processing/` exposure (Media + Alwyzon)
**Intention:** quarantine snapshot via atomic rename; partner can see but not touch.
- [ ] `partner_paths.processing_dir()` / `processing_batch_dir(dt)`.
- [ ] On validation success: assert same-FS, `os.replace` each entry `live/* → processing/<dt>/`, then `live/` is empty. Write initial `logs.json`.
- [ ] Auth hook: `permissions["/processing"] = ["list","download"]` (read-only). Confirm root deny-list still hides `internal`/dotfolders but not `processing`.
**Acceptance:** after a batch, `live/` empty, `processing/<dt>/` holds originals+manifest+logs.json; partner SFTP can list/download `processing/` but cannot upload/delete/mkdir.

### Stage 6 — 128k transcode + covers (Media)
**Intention:** storage-friendly canonical raw; preserve validated art.
- [ ] Replace `_promote_to_raw_store` copy with transcode → `internal/raw/<uuid>.mp3`
      using `preview_service.process_audio_to_mp3_bytes(128k)`; keep-as-is rule per D4.
- [ ] Extract embedded art → `internal/covers/<uuid>.jpg` with D5 gates.
- [ ] Read input from `processing/<dt>/` (not `live/`).
- [ ] `_embed_one`: **drop the `live/`/`test/` fallback** — raw is canonical now.
**Acceptance:** raw files are 128k mp3 (or kept if already ≤133k mp3); oversized/invalid art discarded; embeddings still find audio via raw.

### Stage 7 — Embedding stage joins the timeline + finalize/notify (Media + Alwyzon)
**Intention:** one continuous audit trail across the admin-triggered embedding job.
- [ ] Embedding job looks up the batch's `processing_dir` (from `ingest_logs`) and appends
      `EMBEDDING/INDEXED/FINALIZING/READY` stages to the same `logs.json` + DB timeline.
- [ ] On `READY`: dispatch partner notification (reuse `dispatch_webhook`; email later).
- [ ] Convert long-running steps to Celery tasks (D2); **preserve pause/resume** via the
      existing control-flag-in-JSON mechanism (task polls it, exits/re-enqueues).
**Acceptance:** full `.done → READY` run shows a complete UTC timeline in DB and `logs.json`;
pause/resume behaves exactly as before from the frontend's perspective.

---

## 7. Risks / edge cases
- **Stuck `"running"` jobs** on restart → Celery durability + a reaper that fails batches past a TTL.
- **Atomic rename only valid same-FS** → assert; hard-fail with a clear error otherwise.
- **`logs.json` is partner-visible** → sanitized; rich detail stays in DB/`IngestionError`.
- **Cross-host Redis avoided** by giving Media its own broker (D2) — no new exposed port.
- **Zip bombs / Zip-Slip / symlinks** → explicit caps + path checks (D6).
- **Partner blocked** if admin never embeds (D11) → accepted for now; revisit with cancel-batch.

## 8. Deferred (not in this build)
- Delete originals from `processing/` after raw is built (D10).
- Admin **cancel-batch** action (D11) — needs frontend + tests.
- Partner **email** notifications (webhook is wired; email later).

## 9. Test plan (per stage, all run via `.venv/bin/python -m pytest`)

> **Policy:** every stage closes with new unit tests in **each repo it touched** —
> Alwyzon *and* Media. A stage isn't "done" until both suites are green.
> (Stage 1 = Media `tests/test_pipeline_infra.py`; Stage 2 = Alwyzon
> `tests/unit/services/test_ingestion_stages.py`.)

- Media: validation matrix (good / extra-file / missing-file / folder-in-zip / disallowed-zip-entry /
  fake-audio / EICAR), atomic-move leaves `live/` empty, transcode bitrate + keep-as-is, cover gates.
- Alwyzon: concurrency guard rejects 2nd `.done`, stage timeline fills, auth hook `processing/` read-only,
  migration idempotency.
- Keep both suites green at every stage (currently Alwyzon 275+, Media 70).

---

## 10. Progress log
- 2026-06-19: plan approved; starting Stage 1.
- 2026-06-19: **Stage 1 done** — Celery app + local-Redis config + `ping` task, `MediaAntivirusService` (clamd, gated by `ANTIVIRUS_ENABLED`), deps/env added, checklist §4b. Media 70 tests green; app import unchanged.
- 2026-06-19: runbook updated — clamd note (both apps), media `.env` Celery/AV vars (single-box Redis db `/2`,`/3`), Media Celery worker systemd unit + `ping` check.
- 2026-06-19: **Stage 2 done** — migration `d4e5f6a7b8c9` (+`IngestLog` cols), `ingestion_stages.py` helper, wired into `ingestion_service` stage stamping, 4 unit tests. Alwyzon 295 tests green.
- 2026-06-19: **testing policy** adopted — every stage adds tests in *each repo it touches*. Backfilled Stage 1 Media tests (`test_pipeline_infra.py`, 5).
- 2026-06-19: **Stage 3 done** — Media `reject-done` endpoint, `HetznerService.reject_done`, `ingestion_service` guard (`has_active_batch` + Redis per-partner lock + `reject_duplicate_done`; `start_ingestion_job` split into `create_ingest_log`+`dispatch_to_media`), event-hook wiring (create row under lock to close the race). Tests both repos. **Alwyzon 299, Media 78 green.** Next: Stage 4 (validation upgrade — .aiff, real-audio, mismatch both ways, zip strict-allowlist + slip/bomb, clamAV).
