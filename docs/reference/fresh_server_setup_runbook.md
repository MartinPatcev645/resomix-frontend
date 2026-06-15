# Fresh Staging Server Bring-Up Runbook — Single Box (Alwyzon + Media + SFTPGo)

**What this is:** a step-by-step procedure to stand up a **complete Resomix
staging environment on one clean VPS, from scratch**, with a **fresh empty
database** — no restore-from-backup. In production these run on two separate
servers; for staging we co-locate **all three services on a single box**:

| Service | Repo | Local bind | Public URL |
|---|---|---|---|
| **Alwyzon** control-plane (API, MariaDB, auth, billing) | `basic_fastapi_server_resomix` | `127.0.0.1:8001` | `https://staging-bserver.resomix.com` |
| **Media / similarity** server (FAISS, audio/peaks/segments/HLS, deletion proof) | `resomix-similarity-open` | `127.0.0.1:8004` | `https://staging-media.resomix.com` |
| **SFTPGo** (partner uploads) | (3rd-party) | SFTP `:2022`, Admin REST `127.0.0.1:8090` | partners connect to `staging-media.resomix.com:2022` |

**Out of scope (intentionally):**
- **Embedding generation** — handled by a **dedicated GPU server**. The media
  server only *calls out* to it (`EMBED_SERVER`); we do **not** install any
  embedding/ML stack here.
- **Restore-from-backup** — this runbook stops at running, migrated, *empty*
  services. Loading live data from the Storage Box is a separate step (§J).

> **Secrets:** every `<PLACEHOLDER>` is a value you supply at run time. Never
> commit real passwords/keys. Two secrets **must be byte-identical on both apps**:
> `HETZNER_INTERNAL_API_KEY` and `EDGE_JWT_SECRET`.

> **Port map (single box):** Alwyzon `8001`, Media `8004`, SFTPGo SFTP `2022`,
> SFTPGo Admin `8090` (localhost only), MariaDB `3306`, Redis `6379`.

---

## Part A — Shared base (do once)

These steps prepare the box for **both** Python apps.

### A1. System update + build dependencies + media tools

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev \
  libssl-dev libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev \
  git curl pkg-config ffmpeg \
  libmariadb-dev libmariadb-dev-compat
ffmpeg -version    # media server needs ffmpeg + ffprobe on PATH
# libmariadb-dev provides `mariadb_config`, required to build the `mariadb`
# Python wheel in Alwyzon's requirements.txt (otherwise pip fails with
# "mariadb_config not found").
```

### A2. Non-root service user

```bash
sudo adduser devuser            # strong password
sudo usermod -aG sudo devuser
su - devuser
```

### A3. Git identity + deploy keys (one key per repo)

> ⚠️ **GitHub rule:** a single SSH key can be a *Deploy Key* on **only one**
> repository across all of GitHub. Reusing one key on the second repo fails with
> `Key is already in use`. Because we clone **two** repos onto this box, we
> generate **two** keys and disambiguate them with `~/.ssh/config` host aliases.

```bash
git config --global user.name  "Resomix Deploy"
git config --global user.email "usman.naeem2212@gmail.com"

# One key per repo (no passphrase so unattended pulls/systemd never block):
ssh-keygen -t ed25519 -N "" -C "alwyzon@staging" -f ~/.ssh/id_ed25519_alwyzon
ssh-keygen -t ed25519 -N "" -C "media@staging"   -f ~/.ssh/id_ed25519_media

cat ~/.ssh/id_ed25519_alwyzon.pub   # → Deploy Key on basic_fastapi_server_resomix
cat ~/.ssh/id_ed25519_media.pub     # → Deploy Key on resomix-similarity-open
```

Add **each** public key as a **read-only Deploy Key** on its **own** repo:

- `id_ed25519_alwyzon.pub` → `Resomix/basic_fastapi_server_resomix` → Settings → Deploy keys
- `id_ed25519_media.pub`   → `Resomix/resomix-similarity-open` → Settings → Deploy keys

Then create `~/.ssh/config` so each alias picks the right key:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-alwyzon
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_alwyzon
    IdentitiesOnly yes

Host github-media
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_media
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github-alwyzon   # → "Hi Resomix/basic_fastapi_server_resomix! ..."
ssh -T git@github-media     # → "Hi Resomix/resomix-similarity-open! ..."
```

### A4. Python from source — **two versions** (one per app)

> ⚠️ **The two apps need different Python versions.**
> - **Alwyzon → Python 3.12.** Its deps build cleanly on 3.12.
> - **Media server → Python 3.11.** Its pinned engine deps `numpy==1.24.3` and
>   `faiss-cpu==1.7.4` have **no Python 3.12 wheels** (numpy gained 3.12 support
>   only in 1.26.0; faiss-cpu in 1.8.0). On 3.12, pip tries a source build and
>   fails (`Cannot import 'setuptools.build_meta'`). We do **not** bump those
>   pins — they're core engine versions — so the media venv runs on 3.11.
>
> `make altinstall` installs each side-by-side as `python3.11` / `python3.12`
> and never touches the system `python3`.

