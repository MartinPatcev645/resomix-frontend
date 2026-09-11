# Fresh Staging Server Bring-Up Runbook — Single Box (Alwyzon + Media + SFTPGo)

**What this is:** a step-by-step procedure to stand up a **complete Resomix
staging environment on one clean VPS, from scratch**, with a **fresh empty
database** — no restore-from-backup. In production these run on two separate
servers; for staging we co-locate **all three services on a single box**:

| Service | Repo | Local bind | Public URL |
|---|---|---|---|
| **Alwyzon** control-plane (API, MariaDB, auth, billing) | `basic_fastapi_server_resomix` | `127.0.0.1:8001` | `https://staging-bserver.resomix.com` |
| **Media / similarity** server (FAISS, audio/peaks/segments/HLS, deletion proof) | `resomix-similarity-open` | `127.0.0.1:8002` | `https://staging-media.resomix.com` |
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

> **Port map:** Alwyzon `8001`, Media **`8002`** (not 8004, issue 97), Analysis
> `8010`, SFTPGo SFTP `2022`, SFTPGo Admin `8090` (localhost only), MariaDB
> `3306`, Redis `6379`.

---

## Read first: corrected 2026-09-11 from a real two-box rebuild

This runbook was written for one box and an empty database. In September 2026 it
was used to rebuild production onto **two** boxes **from backup** (the DR drill,
`server-backups/docs/PHASE-8.md`), and the rebuild found the defects below. Each
is now corrected in place, at the step it belongs to; this table is the index.
Issue numbers refer to `server-backups/docs/PROGRESS.md`.

