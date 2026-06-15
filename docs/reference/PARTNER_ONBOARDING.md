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

> ### ⚠️ Pick ONE provisioning path — do not do both
> There are two ways to provision SFTP. **Use only one** per partner:
>
> | Path | What it does | When to use |
> |---|---|---|
> | **A — Automated (recommended)** | One frontend action creates the host dirs, the locked-down SFTPGo user (with the password you set), **and** the Alwyzon DB record. | Default for every new partner. Needs the SFTPGo container + Hetzner server (`:8004`) healthy. |
> | **B — Manual (fallback)** | You create the dirs + SFTPGo user by hand in the SFTPGo panel/REST. | Only when Path A / Hetzner is unavailable. |
>
> Doing **both** is redundant and overwrites itself — see **“What if I did both?”** at the end of this step.

---

### Path A (recommended) — Automated provisioning via the admin frontend

This single action does **everything** — no manual `mkdir`, no SFTPGo panel work:

1. In the admin frontend, open the partner and click **Provision SFTP**.
2. Enter:
   - **Password** — min 8 chars. This is the **plaintext** the partner logs in with.
   - You do **not** type a username — it is auto-derived from the partner UUID as
     `partner_<slug>`, where `<slug>` is the **last segment of the UUID**
     (e.g. UUID `ec15706e-61cf-4f53-a964-65c20f1c06df` → username `partner_65c20f1c06df`).
3. Submit. Behind the scenes this calls
   `POST /api/v1/admin/partners/sftp/provision` → Hetzner (`:8004`) → SFTPGo, which:
   - creates the host directories `partners/<slug>/{test,live}` (slug = last UUID segment),
   - creates the SFTPGo user `partner_<slug>` with your **plaintext password** and the
     full lockdown (root = list-only, no folder creation, only approved file types,
     internal folders hidden),
   - records the account in the Alwyzon `sftp_users` table.

> **Requirements:** the `resomix-sftpgo` container must be up, and the Hetzner
> server on `:8004` must be running the **current** code — it has **no hot-reload**,
> so restart `python run.py` after any backend change before provisioning.

Then skip straight to **3d — Test the SFTP connection** below. You're done.

---

### Path B (fallback) — Manual provisioning via the SFTPGo panel

> Use this **only** if Path A is unavailable. If you use Path B, do **not** also
> click “Provision SFTP” in the frontend (see “What if I did both?”).

#### 3a — Create partner home directories on the host

SFTPGo runs in Docker with this volume mount:  
`./dev_partner_data/sftp` (host) → `/srv/sftp` (container)

Create the partner's upload folders **on the host** inside that volume:

> The folder name is the **UUID slug** — the last segment of the partner's UUID —
> not the integer id. For UUID `ec15706e-61cf-4f53-a964-65c20f1c06df` the slug is
> `65c20f1c06df`. This matches what Path A provisions automatically.

```bash
# From the resomix-similarity-open project directory
SLUG=65c20f1c06df   # last segment of the partner UUID

mkdir -p dev_partner_data/sftp/partners/${SLUG}/test
mkdir -p dev_partner_data/sftp/partners/${SLUG}/live
```

Structure created:
```
dev_partner_data/sftp/partners/65c20f1c06df/
├── test/    ← dry-run uploads (validate + report, no DB changes)
└── live/    ← production uploads (persisted to DB)
```

Inside the container / SFTPGo these appear at `/srv/sftp/partners/65c20f1c06df/`.

---

#### 3b — Create the SFTPGo virtual user

> Set the partner's password here as **plaintext** — SFTPGo hashes it itself.
> (Do not paste a bcrypt hash; SFTPGo would treat it as already-hashed and the
> partner could never log in.)

**Option A — Web Admin Panel** (`http://localhost:8080`)

1. Open `http://localhost:8080` and log in:  
   - Username: `admin`  
   - Password: `12345678`
2. Navigate to **Users → Add User**
3. Fill in the form:

   | Field | Value |
   |---|---|
   | **Username** | `partner_<slug>` (e.g. `partner_65c20f1c06df`) |
   | **Password** | a strong random password |
   | **Home directory** | `/srv/sftp/partners/<slug>` (e.g. `/srv/sftp/partners/65c20f1c06df`) ← container path |
   | **Status** | Enabled |

4. Under **Filesystem** → leave as **Local** (provider 0)
5. Under **Quota** → set **Max total size** in bytes (e.g. 10 GB = `10737418240`)
6. Under **Permissions** → set them **per-directory** (do NOT use `*`):

   | Path | Permissions | Why |
   |---|---|---|
   | `/` | `list` | Partner can see `live/` and `test/` but cannot write or create anything at the root. |
   | `/live` | `list`, `upload`, `download`, `delete` | Production batch uploads. |
   | `/test` | `list`, `upload`, `download`, `delete` | Dry-run batch uploads. |

   > ⚠️ Do **not** grant `create_dirs` on any path — this is what prevents the
   > partner from creating their own folders. They can only upload files into the
   > pre-existing `live/` and `test/` folders.