```bash
cd /tmp

# --- Python 3.12 (for Alwyzon) ---
wget https://www.python.org/ftp/python/3.12.0/Python-3.12.0.tgz
tar -xf Python-3.12.0.tgz && cd Python-3.12.0
./configure --enable-optimizations
make -j"$(nproc)"
sudo make altinstall            # installs python3.12, leaves system python3 alone
python3.12 --version            # -> Python 3.12.0
cd /tmp

# --- Python 3.11 (for the media server) ---
wget https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
tar -xf Python-3.11.9.tgz && cd Python-3.11.9
./configure --enable-optimizations
make -j"$(nproc)"
sudo make altinstall            # installs python3.11 alongside python3.12
python3.11 --version            # -> Python 3.11.9
```

### A5. Generate the shared cross-service secrets (once)

Keep these in a scratch note — you'll paste the **same** values into both `.env` files.

```bash
python3.12 -c "import secrets; print('HETZNER_INTERNAL_API_KEY=' + secrets.token_urlsafe(48))"
python3.12 -c "import secrets; print('EDGE_JWT_SECRET=' + secrets.token_urlsafe(48))"
```

### A6. Shared storage layout

Both the SFTP service and the media server read/write under these roots, so the
paths **must agree** across all three services.

```bash
sudo mkdir -p /srv/sftp/partners            # SFTP chroot homes (PARTNER_SFTP_ROOT)
sudo mkdir -p /srv/resomix/partners         # media per-partner assets (PARTNER_DATA_ROOT)
sudo mkdir -p /srv/resomix/shared           # global shared assets (SHARED_ASSETS_ROOT)
sudo mkdir -p /srv/resomix/audit_logs /srv/resomix/audit_keys   # deletion-proof
sudo chown -R devuser:devuser /srv/resomix
# /srv/sftp ownership is set in Part D (must match the SFTPGo runtime uid).
```

---

## Part B — Alwyzon control-plane

### B1. Clone + venv + deps

```bash
cd ~
git clone git@github-alwyzon:Resomix/basic_fastapi_server_resomix.git
cd basic_fastapi_server_resomix
python3.12 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt
```

> **Always use `.venv/bin/python`** for this repo (app, pytest, alembic).

### B2. MariaDB + Redis (fresh, empty)

```bash
sudo apt install -y mariadb-server redis-server
sudo systemctl enable --now mariadb redis-server
sudo mysql_secure_installation
```

**`mysql_secure_installation` answer key** (Ubuntu/Debian MariaDB ships with
root on **unix_socket** auth, so it's already protected — `sudo mariadb` logs in
via the socket, no password). Answer in this order:

| Prompt | Answer | Why |
|---|---|---|
| Enter current password for root | *(press Enter)* | None set yet — root uses unix_socket. |
| Switch to unix_socket authentication | **n** | Already active; nothing to change. |
| Change the root password | **n** | No password-based root login exists to harden. |
| Remove anonymous users | **Y** | Never leave anonymous access on. |
| Disallow root login remotely | **Y** | Root stays localhost-only. |
| Remove test database | **Y** | Drop the throwaway `test` DB. |
| Reload privilege tables | **Y** | Apply all of the above now. |

```sql
-- inside: sudo mariadb
-- ⚠️ Replace <DB_PASSWORD> with a real strong password (do NOT paste the
--    literal placeholder), and use the SAME value in B3's .env.
-- ⚠️ The app connects via aiomysql over TCP to 127.0.0.1 — MySQL/MariaDB treat
--    'user'@'localhost' as SOCKET-ONLY, so a '@127.0.0.1' grant is REQUIRED or
--    you get "Access denied for user 'resomixAdmin'@'127.0.0.1'". We grant both.
CREATE DATABASE resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'resomixAdmin'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';
CREATE USER 'resomixAdmin'@'127.0.0.1' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON resomix_db.* TO 'resomixAdmin'@'localhost';
GRANT ALL PRIVILEGES ON resomix_db.* TO 'resomixAdmin'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### B3. Configure `.env`

Write `/home/devuser/usman/basic_fastapi_server_resomix/.env`. The block below is
the **full staging file**, production-mode on a single box. Lines marked `# ⚠️`
differ from a typical local-dev `.env`; placeholders `<...>` you must fill in.

