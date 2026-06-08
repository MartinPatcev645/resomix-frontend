# Partner Onboarding Guide

> **Audience:** Resomix operators (developers + admins)
> **Last updated:** June 8, 2026
> **System:** Alwyzon B2B server (port 8001) + Hetzner media server (port 8004)

---

## Overview

Onboarding a new B2B partner involves work on two servers:

| Server | What you do here |
|---|---|
| **Alwyzon** (port 8001) | Create partner DB record, issue API key, provision SFTP account, trigger ingestion + embedding jobs |
| **Hetzner** (port 8004) | Partner folder structure auto-created on first embedding job; FAISS indexes built here |

A typical onboarding takes **5–10 minutes** for setup, plus async time for embedding generation (seconds–minutes per track depending on catalog size).

---

## Prerequisites

- Alwyzon and Hetzner servers both running and healthy
- You have an **admin JWT** (log in via `POST /api/v1/admin/auth/login` with your admin account)
- `HETZNER_INTERNAL_API_KEY` is set in Alwyzon's `.env`
- Hetzner's `PARTNER_DATA_ROOT` is writable

---

## Step 1 — Create the Partner Record (Alwyzon DB)

**Via Admin UI:**  
Navigate to **Admin → Partners → New Partner** and fill in the form.

**Via API:**
```http
POST /api/v1/admin/partners/
Authorization: Bearer <admin_jwt>

{
  "display_name": "Beatport",
  "legal_name": "Beatport LLC",
  "contact_email": "ops@beatport.com",
  "tier": "growth",
  "country_code": "US"
}
```

**Response** gives you the `partner_id` (e.g. `42`). **Note this ID** — every subsequent step needs it.

Available tiers: `sandbox` | `starter` | `growth` | `enterprise`

---

## Step 2 — Issue an API Key

**Via Admin UI:**  
Admin → Partners → [select partner] → API Keys → Issue Key

**Via API:**
```http
POST /api/v1/admin/partners/api-keys/issue
Authorization: Bearer <admin_jwt>

{
  "partner_id": 42,
  "label": "Production Key",
  "tier": "growth",
  "scopes": ["similarity:read", "metadata:read", "playback:read"]
}
```

**Response** includes `plaintext_key` — **show it to the partner once and store it securely**; it cannot be retrieved again.

```json
{
  "data": {
    "plaintext_key": "rmx_growth_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "key_prefix": "rmx_growth_xxxx",
    "label": "Production Key",
    "scopes": ["similarity:read", "metadata:read", "playback:read"],
    "expires_at": null
  }
}
```

The partner uses this key as `Authorization: Bearer rmx_growth_xxx...` or `X-API-KEY: rmx_growth_xxx...` on all API calls.

---

## Step 3 — Provision SFTP Access (if partner will upload via SFTP)

SFTP lets the partner drop audio files + a CSV manifest for batch ingestion.

> **This step is done manually** via the SFTPGo admin panel. The API endpoint
> (`POST /api/v1/admin/partners/sftp/provision`) automates everything below,
> but requires SFTPGo + Hetzner to both be healthy. For initial setup or
> troubleshooting, follow the manual steps.

---

### 3a — Create partner home directories on the host

SFTPGo runs in Docker with this volume mount:  
`./dev_partner_data/sftp` (host) → `/srv/sftp` (container)

Create the partner's upload folders **on the host** inside that volume:

```bash
# From the resomix-similarity-open project directory
PARTNER_ID=42

mkdir -p dev_partner_data/sftp/partners/${PARTNER_ID}/test
mkdir -p dev_partner_data/sftp/partners/${PARTNER_ID}/live
```

Structure created:
```
dev_partner_data/sftp/partners/42/
├── test/    ← dry-run uploads (validate + report, no DB changes)
└── live/    ← production uploads (persisted to DB)
```

Inside the container / SFTPGo these appear at `/srv/sftp/partners/42/`.

---

### 3b — Create the SFTPGo virtual user

**Option A — Web Admin Panel** (`http://localhost:8080`)

1. Open `http://localhost:8080` and log in:  
   - Username: `admin`  
   - Password: `12345678`
2. Navigate to **Users → Add User**
3. Fill in the form:

   | Field | Value |
   |---|---|
   | **Username** | e.g. `beatport_sftp` |
   | **Password** | a strong random password |
   | **Home directory** | `/srv/sftp/partners/42` ← container path |
   | **Status** | Enabled |

4. Under **Permissions** → add entry for path `/` with **All permissions** (`*`)
5. Under **Filesystem** → leave as **Local** (provider 0)
6. Under **Quota** → set **Max total size** in bytes (e.g. 10 GB = `10737418240`)
7. Click **Save**

---

**Option B — REST API** (from terminal)

