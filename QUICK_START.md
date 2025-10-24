# Resomix Quick Start Guide

Complete step-by-step instructions to get Resomix running locally from scratch.

---

## 📋 What You'll Set Up

- Docker Desktop with MariaDB 11.3
- Python 3.12 virtual environment
- FFmpeg for audio processing
- MariaDB Connector/C for Python
- Resomix API server with hot-reload

---

## ⚡ Copy/Paste Setup

```bash
# Install system dependencies (macOS)
brew install mariadb-connector-c ffmpeg

# Clone and setup
git clone <your-repo-url>
cd basic_fastapi_server_resomix
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set MARIA_DB_PORT=3307, MARIA_DB_USER=resomix, MARIA_DB_PASS=secret

# Start services
docker compose up -d mariadb
python -m database.manage setup
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload

# Visit: http://localhost:8005/docs
```

---

## 📦 Step 1: Install System Dependencies

### macOS

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MariaDB Connector/C (required for mariadb Python package)
brew install mariadb-connector-c

# Install FFmpeg (required for audio processing)
brew install ffmpeg

# Verify installations
mariadb_config --version  # Should show version info
ffmpeg -version           # Should show FFmpeg version
docker --version          # Should show Docker 20.10+
```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt-get update

# Install dependencies
sudo apt-get install -y libmariadb-dev ffmpeg build-essential git

# Verify
mariadb_config --version
ffmpeg -version
```

### Linux (Fedora/RHEL)

```bash
sudo dnf install -y mariadb-connector-c-devel ffmpeg gcc git
```

---

## 🐍 Step 2: Setup Python Environment

### Install Python 3.12 (if needed)

```bash
# macOS
brew install python@3.12

# Linux (Ubuntu 22.04+)
sudo apt-get install -y python3.12 python3.12-venv

# Verify
python3.12 --version  # Should show 3.12.x
```

### Create Virtual Environment

```bash
# Navigate to project directory
cd basic_fastapi_server_resomix

# Create venv with Python 3.12
python3.12 -m venv .venv

# Activate venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# Upgrade pip
pip install --upgrade pip
```

**Your prompt should now show** `(.venv)` indicating the virtual environment is active.

---

## 📥 Step 3: Install Python Dependencies

```bash
# Ensure venv is activated
source .venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

**If you get `mariadb_config: command not found` error:**
- You skipped Step 1. Go back and install `mariadb-connector-c`

---

## ⚙️ Step 4: Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor: vim, code, etc.
```

**Required configuration (update these lines in .env):**

```env
# API Security
RESOMIX_API_KEY=your-dev-api-key-here

# MariaDB Configuration (Docker) - IMPORTANT: Use these exact values
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3307              # Docker exposes on 3307
MARIA_DB_USER=resomix           # Docker creates this user
MARIA_DB_PASS=secret            # Docker sets this password
MARIA_DB_NAME=resomix_db
MARIA_DB_ROOT_PASS=rootpass

# Development Settings
RESOMIX_USE_DEVELOPMENT_CORS=true
RESOMIX_TEMP_DIR=temp_audio
```

**Optional services** (leave empty if not using):
```env
SIMILARITY_SERVER_URL=http://localhost:8002
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
```

---

## 🐳 Step 5: Start Docker Services

```bash
# Start MariaDB in Docker
docker compose up -d mariadb

# Wait 10-15 seconds for MariaDB to initialize
sleep 15

# Check status
docker compose ps
```

**Expected output:**
```
NAME              IMAGE          STATUS                   PORTS
resomix-mariadb   mariadb:11.3   Up X seconds (healthy)   0.0.0.0:3307->3306/tcp
```

**If status shows "starting" or "unhealthy":**
```bash
# Wait a bit longer and check logs
docker compose logs mariadb

# If error persists, restart
docker compose down
docker compose up -d mariadb
```

---

## 🗄️ Step 6: Initialize Database