```bash
# ── MongoDB (external Atlas) ────────────────────────────────────────
MONGODB_URI=<your mongodb+srv URI>

# ── External services (single box) ──────────────────────────────────
SIMILARITY_SERVER_URL=http://127.0.0.1:8004        # ⚠️ internal call, same box
RESOMIX_SERVER_URL=http://127.0.0.1:8001           # ⚠️ self, internal
PUBLIC_ALWYZON_URL=https://staging-bserver.resomix.com   # ⚠️ public (needs nginx)
HLS_MEDIA_BASE_URL=https://staging-media.resomix.com     # ⚠️ public media (needs nginx)
RESOMIX_ENV=production                             # ⚠️ was development

# ── Google Sheets (creds file must exist under creds/) ──────────────
SERVICE_ACCOUNT_FILE=creds/<service-account>.json
GOOGLE_SHEET_ID=<sheet id>
FEEDBACK_WORKSHEET_NAME=Feedback 
CONTACT_WORKSHEET_NAME=ContactSubmissions

# ── Preview URL security (MUST match media server) ──────────────────
PREVIEW_FERNET_SECRET=<shared with media>
PREVIEW_HMAC_SECRET=<shared with media>
PREVIEW_AUDIO_URL_EXPIRES_SECONDS=300

PARTNER_API_KEY_SIGNING_SECRET=<secret>
PARTNER_API_KEY_HASH_ALGORITHM=sha256

# ── Application ─────────────────────────────────────────────────────
RESOMIX_API_KEY=<bearer key>
RESOMIX_TEMP_DIR=temp_audio
RESOMIX_DEFAULT_TOP_SK=20
RESOMIX_APP_TITLE=Resomix API
RESOMIX_APP_DESCRIPTION=API for audio similarity search, track information, and metadata extraction
RESOMIX_APP_VERSION=3.0.1

# ── CORS (production) ───────────────────────────────────────────────
RESOMIX_USE_DEVELOPMENT_CORS=false                 # ⚠️ was true
RESOMIX_ALLOWED_ORIGINS_PRODUCTION=https://staging.resomix.com,https://resomix.com  # ⚠️ set real frontend origin(s)

# ── Modes ───────────────────────────────────────────────────────────
DEMO_MODE=false
SIMILARITY_AUTH_REQUIRED=true                      # ⚠️ false if testing without valet tokens

# ── SCP (LEGACY open-tracks pipeline) ───────────────────────────────
# ⚠️ NEVER point at the real production host. Unused in the new handoff flow.
SCP_PRIVATE_KEY_PATH=/etc/pem/<key>.pem
SCP_REMOTE_USER=ubuntu
SCP_REMOTE_HOST=127.0.0.1
SCP_REMOTE_PORT=22
SCP_REMOTE_DIR=/srv/resomix/data/open_tracks/

# ── MariaDB (native; resomixAdmin over TCP — see B2 '@127.0.0.1' grant) ──
MARIA_DB_USER=resomixAdmin                          # ⚠️ was root
MARIA_DB_PASS=<DB_PASSWORD>                          # ⚠️ real password, not 'test'
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3306                                  # ⚠️ was 3307
MARIA_DB_NAME=resomix_db

# ── ElasticSearch (NOT installed on this box) ───────────────────────
ELASTICSEARCH_ENABLED=false                         # ⚠️ enable only after installing ES
ES_URL=https://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=<es pass>
ES_VERIFY_CERTS=True
ES_CA_CERTS=/etc/logstash/certs/http_ca.crt
ES_REQUEST_TIMEOUT=20
ES_SEARCH_LIMIT=100

# ── OAuth (external; Apple needs the .p8 creds file present) ─────────
SPOTIFY_CLIENT_ID=<id>
SPOTIFY_CLIENT_SECRET=<secret>
TIDAL_CLIENT_ID=<id>
TIDAL_CLIENT_SECRET=<secret>
APPLE_TEAM_ID=<id>
APPLE_KEY_ID=<id>
APPLE_PRIVATE_KEY_PATH=creds/<AuthKey>.p8
APPLE_PRIVATE_KEY_PEM=
APPLE_TOKEN_TTL=
APPLE_STOREFRONT=

# ── JWT / Auth ──────────────────────────────────────────────────────
JWT_SECRET_KEY=<strong secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=false
PASSWORD_REQUIRE_LOWERCASE=false
PASSWORD_REQUIRE_DIGIT=true
PASSWORD_REQUIRE_SPECIAL=false
EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS=6
PASSWORD_RESET_TOKEN_EXPIRE_HOURS=1
TWO_FACTOR_CODE_EXPIRE_MINUTES=5
TWO_FACTOR_CODE_LENGTH=6

# ── Cookies (production; require HTTPS via nginx) ────────────────────
COOKIE_DOMAIN=.resomix.com                          # ⚠️ was localhost
COOKIE_SECURE=true                                  # ⚠️ needs HTTPS
COOKIE_SAMESITE=lax

# ── Rate limiting ───────────────────────────────────────────────────
RATE_LIMIT_ENABLED=true                             # ⚠️ was false
LOGIN_RATE_LIMIT=1000/minute
REGISTER_RATE_LIMIT=1000/minute
PASSWORD_RESET_RATE_LIMIT=1000/minute

# ── SMTP (external) ─────────────────────────────────────────────────
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASSWORD=<smtp pass>
SMTP_FROM_EMAIL=noreply@resomix.com
SMTP_FROM_NAME=Resomix
FRONTEND_URL=https://staging.resomix.com            # ⚠️ staging frontend for email links

# ── Cross-service secret (MUST match media) ─────────────────────────
HETZNER_INTERNAL_API_KEY=<shared with media>
REDIS_URL=redis://127.0.0.1:6379/0

# ── Telemetry ───────────────────────────────────────────────────────
TELEMETRY_FLUSH_INTERVAL_SECONDS=120
TELEMETRY_MAX_BATCH_SIZE=500
TELEMETRY_REDIS_KEY=telemetry:stream_events_queue
TELEMETRY_WORKER_POP_SIZE=1000

# ── Edge authz (MUST match media EDGE_JWT_SECRET) ───────────────────
EDGE_JWT_SECRET=<shared with media>
EDGE_TOKEN_TTL_SECONDS=14400

# ── Stripe (test keys) ──────────────────────────────────────────────
STRIPE_PUBLISHABLE_KEY=<pk_test_...>
STRIPE_SECRET_KEY=<sk_test_...>
# ⚠️ Create a NEW Stripe webhook endpoint for the staging URL and use ITS secret.
STRIPE_WEBHOOK_SECRET=<whsec_...>

# ── SFTP provisioning / partner-facing SFTP host ────────────────────
HETZNER_SFTP_PROVISION_URL=http://127.0.0.1:8004/internal/provision-sftp-user  # ⚠️ 127.0.0.1
SFTP_SERVER_HOST=staging-media.resomix.com          # ⚠️ was sftp.resomix.com
SFTP_SERVER_PORT=2022
SFTP_BASE_PATH=/srv/sftp
```

