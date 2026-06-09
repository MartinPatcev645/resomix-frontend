# Fresh Server Bring-Up Runbook (Alwyzon Control-Plane)

**What this is:** a step-by-step procedure to stand up the Alwyzon control-plane
API (`basic_fastapi_server_resomix`, port 8001) on a **clean VPS, from scratch**,
with a **fresh empty database** — no restore-from-backup.

**What this is *not*:** disaster recovery. Restoring production data from the
Hetzner Storage Box backup is a *separate* follow-up step (see
[`restore_runbook.md`](restore_runbook.md)). This runbook gets you ~90% of the
way — a running, migrated, seedable server — and stops before importing live data.

> **Secrets:** every `<PLACEHOLDER>` below is a value you supply at run time.
> Never commit real passwords, API keys, or webhook secrets into this repo. The
> canonical (non-secret) reference for required env keys is `.env.example`.

---

## 0. Prerequisites

- A clean Ubuntu VPS (22.04/24.04) with root or sudo access.
- DNS A-record for the API hostname (e.g. `api.resomix.com`) pointed at the VPS IP
  (needed before the Certbot TLS step).
- Outbound internet (apt, pip, Stripe, VIES, the Hetzner media server).

---

## 1. System update + build dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev \
  libssl-dev libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev \
  git curl pkg-config
```

---

## 2. Create a non-root service user (recommended)

```bash
sudo adduser devuser            # set a strong password when prompted
sudo usermod -aG sudo devuser
# From here on, work as devuser:
su - devuser
```

---

## 3. Git identity + deploy key

```bash
git config --global user.name  "Resomix Deploy"
git config --global user.email "usman.naeem2212@gmail.com"

ssh-keygen -t ed25519 -C "usman.naeem2212@gmail.com"   # press enter through prompts
cat ~/.ssh/id_ed25519.pub
```

Add the printed public key as a **Deploy Key** (read-only) on the GitHub repo,
then verify:

```bash
ssh -T git@github.com    # expect "Hi <org>/... You've successfully authenticated"
```

---

## 4. Python 3.12 from source

The app targets Python 3.12. Build it with `altinstall` so the system `python3`
is left untouched.

```bash
cd /tmp
wget https://www.python.org/ftp/python/3.12.0/Python-3.12.0.tgz
tar -xf Python-3.12.0.tgz
cd Python-3.12.0
./configure --enable-optimizations
make -j"$(nproc)"
sudo make altinstall            # installs as python3.12 (NOT python3)
python3.12 --version            # -> Python 3.12.0
```

---

## 5. Clone the repo + virtualenv + dependencies

```bash
cd ~
git clone git@github.com:<org>/basic_fastapi_server_resomix.git
cd basic_fastapi_server_resomix

python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> **Always use `.venv/bin/python`** for anything in this repo (running the app,
> pytest, alembic). The system Python lacks the project's dependencies.

---

## 6. Install + initialize MariaDB (fresh, empty)

```bash
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation        # set root password, remove anon users
```

Create the database and an application user (run inside `sudo mariadb`):

```sql
CREATE DATABASE resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'resomixAdmin'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON resomix_db.* TO 'resomixAdmin'@'localhost';
FLUSH PRIVILEGES;
```

> No `mysqldump` import here — the schema is created **fresh** by Alembic in §8.
> (Production data import from the Storage Box is the separate, later step.)

---

## 7. Configure `.env`

```bash
cp .env.example .env
# edit .env and fill in real values
nano .env
```

Minimum keys to set for a working server (see `.env.example` for the full list):

| Key | Value |
|---|---|
| `MARIA_DB_USER` | `resomixAdmin` |
| `MARIA_DB_PASS` | `<DB_PASSWORD>` |
| `MARIA_DB_HOST` | `127.0.0.1` |
| `MARIA_DB_PORT` | `3306` (native install; the `3307` default is the Docker mapping) |
| `MARIA_DB_NAME` | `resomix_db` |
| `REDIS_URL` | `redis://localhost:6379` (install redis: `sudo apt install -y redis-server`) |
| `SIMILARITY_SERVER_URL` | base URL of the Hetzner media server |
| `HETZNER_INTERNAL_API_KEY` | `<shared bearer for media-server calls>` |
| `HETZNER_SFTP_PROVISION_URL` | Hetzner `/internal/provision-sftp-user` URL |
| `SFTP_BASE_PATH` | `/srv/sftp` |
| `STRIPE_SECRET_KEY` | `<stripe_secret>` (test key for staging) |

Create the SFTP root the app expects:

```bash
sudo mkdir -p /srv/sftp/partners
sudo chown -R devuser:devuser /srv/sftp
```

