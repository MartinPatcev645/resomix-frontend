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

# audiowaveform — required by the media server's peaks/segment generation.
# Not in the default repos; install from the maintainer PPA (or a release .deb).
sudo add-apt-repository -y ppa:chris-needham/ppa
sudo apt update && sudo apt install -y audiowaveform
audiowaveform --version
# If the PPA has no build for this Ubuntu release, grab the .deb from
# https://github.com/bbc/audiowaveform/releases and: sudo apt install -y ./audiowaveform_*.deb

# ClamAV — used by BOTH apps:
#   • Alwyzon virus-scans every similarity/upload audio file (500 without the socket).
#   • Media virus-scans every ingestion file in the validation phase (ingestion v2),
#     when ANTIVIRUS_ENABLED=true in the media .env.
sudo apt install -y clamav clamav-daemon
sudo systemctl stop clamav-freshclam            # release the DB lock
sudo freshclam                                  # download the initial virus DB (a few min)
sudo systemctl enable --now clamav-freshclam    # keep the DB updated
sudo systemctl enable --now clamav-daemon       # starts clamd → creates /var/run/clamav/clamd.ctl
sudo usermod -aG clamav devuser                 # let the app user read the clamd socket
ls -l /var/run/clamav/clamd.ctl                 # confirm the socket exists
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
> `Key is already in use`. We clone **three** repos onto this box (Alwyzon, media,
> and the analysis add-on — see Part K), so we generate **three** keys and
> disambiguate them with `~/.ssh/config` host aliases.

```bash
git config --global user.name  "Resomix Deploy"
git config --global user.email "usman.naeem2212@gmail.com"

# One key per repo (no passphrase so unattended pulls/systemd never block):
ssh-keygen -t ed25519 -N "" -C "alwyzon@staging"  -f ~/.ssh/id_ed25519_alwyzon
ssh-keygen -t ed25519 -N "" -C "media@staging"    -f ~/.ssh/id_ed25519_media
ssh-keygen -t ed25519 -N "" -C "analysis@staging" -f ~/.ssh/id_ed25519_analysis

cat ~/.ssh/id_ed25519_alwyzon.pub    # → Deploy Key on basic_fastapi_server_resomix
cat ~/.ssh/id_ed25519_media.pub      # → Deploy Key on resomix-similarity-open
cat ~/.ssh/id_ed25519_analysis.pub   # → Deploy Key on resomix-analysis-service
```

Add **each** public key as a **read-only Deploy Key** on its **own** repo:

- `id_ed25519_alwyzon.pub`  → `Resomix/basic_fastapi_server_resomix` → Settings → Deploy keys
- `id_ed25519_media.pub`    → `Resomix/resomix-similarity-open` → Settings → Deploy keys
- `id_ed25519_analysis.pub` → `Resomix/resomix-analysis-service` → Settings → Deploy keys

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