**Two-box split** (production's layout, and the recovery layout):

| Box | Runbook parts | Hardware |
|---|---|---|
| **Alwyzon** (box A) | A, B (restore: **no seed**), F (bserver vhost), G, H (Alwyzon unit), L | **4 GB RAM minimum, 8 GB comfortable.** At 1.9 GB MariaDB, the app, two Celery workers and clamd leave 231 MB, and Elasticsearch needs a 1 GB heap on top. Production: 16 GB. *The staging box A stays at about 2 GB by decision (2026-09-11): no Elasticsearch, clamd kept on, 4 GB swap mandatory, large uploads a known limit (`server-backups/docs/CLOSEOUT.md` Part 3)* |
| **Media** (box B) | A, C, D, K, F (media + analysis vhosts), G, H (media unit), L | **24 GB RAM minimum, 32 GB recommended** (issue 106). Partner 1's FAISS indexes are HNSW graphs that must be fully resident; a 7.8 GB box OOM-kills the service on every similarity query while looking healthy between them. Production: 64 GB |

On two boxes every `127.0.0.1` URL that names the *other* service becomes that
box's address. **For a recovery from backup, the `.env` files come from the
restored secrets bundle, not from the blocks in B3, C3 and K2**; those blocks are
the reference for a fresh build and for checking a restored file.

**Production, as recorded by `server-backups/bin/box_manifest.py` on 2026-09-11**
(`server-backups/manifests/`): Alwyzon on Ubuntu 22.04, Python **3.10.12**,
MariaDB **10.6.23**, Redis 6.0, Elasticsearch **8.19.21** (2 GB heap, alias
`tracks_search`, 1,980,421 documents). Media on Ubuntu 24.04, media venv Python
**3.10.14** (numpy 2.2.6, faiss-cpu 1.14.3), analysis venv Python **3.12.3**,
SFTPGo 2.6.4, Redis 7.0. A rebuilt box is judged by comparing its manifest with
these (Part I).

| # | Step | Correction | Why |
|---|---|---|---|
| 1 | Intro, B3, C3, C4, D5, E, F4, I | media port **8002**, not 8004 | production's `PORT=8002`; the rebuilt box A could never have reached box B (issue 97) |
| 2 | A1 | add `liblzma-dev uuid-dev libgdbm-compat-dev libncursesw5-dev` | without `liblzma-dev` CPython builds with no `_lzma`, and says so only in a line that scrolls past (issue 91) |
| 3 | A1 | ClamAV is **required** on Alwyzon, never disabled to save memory | similarity and cover uploads fail **open** without it (issue 117); a clamd that answers PONG may still be unable to scan (118) |
| 4 | A1 | 4 GB swapfile on any box under 8 GB | the 3.5 GiB database dump does not load on 1.9 GB without it |
| 5 | A2 | the service user is `alwyzon` on Alwyzon and `ubuntu` on media | `devuser` throughout is a substitution |
| 6 | A3 | each box needs only its own repos' keys, **plus `server-backups`** | the recovery tooling is a private repo a blank box cannot clone (issue 63) |
| 7 | A4 | match production's Pythons; `make -j2` on small boxes; build in tmux | parallel CPython compiles OOM a 1.9 GB box; the build is 30 to 60 min with PGO |
| 8 | A4 | verify the build with an import check, not by reading warnings | the `_lzma` omission above was caught only this way |
| 9 | A5 | **six** shared secrets, generated once, copied by file, verified by fingerprint | a secret generated twice fails as a 401 the caller swallows (issue 116); a pasted value picks up a blank line |
| 10 | B2 | MariaDB **10.6.x** | production is 10.6, not the "11.3+" another doc claims; match the version rather than guess, since a mismatch fails partway through a load (issue 46) |
| 11 | B3 | `HLS_MEDIA_BASE_URL` ends in **`/signed-audio/`** | the app appends `/hls-m3u8/`; without the suffix no upload plays and the error names neither URL nor status (issue 105) |
| 12 | B3 | `RESOMIX_ENV=production` on staging too | it only sets the guest cookie's `secure` flag; any other value makes it non-secure over HTTPS |
| 13 | B3 | staging CORS origins **only** | as written, the production frontend could make credentialed calls to the staging API |
| 14 | B3 | `SMTP_FROM_EMAIL` never blank, never a reserved TLD | `fastapi-mail` validates the format at import; blank crashes the app, `.invalid`/`.test` are refused |
| 15 | B3 | `HETZNER_SFTP_PROVISION_URL` and `SIMILARITY_SERVER_URL` name the **media box** | `127.0.0.1:8004` is wrong on both host and port once the services split (Flow 0) |
| 16 | B4 | restore: `alembic current` and `heads` first, then `upgrade head`, **never seed** | seeding writes on top of production's rows; an empty `alembic_version` would replay every migration |
| 17 | B5, H | Alwyzon runs **`run_alwyzon.py`**, unit **`alwyzon.service`** | there is no `run.py`. `run_alwyzon.py` starts uvicorn **and both Celery workers**; running uvicorn alone accepted uploads and never processed one (issues 94, 113) |
| 18 | C1 | media venv on the Python production uses (3.10), analysis on 3.12 | the `numpy==1.24.3` / `faiss-cpu==1.7.4` pins that forced 3.11 are gone: `requirements.txt` now has `faiss-cpu==1.14.3` and unpinned numpy, which resolves to 2.2.6 on 3.10, exactly production's |
| 19 | D2 | the media service user owns `.partner_slugs.json` and is in group `sftpgo`; the restored tree is `chown`ed to `sftpgo` | otherwise similarity returns "success" with zero results forever (issues 99, 102, 104) |
| 20 | D2, J | restart the media service **after** the partner tree is in place and after any ownership fix | a failed slug-map read is cached against the file's mtime, and `chown` does not change it (issue 103) |
| 21 | D4 | hooks name the Alwyzon box, and Alwyzon's firewall admits the media box on 8001 | on one box they were loopback |
| 22 | D5 | two-box firewall rules; the SSH rule in the same command as `enable` | 8002 open to box A and the GPU only; never lock yourself out |
| 23 | E, I | verify with `box_manifest.py`, not `systemctl is-active` | every September fault had an active unit and a healthy `/health` (113, 115, 116, 118) |
| 24 | F6 | one certificate per box, for that box's names only | a name that resolves to the other box fails the whole certbot run |
| 25 | G | `[sshd]` jail on; `ignoreip` holds the other box and the GPU; filters before jails | box B trips `nginx-4xx-5xx` and bans itself from the control plane |
| 26 | K4 | analysis unit needs `KillMode=mixed` | it spawns its own Celery; the default leaves the worker behind on stop |
| 27 | I | public reachability checked from a machine **outside** both boxes | a box's own `curl` returned 200 for forty minutes while nothing outside could connect (issue 108) |
| 28 | J | a real recovery follows `server-backups`, not `restore_runbook.md` | that file describes a Docker `mariabackup`/cron/rsync system that does not exist |
| 29 | K1, K2 | analysis on Python 3.12; `RESOMIX_EMBEDDING_BASE_URL` on GPU port **8015**; durable `RESOMIX_RESULTS_DIR` | 8005 serves embeddings only, so analysis endpoints 404; `./var/results` is wiped on redeploy (issue 47) |
| 30 | L (new) | a recovered box runs its own backups, backup agent and WireGuard link | a box that does not back itself up is not recovered |
| 31 | B3 | on **staging**, `WATCHDOG_BACKUP_ENABLED=false` | staging never backs up, so the backup watchdog would email support@ a stale-backup alarm every 12 h from production's restored `.env` over real SMTP |
| 32 | A4 | with the system Python, install **`python3.10-dev python3.10-venv`** on both boxes | a source build ships `Python.h`, the system Python does not: the `mariadb` wheel fails with `Python.h: No such file or directory` (issue 142, second drill) |

**Long operations run in tmux** (a dump load, a Python build, a 4.8M-inode
`chown`), and every session follows `server-backups` D80, both halves:

- `set -g history-limit 200000` in `~/.tmux.conf`, **set when the box is built**
  (A1 does it), not when tmux is first needed. The default 2,000 lines lost the
  first drill's build warnings, and tmux has no terminal scrollback.
- **Start every session logged, never bare**, and state the log path in any
  instruction that uses it:
  `tmux new -s NAME \; pipe-pane -o 'cat >> ~/tmux-NAME.log'`, then read it
  from any shell with `tail -f ~/tmux-NAME.log`. It survives the session.

---

## Part A — Shared base (do once)

These steps prepare the box for **both** Python apps.

### A1. System update + build dependencies + media tools

On any box under 8 GB RAM, add swap **first** (correction 4):

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab && free -h
```

```bash
sudo apt update && sudo apt upgrade -y
# liblzma-dev, uuid-dev, libgdbm-compat-dev, libncursesw5-dev: without them a
# source-built CPython silently lacks _lzma/_uuid/_dbm/curses (correction 2).
sudo apt install -y \
  build-essential zlib1g-dev libncurses5-dev libncursesw5-dev libgdbm-dev \
  libgdbm-compat-dev libnss3-dev liblzma-dev uuid-dev \
  libssl-dev libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev bzip2 \
  git curl pkg-config ffmpeg tmux \
  libmariadb-dev libmariadb-dev-compat
printf 'set -g history-limit 200000\n' >> ~/.tmux.conf
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

# ClamAV: used by BOTH apps, and REQUIRED on Alwyzon (correction 3):
#   • Alwyzon virus-scans every similarity/upload audio file. Two code paths with
#     opposite failure behaviour: the analysis upload refuses when clamd is
#     down, but the similarity and cover uploads ACCEPT UNSCANNED FILES (issue
#     117). Never disable clamd to save memory; size the box instead.
#   • Media virus-scans every ingestion file in the validation phase (ingestion v2),
#     when ANTIVIRUS_ENABLED=true in the media .env.
#   • `clamdscan --ping` / PONG does NOT prove it can scan (issue 118). Part I's
#     box_manifest streams a real kilobyte through it.
sudo apt install -y clamav clamav-daemon
sudo systemctl stop clamav-freshclam            # release the DB lock
sudo freshclam                                  # download the initial virus DB (a few min)
sudo systemctl enable --now clamav-freshclam    # keep the DB updated
sudo systemctl enable --now clamav-daemon       # starts clamd → creates /var/run/clamav/clamd.ctl
sudo usermod -aG clamav devuser                 # let the app user read the clamd socket
ls -l /var/run/clamav/clamd.ctl                 # confirm the socket exists
```

### A2. Non-root service user

> **Correction 5.** Production's service user is **`alwyzon`** on the Alwyzon box
> and **`ubuntu`** on the media box, with code under `~/usman/<repo>`. Every
> `devuser` in this runbook stands for that user; on a recovery, use production's
> names so restored paths and ownership line up.

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
>
> **Correction 6, two boxes:** the Alwyzon box needs only the `alwyzon` key; the
> media box needs `media` and `analysis`. **Both** also need a fourth key, on
> `Resomix/server-backups` (host alias `github-backups`): a recovery starts by
> cloning it, and a blank box cannot reach a private repo without its own key
> (issue 63).

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

> **Correction 7, superseding the note below: match production's interpreters,
> and build nothing you do not need.** Production (manifest, 2026-09-11):
> Alwyzon venv **3.10.12**, media venv **3.10.14**, analysis venv **3.12.3**. On
> Ubuntu 22.04 the system `python3` *is* 3.10, so the Alwyzon and media venvs
> need no source build at all, and 3.12 for analysis comes from
> `ppa:deadsnakes/ppa` (`python3.12 python3.12-venv python3.12-dev`) in seconds.
> **Correction 32:** the system 3.10 needs its headers too,
> `sudo apt install -y python3.10-dev python3.10-venv`, or `pip install -r
> requirements.txt` fails building the `mariadb` wheel (`Python.h: No such file or
> directory`, issue 142). A source build ships the headers, which is why the first
> drill never saw this.
> The 3.11 requirement below is obsolete: the media pins that forced it are gone.
> If you do build from source: in tmux, `make -j2` on a box under 4 GB (each
> parallel compile holds a few hundred MB), and drop `--enable-optimizations` on
> staging (the 3.12 build on box A took about 90 s without it; PGO makes it 30 to
> 60 min). Then **prove the build** rather
> than reading its warnings (correction 8):
>
> ```bash
> python3.12 -c "import ssl, ctypes, sqlite3, zlib, lzma, bz2, readline, hashlib, decimal, uuid, curses, _gdbm"
> ```
>
> `_tkinter` is the only module allowed to be missing on a server.
>
> *Original note, kept for the record:*
>
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

> **Correction 9.** There are **six** cross-service secrets, not two, and each
> must be byte-identical on every holder:
>
> | Secret | Held by |
> |---|---|
> | `EDGE_JWT_SECRET` | Alwyzon, media, and analysis as **`RESOMIX_EDGE_JWT_SECRET`** |
> | `HETZNER_INTERNAL_API_KEY` | Alwyzon, media |
> | `PREVIEW_HMAC_SECRET`, `PREVIEW_FERNET_SECRET` | Alwyzon, media |
> | `ANALYSIS_INTERNAL_API_KEY` | Alwyzon, and analysis as **`RESOMIX_INTERNAL_API_KEY`** |
> | `BACKUP_AGENT_TOKEN` | Alwyzon's `.env`, and `server-backups/config/backup.env` on both boxes |
>
> **On a recovery, generate none of them**: the restored `.env` files carry
> production's. On a fresh build, generate each **once**, on one box, and copy the
> file to the other; never generate a second copy "to match" (issue 116: it fails
> as a 401 the caller swallows). A pasted value picks up blank lines, so strip them
> (`grep -v '^[[:space:]]*$'`). Part I verifies all six by fingerprint across both
> boxes without printing any.

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

> **Correction 10.** Install **MariaDB 10.6.x** to match production (10.6.23;
> Ubuntu 22.04's default is already 10.6). **On a recovery** the names are
> production's, not the ones below: database **`resomix_prod`**, user
> **`resomix_user`**, both created by the restore. On staging, then rotate that
> user's password so production's stops living on the box:
> `ALTER USER 'resomix_user'@'localhost' IDENTIFIED BY '<new>'` and the same for
> `'resomix_user'@'127.0.0.1'`, then `FLUSH PRIVILEGES`.

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

> **On a recovery, do not write this file**: restore it (it is in the secrets
> bundle) and use this block only to check it. **On staging built from a restore**,
> start from the restored file and override, never the reverse: it holds live
> Stripe and live SMTP, and `JWT_SECRET_KEY` **must** be rotated or a staging
> token is valid in production (`server-backups/docs/STAGING-HANDOVER.md` §2).
> "Blank what you do not need" is not always safe: use inert but well-formed
> values where the app validates at import (correction 14).
>
> Corrected lines in the block, by number from the table at the top: 11
> (`HLS_MEDIA_BASE_URL`), 12 (`RESOMIX_ENV`), 13 (CORS), 14
> (`SMTP_FROM_EMAIL`), 15 (the two media URLs). Added: the analysis and backup
> control-plane keys production has and this block lacked.

```bash
# ── MongoDB (external Atlas) ────────────────────────────────────────
MONGODB_URI=<your mongodb+srv URI>

# ── External services (single box) ──────────────────────────────────
SIMILARITY_SERVER_URL=http://<MEDIA_BOX_IP>:8002   # ⚠️ corr. 15: the media box, port 8002 (single box: http://127.0.0.1:8002; production: https://media.resomix.com)
RESOMIX_SERVER_URL=http://127.0.0.1:8001           # ⚠️ self, internal
PUBLIC_ALWYZON_URL=https://staging-bserver.resomix.com   # ⚠️ public (needs nginx)
HLS_MEDIA_BASE_URL=https://staging-media.resomix.com/signed-audio/   # ⚠️ corr. 11: the /signed-audio/ suffix is part of the value
RESOMIX_ENV=production                             # ⚠️ corr. 12: production on staging too (only sets the guest cookie's secure flag)

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
# ⚠️ corr. 13: staging origins ONLY. Never https://resomix.com here, or the production
#    frontend can make credentialed calls to the staging API.
RESOMIX_ALLOWED_ORIGINS_PRODUCTION=["https://staging-admin.resomix.com","https://staging-frontend.resomix.com"]

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
MARIA_DB_NAME=resomix_db                            # ⚠️ recovery: resomix_prod / resomix_user, production's names (corr. 10)

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
SMTP_FROM_EMAIL=noreply@resomix.com                 # ⚠️ corr. 14: never blank (crashes at import); on staging noreply@staging.resomix.com, not a .invalid/.test address
SMTP_FROM_NAME=Resomix
FRONTEND_URL=https://staging-frontend.resomix.com   # ⚠️ staging webapp (Cloudflare Pages) for email links

# ── Cross-service secret (MUST match media) ─────────────────────────
HETZNER_INTERNAL_API_KEY=<shared with media>
REDIS_URL=redis://127.0.0.1:6379/0

# ── Analysis service (Part K, on the media box). Missing from this block until 2026-09 ──
ANALYSIS_SERVER_URL=https://staging-analysis.resomix.com   # production: https://analysis.resomix.com
ANALYSIS_INTERNAL_API_KEY=<shared with analysis RESOMIX_INTERNAL_API_KEY>   # corr. 9

# ── Backup control plane (server-backups, Part L) ──────────────────
BACKUP_AGENT_TOKEN=<shared with both boxes' server-backups/config/backup.env>   # corr. 9
BACKUP_AGENT_ALWYZON_URL=http://127.0.0.1:8787
BACKUP_AGENT_MEDIA_URL=http://10.99.0.2:8787         # the media agent, through the WireGuard link only
ADMIN_NOTIFICATION_EMAIL=support@resomix.com          # backup-failure alerts (watchdog)
# ⚠️ corr. 31, STAGING: WATCHDOG_BACKUP_ENABLED=false. Staging never backs itself up, and a
#    role that has never succeeded counts as stale, so with production's restored .env
#    (support@ set) and real SMTP it emails support@ "no successful backup" every 12 h,
#    indistinguishable from a production alarm. Production and a real recovery: leave it on.
WATCHDOG_BACKUP_ENABLED=true

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
HETZNER_SFTP_PROVISION_URL=http://<MEDIA_BOX_IP>:8002/internal/provision-sftp-user  # ⚠️ corr. 15 (production: https://media.resomix.com/internal/provision-sftp-user)
SFTP_SERVER_HOST=staging-media.resomix.com          # ⚠️ was sftp.resomix.com
SFTP_SERVER_PORT=2022
SFTP_BASE_PATH=/srv/sftp
```

### B4. Migrate + seed (fresh schema, no restore)

> **Correction 16, after a restore: migrate only, and check first. Never seed.**
> Seeding writes rows on top of production's data. The dump is usually behind the
> code by a migration or two, so the upgrade is still needed, but look before
> running it:
>
> ```bash
> .venv/bin/alembic current      # must print a revision; EMPTY means stop and investigate
> .venv/bin/alembic heads
> .venv/bin/alembic upgrade head # only once current is a known ancestor of head
> ```
>
> An empty `alembic_version` would replay every migration onto populated tables.
> On the 2026-09 drill this was a single step, `e4a9b2c7d135` → `f1c3d5a90b27`,
> taking 84 tables to 86.
>
> The block below is for a **fresh, empty** database only.

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

> **Correction 17.** This repo has **no `run.py`**. The launcher is
> **`run_alwyzon.py`**, and it starts uvicorn **and both Celery workers**
> (`similarity` in the foreground queue, `celery` in the background) and
> supervises them. Running `uvicorn app.main:app` alone, as an earlier correction
> here once said, gives an API that accepts uploads and never processes one
> (issues 94, 113).

```bash
.venv/bin/python run_alwyzon.py   # uvicorn on 0.0.0.0:8001 + both Celery workers
# in another shell:
curl -s http://127.0.0.1:8001/api/v1/health     # -> {"status":"healthy"}
pgrep -af 'celery.*worker'                      # both workers present; none means async jobs queue forever
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
python3.10 -m venv .venv                 # ⚠️ corr. 18: production's media venv is 3.10.14
.venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -c "import numpy, faiss; print(numpy.__version__, faiss.__version__)"   # production: 2.2.6 1.14.3
```

> **Correction 18.** The 3.11 requirement is obsolete: `requirements.txt` now pins
> `faiss-cpu==1.14.3` with numpy unpinned, which resolves to numpy 2.2.6 on 3.10,
> exactly production's. Install with the venv's own interpreter
> (`.venv/bin/python -m pip`), never a bare `pip`: on the media box a leaked
> `PYTHONPATH` or an activated sibling venv has installed into the wrong one
> before.

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
PORT=8002                                            # ⚠️ corr. 1: production's port, not 8004
RESOMIX_DEV_PUBLIC_URL=https://staging-media.resomix.com   # ⚠️ was localhost:8004

# ⚠️ loopback + the Alwyzon box's public IP (two boxes) + the GPU embed server IP
ALLOWED_IPS=127.0.0.1,localhost,::1,<ALWYZON_BOX_IP>,<GPU_EMBED_SERVER_IP>

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
.venv/bin/python run.py         # prints "Server will run on 0.0.0.0:8002"
# in another shell, confirm it's up:
curl -s http://127.0.0.1:8002/health    # expect 200, not a connection refusal
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

#### After a restore (corrections 19, 20)

A restored partner tree does not arrive owned correctly, and the media service
fails **silently** when it is not:

```bash
# 1. The restored tree is owned by a numeric uid (999, which is lxd on a fresh
#    box and sftpgo on production). Give it to sftpgo. 4.8M inodes took 2 min;
#    run it in tmux. Modes survive the restore (dirs 2775 setgid, files 644).
sudo chown -R sftpgo:sftpgo /srv/sftp          # issue 99

# 2. The slug map must be readable by the MEDIA SERVICE USER. It restores as
#    0600 sftpgo; production's service user owns it and is in group sftpgo.
sudo chown <media-service-user>:sftpgo /srv/sftp/partners/.partner_slugs.json
sudo usermod -aG sftpgo <media-service-user>   # partners 4 and 6 live in drwxrws--- dirs

# 3. THEN restart the media service. Not before, and again after any later
#    ownership fix.
sudo systemctl restart resomix-media
```

Why each matters: if the service cannot read `.partner_slugs.json` it gets
`EACCES`, falls back to numeric partner folders that do not exist, and
**similarity returns "success" with zero results forever** (issues 102, 104). And
a failed slug-map read is cached against the file's **mtime**, which `chown` does
not change, so a service started before the fix never retries (issue 103).

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

> **Correction 21, two boxes.** Both hooks call **Alwyzon**, which is on the other
> box: use `http://<ALWYZON_BOX_IP>:8001/internal/sftp/{auth,event}` where the
> table says `127.0.0.1:8001`, and open Alwyzon's firewall to the media box on
> 8001 (D5). These hooks carry partner credentials, so on production they should
> travel inside the WireGuard link (`http://10.99.0.1:8001/...`), not the public
> address: `server-backups` issue 133. On a recovery, patch the packaged
> `sftpgo.json` with production's deltas only and keep the `.orig`; hand-writing
> the file loses every default the version ships. If the media `.env` came from
> production, rotate `SFTPGO_ADMIN_PASS`: it still holds production's value.
>
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
# 8090 (SFTPGo admin), 8001, 8002, 8010 (analysis, Part K) stay localhost-only — do NOT open them.
sudo ufw enable
```

> **Correction 22, two boxes.** Each box admits the other only on the one port it
> needs, and **the SSH rule goes in the same command as the enable**, so a typo
> cannot lock you out:
>
> ```bash
> # media box: the media service only to Alwyzon and the GPU box
> sudo ufw allow 22,80,443,2022/tcp && sudo ufw allow from <ALWYZON_BOX_IP> to any port 8002 && sudo ufw allow from <GPU_IP> to any port 8002 && sudo ufw default deny incoming && sudo ufw --force enable
> # Alwyzon box: the API only to the media box (SFTPGo's hooks)
> sudo ufw allow 22,80,443/tcp && sudo ufw allow from <MEDIA_BOX_IP> to any port 8001 && sudo ufw default deny incoming && sudo ufw --force enable
> ```
>
> With ufw in place, Alwyzon binds `0.0.0.0:8001` as production does. Production's
> media box additionally admits 80/443 **from Cloudflare's ranges only**, since its
> hostnames are proxied (`server-backups` issue 52), and the two production boxes
> talk over WireGuard (Part L).

---

## Part E — Verify the cross-service wiring

With all three apps running (Parts B/C/D), confirm the links. **Correction 23:**
the checks below are the quick version for one box. On two boxes, and for any
recovery, Part I's `box_manifest.py` replaces them: the secret check below cannot
see the analysis service's `RESOMIX_` names, and none of it notices a missing
worker or a clamd that cannot scan.

```bash
# 1. Alwyzon -> media server reachable on this box:
curl -s http://127.0.0.1:8002/health >/dev/null && echo "media OK"

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
| `A` | `staging-media` | `<SERVER_PUBLIC_IPV4>` | media HTTPS (→ 8002) **and** SFTP host (`:2022`) |
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
        proxy_pass http://127.0.0.1:8002;    # corr. 1: not 8004
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

> **Correction 24, two boxes: one certificate per box, for that box's names
> only.** A name that resolves to the other box fails the HTTP-01 challenge and
> takes the whole run down with it:
>
> ```bash
> # Alwyzon box
> sudo certbot --nginx -d staging-bserver.resomix.com --non-interactive --agree-tos -m <email> --redirect
> # media box (one certificate covers both names)
> sudo certbot --nginx -d staging-media.resomix.com -d staging-analysis.resomix.com --non-interactive --agree-tos -m <email> --redirect
> ```
>
> Then `sudo certbot renew --dry-run` and `systemctl list-timers certbot.timer`
> on each: a certificate that cannot renew is an outage on a 90-day timer. Every
> name in a vhost's `server_name` must be on its certificate: when adding a name
> to an existing vhost, re-run certbot with it, then check with
> `sudo certbot certificates`.

---

## Part G — fail2ban (recommended)

Bans IPs that probe/scan over HTTP. All filters read nginx's access log.

> **Correction 25.** Three changes, each learned the hard way on the drill boxes:
> 1. **Write the filters (G3) before the jails (G2)**, then restart. A jail whose
>    filter file is missing fails the configuration.
> 2. **`ignoreip` must hold the other box and the GPU box**, not just loopback.
>    Otherwise the media box's own calls trip `nginx-4xx-5xx` (40 non-2xx in 2
>    min) and it **bans itself from the control plane**:
>    `ignoreip = 127.0.0.1/8 ::1 <OTHER_BOX_IP> <GPU_IP>`
> 3. **Enable `[sshd]`.** The jails below cover only nginx, on boxes with a public
>    SSH port:
>    ```ini
>    [sshd]
>    enabled = true
>    ```
>
> fail2ban installs its own iptables chains, so a ban does not show in
> `ufw status`. If a box is unreachable while ufw looks right, check
> `sudo fail2ban-client status nginx-404` and `sudo iptables -S` (issue 108).
> Production's Alwyzon box runs fail2ban; production's media box does not.

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
# corr. 25: NOT optional on two boxes. The other box and the GPU, or they ban each other.
ignoreip = 127.0.0.1/8 ::1 <OTHER_BOX_IP> <GPU_IP>