```bash
PARTNER_ID=42
USERNAME=beatport_sftp
PASSWORD=SecureRandomPass123!
QUOTA_BYTES=10737418240  # 10 GB (see tier mapping below)

# 1. Get auth token
TOKEN=$(curl -s -u "admin:12345678" \
  http://localhost:8080/api/v2/token | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Create virtual user
curl -s -X POST http://localhost:8080/api/v2/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\",
    \"home_dir\": \"/srv/sftp/partners/${PARTNER_ID}\",
    \"status\": 1,
    \"permissions\": {\"/\": [\"*\"]},
    \"quota_size\": ${QUOTA_BYTES},
    \"filesystem\": {\"provider\": 0}
  }"
```

**Quota tier mapping:**

| Tier | Bytes | Human |
|---|---|---|
| sandbox | `1073741824` | 1 GB |
| starter | `10737418240` | 10 GB |
| growth | `53687091200` | 50 GB |
| enterprise | `0` | Unlimited |

---

### 3c — (Optional) Record the SFTP account in Alwyzon DB

If you want the account tracked in the admin panel, call the provision endpoint
**after** completing steps 3a and 3b above:

```http
POST /api/v1/admin/partners/sftp/provision
Authorization: Bearer <admin_jwt>

{
  "partner_id": 42,
  "username": "beatport_sftp",
  "password": "SecureRandomPass123!",
  "use_public_key": false
}
```

> ⚠️ This endpoint will call Hetzner, which in turn calls SFTPGo to register the
> user. If SFTPGo already has the user from step 3b, the call updates it
> idempotently (HTTP 409 → PUT). Only use this endpoint once SFTPGo is
> confirmed healthy.

---

### 3d — Test the SFTP connection

```bash
sftp -P 2022 beatport_sftp@localhost
# Enter the password you set in step 3b
# You land in the chroot root (which is /srv/sftp/partners/42 inside the container)

ls          # should show: live/  test/
cd live
put /tmp/test_file.txt
ls          # should show test_file.txt
```

**Connection details to give the partner:**
```
Host:     sftp.resomix.com
Port:     2022
Username: beatport_sftp
Password: <as set in step 3b>
```

---

## Step 4 — Ingest Tracks

There are two paths depending on how the partner delivers their catalog.

### Path A — SFTP Batch Upload (standard B2B flow)

1. Partner uploads a **ZIP** (or loose files) to their SFTP `live/` folder containing:
   - A CSV manifest (`manifest.csv`) with track metadata
   - Audio files referenced in the CSV

2. **Trigger ingestion** (Admin UI: Processing → Ingestion → Trigger, or API):
   ```http
   POST /api/v1/admin/ingestion/trigger
   Authorization: Bearer <admin_jwt>
   
   {
     "partner_id": 42,
     "env": "live"
   }
   ```
   Returns `job_id`. Poll `GET /api/v1/admin/ingestion/logs?partner_id=42` to watch progress.

3. **Check for errors:**
   ```http
   GET /api/v1/admin/ingestion/logs/{log_id}
   Authorization: Bearer <admin_jwt>
   ```
   The response includes a per-row `errors` array for any validation failures.

**CSV manifest format** (`manifest.csv`):
```csv
uuid,title,display_artist,isrc,duration_ms,bpm,musical_key,filename
<uuid-v4>,Track Title,Artist Name,US-ABC-25-00001,240000,128,Am,track_01.wav
```

Required columns: `uuid`, `title`, `display_artist`, `filename`  
Optional: `isrc`, `duration_ms`, `bpm`, `musical_key`

### Path B — Script-based seeding (dev / migration)

