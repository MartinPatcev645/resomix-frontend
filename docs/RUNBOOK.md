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

## Log retention timer (one time)

`system_logs` has no retention of its own — without this it grows forever, and because the table
has no `user_id` column nothing keyed on an account can ever reach its rows. Time is the only
handle on it. Required by our retention policy; see
`docs/ACCOUNT_DELETION_GDPR_OPTIONS.md` §4.5.

```bash
sudo tee /etc/systemd/system/alwyzon-prune-logs.service >/dev/null <<'EOF'
[Unit]
Description=Prune system_logs past the retention window
After=mariadb.service

[Service]
Type=oneshot
User=alwyzon
WorkingDirectory=/home/alwyzon/usman/basic_fastapi_server_resomix
Environment=PYTHONPATH=/home/alwyzon/usman/basic_fastapi_server_resomix
ExecStart=/home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python scripts/prune_system_logs.py --quiet
EOF

sudo tee /etc/systemd/system/alwyzon-prune-logs.timer >/dev/null <<'EOF'
[Unit]
Description=Daily system_logs prune

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now alwyzon-prune-logs.timer
```

`Persistent=true` runs a missed occurrence after a reboot, so a box that was down overnight still
prunes. Check it with:

```bash
systemctl list-timers alwyzon-prune-logs.timer
journalctl -u alwyzon-prune-logs.service -n 20
```

**Before the first real run**, see what it would remove — this table has never been pruned, so the
first pass will have a large backlog:

```bash
cd /home/alwyzon/usman/basic_fastapi_server_resomix && PYTHONPATH="$PWD" .venv/bin/python scripts/prune_system_logs.py --dry-run
```

It deletes in batches of 1,000 and commits each one, so the first run is safe to interrupt — what
is committed stays deleted and the next run continues.

**Window:** `SYSTEM_LOG_RETENTION_DAYS`, default 90. Setting it to `0` disables pruning entirely
(it is refused, not treated as "delete everything").

## Lifecycle notification timers (one time)

Two daily jobs. Both are best-effort mail senders — a failure delays a notice, it never corrupts
anything — and both are safe to run repeatedly.

| Job | Sends | When it stays silent |
|---|---|---|
| `notify_expiring_grants` | user: complimentary plan ending in 3 days / ended | no grants in either window |
| `notify_pending_deletions` | admins: erasure requests approaching or past the SLA | nothing is due — **silence is the signal** |

```bash
for job in notify-expiring-grants:notify_expiring_grants notify-pending-deletions:notify_pending_deletions; do
  unit="${job%%:*}"; script="${job##*:}"
  sudo tee /etc/systemd/system/alwyzon-${unit}.service >/dev/null <<EOF
[Unit]
Description=Resomix daily job: ${script}
After=mariadb.service

[Service]
Type=oneshot
User=alwyzon
WorkingDirectory=/home/alwyzon/usman/basic_fastapi_server_resomix
Environment=PYTHONPATH=/home/alwyzon/usman/basic_fastapi_server_resomix
ExecStart=/home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python scripts/${script}.py --quiet
EOF
  sudo tee /etc/systemd/system/alwyzon-${unit}.timer >/dev/null <<EOF
[Unit]
Description=Daily ${script}

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true
RandomizedDelaySec=15m

[Install]
WantedBy=timers.target
EOF
done

sudo systemctl daemon-reload
sudo systemctl enable --now alwyzon-notify-expiring-grants.timer alwyzon-notify-pending-deletions.timer
```

**09:00 rather than midnight** — these are read by people, and a grant-expiry warning timestamped
03:00 lands at the bottom of an inbox. `Persistent=true` catches up after a reboot.

**Check what they would do before enabling** — both have a dry run that sends nothing:

```bash
cd /home/alwyzon/usman/basic_fastapi_server_resomix && PYTHONPATH="$PWD" .venv/bin/python scripts/notify_expiring_grants.py --dry-run && PYTHONPATH="$PWD" .venv/bin/python scripts/notify_pending_deletions.py --dry-run
```

**Grant notices are sent once**, claimed through `billing_notifications.dedupe_key`
(`grant_expiring:<id>` / `grant_expired:<id>`) — per grant, so a user comped twice is told twice.
The deletion digest is a daily summary, not a claim-once notice, so re-running re-sends it.

**`ADMIN_URL`** must point at the admin panel (`https://r-admin.resomix.com`) or the digest's
button leads nowhere. It is not derived from `APP_URL`.

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