[sshd]
enabled  = true

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

**Alwyzon** — `/etc/systemd/system/alwyzon.service`.

> **Correction 17.** The unit is **`alwyzon.service`**, production's name (the
> `resomix-api` this part used to name matches nothing), and it runs
> **`run_alwyzon.py`**, not `run.py`, which does not exist in this repo.
> `run_alwyzon.py` starts uvicorn and **both Celery workers** and supervises them,
> so this one unit is the whole service. Stop it with `systemctl stop`, never
> `kill -9`: SIGKILL orphans the workers (`DuplicateNodenameWarning` on the next
> start; clean up with `pkill -f 'app.tasks.celery_app'`).

```ini
[Unit]
Description=Resomix Alwyzon API (uvicorn + supervised Celery workers)
After=network.target mariadb.service redis-server.service

[Service]
User=devuser
WorkingDirectory=/home/devuser/usman/basic_fastapi_server_resomix
ExecStart=/home/devuser/usman/basic_fastapi_server_resomix/.venv/bin/python run_alwyzon.py
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
WorkingDirectory=/home/devuser/usman/resomix-similarity-open
ExecStart=/home/devuser/usman/resomix-similarity-open/.venv/bin/python run.py
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
WorkingDirectory=/home/devuser/usman/resomix-similarity-open
ExecStart=/home/devuser/usman/resomix-similarity-open/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alwyzon                              # Alwyzon box
sudo systemctl enable --now resomix-media resomix-media-worker   # media box
sudo systemctl status alwyzon resomix-media resomix-media-worker sftpgo
# Verify the worker is wired to its broker:
cd /home/devuser/usman/resomix-similarity-open && \
  .venv/bin/python -c "from app.tasks.celery_app import ping; print(ping.delay().get(timeout=10))"   # → pong
```