### B4. Migrate + seed (fresh schema, no restore)

```bash
source .venv/bin/activate
.venv/bin/python -m alembic upgrade head     # builds all tables
.venv/bin/python scripts/seed_rbac.py        # roles / permissions
.venv/bin/python scripts/seed_data.py seed-all     # operation types, etc. (needs the seed-all arg)
.venv/bin/python scripts/seed_sandbox_catalog.py   # optional demo catalog
mariadb -u resomixAdmin -p resomix_db -e "SHOW TABLES;"
```

> **Migration `a1b2c3d4e5f6` (service_mode) is now idempotent** — it skips the
> add when `partners.service_mode` already exists (the initial schema creates
> it), so a current checkout runs `upgrade head` cleanly with no intervention.
>
> If you're on an **older checkout** that predates that fix, `upgrade head`
> aborts at `a1b2c3d4e5f6` with `(1060, "Duplicate column name 'service_mode'")`.
> Work around it by stamping past that one revision, then continuing:
>
> ```bash
> alembic stamp a1b2c3d4e5f6     # mark the redundant migration applied (no-op)
> alembic upgrade head           # runs the remaining revision(s)
> alembic current                # -> b2c3d4e5f6a7 (head)
> ```

### B5. Smoke test

```bash
.venv/bin/python run.py        # binds 0.0.0.0:8001
# in another shell:
curl -s http://127.0.0.1:8001/api/v1/health     # -> {"status":"healthy"}
```

`Ctrl-C` to stop (supervised process comes in Part H).

---

## Part C — Media / similarity server

The media server is **DB-less**: it owns files, FAISS indexes, audio
processing, and the deletion-proof audit log. It does **not** generate
embeddings — it calls the GPU server for that.

### C1. Clone + venv + deps

```bash
cd ~
git clone git@github-media:Resomix/resomix-similarity-open.git
cd resomix-similarity-open
python3.11 -m venv .venv && source .venv/bin/activate   # ⚠️ 3.11, NOT 3.12 — see A4
pip install --upgrade pip && pip install -r requirements.txt   # faiss-cpu, fastapi, etc.
```

> **Why 3.11 here:** `numpy==1.24.3` and `faiss-cpu==1.7.4` have no Python 3.12
> wheels. Building the media venv with `python3.12` fails on the numpy source
> build. Always create this venv with `python3.11`.

### C2. Create the media working directories

The legacy single-folder paths (audio, peaks, segments, embeddings) live under
`/srv/resomix/data`; partner-scoped + audit roots were already made in A6.

```bash
sudo mkdir -p /srv/resomix/data/{temp_audio_files,audio_files,uploads_previews,uploads_raw,covers,peaks,segments,scripts}
sudo mkdir -p /srv/resomix/data/embeddings/{maest,maest_upload,discogs,discogs_upload}
sudo chown -R devuser:devuser /srv/resomix/data
```

### C3. Configure `.env`

Write `/home/devuser/usman/resomix-similarity-open/.env`. Full staging file
below; `# ⚠️` lines differ from a local-dev `.env`, `<...>` are placeholders.
The `PREVIEW_*` / `HETZNER_INTERNAL_API_KEY` / `EDGE_JWT_SECRET` values MUST be
**identical** to Alwyzon's.

