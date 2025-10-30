# Resomix Audio Similarity API

**Production-ready FastAPI service for music discovery via intelligent audio analysis**

A powerful backend for finding similar tracks, managing playlists, and discovering music from a database of **2.3M+ tracks** backed by MariaDB. Built for scalability, security, and clean architecture.

> 📌 **For setup instructions, see [QUICK_START.md](QUICK_START.md)** — this guide focuses on development practices and architecture.

---

## 🎯 What is Resomix?

Resomix enables music discovery through audio similarity analysis. Users upload tracks or query existing ones to find similar music, build playlists, and integrate with external services like Spotify and Tidal.

**Core Capabilities:**
- **Audio Similarity Matching** – Upload or query by ID to find similar tracks
- **Metadata Processing** – Extract and clean metadata (title, artist, BPM, key, etc.)
- **Search & Discovery** – Full-text search across tracks, artists, albums, genres
- **Playlist Management** – Auto-generate, rename, organize, and fork playlists
- **External Integrations** – Spotify/Tidal transfer, Google Sheets logging
- **Secure Media Delivery** – Time-limited signed URLs for previews
- **User Authentication** – Dual auth (API key + JWT), registration, password reset, 2FA

**Live Endpoints:** 
- Production: `https://bserver.resomix.com`
- Interactive Docs: `https://bserver.resomix.com/docs`

---

## 🏗️ Architecture at a Glance

Four-layer layered architecture with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────────┐
│ Router (app/api/routers/)          - HTTP endpoints only     │
│   ↓ handles requests, responses, dependencies                │
├──────────────────────────────────────────────────────────────┤
│ Controller (app/controllers/)       - Thin HTTP handlers     │
│   ↓ validation, logging, response formatting                 │
├──────────────────────────────────────────────────────────────┤
│ Service (app/services/)             - Business Logic ⭐      │
│   ↓ core rules, orchestration, NO HTTP knowledge            │
├──────────────────────────────────────────────────────────────┤
│ Repository (app/repositories/)      - Data Access Layer     │
│   ↓ database queries, CRUD only                             │
├──────────────────────────────────────────────────────────────┤
│ Models (app/models/)                - SQLAlchemy ORM        │
│   ↓ database schema definitions                             │
├──────────────────────────────────────────────────────────────┤
│ MariaDB                             - 2.3M+ Tracks          │
└──────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- Easy to test (business logic isolated from HTTP)
- Easy to maintain (clear responsibility)
- Easy to extend (add features without touching routers)
- Easy to debug (trace requests top-to-bottom)

---

## 📂 Project Structure

```
basic_fastapi_server_resomix/
├── app/
│   ├── main.py                  # FastAPI app, exception handlers, lifespan
│   ├── observability.py         # Timing middleware, system metrics
│   ├── api/
│   │   ├── routers/             # 22+ endpoint routers (similarity, playlists, etc.)
│   │   ├── middlewares/         # CORS, rate limiting
│   │   └── dependencies/        # Auth, database session injection
│   ├── controllers/             # 19 controllers (thin HTTP handlers)
│   ├── services/                # 26 services (business logic)
│   ├── repositories/            # 17 repositories (data access)
│   ├── models/                  # 17 SQLAlchemy models (Track, User, Playlist, etc.)
│   ├── schemas/                 # Pydantic validation models
│   ├── core/
│   │   ├── config.py            # 500+ lines of settings & env management
│   │   ├── security.py          # JWT, password hashing, 2FA
│   │   └── exceptions.py        # Custom exception hierarchy
│   └── utils/                   # Helpers (response formatting, search filters, etc.)
├── database/
│   ├── connection.py            # SQLAlchemy engine, session management
│   ├── manage.py                # CLI for migrations, schema setup
│   └── migrations/              # SQL migration files
├── scripts/                     # Maintenance scripts (seed data, cleanup)
├── tests/                       # Unit & integration tests
├── docs/                        # Additional guides (Auth, Spotify, Tidal, etc.)
└── docker-compose.yml           # MariaDB, Elasticsearch (optional)
```

---