> The media worker shares the box Redis but uses its own db indices (`/2`,`/3`,
> see Part C `.env`), so it never collides with Alwyzon's Celery (`/0`,`/1`).
> In the production split it runs on the media box against that box's own Redis.

> Alwyzon's background workers (quota flush, webhook dispatch, cleanup) are the
> two Celery workers `run_alwyzon.py` already supervises. Do **not** add units for
> them: a second copy consumes the same queues.
>
> **Settled 2026-09-11 (`server-backups` issue 136):** production's media box runs
> **no** `resomix-media-worker`, and that is correct today. The media Celery app
> registers only a `ping` task and nothing enqueues to it; its own docstring says
> the endpoints move to Celery "in later stages". Install this unit when those
> stages land, not before. The only Celery worker on production media is the
> analysis service's own (K4).

---

## Part I — Final verification checklist

**Correction 23: verify with the manifest first.** Every fault the September
rebuild found had an `active` unit and a healthy `/health`: no Celery worker
(113), an analysis URL at a closed port (115), a shared secret generated twice
(116), clamd answering PONG while unable to scan (118). The checklist below sees
none of them. `server-backups/bin/box_manifest.py` does: it streams a real
kilobyte through clamd, counts the Celery workers and queue depth, probes every
configured URL from the box, checks the units the role requires, and fingerprints
every cross-service secret without printing it.