---

## 8. Create the schema (Alembic) + seed baseline data

```bash
source .venv/bin/activate
.venv/bin/python -m alembic upgrade head      # builds all tables, fresh

# Baseline non-tenant data:
.venv/bin/python scripts/seed_rbac.py         # roles / permissions
.venv/bin/python scripts/seed_data.py         # operation types, etc.
# Optional demo catalog for a staging box:
.venv/bin/python scripts/seed_sandbox_catalog.py
```

Sanity-check the DB:

```bash
mariadb -u resomixAdmin -p resomix_db -e "SHOW TABLES;"
mariadb -u resomixAdmin -p resomix_db -e "SELECT COUNT(*) FROM partners;"
```

---

## 9. First boot (foreground smoke test)

```bash
source .venv/bin/activate
.venv/bin/python run.py        # binds 0.0.0.0:8001
```

In another shell:

```bash
curl -s http://127.0.0.1:8001/api/v1/health    # -> {"status":"healthy"}
```

`Ctrl-C` to stop once healthy. For the persistent process see §12.

---

## 10. nginx reverse proxy + rate-limit / real-IP layer

Install nginx and drop in the shared rate-limit + Cloudflare real-IP config.
Use the production templates checked into the repo root: `s_nginx.txt`.

```bash
sudo apt install -y nginx
```

**a.** Create `/etc/nginx/conf.d/ratelimits_realip.conf` from the
`ratelimits_realip.conf` block in `s_nginx.txt` (Cloudflare real-IP ranges,
`real_ip_header CF-Connecting-IP`, the `limit_req` zones `api_rl`/`global_rl`/
`admin_rl`, the `perip_conn` connection zone, and the CORS `map`).

**b.** Create `/etc/nginx/sites-available/bserver` from the `bserver` block in
`s_nginx.txt`. Key points it must contain:
- `proxy_pass http://127.0.0.1:8001;`
- `client_max_body_size 105M;` (large audio uploads)
- security headers + HSTS
- the rate-limited `/api/` location.

**c.** Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/bserver /etc/nginx/sites-enabled/bserver
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. TLS via Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.resomix.com      # use your real hostname
sudo certbot renew --dry-run                  # confirm auto-renewal works
```

---

## 12. Run the app as a persistent process

**Quick (matches current ops):**

```bash
cd ~/basic_fastapi_server_resomix
source .venv/bin/activate
nohup .venv/bin/python run.py > server.log 2>&1 &
ps aux | grep run.py        # confirm it's up
tail -f server.log
```

**Preferred (survives reboot) — a systemd unit** `/etc/systemd/system/resomix-api.service`:

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now resomix-api
sudo systemctl status resomix-api
```

> The background workers (quota flush, webhook dispatch, cleanup) run via the
> same app/Celery setup — wire their own units the same way if this host runs them.

---

## 13. fail2ban hardening (optional but recommended for production)

Install fail2ban and apply the jails/filters from the repo root template
`s_fail2ban.txt` (nginx-4xx-5xx, nginx-admin-abuse, nginx-404, recidive):

```bash
sudo apt install -y fail2ban
# create /etc/fail2ban/jail.local and the filter files from s_fail2ban.txt
sudo systemctl restart fail2ban
sudo fail2ban-client status            # list active jails
```

---

## 14. Final verification checklist

- [ ] `curl https://api.resomix.com/api/v1/health` → `{"status":"healthy"}` over TLS.
- [ ] `SHOW TABLES;` lists the partner/track/user core tables (Alembic ran).
- [ ] `seed_rbac` / `seed_data` rows present (roles, operation types).
- [ ] nginx `-t` clean; rate-limit + real-IP conf loaded; CORS allowlist correct.
- [ ] Certbot cert issued; `renew --dry-run` passes.
- [ ] App process is supervised (systemd `enabled`, or nohup running).
- [ ] `SIMILARITY_SERVER_URL` reachable from this host (Hetzner media server).
- [ ] fail2ban jails active (if production).

At this point the server is fully provisioned and running on an **empty,
migrated database**.

---

## 15. Next: importing production data (separate step)

This runbook deliberately stops short of loading live data. When you're ready to
populate from a backup:

- **Full DR restore** (catastrophic recovery): follow
  [`restore_runbook.md`](restore_runbook.md).
- **Selective data import** (fresh staging that needs real partners/users): pull
  the relevant table dumps from the Hetzner Storage Box and load them into the
  already-migrated schema, then re-run any AUTO_INCREMENT fix-ups. The media
  files (audio, embeddings, FAISS) live on the Hetzner server, not here.