## 🛠️ Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.12 | Language |
| **FastAPI** | 0.109 | Web framework |
| **MariaDB** | 11.3+ | Primary database |
| **SQLAlchemy** | 2.0 | ORM |
| **Pydantic** | 2.5+ | Validation |
| **FFmpeg** | Latest | Audio analysis |
| **Mutagen** | 1.47 | Metadata extraction |
| **Elasticsearch** | 8.12 | Full-text search (optional) |
| **JWT** | `python-jose` | Authentication |
| **Bcrypt** | 4.0.1 | Password hashing |

---

## 👨‍💻 Development Quickstart

### Prerequisites
- Python 3.12, Docker, FFmpeg installed ([see QUICK_START.md](QUICK_START.md))
- `.env` configured with MariaDB credentials

### Start Development
```bash
# Activate venv
source .venv/bin/activate

# Start MariaDB
docker compose up -d mariadb

# Run migrations
python -m database.manage setup

# Start API with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload

# Open docs
open http://localhost:8005/docs
```

---

## 📝 Development Patterns

### ⭐ The Rule: Everything Has a Place

**No business logic in routers or controllers.**  
**No HTTP knowledge in services or repositories.**  
**No side effects in models.**

This is **non-negotiable** in this codebase.

---

### 1️⃣ Adding a New Feature (Step-by-Step)

Let's say you want to add **"Playlist Notes"** (a new field to store notes on playlists).

#### **Step 1: Database Model** (`app/models/playlist.py`)
```python
class Playlist(Base):
    # ... existing fields ...
    notes: Optional[str] = Column(Text, nullable=True)
```

Create a migration:
```bash
python -m database.manage create-migration add_notes_to_playlists
# Edit the generated SQL file, then:
python -m database.manage migrate
```

---

#### **Step 2: Pydantic Schemas** (`app/schemas/playlist.py`)

**Request Schema:**
```python
from pydantic import BaseModel, Field, validator

class PlaylistUpdateRequest(BaseModel):
    playlist_id: str = Field(..., description="Playlist UUID")
    notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('notes')
    def validate_notes(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Notes cannot be empty or whitespace only')
        return v.strip() if v else None
```

**Response Schema:**
```python
class PlaylistResponse(BaseModel):
    id: int
    uuid: str
    name: str
    notes: Optional[str]
    
    class Config:
        from_attributes = True
```

---

#### **Step 3: Repository Method** (`app/repositories/playlist_repository.py`)

**Golden Rule:** Data access only. Return dicts, not models.

```python
async def async_update_notes(
    self,
    db: AsyncSession,
    playlist_uuid: str,
    notes: Optional[str],
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Update playlist notes by UUID.
    
    Args:
        db: Database session
        playlist_uuid: Playlist UUID
        notes: New notes text (or None)
        user_id: User ID for ownership check (if authenticated)
    
    Returns:
        Dict with success/error and updated data
    """
    try:
        # Query
        stmt = select(Playlist).where(Playlist.uuid == playlist_uuid)
        result = await db.execute(stmt)
        playlist = result.scalar_one_or_none()
        
        if not playlist:
            return {"success": False, "error": "Playlist not found"}
        
        # Ownership check (for authenticated users)
        if user_id is not None and playlist.user_id != user_id:
            return {"success": False, "error": "Not authorized"}
        
        # Update
        playlist.notes = notes
        await db.commit()
        
        return {
            "success": True,
            "data": {
                "id": playlist.id,
                "uuid": playlist.uuid,
                "notes": playlist.notes
            }
        }
    except Exception as e:
        await db.rollback()
        return {"success": False, "error": str(e)}
```

**Key Points:**
- Use async methods (`async def`)
- Return dicts (not models)
- Commit on success, rollback on error
- Check ownership if needed

---

#### **Step 4: Service Layer** (`app/services/playlist_service.py`)

**Golden Rule:** Business logic here. No HTTP, no SQL.

```python
async def update_playlist_notes(
    self,
    db: AsyncSession,
    playlist_uuid: str,
    notes: Optional[str],
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Update playlist notes with business rule validation.
    
    Business Rules:
    - Notes cannot exceed 500 words
    - Cannot update another user's playlist
    """
    # Apply business rules
    if notes:
        word_count = len(notes.split())
        if word_count > 500:
            return {
                "success": False,
                "error": f"Notes exceed word limit (500 max, got {word_count})"
            }
    
    # Delegate to repository
    return await self.playlist_repository.async_update_notes(
        db, playlist_uuid, notes, user_id
    )
```