On each box (write the capture to the home directory, not into the repo):

```bash
cd ~/usman/server-backups && git pull && sudo python3 bin/box_manifest.py --role <alwyzon|media> > ~/manifest-<box>.json && python3 -c "import json,os;d=json.load(open(os.path.expanduser('~/manifest-<box>.json')));print('\n'.join(d['problems']) or 'no problems')"
```

**Pass: `no problems` on both boxes.** Add `--staging` on a staging box only; it
stops the manifest requiring the backup units, WireGuard and Elasticsearch,
which staging lacks by decision. A real recovery never passes it.

Then, on the workstation, with both captures copied into `server-backups/manifests/`:

```bash
python3 bin/box_manifest.py --compare manifests/<new-alwyzon>.json manifests/<new-media>.json   # must exit 0: the pair agrees on all six secrets
python3 bin/box_manifest.py --compare manifests/alwyzon.json manifests/<new-alwyzon>.json       # drift from production, line by line
python3 bin/box_manifest.py --compare manifests/media.json manifests/<new-media>.json
```

For a real recovery the last two must also exit 0: the restored `.env` files are
production's, so every secret matches. For staging add `--ignore-secrets` to
those two only, since staging shares no signing secret with production.

**Correction 27: public reachability, from a machine outside both boxes.** It is
the one thing no box can test about itself; a box's own `curl` returned 200 for
forty minutes on 2026-09-05 while nothing outside could open a socket (issue 108):