Host github-analysis
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_analysis
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github-alwyzon    # → "Hi Resomix/basic_fastapi_server_resomix! ..."
ssh -T git@github-media      # → "Hi Resomix/resomix-similarity-open! ..."
ssh -T git@github-analysis   # → "Hi Resomix/resomix-analysis-service! ..."
```

> ⚠️ **Always clone/pull through the alias, not `github.com`.** A deploy key is
> scoped to ONE repo, so `git clone git@github.com:Resomix/<repo>.git` falls back
> to the default key (the first/other repo's key) and GitHub answers
> `ERROR: Repository not found` (it hides existence rather than saying "denied").
> Use the matching host alias instead, e.g.
> `git clone git@github-analysis:Resomix/resomix-analysis-service.git` — the clone
> then keeps that alias as `origin`, so later `git pull` uses the right key too.

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
# ⚠️ JSON array (NOT comma-separated) — pydantic parses List[str] as JSON.
# Include EVERY browser origin that calls the API: the user frontend AND the
# admin frontend. A missing origin → login preflight returns 400 "Disallowed CORS origin".
RESOMIX_ALLOWED_ORIGINS_PRODUCTION=["https://staging-admin.resomix.com","https://staging.resomix.com","https://resomix.com"]

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
# Max tracks embedded concurrently across ALL partner jobs (global cap on
# simultaneous EMBED_SERVER requests; 1 track = 1 GPU request). Higher = faster
# ingestion but more GPU/box load. Optional — defaults to 8 if unset.
MAX_CONCURRENT_EMBEDS=15

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

# ── Ingestion pipeline v2 — Celery + antivirus (worker unit in Part H) ─
# ⚠️ Single box: the media app shares the box Redis but uses its OWN db indices
#    (2/3) so its Celery tasks never collide with Alwyzon's Celery (db 0/1).
#    Production split: point these at the media box's own local Redis.
CELERY_BROKER_URL=redis://127.0.0.1:6379/2
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/3
MEDIA_REDIS_URL=redis://127.0.0.1:6379/2
# clamd installed in Part A1 → enable AV for the ingestion validation phase.
ANTIVIRUS_ENABLED=true                              # ⚠️ false on a box without clamd
CLAMD_SOCKET=/var/run/clamav/clamd.ctl
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

### D2. Align SFTP storage ownership (shared group)

`/srv/sftp` is written by **two** users: SFTPGo (runs as `sftpgo`) writes partner
uploads, and the **media server** (runs as `devuser`) *creates* each partner's
`<slug>/{test,live}` dirs + a `.slugmap` during provisioning and later *reads* the
uploads for ingestion. So both need read+write. Give them a shared group:

```bash
sudo chown -R sftpgo:sftpgo /srv/sftp
sudo usermod -aG sftpgo devuser     # media's user joins the sftpgo group
sudo chmod -R 2775 /srv/sftp        # group rwx + setgid → new dirs inherit the group
id sftpgo                            # sanity-check the group exists
```

> ⚠️ Without this, provisioning fails with
> `PermissionError: [Errno 13] Permission denied: '/srv/sftp/partners/<slug>'`.
>
> ⚠️ `usermod -aG` only applies to **new** login sessions — it does **not** affect
> a media process already running. Restart the media server in a fresh session
> (re-login, or `newgrp sftpgo`) so it picks up the group; the Part H systemd
> unit gets it automatically on (re)start.

> ⚠️ **Partner upload dirs must be group-writable (`2770`), not `750`.** The media
> provisioner creates `/srv/sftp/partners/<slug>/{test,live}` and `chmod`s them;
> with `750` the `sftpgo` group can't write and uploads fail with
> `dest open "...": Permission denied`. The provisioner sets `2770` (setgid +
> `rwxrwx---`) so SFTPGo (group `sftpgo`) can write while "other" stays denied
> (partners are also chrooted). If a partner was provisioned **before** that code
> fix, remediate its dirs once:
>
> ```bash
> sudo chown -R :sftpgo /srv/sftp/partners/<slug>
> sudo chmod -R 2770    /srv/sftp/partners/<slug>
> ```

#### Same model on the production Hetzner media box

This isn't staging-only. On the **production** two-server layout, SFTPGo and the
media server are **co-located on the Hetzner box**, so they share `/srv/sftp` there
too and need the identical setup. The load-bearing rule on **any** box where
SFTPGo + media coexist:

1. **One shared group** between the media service user and the SFTPGo runtime user
   (here: the media user joins `sftpgo`).
2. `/srv/sftp` **group-owned** by that group, **`2775` + setgid** so new dirs
   inherit the group.
3. Partner dirs **`2770`** (group-write) — the provisioner does this.
4. The media service runs as a **non-root** user (so its `chown 1000:1000` attempt
   no-ops and the group rules govern). Don't run media as root, or that chown would
   succeed and re-break group access.

> The `1000:1000` in the provisioner / the `uid:gid` in Alwyzon's SFTP auth hook are
> legacy from a **Docker** SFTPGo deployment (where SFTPGo ran as uid 1000). With a
> **native** SFTPGo (`.deb`, runs as `sftpgo`, non-root) those values are ignored —
> the shared **group** is what makes reads/writes work. Use native SFTPGo on
> production too for parity with this runbook; if you ever run SFTPGo in Docker
> instead, map the container to uid/gid `1000` and keep that uid in the shared group.

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
# 8090 (SFTPGo admin), 8001, 8004, 8010 (analysis, Part K) stay localhost-only — do NOT open them.
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
grep -h '^HETZNER_INTERNAL_API_KEY=' ~/usman/basic_fastapi_server_resomix/.env ~/usman/resomix-similarity-open/.env | sort -u | wc -l   # expect 1
grep -h '^EDGE_JWT_SECRET='          ~/usman/basic_fastapi_server_resomix/.env ~/usman/resomix-similarity-open/.env | sort -u | wc -l   # expect 1
```