```bash
# ── MongoDB (declared in media config; unused at runtime — leave set) ──
MONGODB_URI=<same URI as Alwyzon, or any valid mongodb+srv URI>

# ── Application ─────────────────────────────────────────────────────
APP_NAME=Resomix Similarity API
APP_VERSION=1.1.0
DEBUG=false
HOST=0.0.0.0
PORT=8004
RESOMIX_DEV_PUBLIC_URL=https://staging-media.resomix.com   # ⚠️ was localhost:8004

# ⚠️ loopback + the staging box public IP + the GPU embed server IP
ALLOWED_IPS=127.0.0.1,localhost,::1,<STAGING_PUBLIC_IP>,<GPU_EMBED_SERVER_IP>

DEMO_MODE=false

# ── Preview/audio signing (MUST match Alwyzon) ──────────────────────
PREVIEW_HMAC_SECRET=<shared with Alwyzon>
PREVIEW_FERNET_SECRET=<shared with Alwyzon>

MAX_FILE_SIZE_MB=105

# ── Working directories (⚠️ remapped to /srv/resomix/data) ──────────
TEMP_TRACKS_DIR=/srv/resomix/data/temp_audio_files
AUDIO_DIRECTORY=/srv/resomix/data/audio_files
TRACKS_PREVIEW_AUDIO_LOCATION=/srv/resomix/data/audio_files
UPLOAD_TRACKS_PREVIEW_AUDIO_LOCATION=/srv/resomix/data/uploads_previews
UPLOAD_TRACKS_RAW_AUDIO_LOCATION=/srv/resomix/data/uploads_raw
UPLOAD_TRACKS_COVER_LOCATION=/srv/resomix/data/covers
TRACKS_PEAKS_LOCATION=/srv/resomix/data/peaks
TRACKS_PREVIEW_SEGMENTS_AUDIO_LOCATION=/srv/resomix/data/segments
UPLOAD_TRACKS_PREVIEW_SEGMENTS_AUDIO_LOCATION=/srv/resomix/data/segments

# ── Similarity defaults ─────────────────────────────────────────────
SIMILARITY_DEFAULT_TOP_K=20
SIMILARITY_MIN_TOP_K=1
SIMILARITY_MAX_TOP_K=400
SIMILARITY_TOP_K_DESCRIPTION=Number of similar tracks to return

# ── Embedding server (the dedicated GPU box) ────────────────────────
EMBED_SERVER=<GPU_EMBED_SERVER_URL>                 # ⚠️ e.g. http://1.2.3.4:8005
EMBED_ENDPOINT=/get_all_embeddings

# ── FAISS indexes / catalogs (⚠️ remapped; files must be imported) ──
MAEST_INDEX=/srv/resomix/data/embeddings/maest_index.index
MAEST_FULL_VECTORS_DIR=/srv/resomix/data/embeddings/maest
MAEST_UPLOAD_FULL_VECTORS_DIR=/srv/resomix/data/embeddings/maest_upload
MAEST_CATALOG=/srv/resomix/data/embeddings/maest_catalog.json
MAEST_DIM=768
DISCOGS_INDEX=/srv/resomix/data/embeddings/discogs_index.index
DISCOGS_VECTORS_DIR=/srv/resomix/data/embeddings/discogs
DISCOGS_UPLOAD_VECTORS_DIR=/srv/resomix/data/embeddings/discogs_upload
DISCOGS_CATALOG=/srv/resomix/data/embeddings/discogs_catalog.json
DISCOGS_DIM=1280
STATUS_LOG_FILE=status_open.txt
CATALOG_FILE=/srv/resomix/data/scripts/extracted_track_info.json

RESOMIX_ENV=production                              # ⚠️ was development

FFMPEG_EXE=ffmpeg
FFPROBE_EXE=ffprobe

ALLOWED_ORIGINS=^https://([\w\-]+\.)*resomix\.com(:[0-9]+)?/?$|^http://localhost:(5173|5174|5175|8001|8004|8006)/?$

# ⚠️ base dir prefixed to relative track paths from the catalog — must match
#    how the imported catalog stores them.
PATH_PREFIX_FOR_API_QUERIES=/srv/resomix/data/

MONTHLY_DIR=data/monthly_vectors
MODEL_NAME=discogs_effnet
DIM=1280

# ── Deletion-proof audit logs ───────────────────────────────────────
AUDIT_LOGS_DIR=/srv/resomix/audit_logs              # ⚠️ remapped
AUDIT_KEYS_DIR=/srv/resomix/audit_keys              # ⚠️ remapped

# ── Cross-service secrets (MUST match Alwyzon) ──────────────────────
HETZNER_INTERNAL_API_KEY=<shared with Alwyzon>
EDGE_JWT_SECRET=<shared with Alwyzon>
EDGE_VERIFY_IP=false                                # ⚠️ flip true AFTER nginx real-IP verified

# ── SFTPGo admin REST (⚠️ port 8090 + the Part D admin creds) ───────
SFTPGO_ADMIN_URL=http://127.0.0.1:8090/api/v2       # ⚠️ was :8080
SFTPGO_ADMIN_USER=admin
SFTPGO_ADMIN_PASS=<SFTPGO_ADMIN_PASS from D3>

# ── Partner-scoped storage (server roots) ───────────────────────────
PARTNER_DATA_ROOT=/srv/resomix/partners             # ⚠️ remapped
PARTNER_SFTP_ROOT=/srv/sftp/partners                # ⚠️ remapped
SHARED_ASSETS_ROOT=/srv/resomix/shared              # ⚠️ remapped
```