```bash
# Run database migrations (creates all tables)
python -m database.manage setup

# Expected output:
# 🚀 Setting up database...
# 📦 Running migrations...
# INFO:database.migration_manager:Applying migration: 001_initial_schema
# ✅ Migrations completed
# 🎉 Database setup completed successfully!
```

**Optional: Seed with sample data**
```bash
python -m database.manage setup --with-data

# This adds:
# - Sample roles and permissions
# - Sample artists, labels, genres
# - Sample tracks and playlists
# - Sample feedback entries
```

**Verify database:**
```bash
# Connect to MariaDB CLI
mysql -h 127.0.0.1 -P 3307 -u resomix -psecret resomix_db

# Show tables
SHOW TABLES;  # Should list 19 tables

# Exit
exit;
```

---

## 🚀 Step 7: Start the API Server

```bash
# Ensure venv is activated
source .venv/bin/activate

# Start server with hot-reload
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload

# Or use make command
make api
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8005 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Application startup complete.
```

---

## ✅ Step 8: Verify Everything Works

### Browser Tests

Open in your browser:
- **Swagger UI**: http://localhost:8005/docs
- **ReDoc**: http://localhost:8005/redoc  
- **Health Check**: http://localhost:8005/

### Command Line Tests

```bash
# Health check (no auth required)
curl http://localhost:8005/

# Expected:
# {"name":"Resomix API","version":"1.0.1","status":"running","docs_url":"/docs"}

# Authenticated endpoint test
curl "http://localhost:8005/api/search/?query=test&api_key=your-dev-api-key-here"
```

### Test in Swagger UI

1. Go to http://localhost:8005/docs
2. Click on any endpoint (e.g., `GET /api/search/`)
3. Click "Try it out"
4. Enter `api_key` parameter
5. Click "Execute"
6. Check response

---

## 🔧 Daily Development Workflow

### Starting Your Day

```bash
# 1. Navigate to project
cd basic_fastapi_server_resomix

# 2. Activate venv
source .venv/bin/activate

# 3. Start Docker services
make up  # or: docker compose up -d mariadb

# 4. Start API server
make api  # or: uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload
```

### Ending Your Day

```bash
# Stop API: Ctrl+C in terminal

# Stop Docker (keeps data)
make down  # or: docker compose down

# Deactivate venv
deactivate
```

### Clean Restart (Wipe All Data)

```bash
# Stop and remove all Docker volumes
docker compose down -v

# Start fresh
docker compose up -d mariadb
python -m database.manage setup
make api
```

---

## 📚 Useful Commands

### Docker Operations

```bash
make up          # Start MariaDB
make down        # Stop all Docker services
make logs        # View Docker logs (follows)
docker compose ps                # Check service status
docker compose logs -f mariadb   # Follow MariaDB logs only
docker compose restart mariadb   # Restart MariaDB
docker compose down -v           # Remove all data (fresh start)
```

### Database Operations

```bash
make db          # Connect to MariaDB CLI
make migrate     # Run migrations
make seed        # Run migrations + seed sample data

python -m database.manage status    # Show database status
python -m database.manage backup    # Create backup
python -m database.manage reset --confirm  # Drop all data
```

### Development

```bash
make api         # Start API with hot-reload
make test        # Run test suite
make fmt         # Format code (black + isort)
make lint        # Lint code (ruff)
make help        # Show all commands
```

### Testing

```bash
# Run all tests
pytest -v

# Run specific test suite
python tests/unit/test_routes/run_all_tests.py health search

# With coverage
pytest --cov=app --cov-report=html
```

---

## 🐛 Troubleshooting

### Issue: `mariadb_config: command not found`

**Cause**: MariaDB Connector/C not installed  
**Fix**:
```bash
brew install mariadb-connector-c  # macOS
sudo apt-get install libmariadb-dev  # Linux
```

### Issue: `Can't connect to server on '127.0.0.1'`