A full end-to-end provisioning check (create partner in Alwyzon admin → SFTP
user appears in SFTPGo → connect with `sftp -P 2022 partner_<slug>@staging-media.resomix.com`)
is the final acceptance test — see the partner onboarding guide
([PARTNER_ONBOARDING.md](PARTNER_ONBOARDING.md)).

---

## Part F — nginx + TLS

### F0. DNS records (do this first)

All services share one box → every subdomain is an `A` record to the **same**
public IPv4 (find it with `curl -4 ifconfig.me`). Add `AAAA` too if the VPS has
IPv6. "Name" is just the label; the provider appends `.resomix.com`.

| Type | Name | Value | Notes |
|------|------|-------|-------|
| `A` | `staging-bserver` | `<SERVER_PUBLIC_IPV4>` | Alwyzon (→ nginx → 8001) |
| `A` | `staging-media` | `<SERVER_PUBLIC_IPV4>` | media HTTPS (→ 8004) **and** SFTP host (`:2022`) |
| `A` | `staging-analysis` | `<SERVER_PUBLIC_IPV4>` | analysis service (→ nginx → 8010); only if deploying Part K |
| `A` | `staging-sftp-admin` | `<SERVER_PUBLIC_IPV4>` | only if exposing the admin (F-d) |

> ⚠️ **Cloudflare users — set these to "DNS only" (grey cloud) for staging.**
> Partners reach `staging-media.resomix.com:2022` over raw SSH/SFTP; Cloudflare's
> proxy forwards only HTTP/HTTPS ports, so a proxied (orange) record kills SFTP.
> Grey cloud also keeps Certbot HTTP-01 simple and lets nginx see the real client
> IP as `$remote_addr` (so `EDGE_VERIFY_IP=true` works without CF real-IP config).

### F1. Install nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx apache2-utils
```

### F2. HTTP-level rate-limit + CORS layer

Write `/etc/nginx/conf.d/ratelimits_realip.conf`. This defines the shared
rate-limit zones and the browser-CORS allowlist used by the vhosts. The
Cloudflare real-IP block is **commented out** — uncomment it **only** if you put
the records behind the Cloudflare proxy (orange cloud); on a grey-cloud/direct
staging box, trusting `CF-Connecting-IP` would let clients spoof their IP.

```bash
sudo tee /etc/nginx/conf.d/ratelimits_realip.conf >/dev/null <<'EOF'
# ── Rate-limit / connection zones (per client IP) ──────────────────────
limit_req_zone  $binary_remote_addr zone=api_rl:10m      rate=3r/s;    # API/search
limit_req_zone  $binary_remote_addr zone=media_rl:10m    rate=25r/s;   # HLS/segments (bursty)
limit_req_zone  $binary_remote_addr zone=analysis_rl:10m rate=2r/s;    # analysis API (Part K); upload + status polling
limit_req_zone  $binary_remote_addr zone=global_rl:10m   rate=5r/s;    # catch-all
limit_req_zone  $binary_remote_addr zone=admin_rl:2m   rate=10r/m;   # admin (strict)
limit_conn_zone $binary_remote_addr zone=perip_conn:10m;
limit_req_status 429;

# ── Browser CORS allowlist (FastAPI still sets CORS on proxied 2xx) ─────
map $http_origin $cors_allow_origin {
    default "";
    "~^https://([\w\-]+\.)*resomix\.com$" $http_origin;
    # Dev only — remove in a locked-down prod:
    "~^http://localhost:517[2-5]$"        $http_origin;
}

