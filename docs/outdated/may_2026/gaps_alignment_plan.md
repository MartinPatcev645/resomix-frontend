# Fix & Wire: Full B2B Pipeline Alignment (W1–W5)

## Context

Two FastAPI services must work together for the B2B partner flow to function end-to-end:

- **`resomix-similarity-open`** (Hetzner SX65, port 8004) — media server: FAISS, audio streaming, HLS, peaks, cover art, SFTPGo provisioning, ECDSA audit logs
- **`basic_fastapi_server_resomix`** (Alwyzon, port 80/443) — B2B API: MariaDB, JWT, rate-limiting, Celery webhooks, CSV ingestion, Stripe

Current state: several inter-service call URLs are wrong or missing entirely. Two critical gaps mean vectors are **never indexed** and the **rebuild endpoint is permanently broken**. This plan fixes all wiring gaps before first partner onboarding, organized by where the change must happen.

```
Partner → B2B FastAPI (Alwyzon)
              ↓ calls /internal/* with Bearer {hetzner_internal_api_key}
          Media Server (Hetzner SX65, port 8004)
              ↓ calls
          SFTPGo (port 8090 admin, 2022 SFTP)
          External Embedding Server (settings.embed_server)
```

---

## A. Code Changes — `resomix-similarity-open` (Hetzner)

### A1. `/health` returns `"ok"` not `"healthy"` 🔴
- **File**: `app/main.py:146`
- **Fix**: Change `"status": "ok"` → `"status": "healthy"` in the `HealthResponse`.
- Uptime Robot keyword monitor checks for `"healthy"` — current response causes false-down alerts.
- Also add shallow dependency checks: embedding server ping, SFTPGo admin ping, disk free on `partner_data_root`.

### A2. No export endpoint for ECDSA audit logs 🔴
- **Files**: `app/api/internal.py`, `app/schemas/internal.py`, `app/services/audit_service.py`
- **Fix**: Add `GET /internal/audit-log/{partner_id}?from_date=&to_date=` protected by `verify_internal_api_key`.
- `audit_service.py` already writes daily `audit_log_YYYY-MM-DD.log` files — add a `read_events(partner_id, from_date, to_date)` method that reads and filters those files.
- The B2B `GET /api/v1/partner/deletion-log` will call this endpoint.

### A3. Remove dead code — MongoDB URI and HMAC/Fernet 🟢
- **Files**: `app/core/config.py` (remove `mongodb_uri`, `preview_hmac_secret`, `preview_fernet_secret`), `env_template.txt`
- `app/utils/security.py` — `verify_secure_url()` is defined but never called; remove or clearly mark TODO
- `app/api/audio.py` — `xpi`/`token` params already marked `disabled`; remove the dead params

