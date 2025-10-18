# ResomiX Audio Similarity API

A production-ready FastAPI service for audio similarity analysis, metadata extraction, and playlist management backed by MariaDB with 2.3M+ tracks.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Development Guidelines](#-development-guidelines)
- [Documentation](#-documentation)

---

## 🎵 Project Overview

ResomiX is an advanced audio similarity API that enables music discovery through intelligent audio analysis. The system provides:

- **Audio Similarity Matching**: Upload or query by path to find similar tracks from 2.2M+ database
- **Metadata Processing**: Extract and clean audio metadata using FFmpeg + Mutagen
- **Search & Discovery**: Advanced search across tracks, artists, albums, labels, and genres
- **Playlist Management**: Create custom playlists with similarity-based suggestions
- **External Integrations**: Spotify, Tidal, and Google Sheets integration
- **Secure Media Delivery**: Time-limited signed URLs for audio previews

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   FastAPI   │ ──▶ │ Controllers  │ ──▶ │  Services   │
│   Routers   │     │   (Thin)     │     │ (Business)  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Pydantic  │     │ Repositories │ ──▶ │   MariaDB   │
│   Schemas   │     │ (Data Layer) │     │  2.2M tracks│
└─────────────┘     └──────────────┘     └─────────────┘
```

**Project Structure:**
```
basic_fastapi_server_resomix/
├── app/
│   ├── api/              # Routers, middlewares, dependencies
│   ├── controllers/      # HTTP handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Data access layer
│   ├── models/           # SQLAlchemy ORM models
│   ├── schemas/          # Pydantic validation schemas
│   ├── core/             # Config, security, exceptions
│   └── utils/            # Helper utilities
├── database/
│   ├── migrations/       # SQL migration files
│   ├── connection.py     # Database connection manager
│   └── manage.py         # CLI for database operations
├── scripts/              # Maintenance and utility scripts
├── tests/                # Unit and integration tests
├── docs/                 # Additional documentation
├── docker-compose.yml    # Docker services configuration
└── run.py               # Development server entry point
```

---

## 🛠️ Technology Stack

- **Framework**: FastAPI 0.109.0 (async/await)
- **Database**: MariaDB 11.3 with SQLAlchemy 2.0
- **Audio Processing**: FFmpeg + Mutagen
- **Search**: Elasticsearch 8.11 (optional)
- **External APIs**: Spotify, Tidal, Google Sheets
- **Security**: API key auth, URL signing, input validation
- **Python**: 3.12 (recommended), supports 3.8-3.12

---

## ✅ Prerequisites

### Required Versions

| Component | Version | Notes |
|-----------|---------|-------|
| **Python** | 3.12.x | **Recommended**. Supports 3.8-3.12, NOT 3.13 |
| **Docker Desktop** | 20.10+ | For running MariaDB |
| **MariaDB** | 11.3+ | Runs in Docker container |
| **FFmpeg** | Latest | System-level installation required |

### System Dependencies

Before installing Python packages, you need:

#### macOS (via Homebrew)
```bash
# MariaDB Connector/C (required for mariadb Python package)
brew install mariadb-connector-c

# FFmpeg (required for audio processing)
brew install ffmpeg

# Verify installations
mariadb_config --version
ffmpeg -version
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y libmariadb-dev ffmpeg build-essential
```

#### Linux (Fedora/RHEL)
```bash
sudo dnf install -y mariadb-connector-c-devel ffmpeg gcc
```

### Optional Services

- **Similarity Microservice**: External service for audio similarity computation
- **Elasticsearch**: For advanced full-text search (can use Docker profile)
- **Google Service Account**: For Sheets integration (feedback/contact forms)

---

## 🚀 Getting Started

### Quick Clone & Setup

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd basic_fastapi_server_resomix

# 2. Create virtual environment with Python 3.12
python3.12 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration (see below)

# 5. Start Docker services
docker compose up -d mariadb

# 6. Run database migrations
python -m database.manage setup

# 7. Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload
```

### Environment Configuration

Minimal `.env` configuration for local development:

```env
# API Security
RESOMIX_API_KEY=your-secure-api-key-here

# MariaDB (Docker)
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3307
MARIA_DB_USER=resomix
MARIA_DB_PASS=secret
MARIA_DB_NAME=resomix_db

# Development
RESOMIX_USE_DEVELOPMENT_CORS=true
```

For detailed setup instructions including troubleshooting, see **[QUICK_START.md](QUICK_START.md)**.

### Verify Installation

```bash
# Health check
curl "http://localhost:8005/?api_key=your-api-key"

# Interactive API documentation
open http://localhost:8005/docs
```

---

## 📚 Development Guidelines

### Code Standards

1. **Style Guide**
   - Follow PEP 8 conventions
   - Use `black` for code formatting
   - Use `isort` for import sorting
   - Run `make fmt` before committing

2. **Type Hints & Documentation**
   - Add type hints to all function signatures
   - Include docstrings for classes and public methods
   - Document complex logic with inline comments

3. **Architecture Patterns**
   - **Controllers**: Thin layer, handle HTTP requests/responses only
   - **Services**: Business logic, no HTTP knowledge
   - **Repositories**: Data access, database operations only
   - **Schemas**: Pydantic models for validation and serialization

### Project Workflow

1. **Branch Strategy**
   ```bash
   # Feature branches
   git checkout -b feature/add-new-endpoint
   
   # Bug fixes
   git checkout -b fix/resolve-connection-issue
   ```

2. **Commit Convention**
   ```
   feat: add similarity deduplication algorithm
   fix: resolve database connection timeout
   docs: update API documentation
   refactor: optimize track search query
   test: add integration tests for playlists
   ```

3. **Before Committing**
   ```bash
   # Format code
   make fmt
   
   # Run linter
   make lint
   
   # Run tests
   make test
   
   # Check for issues
   python -m database.manage status
   ```

### Testing Requirements

- **Write tests** for all new features and bug fixes
- **Maintain coverage** ≥ 80%
- **Test types**: Unit tests (services, utils), Integration tests (API endpoints)
- **Test location**: `tests/unit/` and `tests/integration/`

```bash
# Run all tests
pytest -v

# Run specific test suite
python tests/unit/test_routes/run_all_tests.py health search

# Generate coverage report
pytest --cov=app --cov-report=html
```

### Database Migrations

1. **Create new migration**
   ```bash
   # Create new file: database/migrations/002_add_new_table.sql
   # Write clean SQL with IF NOT EXISTS
   ```

2. **Test migration**
   ```bash
   # Test on fresh database
   docker compose down -v
   docker compose up -d mariadb
   python -m database.manage setup
   ```

3. **Rollback if needed**
   ```bash
   python -m database.manage rollback <version>
   ```

### Code Quality Checklist

Before submitting a PR:

- [ ] Code follows PEP 8 and project style guide
- [ ] All functions have type hints and docstrings
- [ ] New features have corresponding tests
- [ ] All tests pass (`make test`)
- [ ] Code is formatted (`make fmt`)
- [ ] No linter errors (`make lint`)
- [ ] Database migrations tested
- [ ] `.env` or secrets not committed
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow convention

### Performance Guidelines

- **Async First**: Use `async`/`await` for I/O operations
- **Connection Pooling**: Leverage SQLAlchemy connection pool
- **Query Optimization**: Use indexes, avoid N+1 queries
- **Caching**: Consider caching for frequently accessed data
- **Logging**: Use structured logging, no `print()` statements

### Security Best Practices

- **Never commit** `.env`, credentials, or API keys
- **Validate inputs** using Pydantic schemas
- **Use parameterized queries** (SQLAlchemy ORM handles this)
- **Rate limiting** on public endpoints
- **API key authentication** on all routes except health checks
- **Signed URLs** for media access with expiration

---

## 📖 Documentation

- **[QUICK_START.md](QUICK_START.md)**: Step-by-step setup guide with troubleshooting
- **[/docs/SPOTIFY_TRANSFER_README.md](docs/SPOTIFY_TRANSFER_README.md)**: Spotify integration guide
- **[/docs/TIDAL_TRANSFER_README.md](docs/TIDAL_TRANSFER_README.md)**: Tidal integration guide
- **[/docs/database.md](docs/database.md)**: Database schema and design notes
- **API Documentation**: Available at `/docs` and `/redoc` endpoints when server is running

### Useful Commands

```bash
# Development
make up          # Start Docker services
make down        # Stop Docker services
make api         # Start API with hot-reload
make logs        # View Docker logs

# Database
make migrate     # Run migrations
make seed        # Run migrations + seed data
make db          # Connect to MariaDB CLI

# Code Quality
make fmt         # Format code (black + isort)
make lint        # Lint code (ruff)
make test        # Run test suite

# Help
make help        # Show all available commands
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the development guidelines above
4. Write tests for your changes
5. Ensure all tests pass and code is formatted
6. Commit with conventional commit messages
7. Push to your branch
8. Open a Pull Request with detailed description

---

## 📞 Support & Contact

- **Issues**: GitHub Issues for bugs and feature requests
- **API Documentation**: Available at `/docs` endpoint
- **Health Check**: `GET /api/health/`

---

**Built with ❤️ for music discovery**
