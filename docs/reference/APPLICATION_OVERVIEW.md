# Application Architecture Overview

## Overall Application Structure

The Resomix FastAPI application follows a **layered architecture pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
│                     (app/main.py)                           │
│  - Routes all HTTP requests                                  │
│  - Handles middleware (CORS, rate limiting, timing)         │
│  - Global exception handlers                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routers Layer                         │
│              (app/api/routers/*.py)                          │
│  - Define HTTP endpoints                                     │
│  - Handle request validation                                 │
│  - Route to controllers                                      │
│  - Dependencies: auth, database                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Controllers Layer                          │
│             (app/controllers/*.py)                           │
│  - Handle HTTP request/response                              │
│  - Coordinate services                                       │
│  - Logging and error handling                                │
│  - Response formatting                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
│              (app/services/*.py)                             │
│  - Business logic                                            │
│  - External API integrations                                 │
│  - Data processing                                           │
│  - Coordinates repositories                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Repositories Layer                          │
│            (app/repositories/*.py)                           │
│  - Database access (SQLAlchemy)                             │
│  - CRUD operations                                           │
│  - Query building                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Models Layer                             │
│               (app/models/*.py)                              │
│  - SQLAlchemy ORM models                                     │
│  - Database schema definitions                               │
└─────────────────────────────────────────────────────────────┘
```

### Supporting Components

- **Schemas** (`app/schemas/*.py`): Pydantic models for request/response validation
- **Utils** (`app/utils/*.py`): Utility functions (response formatting, logging, etc.)
- **Core** (`app/core/*.py`): Configuration, security, exceptions
- **Dependencies** (`app/api/dependencies/*.py`): FastAPI dependencies (auth, database)
- **Middlewares** (`app/api/middlewares/*.py`): CORS, rate limiting, timing

---

## Spotify Integration - Deep Dive

### Architecture Flow

```
HTTP Request → Router → Controller → Service → Repository → Database
                                  ↓
                            External APIs (Spotify)
```

### Component Breakdown

#### 1. **Router** (`app/api/routers/spotify_transfer.py`)

**Purpose**: Define HTTP endpoint, handle routing and validation

**Key Features**:
- Defines `POST /spotify/transfer-playlist/` endpoint
- Uses FastAPI APIRouter with prefix `/spotify`
- Tags: `["spotify-transfer"]`
- Requires API key authentication via `Security(get_api_key)`
- Gets database session via dependency injection
- Validates request using `SpotifyTransferRequest` schema

**Dependencies**:
- `get_api_key`: Validates API key from query parameter
- `get_database_session`: Provides async database session
- Request body validated against `SpotifyTransferRequest` schema

**Endpoint Details**:
```python
POST /spotify/transfer-playlist/
Request Body:
{
    "playlist_id": "uuid",
    "access_token": "spotify_oauth_token",
    "playlist_name": "optional_custom_name"
}
```

#### 2. **Controller** (`app/controllers/spotify_transfer_controller.py`)

**Purpose**: Handle HTTP-level concerns, orchestrate services, manage logging

**Responsibilities**:
- Receives request parameters from router
- Calls service layer for business logic
- Comprehensive logging at start, success, and error
- Error handling and status code determination
- Response formatting using `format_response` utility
- Correlation ID generation for request tracking

**Key Features**:
- Logs transfer initiation with correlation ID
- Logs success with detailed metadata (tracks added, time taken, etc.)
- Error handling:
  - `ValueError` → 404 (not found) or 422 (validation error)
  - Authentication errors → 401 (unauthorized)
  - Other exceptions → 500 (internal error)
- Uses `LoggingService` for structured logging
- Uses `PlaylistService` to resolve playlist by UUID

**Services Used**:
- `SpotifyTransferService`: Core transfer logic
- `LoggingService`: Request/response logging
- `PlaylistService`: Playlist data access

#### 3. **Service** (`app/services/spotify_transfer_service.py`)

**Purpose**: Business logic, external API integration, data processing

**Key Responsibilities**:

**a. Spotify Authentication**:
- Creates Spotify client using `spotipy` library
- Validates access token by calling `client.me()`
- Handles authentication errors (401, 403)

**b. Track Search**:
- Cleans track titles and artist names for better search results
- Searches Spotify API using title + artist
- Falls back to title-only search if no results
- Scoring algorithm to find best match:
  - Title exact match: +3 points
  - Title partial match: +1 point per matching word
  - Artist exact match: +2 points
  - Artist partial match: +1 point
- Returns best matching track URI

**c. Concurrent Processing**:
- Uses `ThreadPoolExecutor` for concurrent Spotify API calls
- Processes 2 tracks simultaneously (`max_concurrent_searches = 2`)
- Handles async operations properly with event loops

**d. Caching**:
- Checks `playlist_transfer_tracks` table for cached Spotify IDs
- Only searches uncached tracks
- Updates cache with newly found Spotify IDs
- Improves performance for repeated transfers

**e. Playlist Creation**:
- Creates private playlist in user's Spotify account
- Sets playlist name: `custom_playlist_name` or `"Resomix - {original_name}"`
- Adds description indicating transfer source

**f. Track Addition**:
- Adds tracks to playlist in batches (100 per request - Spotify limit)
- Handles errors gracefully per batch
- Returns count of tracks successfully added

**Transfer Flow**:
1. Fetch playlist from database by UUID
2. Get all tracks in playlist with artist information
3. Authenticate with Spotify using access token
4. Create Spotify playlist
5. Check cache for existing Spotify IDs
6. Search uncached tracks concurrently
7. Update cache with newly found IDs
8. Add found tracks to playlist in batches
9. Return transfer statistics

**Repositories Used**:
- `PlaylistRepository`: Get playlist and tracks
- `TrackRepository`: Get track details and artists
- `PlaylistTransferTrackRepository`: Cache management

#### 4. **Schemas** (`app/schemas/spotify_transfer.py`)

**Purpose**: Request/response validation and documentation

**Schemas**:

**`SpotifyTransferRequest`**:
- `playlist_id`: Required, validated UUID
- `access_token`: Required, non-empty string
- `playlist_name`: Optional, max 100 characters
- Validators ensure proper format

**`SpotifyTransferResponse`**:
- `success`: Boolean
- `data`: Transfer results dictionary
- `message`: Human-readable success message

**`SpotifyTransferErrorResponse`**:
- `success`: Always false
- `error`: Error description
- `details`: Optional additional error context

#### 5. **Repository** (`app/repositories/playlist_transfer_track_repository.py`)

**Purpose**: Database operations for caching Spotify track IDs

**Key Methods**:
- `async_get_spotify_ids(track_ids)`: Get cached Spotify IDs for multiple tracks
- `async_batch_upsert_spotify_ids(track_spotify_map)`: Batch insert/update Spotify IDs
- Uses MySQL `INSERT ... ON DUPLICATE KEY UPDATE` for efficient upserts

**Model** (`app/models/playlist_transfer_track.py`):
- Stores external platform IDs (Spotify, Tidal, Apple Music, etc.)
- Primary key: `track_id` (links to tracks table)
- Columns: `spotify_id`, `tidal_id`, `apple_music_id`, etc.
- Timestamps: `created_at`, `updated_at`

### Data Flow Example

**Scenario**: User transfers playlist with 10 tracks to Spotify

1. **HTTP Request** arrives at `/spotify/transfer-playlist/`
2. **Router** validates request body against `SpotifyTransferRequest` schema
3. **Controller**:
   - Generates correlation ID
   - Logs transfer start
   - Calls service
4. **Service**:
   - Fetches playlist from database → gets 10 tracks
   - Authenticates with Spotify
   - Creates Spotify playlist → gets playlist ID
   - Checks cache → finds 3 tracks already cached
   - Searches remaining 7 tracks concurrently
   - Finds 6 tracks, 1 not found
   - Caches 6 newly found tracks
   - Adds 9 tracks (3 cached + 6 found) to Spotify playlist
5. **Controller**:
   - Formats response with statistics
   - Logs success
6. **HTTP Response** returns with transfer results

### Error Handling Strategy

**Validation Errors** (ValueError):
- Playlist not found → 404
- Playlist empty → 422
- Invalid format → 422

**Authentication Errors**:
- Invalid/expired token → 401
- Unauthorized app → 403 → 401

**Service Errors**:
- Spotify API errors → 500
- Database errors → 500

All errors are:
- Logged with correlation ID
- Returned in standardized format
- Include error type and context

### Performance Optimizations

1. **Caching**: Avoids redundant Spotify searches for previously transferred tracks
2. **Concurrent Search**: Processes multiple tracks simultaneously (2 at a time)
3. **Batch Addition**: Adds tracks in batches of 100 (Spotify API limit)
4. **Early Validation**: Validates playlist existence before expensive operations

### Dependencies

**External Libraries**:
- `spotipy`: Spotify Web API client
- `asyncio`: Async operations
- `concurrent.futures`: Thread pool execution

**Internal Dependencies**:
- Database: MariaDB via SQLAlchemy
- Authentication: API key from query parameter
- Logging: Structured logging service

### Configuration

Spotify settings in `app/core/config.py`:
- `spotify_client_id`: Optional (not used in current flow - frontend handles OAuth)
- `spotify_client_secret`: Optional (not used in current flow)

**Note**: The current implementation expects the frontend to handle OAuth flow and provide the access token. The backend only uses the token to authenticate with Spotify API.

---

## Architecture Patterns Used

1. **Layered Architecture**: Clear separation between routing, business logic, and data access
2. **Dependency Injection**: FastAPI's dependency system for database sessions, auth, etc.
3. **Repository Pattern**: Abstracts database operations
4. **Service Layer Pattern**: Encapsulates business logic
5. **Schema Validation**: Pydantic models for request/response validation
6. **Caching Strategy**: Database-level caching for external API results
7. **Async/Await**: Fully async implementation for better performance

---

## Key Takeaways

1. **Clear Separation**: Each layer has a single responsibility
2. **Async First**: Everything is async for better performance
3. **Comprehensive Logging**: Every operation is logged with correlation IDs
4. **Error Handling**: Consistent error handling and response formatting
5. **Performance**: Caching and concurrent processing optimize transfers
6. **Validation**: Request validation happens at multiple layers (schema, service)