> If you don't already have shared `PREVIEW_*` secrets, generate them once and
> paste the **same** values into both `.env` files:
>
> ```bash
> .venv/bin/python -c "import secrets; print('PREVIEW_HMAC_SECRET=' + secrets.token_hex(32))"
> .venv/bin/python -c "from cryptography.fernet import Fernet; print('PREVIEW_FERNET_SECRET=' + Fernet.generate_key().decode())"
> ```
>
> The `MAEST_*` / `DISCOGS_*` / `MONTHLY_*` keys serve the open-tracks demo
> catalog and the legacy in-process embedding path; the `.index`/catalog files
> must be imported (Part J) before similarity over that catalog works.

### C4. Smoke test

```bash
source .venv/bin/activate
.venv/bin/python run.py         # prints "Server will run on 0.0.0.0:8004"
# in another shell — confirm it's up (use a known health/root route):
curl -s http://127.0.0.1:8004/    # expect a JSON response, not a connection refusal
```

`Ctrl-C` to stop.

---

## Part D — SFTPGo

SFTPGo authenticates **and** signals uploads by calling **Alwyzon** over HTTP:

- **External auth hook** → `http://127.0.0.1:8001/internal/sftp/auth` (Alwyzon
  validates the partner against MariaDB and returns the home dir + quota +
  lockdown permissions on every login).
- **Upload event hook** → `http://127.0.0.1:8001/internal/sftp/event` (when a
  partner finishes a batch with a `.done` marker, Alwyzon opens an ingest log
  and hands the job to the media server).

Partner SFTP users are **provisioned** by Alwyzon calling the media server's
`/internal/provision-sftp-user`, which in turn creates the SFTPGo user via the
Admin REST API on `127.0.0.1:8090`.

### D1. Install SFTPGo (native, from the GitHub `.deb`)

> ⚠️ The old osuosl **apt repo is dead** (`apt update` returns `404 ... Release`).
> Install the official `.deb` from GitHub releases instead. Pick the package that
> matches the server CPU/OS — on a 64-bit Intel/AMD Ubuntu/Debian box that's the
> **`amd64.deb`** (`x86_64` `.rpm` is for RHEL/Fedora; `arm64`/`armhf`/`ppc64le`
> are other CPUs; `.tar.xz` is a manual binary with no systemd unit — avoid).

```bash
# (if you already tried the apt repo, remove the dead source first)
sudo rm -f /etc/apt/sources.list.d/sftpgo.list /usr/share/keyrings/sftpgo.gpg
sudo apt update

cd /tmp
SFTPGO_VER=2.7.1
wget "https://github.com/drakkan/sftpgo/releases/download/v${SFTPGO_VER}/sftpgo_${SFTPGO_VER}-1_amd64.deb"

# verify against the checksum published on the release page (example for 2.7.1):
echo "0870fe9cfd4676fb0db5fa6e724dcb9493f8b0af2ac35047f47e9cc675219b41  sftpgo_2.7.1-1_amd64.deb" | sha256sum -c -

# install (the leading ./ installs the local file and resolves any deps; this
# creates the `sftpgo` service user, a systemd unit, and config under /etc/sftpgo)
sudo apt install -y ./sftpgo_${SFTPGO_VER}-1_amd64.deb
sftpgo --version
```

### D2. Align SFTP storage ownership

```bash
# Make the SFTP homes owned by the sftpgo runtime user (check the uid with:
# id sftpgo). Keep this uid consistent with the chown the media server's
# provisioner applies to new partner folders.
sudo chown -R sftpgo:sftpgo /srv/sftp
```

### D3. Create the SFTPGo admin (for the REST API)

> ⚠️ Replace `<SFTPGO_ADMIN_PASS>` with a **real strong password** — do not type
> the literal placeholder. Use the **same** value in the media server's `.env`
> (`SFTPGO_ADMIN_PASSWORD`). Run **D4's JSON patch first** (it sets
> `create_default_admin: true`), then this.
>
> **Why not `initprovider`:** on a box where the `.deb` postinstall already
> initialized the SQLite provider, `sftpgo initprovider` reports "data provider
> is up to date" and **skips admin creation** — it only seeds the admin during a
> *fresh* init. Meanwhile `create_default_admin: true` makes the `serve` process
> try to create the admin on every start, and since the systemd unit has no
> `SFTPGO_DEFAULT_ADMIN_PASSWORD` in its environment, the service **crash-loops**
> with a `...SSWORD` error. So we create the admin with a one-shot foreground
> `serve` that *does* carry the env vars, then turn the flag back off.

