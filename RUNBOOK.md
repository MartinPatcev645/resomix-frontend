# Alwyzon Backend — Ops Runbook

> **Mental model:** systemd runs the program in the background, starts it on boot, and
> restarts it if it crashes. Control it with `systemctl <verb> <service>`, read output with
> `journalctl -u <service>`.

## Facts (this box)
| | |
|---|---|
| **Box** | `alwyzon@tracklizer` (Alwyzon prod box) |
| **Repo path** | `/home/alwyzon/usman/basic_fastapi_server_resomix`  ← **confirm with `pwd`** |
| **venv** | `.venv` |
| **Launch cmd** | `python run_alwyzon.py` → uvicorn `app.main:app` on `:8001` **+** the Celery worker, one supervised process |
| **Port** | `ALWYZON_PORT` = **8001** → nginx `bserver.resomix.com` → `127.0.0.1:8001` |
| **Depends on** | MariaDB (local) + Redis (`DB 0`) |
| **systemd unit** | `alwyzon` — **to be created** (see below) |
| **Health** | `curl -s https://bserver.resomix.com/health` (or the docs root) |

> Confirm the two paths before installing:  `cd` into the repo, run `pwd` and `whoami`, and
> substitute them into `WorkingDirectory`, `ExecStart`, and `User` below.

## Install as a service (one time)
```bash
sudo tee /etc/systemd/system/alwyzon.service >/dev/null <<'EOF'
[Unit]
Description=Alwyzon Backend (API + worker)
After=network-online.target mariadb.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=alwyzon
WorkingDirectory=/home/alwyzon/usman/basic_fastapi_server_resomix
ExecStart=/home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python run_alwyzon.py
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

# IMPORTANT: stop any `make api` / tmux / nohup instance first (frees port 8001)
sudo systemctl daemon-reload
sudo systemctl enable --now alwyzon
sudo systemctl status alwyzon
```
`run_alwyzon.py` spawns and supervises the Celery worker itself (env `ALWYZON_EMBED_WORKER=1`,
the default), so this one unit runs **both** the API and the worker.

## Everyday commands
```bash
sudo systemctl status alwyzon

journalctl -u alwyzon -f                        # live logs (Ctrl-C to stop watching)
journalctl -u alwyzon -n 200 --no-pager
journalctl -u alwyzon --since "15 min ago" --no-pager
journalctl -u alwyzon | grep -i error
journalctl -u alwyzon --since today | grep -i "webhook"     # e.g. trace Stripe webhooks

sudo systemctl restart alwyzon
sudo systemctl stop    alwyzon
sudo systemctl start   alwyzon
sudo systemctl enable  alwyzon     # start on boot
sudo systemctl disable alwyzon
```

## Deploy new code
```bash
cd /home/alwyzon/usman/basic_fastapi_server_resomix
git pull
source .venv/bin/activate
pip install -r requirements.txt        # only if requirements changed
.venv/bin/alembic upgrade head         # if the pull added DB migrations
.venv/bin/python scripts/seed_rbac.py  # if the pull added keys to app/core/rbac.py PERMISSIONS
# PYTHONPATH="$PWD" .venv/bin/python scripts/seed_consumer_pro_price.py   # only when (re)seeding billing
sudo systemctl restart alwyzon
sudo systemctl status alwyzon
journalctl -u alwyzon -n 200 --no-pager
```

## Notes / gotchas
- **`seed_rbac.py` after a permissions change**: `require_permission` checks the `role_permissions`
  **rows**, not the `ROLE_PERMISSIONS` map in code. A release that adds a permission key ships it
  granted-in-code and denied-in-production until the seeder runs. It is idempotent, so running it on
  every deploy is harmless. (`--admin-email <addr>` also grants+activates one admin account.)
- **Shared secrets** (must equal the media/analysis boxes): `EDGE_JWT_SECRET` (media + analysis),
  `HETZNER_INTERNAL_API_KEY` + `PREVIEW_FERNET_SECRET` + `PREVIEW_HMAC_SECRET` (media),
  `ANALYSIS_INTERNAL_API_KEY` (= analysis `RESOMIX_INTERNAL_API_KEY`). See `SECRET_ROTATION` notes.
- **Analysis front-door**: needs `ANALYSIS_SERVER_URL=https://analysis.resomix.com` +
  `ANALYSIS_INTERNAL_API_KEY` in `.env`, else the upload→analysis path is inert.
- **Stripe webhooks** in prod come from a **Dashboard** webhook endpoint (not the CLI); the
  `STRIPE_WEBHOOK_SECRET` must be that endpoint's signing secret.
- `JWT_SECRET_KEY` is Alwyzon-only; rotating it logs everyone out but touches no other service.
- Don't `kill -9` — it orphans the Celery worker. Use `systemctl stop` / plain `kill`.

## Orphaned Celery workers (silent, and restarts do NOT fix them)

A worker started outside this unit — by hand with `nohup`, from tmux, or by an older unit — keeps
consuming the **same** Redis queue forever. `systemctl restart alwyzon` cannot stop it, because it
is not in the unit's cgroup: `systemctl status alwyzon` will look perfectly healthy while a stale
worker takes a share of every job and runs whatever code it was started with weeks ago.

This is nasty to diagnose because it presents as an application bug — a task that "does nothing", a
row stuck half-written — with **nothing in `journalctl -u alwyzon`**, since the stale worker logs to
wherever it was launched (typically `/tmp/celery.log`).

`run_alwyzon.py` now sweeps these at startup, so a restart leaves exactly one worker. To check by
hand — every Celery PID should be a child of the current `run_alwyzon.py`:

```bash
ps -eo pid,lstart,cmd | grep -E "[c]elery" # look for start dates older than the current service
systemctl status alwyzon --no-pager        # its cgroup lists the ONLY workers that should exist
```

A `DuplicateNodenameWarning: Received multiple replies from node name: celery@…` in the startup log
is Celery telling you this has already happened.

Stop strays with plain SIGTERM (never `-9` first — it leaves their pool children behind):

```bash
kill <stray-pid>   # then re-check with the ps above
```
