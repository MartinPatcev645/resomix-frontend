# Resomix — Local Setup (macOS & Windows)

A minimal, step-by-step guide to get the API running locally. No extra services, no tests.

---

## 0. Steps at a Glance

1. Install prerequisites (Docker, Python 3.12, FFmpeg, MariaDB Connector/C, Git)
2. Clone repo & create virtual env
3. Create and fill `.env`
4. Start MariaDB in Docker
5. Create local database and run Alembic migrations
6. Start API (Uvicorn)
7. Run final checklist

---

## 1. Prerequisites

### 1.1 macOS

```bash
# Docker Desktop (install & start it)

# Homebrew (if you don't have it yet)
#/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python 3.12
brew install python@3.12

# MariaDB Connector/C (needed for the Python mariadb wheel to build)
brew install mariadb-connector-c

# FFmpeg (audio utils)
brew install ffmpeg

# Git
brew install git
````

Make sure Docker Desktop is running before you start containers.

---

### 1.2 Windows (PowerShell)

```powershell
# Docker Desktop for Windows (install & start it)

# Python 3.12
winget install -e --id Python.Python.3.12

# Git
winget install -e --id Git.Git

# FFmpeg
winget install -e --id Gyan.FFmpeg
# (or: choco install ffmpeg)

# MariaDB Connector/C
# 1) Download MariaDB Connector/C for Windows (MSI)
# 2) Run the installer (Typical)
# 3) Open a new PowerShell so PATH is refreshed
```

---

## 2. Clone & Virtual Env

```bash
git clone <your-repo-url>
cd basic_fastapi_server_resomix
```

**macOS / Linux shell:**

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell):**

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

---

## 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and keep only what’s needed:

```env
# API
RESOMIX_API_KEY=your-dev-api-key-here

# MariaDB (Docker Default)
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3307
MARIA_DB_USER=root
MARIA_DB_PASS=test
MARIA_DB_NAME=resomix_db

# Dev
RESOMIX_USE_DEVELOPMENT_CORS=true
RESOMIX_TEMP_DIR=temp_audio

# Optional
SIMILARITY_SERVER_URL=
```

**Important:** the port in `.env` must match the port exposed by Docker (we use **3307**).

---

## 4. Setup & Migrate (Alembic)

Start MariaDB locally using Docker:
```bash
docker run --name resomix-test-db -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 -d mariadb:10.5
```

Create the database schema natively (wait a few seconds after running the previous command):
```bash
docker exec -i resomix-test-db mariadb -uroot -ptest -e "CREATE DATABASE IF NOT EXISTS resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Run Alembic to create the tables based on the baseline schema:
```bash
alembic upgrade head
```

---

## 5. Run the API (Hot Reload)

Preferred (make):

```bash
make api
```

Optional (equivalent without make):

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload
```

Open:

* `http://localhost:8005/`
* `http://localhost:8005/docs`

---

## 6. Final Checklist

* [ ] Docker Desktop is running
* [ ] `.env` exists and uses **3307**
* [ ] `alembic upgrade head` ran without errors and generated tables
* [ ] FFmpeg is installed (`ffmpeg -version`)
* [ ] On Windows, MariaDB Connector/C was installed **before** `pip install`
* [ ] API reachable at `http://localhost:8005/docs`

That’s the full, minimal setup.