```bash
for h in <alwyzon-host> <media-host> <analysis-host>; do printf "%-28s " "$h"; curl -s -o /dev/null -m 8 -w "%{http_code} ip=%{remote_ip}\n" "https://$h/health"; done
```

The quick checklist, for a fresh single box:

- [ ] `https://staging-bserver.resomix.com/api/v1/health` → `{"status":"healthy"}` over TLS.
- [ ] `https://staging-media.resomix.com/` responds over TLS.
- [ ] *(if Part K)* `https://staging-analysis.resomix.com/health` over TLS; Celery worker up (a test upload reaches `succeeded`); analysis Redis on its **own** db (`/4`), not `/1`.
- [ ] MariaDB: `SHOW TABLES;` lists core tables; `seed_rbac`/`seed_data` rows present.
- [ ] All six shared secrets identical on every holder (A5; `box_manifest.py --compare`).
- [ ] Alwyzon `SIMILARITY_SERVER_URL` names the media service on port 8002; media reachable.
- [ ] SFTPGo: `sftpgo` service active; SFTP listening on `:2022`; Admin REST on `127.0.0.1:8090` only.
- [ ] SFTPGo auth hook → `:8001/internal/sftp/auth`; upload hook → `:8001/internal/sftp/event`.
- [ ] `/srv/sftp/partners` owned by the `sftpgo` user; `/srv/resomix/{partners,shared,audit_logs,audit_keys}` exist.
- [ ] Media `EMBED_SERVER` points at the dedicated GPU embedding server.
- [ ] ufw: only `22, 80, 443, 2022` open; `8001/8002/8090/3306/6379` are localhost-only (two boxes: D5's per-box rules).
- [ ] systemd units `enabled`; Certbot certs issued; `renew --dry-run` passes.
- [ ] fail2ban jails active.
- [ ] End-to-end: provision a test partner → SFTP login on `:2022` → upload + `.done` → ingest log opens.

At this point the full staging stack runs on one box, on an **empty, migrated
database**, with embedding generation delegated to the GPU server.

---

## Part J — Next: importing data (separate step)

This runbook stops before loading live data.

- **Full DR restore** (catastrophic recovery): **correction 28.** Follow
  `server-backups`: `docs/PHASE-8.md`, section *"The recovery procedure, as actually
  run"*, which restores both boxes with `bin/restore.sh --role alwyzon|media` from
  the restic repository on the Storage Box (62 minutes for both boxes on the
  2026-09 drill). **Do not follow [restore_runbook.md](restore_runbook.md)**: it
  describes a Docker `mariabackup` + cron + rsync system with `--password=test`
  that does not exist, and a drill that did not happen as described. After the
  restore: B4's migrate-only check, then D2's ownership fixes and restart order.
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

The `except` in `lifespan` swallows it, so uvicorn still binds 8002 — but the
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
> `curl -F file=@track.mp3 http://<GPU_EMBED_IP>:8015/get_analysis_bundle` (8015, the
> analysis instance; see K2).

### K1. Clone + venv + deps

```bash
cd /home/devuser/usman
git clone git@github-analysis:Resomix/resomix-analysis-service.git   # ⚠️ the ALIAS, not github.com (see A3)
cd resomix-analysis-service

# ⚠️ corr. 29: Python 3.12 explicitly (production: 3.12.3). A bare `python3` is 3.10 on
#    Ubuntu 22.04; the drill built this venv on 3.10 first and had to rebuild it.
python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
sudo mkdir -p /srv/resomix/analysis/{work,results} && sudo chown -R devuser:devuser /srv/resomix/analysis   # corr. 29: durable, outside the repo
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

# ⚠️ corr. 29: the GPU box's ANALYSIS instance, port 8015 (production: http://46.4.100.18:8015).
#    8005 is the embedding-only instance the media server uses; it has no analysis
#    endpoints, so /get_analysis_bundle, /get_semantics and /separate_stems 404 while
#    embeddings still answer 200, and every analysis comes back part-1 only.
RESOMIX_EMBEDDING_BASE_URL=http://<GPU_EMBED_IP>:8015

# ⚠️ corr. 29: durable storage, outside the repo. ./var/results is wiped by a redeploy,
#    and a restore puts the analysis results here (issue 47).
RESOMIX_WORK_DIR=/srv/resomix/analysis/work
RESOMIX_RESULTS_DIR=/srv/resomix/analysis/results

# Lock CORS to the browser origins that call it directly (comma-separated here, NOT JSON).
# Leave the default "*" if only the Alwyzon backend calls it server-to-server.
RESOMIX_CORS_ALLOW_ORIGINS=https://staging.resomix.com,https://staging-frontend.resomix.com
```

> Storage (`RESOMIX_WORK_DIR` / `RESOMIX_RESULTS_DIR`) defaults to `./var/...` under
> the repo. **Not fine even for staging** (corr. 29): a redeploy wipes it, and restored
> results live there. Set both, as above. The GPU-response cache (`./var/gpu_cache`) reuses
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
WorkingDirectory=/home/devuser/usman/resomix-analysis-service
ExecStart=/home/devuser/usman/resomix-analysis-service/.venv/bin/python run_analysis.py
Restart=on-failure
KillSignal=SIGTERM
KillMode=mixed          # corr. 26: SIGTERM to the launcher, then clean up the worker it spawned
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
cd /home/devuser/usman/resomix-analysis-service && source .venv/bin/activate
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

- `8010` stays **localhost-only** in ufw (nginx is the only public door) — like 8001/8002.
- Job stuck at `queued` → the **worker isn't running** (check the unit /
  `RESOMIX_EMBED_WORKER`). Reaches `succeeded` but semantic/composition sections are
  empty/`partial` → the **GPU embedding endpoints aren't deployed** yet (top callout).