### A4. Expand partner isolation tests 🟡
- **File**: `tests/test_partner_isolation.py`
- Currently only 4 tests. Add: cross-partner query isolation (partner A cannot see partner B's vectors), catalog contamination prevention, concurrent provisioning safety, partner directory permission checks.

---

## B. Code Changes — `basic_fastapi_server_resomix` (Alwyzon)

### B1. BROKEN: Rebuild URL mismatch 🔴
- **File**: `app/services/similarity_service.py:749`
- B2B calls: `{similarity_server_url}/admin/similarity/rebuild-index/`
- Media server has: `POST /internal/ingest/rebuild-index`
- **Fix**: Change the URL in `rebuild_faiss_indexes()` to `{similarity_server_url}/internal/ingest/rebuild-index`

### B2. BROKEN: Ingestion never indexes vectors in FAISS 🔴
- **File**: `app/services/ingestion_service.py` (inside the per-track success block, around line 313–362)
- After each track is successfully inserted into MariaDB, the code fires a `track.indexed` webhook but **never** calls the media server's `POST /internal/ingest/add-vector` with the track's embedding.
- Without this call, the FAISS index is never populated — similarity search returns nothing for partner-ingested tracks.
- **Fix**: After the DB insert succeeds (in the success block), call:
  ```
  POST {similarity_server_url}/internal/ingest/add-vector
  Authorization: Bearer {hetzner_internal_api_key}
  Body: { partner_id, track_uuid, engine, vector_path }
  ```
  Use the existing `httpx` pattern from `hetzner_service.py` or `similarity_service.py`. Wrap in try/except — a failed vector index should mark the track with a warning status, not roll back the DB transaction.

### B3. Add `GET /api/v1/partner/deletion-log` endpoint 🔴
- **Files**: `app/api/routers/partner/`, `app/services/similarity_service.py` or new `audit_service_client.py`
- Calls media server `GET /internal/audit-log/{partner_id}` (from A2 above).
- Returns signed deletion events to the authenticated partner.
- Required by W5-2.

### B4. Extend Hetzner backup to cover FAISS/catalog data 🟡
- **File**: `scripts/backup_restore.sh`
- Current script backs up MariaDB only.
- Add `rsync` of `/srv/resomix/partners/` (FAISS index files, catalog JSONs, .npy vectors) to the Hetzner Storage Box.
- Loss of this data = full re-indexing for all partners.

### B5. `partner_id` must always be passed to similarity endpoints 🟡
- **File**: `app/services/similarity_service.py`
- Both `calculate_similarity_for_upload()` and `get_similarity_by_path()` already pass `partner_id` — **confirmed OK**.
- Risk: if `partner_id` is `None`, media server falls back to global open catalog (multi-tenancy bypass). Add an assertion/guard before the HTTP call to fail loudly rather than silently degrade.

### B6. Duplicate test function — rate limiting tests 🟢
- **File**: `tests/test_rate_limiting.py`
- One function name is defined twice. Second definition silently overwrites first — one test is never run.
- **Fix**: Rename the duplicate.

---

## C. Server-Side Config Only (no code changes)

### C1. Wire SFTPGo auth hook → B2B `/internal/sftp/auth` 🔴
- SFTPGo must call the B2B FastAPI to authenticate partner SFTP logins.
- **Action**: In SFTPGo admin panel (`http://127.0.0.1:8090`) or `sftpgo.json` config, set:
  ```
  "external_auth_hook": "http://<alwyzon-host>/internal/sftp/auth"
  ```
  (or the equivalent `hooks.external_auth_hook` field in the YAML config)
- No code change needed — the B2B endpoint `POST /internal/sftp/auth` already exists and is wired.

### C2. Set `HETZNER_SFTP_PROVISION_URL` in B2B `.env` 🔴
- B2B `sftp_service.py` POSTs to `settings.hetzner_sftp_provision_url`.
- This must point to: `http://127.0.0.1:8004/internal/provision-sftp-user` (loopback if co-located, or Hetzner internal IP).
- Verify `.env` on Alwyzon has this set correctly.

### C3. Set `SIMILARITY_SERVER_URL` in B2B `.env` 🔴
- Must be the Hetzner internal IP/port: `http://<hetzner-ip>:8004`
- Verify `.env` on Alwyzon has this set.

### C4. Set `HETZNER_INTERNAL_API_KEY` on both servers 🔴
- Media server uses this key for `verify_internal_api_key` (Bearer token).
- B2B sends it as `Authorization: Bearer {hetzner_internal_api_key}`.
- Must match exactly on both servers. Verify in both `.env` files.

### C5. Extend Hetzner backup cron 🟡
- Current backup covers MariaDB on Alwyzon. No backup covers the FAISS/catalog data on Hetzner.
- **Action**: Add cron on Hetzner SX65:
  ```bash
  rsync -avz /srv/resomix/partners/ u<storagebox>@<storagebox>.your-storagebox.de:./resomix_partners_backup/
  ```
  Run nightly, retain 7 days.

### C6. Add systemd unit for Celery worker on Alwyzon 🟡
- Celery webhook delivery requires the worker process running on the B2B server.
- Create `/etc/systemd/system/resomix-celery.service` pointing at the venv's `celery` binary.

---

## Full Route Wiring Checklist

| Call | From | To | Auth | Status |
|---|---|---|---|---|
| `POST /internal/partner/provision` | B2B | Media server | Bearer key | ✅ Wired |
| `POST /internal/provision-sftp-user` | B2B | Media server | Bearer key | ✅ Wired (verify URL in env) |
| `DELETE /internal/provision-sftp-user/{u}` | B2B | Media server | Bearer key | ✅ Wired |
| `POST /internal/ingest/add-vector` | B2B (ingestion) | Media server | Bearer key | 🔴 **MISSING** — B1/B2 fix |
| `POST /internal/ingest/rebuild-index` | B2B | Media server | Bearer key | 🔴 **WRONG URL** — B1 fix |
| `DELETE /delete-track/{uuid}` | B2B (cleanup) | Media server | Bearer key | ✅ Wired |
| `POST /similarity/query-by-uuid/` | B2B | Media server | Origin header | ✅ Wired |
| `POST /similarity/query-by-upload/` | B2B | Media server | Origin header | ✅ Wired |
| `GET /internal/audit-log/{partner_id}` | B2B | Media server | Bearer key | 🔴 **MISSING** — A2/B3 fix |
| `POST /internal/sftp/auth` | SFTPGo | B2B | internal secret | 🔴 **Hook not configured** — C1 fix |
| `POST /internal/sftp/event` | SFTPGo | B2B | internal secret | ✅ Wired (verify SFTPGo event hook) |

---

## Execution Order

1. **B1** (fix rebuild URL) — 10 min, unblocks admin operations
2. **B2** (add vector indexing in ingestion) — 2h, unblocks the entire similarity pipeline
3. **C1–C4** (env/config wiring) — 30 min on servers, must be done before any partner test
4. **A1** (health endpoint `"healthy"`) — 30 min, fixes Uptime Robot monitoring
5. **A2 + B3** (audit log export) — 2h combined, required for W5-2
6. **B4 + C5** (backup coverage) — 1h, required before partner data grows
7. **A3, B5, B6** (cleanup + guards) — low priority, 1h total

---

## Verification

1. Start media server locally → `curl http://localhost:8004/health` → confirm `"status": "healthy"`
2. Provision a test partner via B2B → confirm dirs created on media server
3. Ingest a CSV → confirm `POST /internal/ingest/add-vector` is called (check media server logs)
4. Run similarity query for the partner → confirm results include ingested tracks
5. Trigger rebuild from admin panel → confirm `POST /internal/ingest/rebuild-index` is called (no 404)
6. Delete a track → confirm audit log entry written → `GET /internal/audit-log/{partner_id}` returns it
7. SFTP upload a `.done` file as a partner → confirm SFTPGo calls B2B auth hook → ingestion starts