**What goes here:**
- Business rules (word limits, duplicate checks, etc.)
- Orchestration (call multiple repositories)
- Caching logic
- Email notifications

**What does NOT go here:**
- HTTP details (status codes, headers)
- Database queries (use repositories!)
- Request/response formatting

---

#### **Step 5: Controller** (`app/controllers/playlist_controller.py`)

**Golden Rule:** HTTP concerns only. Call services, format responses, log.

```python
async def update_playlist_notes(
    self,
    db: AsyncSession,
    request: Request,
    update_data: PlaylistUpdateRequest,
    current_user: Optional[User] = None
) -> JSONResponse:
    """Update playlist notes with logging and error handling."""
    start_time = time.time()
    correlation_id = self.logging_service.generate_correlation_id()
    
    try:
        # Get user ID if authenticated
        user_id = current_user.id if current_user else None
        
        # Call service (business logic)
        result = await self.playlist_service.update_playlist_notes(
            db,
            update_data.playlist_id,
            update_data.notes,
            user_id
        )
        
        # Log operation
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO" if result["success"] else "WARNING",
            category="USER_ACTION",
            action="update_playlist_notes",
            message=f"Update notes: {'Success' if result['success'] else 'Failed'}",
            correlation_id=correlation_id,
            request=request,
            status_code=200 if result["success"] else 400,
            duration_ms=duration_ms,
            metadata={"playlist_id": update_data.playlist_id}
        )
        
        # Format response
        if result["success"]:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=result["data"])
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=format_response(success=False, error=result["error"])
            )
    except Exception as e:
        # Error handling
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="ERROR",
            category="USER_ACTION",
            action="update_playlist_notes",
            message=f"Unexpected error: {str(e)}",
            correlation_id=correlation_id,
            request=request,
            status_code=500,
            duration_ms=duration_ms
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="Internal server error")
        )
```

**What goes here:**
- HTTP request/response handling
- Input validation (Pydantic handles most of this)
- Calling services
- Logging and error handling
- Response formatting with `format_response()`

**What does NOT go here:**
- Database queries
- Business rule enforcement

---

#### **Step 6: Router Endpoint** (`app/api/routers/playlists.py`)

**Golden Rule:** HTTP definitions only. Wire dependencies, call controller.

```python
from app.schemas.playlist import PlaylistUpdateRequest

@router.put(
    "/notes/",
    response_model=PlaylistOperationResponse,
    summary="Update Playlist Notes",
    description="Update the notes field of a playlist."
)
async def update_playlist_notes_endpoint(
    request: Request,
    update_data: PlaylistUpdateRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Update notes on a playlist.
    
    - **playlist_id**: UUID of the playlist
    - **notes**: New notes (max 1000 characters)
    
    Authenticated users (JWT) can only modify their own playlists.
    """
    return await playlist_controller.update_playlist_notes(
        db, request, update_data, current_user
    )
```

**What goes here:**
- Route definition (`@router.put()`)
- Parameter docs
- OpenAPI response definitions
- Dependency injection (database, auth, etc.)

**What does NOT go here:**
- Business logic
- Implementation details

---

### 2️⃣ Authentication & User Context

All endpoints support **dual authentication:**

#### **API Key (Anonymous/Public)**
```bash
curl "http://localhost:8005/get_similarity/?api_key=your-api-key" -F "file=@track.mp3"
```

#### **JWT Token (Authenticated Users)**
```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:8005/users/me
```

#### **Getting User in Code**
```python
from app.api.dependencies.auth import get_current_user_optional

async def my_endpoint(
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    user_id = current_user.id if current_user else None
    # Use user_id for ownership checks, personalization, etc.
```

---

### 3️⃣ Response Format

**Always use `format_response()`:**

```python
from app.utils.response_utils import format_response

# Success
return JSONResponse(
    status_code=200,
    content=format_response(success=True, data={"id": 1, "name": "My Playlist"})
)

# Error
return JSONResponse(
    status_code=400,
    content=format_response(success=False, error="Invalid input")
)
```

**Response Structure:**
```json
{
  "success": true,
  "data": { /* your data */ },
  "error": null
}
```

---

### 4️⃣ Error Handling

Use custom exceptions from `app/core/exceptions.py`:

```python
from app.core.exceptions import NotFoundError, ValidationError

# In service:
if not track:
    raise NotFoundError(f"Track {track_id} not found")

if not is_valid:
    raise ValidationError("Email must be valid")
```

