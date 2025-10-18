# ResomiX Audio Similarity API

A production-ready FastAPI service for audio similarity analysis, metadata extraction and playlist management backed by MariaDB.

---

## 📁 Project Structure (High-Level)

```text
basic_fastapi_server_resomix/
├── app/               # FastAPI application package
│   ├── api/           # Routers, middlewares & dependencies
│   ├── controllers/   # Thin HTTP handlers
│   ├── services/      # Business-logic layer
│   ├── repositories/  # Data-access layer (SQLAlchemy)
│   ├── models/        # ORM models
│   ├── schemas/       # Pydantic schemas (DTO / validation)
│   └── core/          # Config, security, observability
├── database/          # SQL migrations, CLI & helpers
├── scripts/           # One-off & maintenance scripts
├── tests/             # Unit & integration tests
└── run.py             # Simple development entry-point
```

See `docs/` for deeper architecture notes.

---

## ✨ Core Features

• **Audio similarity** (upload / server-path) with de-duplication  
• **Metadata extraction** & cleaning using FFmpeg + Mutagen  
• **Search & discovery** across 2.2 M+ tracks  
• **Playlist system** with similarity-based suggestions  
• **External integrations**: Spotify, Tidal, Google Sheets  
• **Secure previews** with time-limited signed URLs  
• **Full async support**, connection pooling & observability

---

## 🚀 Getting Started

### 1 – Prerequisites

* Python 3.8-3.12
* MariaDB 10.5+ running locally (or Docker)
* FFmpeg in `PATH`
* (Optional) Similarity micro-service for heavy similarity calls

### 2 – Installation

```bash
# Clone & enter repo
git clone https://github.com/<you>/basic_fastapi_server_resomix.git
cd basic_fastapi_server_resomix

# Create & activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3 – Environment Variables

Copy the sample file and fill in **at least** the starred vars:

```bash
cp .env.example .env
```

```env
# ★ API key used by all clients
RESOMIX_API_KEY=<your_random_key>

# ★ Database connection (MariaDB)
MARIA_DB_HOST=127.0.0.1
MARIA_DB_USER=resomix
MARIA_DB_PASS=secret
MARIA_DB_NAME=resomix_db

# External services (optional)
SIMILARITY_SERVER_URL=http://localhost:8002
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
```

### 4 – Database Setup

```bash
# Create database & user (adjust creds) – skip if you already have one
mariadb -u root -p -e "CREATE DATABASE resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations & (optionally) seed sample data
python -m database.manage setup           # schema only
python -m database.manage setup --with-data   # + sample data
```

### 5 – Run the Server

```bash
# Development (autoreload off)
python run.py                            # http://localhost:8001

# Production example (gunicorn or uvicorn)
uvicorn app.main:app --host 0.0.0.0 --port 8005 --workers 4
```

Interactive documentation:  
• Swagger UI → `http://localhost:8001/docs`  
• ReDoc     → `http://localhost:8001/redoc`

### 6 – Running Tests

```bash
pytest -q                # full suite
# or run selective route tests
python tests/unit/test_routes/run_all_tests.py health search
```

---

## 🔧 Developer Workflow & Best Practices

1. **Branching**: feature/xyz or fix/xyz → PR → main  
2. **Commit style**: Conventional Commits (e.g. `feat: add similarity dedupe`)  
3. **Coding style**: follow `black` (PEP-8) + `isort`; run `make format` before PR  
4. **Env safety**: *never* commit `.env` or creds. Use dotenv & secrets manager.  
5. **Type hints + docstrings** on all public functions/classes.  
6. **Tests**: write/extend tests for every new feature; keep coverage ≥ 80 %.  
7. **Database migrations**: one numbered SQL file per change in `database/migrations/`; run migration CLI after review.  
8. **Performance**: prefer async service/repository calls; avoid blocking IO.  
9. **Logging**: use `app.utils.logging_utils`; no `print` in prod code.  
10. **CI**: GitHub Actions (or similar) should run `format`, `lint`, `tests`.

Happy hacking 🎧