Use for initial catalog loads from an existing JSON/CSV export.  
Reference: `scripts/seed_sandbox_catalog.py` (partner 1's historical seeding script).

For a new partner, adapt that script — change `partner_id`, point it at the correct JSON source, and run:
```bash
python scripts/seed_sandbox_catalog.py  # (adapt for new partner)
```

---

## Step 5 — Generate Embeddings

This step sends tracks to the Hetzner audio-ML pipeline to produce MAEST and Discogs embeddings. It also creates the partner's directory tree on Hetzner on first run.

**Via Admin UI:**  
Admin → Processing → Jobs → Trigger Embeddings Job

**Via API:**
```http
POST /api/v1/admin/processing/jobs/embeddings
Authorization: Bearer <admin_jwt>

{
  "partner_id": 42,
  "env": "live",
  "index_after": true,
  "only_pending": true
}
```

- `env: "live"` — persist embeddings to disk
- `index_after: true` — insert each vector into the FAISS index as it's generated
- `only_pending: true` — skip tracks that already have embeddings (safe to re-run)

**Poll for completion:**
```http
GET /api/v1/admin/processing/jobs/{job_id}
Authorization: Bearer <admin_jwt>
```

Status values: `pending` → `running` → `completed` | `failed`

**Expected result:**
- Alwyzon: `track_processing_status.embedding_status = "done"` for each track
- Hetzner: `.npy` files at `data/partners/42/internal/embeddings/{maest,discogs}/`

---

## Step 6 — Build FAISS Indexes

After embeddings are generated, rebuild both FAISS indexes so the partner's tracks become searchable.

**Via Admin UI:**  
Admin → Similarity → Rebuild Index → select partner

**Via API:**
```http
POST /api/v1/admin/similarity/rebuild-index?partner_id=42
Authorization: Bearer <admin_jwt>
```

This calls Hetzner twice (once per engine) and returns:
```json
{
  "success": true,
  "partner_id": 42,
  "engines": {
    "maest":   { "success": true, "data": { "index_size": 500 } },
    "discogs": { "success": true, "data": { "index_size": 500 } }
  }
}
```

`index_size` should equal your track count.

**Files created/updated on Hetzner:**
```
data/partners/42/internal/
├── indexes/
│   ├── faiss_maest_42.index    ← MAEST FAISS index (live, hot-swapped atomically)
│   └── faiss_discogs_42.index  ← Discogs FAISS index
└── catalog/
    ├── maest_catalog_42.json   ← UUID → FAISS slot mapping
    └── discogs_catalog_42.json
```

---

## Step 7 — Verify Everything Works

### Check track count in DB
```http
GET /api/v1/admin/tracks?partner_id=42&page_size=1
Authorization: Bearer <admin_jwt>
```
Look at `pagination.total` — should match your expected catalog size.

### Check embedding status
```http
GET /api/v1/admin/tracks?partner_id=42&page_size=20
Authorization: Bearer <admin_jwt>
```
Each track's `processing.embedding_status` should be `"done"` and `processing.faiss_indexed` should be `true`.

### Test a similarity search
Use the partner's API key to do a real similarity query:
```http
GET /api/v1/similarity/by-track/<any_track_uuid>
X-API-KEY: rmx_growth_xxx...
```
You should get back a list of similar tracks.  A 404 or empty result means the track isn't indexed yet.

### Confirm index sizes on Hetzner
```bash
# On the Hetzner server
python3 -c "
import json, pathlib
base = pathlib.Path('data/partners/42/internal')
for f in ['maest_catalog_42.json', 'discogs_catalog_42.json']:
    d = json.loads((base / 'catalog' / f).read_text())
    print(f, len(d['uuids']), 'tracks')
"
```

---

## Full Checklist

```
[ ] Partner record created (ID noted)
[ ] API key issued and shared with partner
[ ] SFTP provisioned (if partner uses SFTP delivery)
[ ] Tracks ingested (ingest log shows COMPLETED, 0 errors)
[ ] Embeddings job completed (all tracks: embedding_status=done)
[ ] FAISS indexes rebuilt (index_size matches track count for both engines)
[ ] Similarity search test returns results
```

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Embedding job stuck at `pending` | Hetzner embed server offline | Check `GET /health` on Hetzner (port 8004) |
| `index_size: 0` after rebuild | No `.npy` files on disk | Re-run the embeddings job |
| Similarity returns nothing | Track not in FAISS | Check `faiss_indexed=true` on the track, then rebuild index |
| `422 Unprocessable Entity` on rebuild | `partner_id` missing in query param | Always pass `?partner_id=<id>` |
| SFTP upload not triggering | Webhook / watcher not configured | Use manual trigger: `POST /api/v1/admin/ingestion/trigger` |
| `500 Media server not configured` | Missing env vars | Check `SIMILARITY_SERVER_URL` and `HETZNER_INTERNAL_API_KEY` in Alwyzon `.env` |

---

## Off-boarding a Partner

1. **Deactivate** the partner (Admin → Partners → Deactivate) — stops API key validation
2. **Revoke all API keys** (Admin → Partners → API Keys → Revoke)
3. **Delete DB record** — `DELETE /api/v1/admin/partners/{partner_id}` (cascades: api_keys, quotas, usage_logs)
4. **Remove Hetzner data** (on Hetzner server):
   ```bash
   rm -rf data/partners/42/
   ```
5. Run `cleanup_test_partners.py` if the partner was a test/staging tenant

---

## Reference: Key Admin API Endpoints

| Action | Method + Path |
|---|---|
| Create partner | `POST /api/v1/admin/partners/` |
| List partners | `GET /api/v1/admin/partners/` |
| Get partner | `GET /api/v1/admin/partners/{id}` |
| Issue API key | `POST /api/v1/admin/partners/api-keys/issue` |
| List API keys | `GET /api/v1/admin/partners/api-keys/{partner_id}` |
| Revoke API key | `POST /api/v1/admin/partners/api-keys/revoke` |
| Provision SFTP | `POST /api/v1/admin/partners/sftp/provision` |
| SFTP status | `GET /api/v1/admin/partners/{id}/sftp` |
| Trigger ingestion | `POST /api/v1/admin/ingestion/trigger` |
| List ingest logs | `GET /api/v1/admin/ingestion/logs?partner_id={id}` |
| Trigger embeddings job | `POST /api/v1/admin/processing/jobs/embeddings` |
| Get job status | `GET /api/v1/admin/processing/jobs/{job_id}` |
| Rebuild FAISS indexes | `POST /api/v1/admin/similarity/rebuild-index?partner_id={id}` |
| List tracks | `GET /api/v1/admin/tracks?partner_id={id}` |