Global exception handlers in `app/main.py` automatically format responses.

---

### 5️⃣ Logging

Use `LoggingService` for structured logging:

```python
from app.services.logging_service import LoggingService

logging_service = LoggingService()

await logging_service.log(
    async_db=db,
    level="INFO",  # or "WARNING", "ERROR"
    category="USER_ACTION",
    action="upload_track",
    message="Track uploaded successfully",
    correlation_id=correlation_id,
    request=request,
    status_code=200,
    duration_ms=1234.5,
    metadata={"track_id": 123}
)
```

**Never use `print()`** – it doesn't persist. Use structured logging.

---

### 6️⃣ Database Logging (Admin Panel Access)

In addition to file logging, we store **all request/action logs in the database** for easy access via the admin panel. This is essential for auditing, debugging, and monitoring user actions.

#### **What Gets Logged?**
- **Request Details**: HTTP method, endpoint, query params, client IP, user agent
- **Response Details**: Status code, response size, duration
- **User Actions**: Track uploads, playlist renames, searches, etc.
- **Errors**: Stack traces, error messages, error context
- **System Metrics**: CPU usage, memory usage at request time
- **Metadata**: Custom data relevant to the action (track IDs, playlist IDs, etc.)
- **Correlation ID**: Unique request identifier for tracing across logs

#### **Database Schema** (`app/models/log.py`)
```python
class SystemLog(Base):
    __tablename__ = "system_logs"
    
    id: BigInteger                              # Auto-incrementing ID
    correlation_id: str                         # Request tracking ID
    level: Enum('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
    category: str                               # REQUEST, USER_ACTION, ERROR, SYSTEM, etc.
    action: str                                 # Specific action (e.g., "upload_track")
    message: str                                # Human-readable message
    method: str                                 # HTTP method (GET, POST, etc.)
    endpoint: str                               # API endpoint path (indexed)
    status_code: int                            # HTTP response code (indexed)
    duration_ms: float                          # Request duration
    client_ip: str                              # Client IP address (indexed)
    track_id: int                               # FK to track (if applicable)
    playlist_id: int                            # FK to playlist (if applicable)
    log_metadata: JSON                          # Custom structured data
    stack_trace: str                            # Full error traceback (for ERROR logs)
    cpu_percent: float                          # System CPU usage
    memory_percent: float                       # System memory usage
    created_at: DateTime                        # Timestamp (indexed)
```

#### **Usage in Controllers**

Every controller should log both **success and error** paths:

```python
from app.services.logging_service import LoggingService
import time

class PlaylistController:
    def __init__(self):
        self.playlist_service = PlaylistService()
        self.logging_service = LoggingService()  # Initialize logging service
    
    async def rename_playlist(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        new_name: str,
        current_user: Optional[User] = None
    ) -> JSONResponse:
        """Rename playlist with comprehensive logging."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Validate inputs first
            if not playlist_id or not new_name:
                # Log validation error
                await self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="rename_playlist",
                    message="Playlist rename failed: validation error",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=(time.time() - start_time) * 1000,
                    metadata={
                        "error": "Missing required fields",
                        "playlist_id": playlist_id,
                        "user_id": current_user.id if current_user else None
                    }
                )
                return JSONResponse(
                    status_code=422,
                    content=format_response(success=False, error="Invalid input")
                )
            
            # Call service
            user_id = current_user.id if current_user else None
            result = await self.playlist_service.rename_playlist(
                db, playlist_id, new_name, user_id
            )
            
            # Log success
            if result["success"]:
                await self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="rename_playlist",
                    message=f"Playlist renamed: '{result['old_name']}' → '{new_name}'",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=(time.time() - start_time) * 1000,
                    metadata={
                        "playlist_id": playlist_id,
                        "old_name": result["old_name"],
                        "new_name": new_name,
                        "user_id": user_id
                    }
                )
                return JSONResponse(
                    status_code=200,
                    content=format_response(success=True, data=result)
                )
            else:
                # Log failure (not found, permissions, etc.)
                await self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="rename_playlist",
                    message=f"Playlist rename failed: {result['error']}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404 if result["error"] == "Playlist not found" else 400,
                    duration_ms=(time.time() - start_time) * 1000,
                    metadata={
                        "error": result["error"],
                        "playlist_id": playlist_id,
                        "user_id": user_id
                    }
                )
                return JSONResponse(
                    status_code=400,
                    content=format_response(success=False, error=result["error"])
                )
        
        except Exception as e:
            # Log unexpected errors
            import traceback
            await self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="USER_ACTION",
                action="rename_playlist",
                message=f"Unexpected error: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=(time.time() - start_time) * 1000,
                error=e,
                stack_trace=traceback.format_exc(),
                metadata={
                    "playlist_id": playlist_id,
                    "user_id": current_user.id if current_user else None
                }
            )
            return JSONResponse(
                status_code=500,
                content=format_response(success=False, error="Internal server error")
            )
```

