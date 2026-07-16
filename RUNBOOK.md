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
# PYTHONPATH="$PWD" .venv/bin/python scripts/seed_consumer_pro_price.py   # only when (re)seeding billing
sudo systemctl restart alwyzon
sudo systemctl status alwyzon
journalctl -u alwyzon -n 50 --no-pager
```

## Notes / gotchas
- **Shared secrets** (must equal the media/analysis boxes): `EDGE_JWT_SECRET` (media + analysis),
  `HETZNER_INTERNAL_API_KEY` + `PREVIEW_FERNET_SECRET` + `PREVIEW_HMAC_SECRET` (media),
  `ANALYSIS_INTERNAL_API_KEY` (= analysis `RESOMIX_INTERNAL_API_KEY`). See `SECRET_ROTATION` notes.
- **Analysis front-door**: needs `ANALYSIS_SERVER_URL=https://analysis.resomix.com` +
  `ANALYSIS_INTERNAL_API_KEY` in `.env`, else the upload→analysis path is inert.
- **Stripe webhooks** in prod come from a **Dashboard** webhook endpoint (not the CLI); the
  `STRIPE_WEBHOOK_SECRET` must be that endpoint's signing secret.
- `JWT_SECRET_KEY` is Alwyzon-only; rotating it logs everyone out but touches no other service.
- Don't `kill -9` — it orphans the Celery worker. Use `systemctl stop` / plain `kill`.