7. Under **ACLs / Filters → File patterns**, restrict allowed file types and hide
   internal folders:

   | Path | Allowed patterns | Denied patterns | Policy |
   |---|---|---|---|
   | `/live` | `*.flac, *.wav, *.aiff, *.mp3, *.zip, *.csv, *.done, .done` | — | **Hide** (deny + hide) |
   | `/test` | `*.flac, *.wav, *.aiff, *.mp3, *.zip, *.csv, *.done, .done` | — | **Hide** |
   | `/` | — | `internal, .processing, .*` | **Hide** |

   This means **only** `.flac .wav .aiff .mp3 .zip .csv .done` files can be uploaded,
   and any internal/processing folder (or dotfile) at the root is hidden from and
   inaccessible to the partner.

8. Click **Save**

---

**Option B — REST API** (from terminal)

```bash
SLUG=65c20f1c06df              # last segment of the partner UUID
USERNAME=partner_${SLUG}
PASSWORD=SecureRandomPass123!
QUOTA_BYTES=10737418240  # 10 GB (see tier mapping below)

# 1. Get auth token
TOKEN=$(curl -s -u "admin:12345678" \
  http://localhost:8080/api/v2/token | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Create the locked-down virtual user
#    - per-directory permissions (root = list only, no create_dirs anywhere)
#    - only the 7 allowed file types accepted in live/ and test/
#    - internal/processing folders hidden at the root
curl -s -X POST http://localhost:8080/api/v2/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\",
    \"home_dir\": \"/srv/sftp/partners/${SLUG}\",
    \"status\": 1,
    \"quota_size\": ${QUOTA_BYTES},
    \"filesystem\": {\"provider\": 0},
    \"permissions\": {
      \"/\": [\"list\"],
      \"/live\": [\"list\", \"upload\", \"download\", \"delete\"],
      \"/test\": [\"list\", \"upload\", \"download\", \"delete\"]
    },
    \"filters\": {
      \"file_patterns\": [
        {
          \"path\": \"/\",
          \"denied_patterns\": [\"internal\", \".processing\", \".*\"],
          \"deny_policy\": 1
        },
        {
          \"path\": \"/live\",
          \"allowed_patterns\": [\"*.flac\", \"*.wav\", \"*.aiff\", \"*.mp3\", \"*.zip\", \"*.csv\", \"*.done\", \".done\"],
          \"deny_policy\": 1
        },
        {
          \"path\": \"/test\",
          \"allowed_patterns\": [\"*.flac\", \"*.wav\", \"*.aiff\", \"*.mp3\", \"*.zip\", \"*.csv\", \"*.done\", \".done\"],
          \"deny_policy\": 1
        }
      ]
    }
  }"
```

> **What this lockdown enforces**
> - **`live/` and `test/` available** — partner sees and uploads into both.
> - **No folder creation** — `create_dirs` is granted nowhere, so the partner
>   cannot create directories anywhere in their home.
> - **Internal folder hidden** — `deny_policy: 1` (hide) + `denied_patterns`
>   means any `internal` / `.processing` / dotfolder at the root is invisible
>   and inaccessible.
> - **Only approved file types** — `allowed_patterns` restricts uploads to
>   `.flac .wav .aiff .mp3 .zip .csv .done` (with `deny_policy: 1` hiding/rejecting
>   anything else). `.done` is listed explicitly so the batch-completion marker
>   is accepted.

**Quota tier mapping:**

| Tier | Bytes | Human |
|---|---|---|
| sandbox | `1073741824` | 1 GB |
| starter | `10737418240` | 10 GB |
| growth | `53687091200` | 50 GB |
| enterprise | `0` | Unlimited |

---

#### What if I did both? (Path A *and* the manual panel)

You won't get DB duplicates, but the two paths fight each other — which is why
you pick one:

- **Alwyzon DB (`sftp_users`)** — the provision endpoint refuses a second
  account for a partner that already has one (`"SFTP account already
  provisioned"`), so there's never a duplicate row.
- **SFTPGo** — the provision flow does `POST /users`; if the username already
  exists (because you created it in the panel) it gets `409` and falls back to
  `PUT /users/{username}`, **overwriting** your manual settings with the
  endpoint's (password, permissions, file filters). So the panel work is wasted
  and, before the plaintext fix, this is also how a working panel password got
  clobbered by a bcrypt hash.

**Rule of thumb:** if Path A (frontend provision) works, use it alone. Only fall
back to the manual panel when Hetzner/`:8004` is down — and then don't click the
frontend "Provision SFTP" button for that partner.

---

### 3d — Test the SFTP connection