#### **Key Logging Patterns**

**1. Validation Errors** (WARNING)
```python
await self.logging_service.log(
    async_db=db,
    level="WARNING",
    category="USER_ACTION",
    action="rename_playlist",
    message="Validation failed: empty playlist_id",
    correlation_id=correlation_id,
    request=request,
    status_code=422,
    duration_ms=elapsed_ms,
    metadata={"error": "playlist_id cannot be empty"}
)
```

**2. Successful Operations** (INFO)
```python
await self.logging_service.log(
    async_db=db,
    level="INFO",
    category="USER_ACTION",
    action="upload_track",
    message="Track uploaded and stored successfully",
    correlation_id=correlation_id,
    request=request,
    status_code=200,
    duration_ms=elapsed_ms,
    metadata={
        "track_id": 12345,
        "filename": "song.mp3",
        "file_size": 5242880,
        "user_id": user_id
    }
)
```

**3. Errors** (ERROR with stack trace)
```python
await self.logging_service.log(
    async_db=db,
    level="ERROR",
    category="SYSTEM",
    action="database_operation",
    message=f"Database connection failed: {str(e)}",
    correlation_id=correlation_id,
    request=request,
    status_code=500,
    duration_ms=elapsed_ms,
    error=e,
    stack_trace=traceback.format_exc(),
    metadata={"operation": "save_playlist"}
)
```

#### **Querying Logs from Admin Panel**

Logs are stored in `system_logs` table with indexes on:
- `correlation_id` – trace full request flow
- `endpoint` – find all calls to an endpoint
- `status_code` – find errors (≥ 400)
- `action` – find specific user actions
- `created_at` – time-based filtering
- `level` – filter by severity

Example query for admin dashboard:
```sql
-- Find all errors in the last hour
SELECT id, action, message, status_code, correlation_id, created_at 
FROM system_logs 
WHERE level = 'ERROR' 
  AND created_at >= NOW() - INTERVAL 1 HOUR
ORDER BY created_at DESC;

-- Find all uploads by a user
SELECT id, message, status_code, duration_ms, created_at 
FROM system_logs 
WHERE action = 'upload_track' 
  AND metadata->>'user_id' = '123'
ORDER BY created_at DESC;

-- Find slow requests (> 5 seconds)
SELECT id, endpoint, status_code, duration_ms, created_at 
FROM system_logs 
WHERE duration_ms > 5000 
ORDER BY duration_ms DESC;
```

#### **Why This Matters**

✅ **Auditing** – See exactly what users did and when  
✅ **Debugging** – Trace requests via correlation ID  
✅ **Monitoring** – Find performance issues (slow endpoints)  
✅ **Security** – Track failed logins, unauthorized access  
✅ **Analytics** – Which endpoints are popular, error rates  
✅ **Admin Panel** – Display logs in user-friendly dashboard  

---

## 🎨 Code Standards

### Type Hints (Required)
```python
# ✅ Good
async def search_tracks(
    db: AsyncSession,
    query: str,
    limit: int = 20
) -> List[Track]:
    ...

# ❌ Bad
async def search_tracks(db, query, limit=20):
    ...
```

### Docstrings (Required for Public Methods)
```python
def rename_playlist(self, db: AsyncSession, playlist_id: str, new_name: str) -> Dict[str, Any]:
    """
    Rename a playlist by UUID.
    
    Args:
        db: Database session
        playlist_id: Playlist UUID
        new_name: New playlist name
    
    Returns:
        Dict with success status and message
    
    Raises:
        NotFoundError: If playlist doesn't exist
        ValidationError: If new_name is invalid
    """
    ...
```