**Cause**: Wrong .env configuration or Docker not running  
**Fix**:
```bash
# 1. Check Docker is running
docker compose ps  # Should show "healthy"

# 2. Verify .env has correct values
grep MARIA_DB .env
# Should show:
# MARIA_DB_PORT=3307  (not 3306)
# MARIA_DB_USER=resomix
# MARIA_DB_PASS=secret

# 3. Test connection manually
mysql -h 127.0.0.1 -P 3307 -u resomix -psecret -e "SELECT 1"
```

### Issue: `Port 3307 already in use`

**Cause**: Another service using port 3307  
**Fix**:
```bash
# Find what's using the port
lsof -i :3307

# Either kill that process or change port in docker-compose.yml
# Edit docker-compose.yml: ports: ["3308:3306"]
# Edit .env: MARIA_DB_PORT=3308
```

### Issue: `FFmpeg not found` or audio processing fails

**Cause**: FFmpeg not installed  
**Fix**:
```bash
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Linux

# Verify
ffmpeg -version
```

### Issue: Python 3.13 compatibility errors

**Cause**: Some packages don't support Python 3.13 yet  
**Fix**:
```bash
# Install Python 3.12
brew install python@3.12

# Recreate venv
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: Migration fails with foreign key error

**Cause**: Old tables from previous failed migration  
**Fix**:
```bash
# Option 1: Clean restart
docker compose down -v
docker compose up -d mariadb
python -m database.manage setup

# Option 2: Manual cleanup
mysql -h 127.0.0.1 -P 3307 -u resomix -psecret resomix_db -e "DROP DATABASE resomix_db; CREATE DATABASE resomix_db;"
python -m database.manage setup
```

### Issue: `make` command not found or not working

**Cause**: Make not installed or Makefile issues  
**Fix**:
```bash
# Install make (if needed)
brew install make  # macOS
sudo apt-get install make  # Linux

# Or run commands directly without make
docker compose up -d mariadb  # instead of: make up
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload  # instead of: make api
```

### Issue: API starts but crashes on first request

**Common causes and fixes:**

1. **Database not migrated**
   ```bash
   python -m database.manage setup
   ```

2. **FFmpeg missing**
   ```bash
   brew install ffmpeg
   ```

3. **Wrong API key**
   ```bash
   # Check .env file has RESOMIX_API_KEY set
   grep RESOMIX_API_KEY .env
   ```

---

## 🔍 Optional: Enable Elasticsearch

If you need full-text search functionality:

```bash
# 1. Start Elasticsearch
docker compose --profile search up -d

# 2. Update .env
echo "ELASTICSEARCH_ENABLED=true" >> .env
echo "ES_URL=http://127.0.0.1:9200" >> .env

# 3. Restart API
# Press Ctrl+C to stop current API
make api
```

**Verify Elasticsearch:**
```bash
curl http://localhost:9200/_cluster/health
```

---

## 🎯 Next Steps

1. **Explore API Documentation**: http://localhost:8005/docs
2. **Read Main README**: [README.md](README.md) for architecture and development guidelines
3. **Check Additional Docs**: `/docs` folder for feature-specific guides
4. **Run Tests**: `make test` to ensure everything works
5. **Start Building**: Create your first endpoint or explore existing ones

---

## 💡 Pro Tips

- **Use `make help`** to see all available commands
- **Keep Docker running** during development for faster iteration
- **Use hot-reload** (`make api`) to see changes instantly
- **Check logs** (`make logs`) when debugging issues
- **Test database connection** before running migrations
- **Format code** (`make fmt`) before every commit
- **Run tests** (`make test`) before pushing code

---

## 📞 Getting Help

- **Check logs**: `make logs` or `docker compose logs -f mariadb`
- **Database status**: `python -m database.manage status`
- **Health check**: Visit http://localhost:8005/
- **API Documentation**: http://localhost:8005/docs
- **Project Issues**: Check GitHub Issues or create a new one

---