---

## Part L: backups, the backup agent and the WireGuard link (correction 30)

A recovered box that does not back itself up is not recovered: the next failure
has nothing to restore from. Everything here lives in the `server-backups` repo
(its `README.md` and `docs/PROGRESS.md` Phases 1 to 6 are the procedure); this
part is the checklist, so it cannot be skipped by a runbook that ends at Part K.

On **each** production box (not staging, which never backs itself up):

- [ ] `~/usman/server-backups` cloned through its own deploy key (A3).
- [ ] `config/backup.env` from the restored secrets bundle, `chmod 600`,
      `BACKUP_ROLE` set, restic **0.19.1** from upstream (not the distro package).
- [ ] `bash tests/run_tests.sh` → `ALL GREEN` **on the box itself**. The laptop
      suite is not the authority: macOS bash 3.2 has hidden real failures.
- [ ] `server-backups.timer` enabled (Alwyzon 02:00 UTC, media 03:00 UTC).
- [ ] `server-backups-agent.service` installed (Phase 4, the admin panel's *Run
      now*). **No `MemoryMax`** on that unit: the backups it starts share its
      cgroup, and a cap OOM-kills them.
- [ ] WireGuard `wg0` up between the two boxes (Alwyzon `10.99.0.1`, media
      `10.99.0.2`, UDP 51820 open only to the other box). Backup reports and
      the media agent travel only inside it; the agent on media binds
      `10.99.0.2:8787`.
- [ ] Alwyzon `.env`: `BACKUP_AGENT_TOKEN`, `BACKUP_AGENT_ALWYZON_URL`,
      `BACKUP_AGENT_MEDIA_URL`, `ADMIN_NOTIFICATION_EMAIL` (B3).
- [ ] One *Run now* per box from the admin panel, ending `succeeded`, and one
      scheduled night recorded `succeeded` for both roles.
- [ ] `box_manifest.py` without `--staging` reports `no problems` (Part I): it
      requires the timer, the agent and `wg-quick@wg0` on both roles.