### PEP 8 & Formatting
```bash
# Format code (black + isort)
make fmt

# Lint code
make lint

# Both before committing!
make fmt && make lint
```

---

## 🧪 Testing

### Test Structure
```
tests/
├── unit/          # Service, repo, utility tests
│   └── test_*.py
└── integration/   # API endpoint tests
    └── test_*.py
```

### Run Tests
```bash
# All tests
pytest -v

# Specific test
pytest tests/unit/test_services/test_playlist_service.py -v

# With coverage
pytest --cov=app --cov-report=html

# Open coverage report
open htmlcov/index.html
```

### Write Tests
```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_update_playlist_notes(db: AsyncSession):
    """Test updating playlist notes."""
    # Arrange
    playlist = await create_test_playlist(db, notes="Old notes")
    
    # Act
    result = await playlist_service.update_playlist_notes(
        db, playlist.uuid, "New notes"
    )
    
    # Assert
    assert result["success"] is True
    assert result["data"]["notes"] == "New notes"
```

**Target:** ≥ 80% coverage for new code.

---

## 🔄 Git Workflow

### Branch Strategy
```bash
# Feature
git checkout -b feature/add-playlist-notes

# Bug fix
git checkout -b fix/resolve-auth-issue

# Docs
git checkout -b docs/update-readme
```

### Commit Convention
```
feat: add playlist notes feature
fix: resolve playlist rename validation bug
docs: update authentication guide
refactor: simplify track search logic
test: add integration tests for playlists
perf: optimize similarity query performance
```

### Before Committing
```bash
# 1. Format code
make fmt

# 2. Lint
make lint

# 3. Test
make test

# 4. Commit with message
git add .
git commit -m "feat: add playlist notes feature"

# 5. Push
git push origin feature/add-playlist-notes
```

---

## 🚀 Deployment Checklist

Before deploying:

- [ ] Code formatted (`make fmt`)
- [ ] No linter errors (`make lint`)
- [ ] Tests pass (`make test`)
- [ ] `.env` secrets not committed
- [ ] Database migrations tested
- [ ] Type hints on all functions
- [ ] Docstrings on public methods
- [ ] Commit message follows convention
- [ ] PR reviewed by team

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](QUICK_START.md) | Setup, installation, troubleshooting |
| [docs/AUTH_IMPLEMENTATION_GUIDE.md](docs/AUTH_IMPLEMENTATION_GUIDE.md) | JWT, sessions, 2FA implementation |
| [docs/SPOTIFY_TRANSFER_README.md](docs/SPOTIFY_TRANSFER_README.md) | Spotify OAuth integration |
| [docs/TIDAL_TRANSFER_README.md](docs/TIDAL_TRANSFER_README.md) | Tidal OAuth integration |
| [docs/database.md](docs/database.md) | Schema design, relationships |
| API Docs | Available at `/docs` (Swagger UI) and `/redoc` |

---

## 🆘 Common Tasks

### Add a New Endpoint
1. Create schema in `app/schemas/`
2. Add repository method in `app/repositories/`
3. Add service method in `app/services/`
4. Add controller method in `app/controllers/`
5. Add router endpoint in `app/api/routers/`
6. Write tests in `tests/`

### Add a Database Field
1. Create migration: `python -m database.manage create-migration <name>`
2. Update model in `app/models/`
3. Update schema in `app/schemas/`
4. Run migration: `python -m database.manage migrate`

### Add Authentication to Endpoint
```python
from app.api.dependencies.auth import get_current_user

@router.get("/my-endpoint/")
async def my_endpoint(
    current_user: User = Depends(get_current_user)  # Required login
) -> JSONResponse:
    ...
```

### Debug Database Connection
```bash
python -m database.connection
```

---

## 💡 Tips for Success

1. **Read existing code first** – Best way to learn patterns is from similarity, playlist, or auth services
2. **Follow the architecture** – Don't skip layers
3. **Test early** – Write tests as you code
4. **Use the docs** – `/docs` endpoint shows all endpoints with examples
5. **Ask questions** – This codebase is complex; it's okay to ask

---

## 📞 Support

- **API Docs**: Available at `http://localhost:8005/docs`
- **Health Check**: `GET /health/`
- **Issues**: Check existing documentation and examples first

---

**Built with ❤️ for music discovery**