```bash
# 1. create the admin via a time-boxed foreground serve that carries the env vars
#    (exit code 124 from `timeout` is expected — hence "|| true").
sudo systemctl stop sftpgo
sudo timeout 10 env SFTPGO_DEFAULT_ADMIN_USERNAME=admin \
     SFTPGO_DEFAULT_ADMIN_PASSWORD='<SFTPGO_ADMIN_PASS>' \
     /usr/bin/sftpgo serve || true
#    look for: created the default admin "admin"

# 2. admin exists now -> stop serve from recreating it (prevents the crash-loop)
sudo python3 - <<'PY'
import json
p = "/etc/sftpgo/sftpgo.json"
c = json.load(open(p))
c["data_provider"]["create_default_admin"] = False
json.dump(c, open(p, "w"), indent=2)
print("create_default_admin -> false")
PY

# 3. start the service normally
sudo systemctl enable --now sftpgo
sudo systemctl status sftpgo --no-pager

# 4. verify the admin against the REST API (expect a JSON access_token)
curl -s -u "admin:<SFTPGO_ADMIN_PASS>" http://127.0.0.1:8090/api/v2/token | python3 -m json.tool
```

**To change an *existing* admin's password later**, use the REST API — replace
`<OLD_PASS>` / `<NEW_PASS>`:

```bash
TOKEN=$(curl -s -u "admin:<OLD_PASS>" http://127.0.0.1:8090/api/v2/token \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -X PUT http://127.0.0.1:8090/api/v2/admins/admin \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<NEW_PASS>","permissions":["*"],"status":1}'
```

### D4. Configure bindings + hooks

> ⚠️ **Do NOT replace the whole file** and **do NOT hand-edit it in nano** — the
> default `/etc/sftpgo/sftpgo.json` is ~600 lines. The `.deb` already wrote a
> complete config; we only change a few keys, scripted in place. The table is
> just *what* changes; the Python block below is *how* to apply it safely.

| Section → key | Default | Set to |
|---|---|---|
| `common.actions.execute_on` | `[]` | `["upload"]` |
| `common.actions.hook` | `""` | `"http://127.0.0.1:8001/internal/sftp/event"` |
| `httpd.bindings[0].port` | `8080` | `8090` |
| `httpd.bindings[0].address` | `""` | `"127.0.0.1"` |
| `data_provider.external_auth_hook` | `""` | `"http://127.0.0.1:8001/internal/sftp/auth"` |
| `data_provider.create_default_admin` | `false` | `true` *(so D3 can seed the admin)* |
| `sftpd.bindings[0].port` | `2022` | *(already correct — leave it)* |
| `data_provider.external_auth_scope` | `0` | *(already correct — leave it)* |

Apply in place (backs up first, edits only those keys, re-validates):

```bash
sudo cp /etc/sftpgo/sftpgo.json /etc/sftpgo/sftpgo.json.bak

sudo python3 - <<'PY'
import json
p = "/etc/sftpgo/sftpgo.json"
with open(p) as f:
    c = json.load(f)
c["common"]["actions"]["execute_on"] = ["upload"]
c["common"]["actions"]["hook"] = "http://127.0.0.1:8001/internal/sftp/event"
c["httpd"]["bindings"][0]["port"] = 8090
c["httpd"]["bindings"][0]["address"] = "127.0.0.1"
c["data_provider"]["external_auth_hook"] = "http://127.0.0.1:8001/internal/sftp/auth"
c["data_provider"]["external_auth_scope"] = 0
c["data_provider"]["create_default_admin"] = True
with open(p, "w") as f:
    json.dump(c, f, indent=2)
print("sftpgo.json patched OK")
PY

sudo python3 -m json.tool /etc/sftpgo/sftpgo.json > /dev/null && echo "JSON OK"
```

