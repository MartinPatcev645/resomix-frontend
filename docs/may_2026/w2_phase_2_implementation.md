Here is the exact breakdown of how your local development, Docker, and testing environments are currently set up and utilized based on your configuration files (`docker-compose.yml`, `Makefile`, and `tests/conftest.py`):

### 1. Dockerized Infrastructure
You are using Docker primarily for backing services (Database and Cache), while running the actual API code on your local host machine for easier debugging and hot-reloading.
*   **MariaDB (`resomix-mariadb`)**: Runs MariaDB 11.3. It exposes port `3306` inside the container to port `3307` on your local machine. It automatically seeds data on startup by mapping your `./database/seed` directory to the container's init folder.
*   **Redis (`resomix-redis`)**: Runs Redis 7.2, exposing port `6379` locally.
*   **Optional Services**: You have profiles defined for `elasticsearch` and the `api` itself, but they are optional and not started by default.

### 2. Local Database & Server Workflow (`Makefile`)
Your workflow relies heavily on `make` commands to bridge your local environment with the Docker containers:
*   `make up`: This specifically runs `docker compose up -d mariadb` to start the database container in the background.
*   `make db`: Gives you direct CLI access to the MariaDB container (`mysql -h 127.0.0.1 -P 3307 ...`).
*   `make migrate` & `make seed`: Runs Alembic and your Python seed scripts against the Dockerized database to prepare the schema and test data.
*   `make api`: Starts your FastAPI server locally using `uvicorn` on port `8001`. It connects to the Dockerized MariaDB (via port `3307`) and Redis (via port `6379`).

### 3. Testing Workflow (`pytest` & `conftest.py`)
Your testing strategy enforces that integration tests run against a live local server rather than just mocked endpoints.
*   **Health Check Gate**: In `tests/conftest.py`, there is an `autouse=True` fixture named `check_server_health`. Before any tests run, it pings `http://localhost:8001/health/`.
*   **Test Execution**: If the server isn't running, pytest will abort with the message: `"🚨 Server at http://localhost:8001 returned... Please start the server using 'make api'."`
*   **Workflow**: To test locally, you must first run `make up` (to start the DB), then run `make api` in one terminal, and finally run `make test` (which executes `pytest -q`) in another terminal.

This setup ensures that when you run tests during development, they are executing against the exact same database structure as production, but running locally on your machine for fast iteration.


## Architecture Clarity

The three servers have distinct roles:

- **Alwyzon** — FastAPI app, MariaDB, Redis, business logic, API endpoints
- **Hetzner SX65** — Raw storage, SFTPGo, audio files, FAISS indexes, embeddings
- **GPU server** — PYXIS-1 embedding extraction only

For SFTPGo, the flow is:

```
Partner SFTP client
       ↓
  Hetzner SX65 (SFTPGo listens here)
       ↓ auth hook HTTP call
  Alwyzon FastAPI (/internal/sftp/auth)
       ↓ validates against sftp_users table in MariaDB
  Response back to SFTPGo → allow/deny
```

So SFTPGo lives on **Hetzner SX65**, the auth hook endpoint lives on **Alwyzon**.

---

## W2-4: SFTPGo Setup

### On Hetzner SX65

**1. Install SFTPGo**
```bash
# Download latest release
wget https://github.com/drakkan/sftpgo/releases/latest/download/sftpgo_linux_x86_64.tar.xz
tar -xf sftpgo_linux_x86_64.tar.xz
mv sftpgo /usr/local/bin/
mkdir -p /etc/sftpgo /var/lib/sftpgo /srv/sftp
```

**2. Configure SFTPGo** — create `/etc/sftpgo/sftpgo.json`. The critical part is the external auth hook pointing to Alwyzon:

```json
{
  "sftpd": {
    "bindings": [{"port": 2222, "address": ""}],
    "host_keys": ["/etc/sftpgo/id_rsa"]
  },
  "data_provider": {
    "driver": "memory",
    "external_auth_hook": "http://YOUR_ALWYZON_INTERNAL_IP/internal/sftp/auth",
    "external_auth_scope": 1
  },
  "httpd": {
    "bindings": [{"port": 8090, "address": "127.0.0.1"}]
  }
}
```

`external_auth_scope: 1` means password auth only. Use `3` if you want both password + public key.

**3. Directory structure per partner**
```bash
# Create base directory
mkdir -p /srv/sftp/partners

# When a partner is provisioned, create:
mkdir -p /srv/sftp/partners/{partner_id}/incoming
mkdir -p /srv/sftp/partners/{partner_id}/processed
mkdir -p /srv/sftp/partners/{partner_id}/error
mkdir -p /srv/sftp/partners/{partner_id}/test
```

The SFTPGo external auth hook response tells SFTPGo what the virtual user's home directory is. You return `/srv/sftp/partners/{partner_id}` as their chroot. They cannot see anything outside it.

**4. SFTPGo webhook on file upload** — configure in `sftpgo.json` under `common`:
```json
"common": {
  "actions": {
    "hook": "http://YOUR_ALWYZON_INTERNAL_IP/internal/sftp/event",
    "execute_on": ["upload"],
    "execute_for": ["*"]
  }
}
```