# ── Cloudflare real-IP — UNCOMMENT ONLY IF PROXYING THROUGH CLOUDFLARE ──
# real_ip_header CF-Connecting-IP;
# real_ip_recursive on;
# set_real_ip_from 173.245.48.0/20;
# set_real_ip_from 103.21.244.0/22;
# set_real_ip_from 103.22.200.0/22;
# set_real_ip_from 103.31.4.0/22;
# set_real_ip_from 141.101.64.0/18;
# set_real_ip_from 108.162.192.0/18;
# set_real_ip_from 190.93.240.0/20;
# set_real_ip_from 188.114.96.0/20;
# set_real_ip_from 197.234.240.0/22;
# set_real_ip_from 198.41.128.0/17;
# set_real_ip_from 162.158.0.0/15;
# set_real_ip_from 104.16.0.0/13;
# set_real_ip_from 104.24.0.0/14;
# set_real_ip_from 172.64.0.0/13;
# set_real_ip_from 131.0.72.0/22;
# set_real_ip_from 2400:cb00::/32;
# set_real_ip_from 2606:4700::/32;
# set_real_ip_from 2803:f800::/32;
# set_real_ip_from 2405:b500::/32;
# set_real_ip_from 2405:8100::/32;
# set_real_ip_from 2a06:98c0::/29;
# set_real_ip_from 2c0f:f248::/32;
EOF
```

### F3. Alwyzon vhost

Write `/etc/nginx/sites-available/staging-bserver` (plain HTTP for now — Certbot
in F6 rewrites it to add the 443 block and the HTTP→HTTPS redirect):

```bash
sudo tee /etc/nginx/sites-available/staging-bserver >/dev/null <<'EOF'
server {
    listen 80;
    server_name staging-bserver.resomix.com;
    client_max_body_size 105M;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer-when-downgrade always;

    # Global safety-net limits
    limit_req  zone=global_rl burst=10;
    limit_conn perip_conn 30;

    # Tighter limits on API-ish paths
    location ~ ^/(api|search|upload|v1|v2)/ {
        limit_req  zone=api_rl burst=10 nodelay;
        limit_conn perip_conn 20;
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF
```

### F4. Media vhost

Write `/etc/nginx/sites-available/staging-media`:

```bash
sudo tee /etc/nginx/sites-available/staging-media >/dev/null <<'EOF'
server {
    listen 80;
    server_name staging-media.resomix.com;
    client_max_body_size 105M;           # large audio uploads / range requests

    add_header X-Content-Type-Options nosniff always;

    location / {
        # generous limit — HLS playback fires many small segment requests
        limit_req  zone=media_rl burst=50 nodelay;
        limit_conn perip_conn 40;
        proxy_pass http://127.0.0.1:8004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;             # streaming media / HLS
        proxy_request_buffering off;     # stream large uploads through, don't spool
        proxy_read_timeout 300s;         # long media / embedding calls
        proxy_send_timeout 300s;
    }
}
EOF
```

### F5. (Optional) SFTPGo admin vhost

> **Preferred: skip this and use an SSH tunnel** — `ssh -L 8090:127.0.0.1:8090
> devuser@<SERVER>`, then browse `http://localhost:8090`. Zero public exposure;
> no DNS record or cert needed. Only create the vhost below if you need remote
> browser access. Keep the DNS record **grey-cloud** so the IP allowlist sees
> real IPs.

```bash
# basic-auth credential file (you'll be prompted for a password):
sudo htpasswd -c /etc/nginx/.sftpgo_admin_htpasswd <admin-username>

sudo tee /etc/nginx/sites-available/staging-sftp-admin >/dev/null <<'EOF'
server {
    listen 80;
    server_name staging-sftp-admin.resomix.com;
    allow <YOUR_ADMIN_IP>;               # your fixed IP; everyone else denied
    deny  all;
    location / {
        limit_req zone=admin_rl burst=5 nodelay;
        auth_basic "SFTPGo Admin";
        auth_basic_user_file /etc/nginx/.sftpgo_admin_htpasswd;
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

### F5b. Developer docs (api-docs) — static SPA

The `resomix_docs` site is a Vite/React **single-page app** with clean path-based
URLs (no `#`). That means nginx must serve `index.html` for any unknown path
(`/playground`, `/api-ref`, `/quickstart`, …) so the client router can take over —
otherwise a direct hit or refresh on a deep link 404s. The `try_files … /index.html`
line below is what makes the clean URLs work; do not omit it.

```bash
# Build the SPA (on the build box or here) and publish the static output:
#   cd resomix_docs && npm ci && npm run build      # produces ./dist
sudo mkdir -p /var/www/api-docs
sudo rsync -a --delete /path/to/resomix_docs/dist/ /var/www/api-docs/
sudo chown -R www-data:www-data /var/www/api-docs

sudo tee /etc/nginx/sites-available/api-docs >/dev/null <<'EOF'
server {
    listen 80;
    server_name api-docs.resomix.com;
    root /var/www/api-docs;
    index index.html;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer-when-downgrade always;

    # Long-cache fingerprinted assets; never cache the HTML shell.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location = /index.html { add_header Cache-Control "no-cache"; }

    # SPA fallback — REQUIRED for clean (hash-less) URLs. sitemap.xml / robots.txt
    # are real files in dist/ and are served directly before this fallback.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### F6. Enable vhosts + issue certificates

```bash
sudo ln -s /etc/nginx/sites-available/staging-bserver /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/staging-media   /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api-docs        /etc/nginx/sites-enabled/
# sudo ln -s /etc/nginx/sites-available/staging-sftp-admin /etc/nginx/sites-enabled/   # only if F5

# (optional) drop nginx's default welcome site so it doesn't shadow your vhosts
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx

# Certbot rewrites each vhost to add the 443 block + HTTP→HTTPS redirect.
sudo certbot --nginx -d staging-bserver.resomix.com -d staging-media.resomix.com -d api-docs.resomix.com
# add  -d staging-sftp-admin.resomix.com  to the line above if you enabled F5

sudo certbot renew --dry-run        # confirm auto-renewal works
```

---

## Part G — fail2ban (recommended)

Bans IPs that probe/scan over HTTP. All filters read nginx's access log.

### G1. Install

```bash
sudo apt install -y fail2ban
```

### G2. Jails — `/etc/fail2ban/jail.local`

```bash
sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 10
backend  = auto
# (optional) ignoreip = 127.0.0.1/8 ::1 <YOUR_ADMIN_IP>

[nginx-4xx-5xx]
enabled  = true
filter   = nginx-4xx-5xx
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 40
findtime = 2m
bantime  = 2h

[nginx-admin-abuse]
enabled  = true
filter   = nginx-admin-abuse
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 6
findtime = 5m
bantime  = 12h

[nginx-404]
enabled  = true
filter   = nginx-404
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 25
findtime = 3m
bantime  = 3h

[recidive]
enabled  = true
logpath  = /var/log/fail2ban.log
findtime = 1d
bantime  = 7d
maxretry = 5
EOF
```

### G3. Filters — `/etc/fail2ban/filter.d/*.conf`

```bash
sudo tee /etc/fail2ban/filter.d/nginx-4xx-5xx.conf >/dev/null <<'EOF'
[Definition]
failregex = ^<HOST> - - .*"[^"]*" (4\d\d|5\d\d) \d+ "[^"]*"
ignoreregex =
EOF

sudo tee /etc/fail2ban/filter.d/nginx-admin-abuse.conf >/dev/null <<'EOF'
[Definition]
failregex = ^<HOST> - - .*"GET /(?:admin|r-admin|login|wp-login\.php)[^"]*" (404|401|403) \d+ "[^"]*"
ignoreregex =
EOF

sudo tee /etc/fail2ban/filter.d/nginx-404.conf >/dev/null <<'EOF'
[Definition]
failregex = ^<HOST> - - .*"[^"]*" 404 \d+ "[^"]*"
ignoreregex = robots\.txt|favicon\.ico
EOF
```

### G4. Start + verify

```bash
sudo touch /var/log/fail2ban.log
sudo fail2ban-client -t                 # config test
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status             # lists the active jails
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

**Media Celery worker** (ingestion v2 — durable validate/move/transcode/embed) —
`/etc/systemd/system/resomix-media-worker.service`:

```ini
[Unit]
Description=Resomix Media Celery Worker (ingestion pipeline)
After=network.target redis-server.service
Requires=redis-server.service

[Service]
User=devuser
WorkingDirectory=/home/devuser/resomix-similarity-open
ExecStart=/home/devuser/resomix-similarity-open/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now resomix-api resomix-media resomix-media-worker
sudo systemctl status resomix-api resomix-media resomix-media-worker sftpgo
# Verify the worker is wired to its broker:
cd /home/devuser/resomix-similarity-open && \
  .venv/bin/python -c "from app.tasks.celery_app import ping; print(ping.delay().get(timeout=10))"   # → pong
```

> The media worker shares the box Redis but uses its own db indices (`/2`,`/3`,
> see Part C `.env`), so it never collides with Alwyzon's Celery (`/0`,`/1`).
> In the production split it runs on the media box against that box's own Redis.

> Alwyzon's background workers (quota flush, webhook dispatch, cleanup) run via
> the same app/Celery setup — give them their own units if this box runs them.

---

## Part I — Final verification checklist

- [ ] `https://staging-bserver.resomix.com/api/v1/health` → `{"status":"healthy"}` over TLS.
- [ ] `https://staging-media.resomix.com/` responds over TLS.
- [ ] *(if Part K)* `https://staging-analysis.resomix.com/health` over TLS; Celery worker up (a test upload reaches `succeeded`); analysis Redis on its **own** db (`/4`), not `/1`.
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

### J1. Global open-tracks catalog (optional)

On first media-server start you'll see a **non-fatal** error if the global
open-tracks FAISS index is absent:

```
ERROR ... could not open /srv/resomix/data/embeddings/maest_index.index ... No such file or directory
```

The `except` in `lifespan` swallows it, so uvicorn still binds 8004 — but the
steps after `similarity_service.preload()` (e.g. monthly-pipeline init) are
skipped, and the **global** similarity catalog is unavailable. **Partner-scoped
flows do not need this** (per-partner indexes are built at ingestion).

To load the global catalog, copy these into `/srv/resomix/data/embeddings/`
(owned by `devuser`, so scp lands directly). Required: `maest_index.index` +
`maest_catalog.json`. Optional: the Discogs pair + the `maest/` `discogs/`
full-vector dirs.

```bash
# from a host that has the files (e.g. your workstation):
scp -P <SSH_PORT> maest_index.index maest_catalog.json \
    devuser@<SERVER>:/srv/resomix/data/embeddings/
```

> Heads-up — **`audiowaveform`** (Part A) must be installed for peaks/segment
> generation; without it the media log warns `audiowaveform not found - peaks
> generation will fail`, and `similarity_playback` partners can't produce peaks.

---

## Part K — Analysis service (add-on)

The **analysis service** (`resomix-analysis-service`, port **8010**) is an optional,
later add-on to the base A–J box. It serves on-demand full-track analysis (tempo,
key, loudness, spectral/energy curves, semantic labels) behind an async
**upload → poll → result** API. Like the media server it is **CPU-only** here —
every model/embedding call is delegated to the GPU embedding server
(`maest-discogs-ccreplica`). Skip this whole part if the box doesn't run analysis.

> ⚠️ **Hard dependency:** the semantic/composition stages call the embedding
> server's newer endpoints (`/get_analysis_bundle`, `/get_semantics`, `/get_affect`,
> `/separate_stems`). Until the GPU box serves those, analyses still complete — but
> the semantic/composition sections come back `partial`. Local DSP ("part 1":
> tempo/key/loudness/spectral/energy/structure) works regardless. Confirm with:
> `curl -F file=@track.mp3 http://<GPU_EMBED_IP>:8005/get_analysis_bundle`.

### K1. Clone + venv + deps

```bash
cd /home/devuser
git clone git@github-analysis:Resomix/resomix-analysis-service.git   # ⚠️ the ALIAS, not github.com (see A3)
cd resomix-analysis-service

python3 -m venv .venv           # CPU-only, light deps — the box Python 3.12 (A4) is fine
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
mkdir -p var/work var/results   # local filesystem store (v1)
```

### K2. Configure `.env`

```bash
cp .env.example .env
```

```dotenv
RESOMIX_ENV=staging
RESOMIX_API_HOST=0.0.0.0
RESOMIX_API_PORT=8010

# ⚠️ Redis db allocation on the shared box: Alwyzon = 0/1, media = 2/3 → analysis takes /4.
#    (.env.example ships /1, which COLLIDES with Alwyzon — change it.)
RESOMIX_REDIS_URL=redis://127.0.0.1:6379/4

# The dedicated GPU embedding server (the same box the media server's EMBED_SERVER points at).
RESOMIX_EMBEDDING_BASE_URL=http://<GPU_EMBED_IP>:8005

# Lock CORS to the browser origins that call it directly (comma-separated here, NOT JSON).
# Leave the default "*" if only the Alwyzon backend calls it server-to-server.
RESOMIX_CORS_ALLOW_ORIGINS=https://staging.resomix.com,https://staging-frontend.resomix.com
```

> Storage (`RESOMIX_WORK_DIR` / `RESOMIX_RESULTS_DIR`) defaults to `./var/...` under
> the repo — fine for staging. The GPU-response cache (`./var/gpu_cache`) reuses
> embedding-server responses across repeat analyses; delete a track's folder to
> invalidate after a GPU change.

### K3. nginx vhost (:8010) + TLS

The `analysis_rl` zone is declared once in **F2** (add it there if you skipped
ahead). Then the vhost:

```bash
sudo tee /etc/nginx/sites-available/staging-analysis >/dev/null <<'EOF'
server {
    listen 80;
    server_name staging-analysis.resomix.com;
    client_max_body_size 105M;           # audio uploads up to RESOMIX_MAX_UPLOAD_MB

    add_header X-Content-Type-Options nosniff always;

    location / {
        limit_req  zone=analysis_rl burst=50 nodelay;   # upload + status polling
        limit_conn perip_conn 40;
        proxy_pass http://127.0.0.1:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;     # stream large uploads through, don't spool
        proxy_read_timeout 300s;         # long embedding-server calls
        proxy_send_timeout 300s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/staging-analysis /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging-analysis.resomix.com   # adds the 443 block + HTTP→HTTPS redirect
```

> Cloudflare: if the `staging-analysis` record is proxied (orange), temporarily set
> it to **DNS only** for the HTTP-01 challenge, then re-proxy; keep SSL mode **Full
> (strict)** to match the real origin cert (as with the other vhosts).

### K4. Run it — systemd (single unit; the launcher supervises the worker)

`run_analysis.py` starts uvicorn **and** spawns the Celery worker as a supervised
child (in its own process group), tearing it down on shutdown — so **one** unit
runs the whole service. `RESOMIX_ENV=staging` turns autoreload off automatically.

`/etc/systemd/system/resomix-analysis.service`:

```ini
[Unit]
Description=Resomix Analysis Service (API + supervised Celery worker)
After=network.target redis-server.service
Requires=redis-server.service

[Service]
User=devuser
WorkingDirectory=/home/devuser/resomix-analysis-service
ExecStart=/home/devuser/resomix-analysis-service/.venv/bin/python run_analysis.py
Restart=on-failure
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now resomix-analysis
sudo systemctl status resomix-analysis
```

> `KillSignal=SIGTERM` matters: the launcher only forwards a graceful stop to the
> worker on SIGTERM. **Never stop it with `kill -9`** (SIGKILL can't be caught → the
> worker is orphaned). Same for the manual quick-start below.

**Manual quick-start (no systemd):**

```bash
cd /home/devuser/resomix-analysis-service && source .venv/bin/activate
nohup python run_analysis.py > analysis.out 2>&1 &   # API + worker together; stop with `kill <pid>` (SIGTERM)
```

**Prefer separate API and worker processes?** Set `RESOMIX_EMBED_WORKER=0` (the
launcher then runs the API only) and add a second unit:
`ExecStart=…/.venv/bin/celery -A app.workers.celery_app.celery_app worker --loglevel=INFO --concurrency=2`.

### K5. Verify

```bash
curl -s http://127.0.0.1:8010/health                    # app up locally
curl -s https://staging-analysis.resomix.com/health     # nginx + TLS + Cloudflare
# full async flow (upload -> poll -> result):
.venv/bin/python scripts/analyze_client.py audio/prelisten.mp3 --out result.json
```

- `8010` stays **localhost-only** in ufw (nginx is the only public door) — like 8001/8004.
- Job stuck at `queued` → the **worker isn't running** (check the unit /
  `RESOMIX_EMBED_WORKER`). Reaches `succeeded` but semantic/composition sections are
  empty/`partial` → the **GPU embedding endpoints aren't deployed** yet (top callout).