> The validate command needs `sudo` — `/etc/sftpgo/sftpgo.json` isn't
> world-readable, so a non-root `python3 -m json.tool` fails with
> `Permission denied` (the patch above already ran under `sudo`, so it's fine).

- `sftpd.bindings[].port = 2022` (default) listens on all interfaces — this is
  the only SFTPGo port partners reach (raw SSH/SFTP, **not** proxied by nginx).
- `httpd` Admin REST is bound to **127.0.0.1** only — never public.
- `external_auth_scope: 0` = all auth methods (password + public key), matching
  Alwyzon's auth hook which can return `public_keys` for key-based partners.

> ⚠️ **Don't start the service yet.** With `create_default_admin: true` and no
> admin, `serve` will crash-loop. Go straight to **D3**, which creates the admin
> and starts the service for you.

### D5. Firewall

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH            # your admin SSH (port 22)
sudo ufw allow 80,443/tcp        # nginx
sudo ufw allow 2022/tcp          # partner SFTP
# 8090 (SFTPGo admin), 8001, 8004 stay localhost-only — do NOT open them.
sudo ufw enable
```

---

## Part E — Verify the cross-service wiring

With all three apps running (Parts B/C/D), confirm the links:

```bash
# 1. Alwyzon -> media server reachable on this box:
curl -s http://127.0.0.1:8004/ >/dev/null && echo "media OK"

# 2. Media server -> SFTPGo admin REST reachable:
curl -s http://127.0.0.1:8090/api/v2/token >/dev/null && echo "sftpgo admin OK"

# 3. Shared secrets identical on both apps (compare without printing them):
grep -h '^HETZNER_INTERNAL_API_KEY=' ~/basic_fastapi_server_resomix/.env ~/resomix-similarity-open/.env | sort -u | wc -l   # expect 1
grep -h '^EDGE_JWT_SECRET='          ~/basic_fastapi_server_resomix/.env ~/resomix-similarity-open/.env | sort -u | wc -l   # expect 1
```

A full end-to-end provisioning check (create partner in Alwyzon admin → SFTP
user appears in SFTPGo → connect with `sftp -P 2022 partner_<slug>@staging-media.resomix.com`)
is the final acceptance test — see the partner onboarding guide
([PARTNER_ONBOARDING.md](PARTNER_ONBOARDING.md)).

---

## Part F — nginx (two vhosts) + TLS

Point DNS A-records for **both** subdomains at the VPS IP before running Certbot:
`staging-bserver.resomix.com` and `staging-media.resomix.com`.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

**a. Shared rate-limit / real-IP layer** — create
`/etc/nginx/conf.d/ratelimits_realip.conf` from the repo-root `s_nginx.txt`
template (Cloudflare real-IP ranges, `real_ip_header CF-Connecting-IP`,
`limit_req` zones, CORS map).

**b. Alwyzon vhost** `/etc/nginx/sites-available/staging-bserver`:

```nginx
server {
    server_name staging-bserver.resomix.com;
    client_max_body_size 105M;
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**c. Media vhost** `/etc/nginx/sites-available/staging-media`:

```nginx
server {
    server_name staging-media.resomix.com;
    client_max_body_size 105M;           # large audio uploads / range requests
    location / {
        proxy_pass http://127.0.0.1:8004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;             # streaming media / HLS
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/staging-bserver /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/staging-media  /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging-bserver.resomix.com -d staging-media.resomix.com
sudo certbot renew --dry-run
```

---

## Part G — fail2ban (recommended)

```bash
sudo apt install -y fail2ban
# create /etc/fail2ban/jail.local + filters from the repo-root s_fail2ban.txt template
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

---

## Part H — Process supervision (systemd)

**Alwyzon** — `/etc/systemd/system/resomix-api.service`:

```ini
[Unit]
Description=Resomix Alwyzon API
After=network.target mariadb.service redis-server.service

[Service]
User=devuser
WorkingDirectory=/home/devuser/basic_fastapi_server_resomix
ExecStart=/home/devuser/basic_fastapi_server_resomix/.venv/bin/python run.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Media server** — `/etc/systemd/system/resomix-media.service`:

```ini
[Unit]
Description=Resomix Media/Similarity Server
After=network.target

[Service]
User=devuser
WorkingDirectory=/home/devuser/resomix-similarity-open
ExecStart=/home/devuser/resomix-similarity-open/.venv/bin/python run.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now resomix-api resomix-media
sudo systemctl status resomix-api resomix-media sftpgo
```

> Alwyzon's background workers (quota flush, webhook dispatch, cleanup) run via
> the same app/Celery setup — give them their own units if this box runs them.

---

## Part I — Final verification checklist

- [ ] `https://staging-bserver.resomix.com/api/v1/health` → `{"status":"healthy"}` over TLS.
- [ ] `https://staging-media.resomix.com/` responds over TLS.
- [ ] MariaDB: `SHOW TABLES;` lists core tables; `seed_rbac`/`seed_data` rows present.
- [ ] `HETZNER_INTERNAL_API_KEY` and `EDGE_JWT_SECRET` identical on both apps (Part E).
- [ ] Alwyzon `SIMILARITY_SERVER_URL` = `http://127.0.0.1:8004`; media reachable.
- [ ] SFTPGo: `sftpgo` service active; SFTP listening on `:2022`; Admin REST on `127.0.0.1:8090` only.
- [ ] SFTPGo auth hook → `:8001/internal/sftp/auth`; upload hook → `:8001/internal/sftp/event`.
- [ ] `/srv/sftp/partners` owned by the `sftpgo` user; `/srv/resomix/{partners,shared,audit_logs,audit_keys}` exist.
- [ ] Media `EMBED_SERVER` points at the dedicated GPU embedding server.
- [ ] ufw: only `22, 80, 443, 2022` open; `8001/8004/8090/3306/6379` are localhost-only.
- [ ] systemd units `enabled`; Certbot certs issued; `renew --dry-run` passes.
- [ ] fail2ban jails active.
- [ ] End-to-end: provision a test partner → SFTP login on `:2022` → upload + `.done` → ingest log opens.

At this point the full staging stack runs on one box, on an **empty, migrated
database**, with embedding generation delegated to the GPU server.

---

## Part J — Next: importing data (separate step)

This runbook stops before loading live data.

- **Full DR restore** (catastrophic recovery): follow [restore_runbook.md](restore_runbook.md).
- **Selective import** for staging: pull the relevant MariaDB table dumps from
  the Hetzner Storage Box into the already-migrated schema (re-run AUTO_INCREMENT
  fix-ups afterward), and sync the per-partner media assets into
  `/srv/resomix/partners` + the SFTP homes under `/srv/sftp/partners`. Embeddings
  are (re)generated by the GPU server; FAISS indexes are rebuilt per partner via
  the Alwyzon admin `rebuild-index` action.