This fires to Alwyzon whenever any file is uploaded. Your event endpoint checks if the filename is `.done` and if so, enqueues the Celery ingestion task.

---

### On Alwyzon

Two new internal endpoints. Keep them on a separate internal router not exposed through Cloudflare — only reachable from SX65's IP.

**Auth hook endpoint** (`/internal/sftp/auth`):
```python
@router.post("/internal/sftp/auth")
async def sftp_auth_hook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    username = body.get("username")
    password = body.get("password")
    ip = body.get("ip")
    
    # Validate request comes from SX65 only
    if request.client.host != "YOUR_SX65_IP":
        raise HTTPException(403)
    
    # Look up sftp_users table
    sftp_user = await sftp_user_repo.get_by_username(username)
    if not sftp_user or not sftp_user.is_active:
        return {"username": "", "status": 0}  # deny
    
    # Verify password hash
    if not verify_password(password, sftp_user.password_hash):
        return {"username": "", "status": 0}  # deny
    
    # Check IP whitelist
    if sftp_user.allowed_ip and ip not in sftp_user.allowed_ip:
        return {"username": "", "status": 0}  # deny
    
    partner_id = sftp_user.partner_id
    
    # Return SFTPGo virtual user spec
    return {
        "status": 1,
        "username": username,
        "home_dir": f"/srv/sftp/partners/{partner_id}",
        "uid": 1000,
        "gid": 1000,
        "permissions": {"/": ["list", "download", "upload", "create_dirs", "delete"]},
        "filters": {
            "allowed_ip": [sftp_user.allowed_ip] if sftp_user.allowed_ip else []
        }
    }
```

**Event hook endpoint** (`/internal/sftp/event`):
```python
@router.post("/internal/sftp/event")
async def sftp_event_hook(request: Request):
    if request.client.host != "YOUR_SX65_IP":
        raise HTTPException(403)
    
    body = await request.json()
    
    # Only care about .done file uploads
    if body.get("action") == "upload" and body.get("name") == ".done":
        virtual_path = body.get("virtual_target_path", "")
        # Extract partner_id from path: /incoming/.done
        # virtual_path is relative to their chroot
        username = body.get("username")
        sftp_user = await sftp_user_repo.get_by_username(username)
        
        # Enqueue Celery ingestion task
        process_ingestion_batch.delay(
            partner_id=sftp_user.partner_id,
            batch_path=f"/srv/sftp/partners/{sftp_user.partner_id}/incoming"
        )
    
    return {"status": "ok"}
```

---

## W1-5: FAISS — Your Instinct is Correct

Your instinct to wait on FAISS until SFTPGo is working is right, and the directory structure connection makes sense. Here's how it fits:

```
/srv/sftp/partners/{partner_id}/          ← SFTPGo chroot (partner sees this)
    incoming/                              ← they upload here
    processed/                             ← files moved here after ingestion
    error/                                 ← failed files land here

/srv/resomix/partners/{partner_id}/       ← internal only (partner never sees this)
    embeddings/                            ← raw .npy vectors per track
    indexes/                               ← faiss_{partner_id}.index file
```

Keep these two trees separate. The SFTP tree is what partners touch. The internal tree is what PYXIS-1 writes to and what FastAPI loads FAISS indexes from. Never mix them.

**FAISS index lifecycle on SX65:**
1. Celery task on Alwyzon sends audio to GPU server
2. GPU returns embedding vector
3. Celery writes `.npy` file to `/srv/resomix/partners/{partner_id}/embeddings/`
4. Celery calls a lightweight endpoint on the Alwyzon FastAPI that tells the FAISS index manager to either `add()` the new vector incrementally or schedule a full rebuild
5. FAISS index is saved to `/srv/resomix/partners/{partner_id}/indexes/faiss_{partner_id}.index`

The FAISS index manager itself runs inside Alwyzon's FastAPI process — it holds the `dict[int, faiss.Index]` in memory and reads/writes the `.index` files on SX65 via a mounted path or rsync. If Alwyzon and SX65 are on the same network, mount SX65's `/srv/resomix` via NFS or SSHFS so Alwyzon can read/write it directly. That's the simplest path.

---

## Summary: What goes where

| Task | Server | What to do |
|---|---|---|
| SFTPGo install + config | **SX65** | Install, configure external auth hook pointing to Alwyzon, set up `/srv/sftp/partners/` tree |
| Auth hook endpoint | **Alwyzon** | `/internal/sftp/auth` — validates against `sftp_users` table |
| Event hook endpoint | **Alwyzon** | `/internal/sftp/event` — fires Celery task on `.done` detection |
| Partner directory provisioning | **SX65** | Script creates folders when a new partner is onboarded |
| FAISS index storage | **SX65** | `/srv/resomix/partners/{id}/indexes/` — mounted or rsync'd to Alwyzon |
| FAISS index management | **Alwyzon** | In-memory dict inside FastAPI process, reads/writes SX65 via mount |
| CSV ingestion service | **Alwyzon** | Celery task reads CSV from SX65 path, parses, writes to MariaDB |

Start with SFTPGo on SX65 + the two Alwyzon endpoints. Once a test SFTP connection successfully authenticates and triggers the event hook, then wire up the FAISS directory structure and the CSV ingestion service. That's the correct dependency order.