```bash
sftp -P 2022 partner_65c20f1c06df@localhost
# Enter the plaintext password you set during provisioning
# You land in the chroot root (which is /srv/sftp/partners/<slug> inside the container)

ls          # should show: live/  test/   (internal/dotfolders are hidden)
cd live
put /path/to/track.flac     # only .flac .wav .aiff .mp3 .zip .csv .done are accepted
ls          # should show track.flac
```

**Connection details to give the partner:**
```
Host:     sftp.resomix.com
Port:     2022
Username: partner_65c20f1c06df
Password: <the plaintext password set during provisioning>
```

---

## Step 4 — Ingest Tracks

There are two paths depending on how the partner delivers their catalog.

### Path A — SFTP Batch Upload (standard B2B flow)

The partner uploads their audio + `manifest.csv` into `live/` (or `test/` for a
dry-run), then uploads an empty **`.done`** marker **last**. The `.done` upload is
what triggers ingestion automatically — no manual API call needed.

**How the auto-trigger works** (already wired on a box set up per the runbook):
SFTPGo's `common.actions` hook (`execute_on: ["upload"]`) POSTs every upload to
Alwyzon `:8001/internal/sftp/event`. That handler ignores everything **except** a
file named `.done`; on `.done` it derives the env from the path (`/live/` vs
`/test/`) and hands the batch to the media server, which validates `manifest.csv`
row-by-row and ingests. So: **upload all files first, `.done` last.**

1. **Upload the batch** (audio + manifest first, then `.done`). From any host
   with the files — example uploading a whole folder. Replace `<sftp-host>` with
   the partner's SFTP host (prod: `sftp.resomix.com`; on-box test: `localhost`),
   `<sftp-user>` with the provisioned username, and `<audio_folder>` with the
   local folder of audio + `manifest.csv`:

   ```bash
   # 1a. put the manifest alongside the audio so they upload together
   cp manifest.csv <audio_folder>/

   # 1b. upload audio + manifest (everything EXCEPT .done). You'll be prompted
   #     for the partner's SFTP password.
   sftp -P 2022 <sftp-user>@<sftp-host> <<'EOF'
   cd live
   lcd <audio_folder>
   mput *.flac
   put manifest.csv
   bye
   EOF

   # 1c. upload the .done marker LAST — this fires ingestion
   touch /tmp/.done
   sftp -P 2022 <sftp-user>@<sftp-host> <<'EOF'
   cd live
   put /tmp/.done
   bye
   EOF
   ```

   > Use `test` instead of `live` for a non-persisting dry-run. For fully
   > unattended uploads use `lftp -u "<user>,<pass>" sftp://<sftp-host>:2022 -e "..."`
   > or `sshpass`, since plain `sftp` prompts for the password interactively.

2. **(Fallback) Manual trigger** — if the `.done` hook didn't fire (e.g. SFTPGo
   `common.actions` not configured), trigger ingestion explicitly:
   ```http
   POST /api/v1/admin/ingestion/trigger
   Authorization: Bearer <admin_jwt>

   { "partner_id": 42, "env": "live" }
   ```
   Returns `job_id`. Poll `GET /api/v1/admin/ingestion/logs?partner_id=42` to watch progress.

3. **Check for errors:**
   ```http
   GET /api/v1/admin/ingestion/logs/{log_id}
   Authorization: Bearer <admin_jwt>
   ```
   The response includes a per-row `errors` array for any validation failures.

**CSV manifest format** (`manifest.csv`) — must match the media-server validator
(`resomix-similarity-open/app/services/ingestion_runner.py`):

```csv
isrc,title,audio_filename,display_artist,mix_name,duration_ms,bpm,genre
USABC2500001,Track Title,track_01.flac,Artist Name,Original Mix,240000,128,Electronic
```

**Required columns:** `isrc`, `title`, `audio_filename`, `display_artist`
- `isrc` — 12 chars, format `^[A-Z]{2}[A-Z0-9]{3}\d{7}$`, **unique within the batch** (no hyphens).
- `audio_filename` — exact basename of the uploaded file (the validator looks for `live/<audio_filename>`).

**Optional** (validated only if present): `mix_name` (default `Original Mix`),
`version_title`, `genre`, `sub_genre`, `duration_ms`, `bpm` (30–300),
`musical_key`, `parental_warning` (`NoAdviceAvailable`|`NotExplicit`|`Explicit`|`ExplicitContentEdited`),
`release_date` (`YYYY-MM-DD`), `audio_language` (2-letter), `is_explicit`/`is_instrumental`
(`0`|`1`|`true`|`false`), `p_line_year`, `p_line_text`, `upc_ean` (12–13 digits),
`language_of_lyrics`.

> ⚠️ There is **no `uuid` column** — the media server assigns each track's UUID.
> The column is `audio_filename`, **not** `filename`.

**No manifest yet?** Generate one from a folder of audio files:
```bash
# Alwyzon repo — synthesizes valid placeholder ISRCs + parses artist/title/mix
.venv/bin/python scripts/generate_manifest.py /path/to/audio_folder \
    --out manifest.csv --genre Electronic
```

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
