# Playlist Fork Feature - Implementation Guide

## Overview
This guide provides a comprehensive, step-by-step approach to implementing the playlist forking feature in your FastAPI application. The feature allows authenticated users to fork public playlists, creating their own copy with reset track positions.

---

## Table of Contents
1. [Prerequisites & Understanding](#1-prerequisites--understanding)
2. [Schema Layer Updates](#2-schema-layer-updates)
3. [Repository Layer Implementation](#3-repository-layer-implementation)
4. [Service Layer Implementation](#4-service-layer-implementation)
5. [Controller Layer Implementation](#5-controller-layer-implementation)
6. [Router Layer Implementation](#6-router-layer-implementation)
7. [Testing Strategy](#7-testing-strategy)
8. [Best Practices & Considerations](#8-best-practices--considerations)

---

## 1. Prerequisites & Understanding

### 1.1 Review Existing Code
Before starting implementation, thoroughly review:
- **Authentication System**: `/app/api/dependencies/auth.py`
  - `get_current_user()` - Returns User object or raises 401
  - `get_current_user_optional()` - Returns User or None (no exception for anonymous)
- **Similarity Endpoint Response Format**: `/app/repositories/playlist_repository.py` → `async_get_playlist_similarity_data()`
  - Response structure with `queried_track`, `similar_tracks`, and `playlist` keys
- **Playlist Creation Flow**: `/app/repositories/playlist_repository.py` → `async_create_similarity_playlist()`
  - How playlists and playlist_tracks are created
- **Existing Endpoints**: `/app/api/routers/playlists.py`
  - Pattern for endpoint structure, dependencies, and error handling

### 1.2 Key Concepts
- **Fork Relationship**: New playlist links back to original via `fork_id` (UUID of original)
- **Position Reset**: Decimal positions like `1.0, 2.0, 2.25, 2.5, 3.0, 4.0` become `1.0, 2.0, 3.0, 4.0, 5.0, 6.0`
- **Fork Count**: Original playlist's `fork_count` increments by 1
- **Response Format**: Same as `/playlists/similarity/{id}` endpoint

---

## 2. Schema Layer Updates

### File: `app/schemas/playlist.py`

#### 2.1 Create Fork Request Schema
**Location**: Add after existing request schemas (around line 78)

**What to Add**:
```python
class PlaylistForkRequest(BaseModel):
    """Request schema for forking a playlist."""
    playlist_id: str = Field(..., description="UUID of the playlist to fork")
    
    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate that playlist_id is not empty."""
        if not v or not v.strip():
            raise ValueError('Playlist ID cannot be empty')
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
```

**Why**: 
- Provides type safety and validation for the fork endpoint
- Follows existing pattern from `PlaylistRenameRequest` and `PlaylistVisibilityRequest`
- Validates that playlist_id is not empty before reaching business logic

**Note**: Alternatively, use path parameter instead of request body (see Router section for decision)

#### 2.2 Create Fork Response Schema
**Location**: Add after `PlaylistSimilarityResponse` (around line 113)

**What to Add**:
```python
class PlaylistForkResponse(BaseModel):
    """Response schema for playlist fork operation."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityByIdResponse = Field(..., description="Forked playlist data in similarity format")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "queried_track": {
                        "rank": 0,
                        "score": 1.0,
                        "id": "67addcb39387d00fbdc3acdf",
                        "label": "Global Underground",
                        "duration": 491,
                        "artist": "Oxia",
                        "title": "Whole Life (Original Mix)",
                        "year": 2010
                    },
                    "similar_tracks": [...],
                    "playlist": {
                        "id": "new-playlist-uuid",
                        "name": "Playlist Name",
                        "is_public": False
                    }
                }
            }
        }
```

**Why**:
- Reuses `SimilarityByIdResponse` to match the required response format
- Provides consistent API responses
- Enables automatic OpenAPI documentation

**Import Required**: Add at top of file:
```python
from app.schemas.similarity import SimilarityByIdResponse
```

---

## 3. Repository Layer Implementation

### File: `app/repositories/playlist_repository.py`

#### 3.1 Create `async_fork_playlist()` Method
**Location**: Add after `async_create_similarity_playlist()` method (around line 105)

**Method Signature**:
```python
async def async_fork_playlist(
    self,
    db: AsyncSession,
    original_playlist_uuid: str,
    user_id: int
) -> Optional[Dict[str, Any]]:
```

**Implementation Steps**:

1. **Fetch Original Playlist**
   - Use `async_get_playlist_by_uuid()` to get original playlist
   - If not found, return None
   - Verify `is_public` is True, otherwise return `{"error": "not_public"}`
   - Check if `user_id` matches original owner, return `{"error": "already_owner"}` if true

2. **Generate New UUID**
   - Import: `import uuid`
   - Create: `new_uuid = str(uuid.uuid4())`

3. **Create New Playlist Record**
   - Create `Playlist` object with:
     - `uuid`: new_uuid (generated)
     - `user_id`: authenticated user's ID (passed parameter)
     - `name`: original playlist's name (keep same)
     - `is_public`: False (forked playlists default to private)
     - `type`: original playlist's type
     - `seed_track_id`: original playlist's seed_track_id
     - `fork_id`: original_playlist_uuid (link back to original)
     - `forked_at`: `datetime.utcnow()` (import from datetime)
     - `fork_count`: 0 (new playlist starts with 0 forks)
     - `created_at`: original playlist's created_at (keep same timestamp)
   - Add to session with `db.add(playlist)`
   - Flush to get ID: `await db.flush()`

4. **Fetch Original Playlist Tracks**
   - Query using:
     ```python
     stmt = select(PlaylistTrack).where(
         PlaylistTrack.playlist_id == original_playlist.id
     ).order_by(PlaylistTrack.position.asc())
     ```
   - Execute and get all results

5. **Create Forked Playlist Tracks with Reset Positions**
   - Iterate through sorted tracks
   - For each track at index `i`, create `PlaylistTrack`:
     - `playlist_id`: new_playlist.id
     - `track_id`: original track_id
     - `position`: `Decimal(str(i + 1))` (reset to 1.0, 2.0, 3.0, etc.)
     - `score`: original score (keep same)
   - Collect in list and bulk insert with `db.add_all()`

6. **Increment Original Playlist Fork Count**
   - Update original playlist:
     ```python
     original_playlist.fork_count += 1
     ```
   - This will be automatically tracked by SQLAlchemy

7. **Commit Transaction**
   - `await db.commit()`

8. **Return Success Data**
   - Structure return similar to `async_get_playlist_similarity_data()`:
     ```python
     return await async_get_playlist_similarity_data(db, new_uuid)
     ```
   - This reuses existing logic to format the response correctly

**Error Handling**:
- Wrap entire method in try-except
- On exception: rollback transaction, log error, return None
- Return None for "not found" scenarios
- Return dict with "error" key for business logic failures

**DO's**:
- ✅ Use transactions properly (flush for ID, commit at end)
- ✅ Order tracks by position before copying
- ✅ Convert position to Decimal explicitly
- ✅ Reuse existing methods (`async_get_playlist_by_uuid`, `async_get_playlist_similarity_data`)
- ✅ Keep forked playlists private by default
- ✅ Preserve original created_at timestamp

**DON'Ts**:
- ❌ Don't forget to increment fork_count on original
- ❌ Don't copy fork fields from original (fork_id, forked_at)
- ❌ Don't make forked playlist public automatically
- ❌ Don't use integer for position (use Decimal)
- ❌ Don't skip ordering by position
- ❌ Don't commit before all operations complete

---

## 4. Service Layer Implementation

### File: `app/services/playlist_service.py`

#### 4.1 Create `fork_playlist()` Method
**Location**: Add after `get_playlist_similarity_data()` method (around line 223)

**Method Signature**:
```python
async def fork_playlist(
    self,
    db: AsyncSession,
    playlist_uuid: str,
    user_id: int
) -> Dict[str, Any]:
```

**Implementation Steps**:

1. **Call Repository Method**
   - Call `self.playlist_repository.async_fork_playlist(db, playlist_uuid, user_id)`
   - Store result

2. **Handle Response Cases**
   - **Case 1: None returned** (playlist not found)
     ```python
     return {
         "success": False,
         "error": "Playlist not found"
     }
     ```
   
   - **Case 2: Dict with "error": "not_public"**
     ```python
     return {
         "success": False,
         "error": "Cannot fork private playlists. Only public playlists can be forked."
     }
     ```
   
   - **Case 3: Dict with "error": "already_owner"**
     ```python
     return {
         "success": False,
         "error": "You already own this playlist. No need to fork it."
     }
     ```
   
   - **Case 4: Valid data returned**
     ```python
     # Apply metadata filtering
     filtered_data = self._apply_playlist_response_filtering(result)
     return {
         "success": True,
         "data": filtered_data
     }
     ```

3. **Exception Handling**
   - Wrap in try-except
   - Log error with descriptive message
   - Return generic error response:
     ```python
     return {
         "success": False,
         "error": "An error occurred while forking the playlist"
     }
     ```

**Why This Layer**:
- Separates business logic from data access
- Applies response filtering (removes sensitive metadata)
- Centralizes error message formatting
- Enables easier testing and mocking

**DO's**:
- ✅ Reuse `_apply_playlist_response_filtering()` method
- ✅ Return consistent response structure
- ✅ Log exceptions with context
- ✅ Provide user-friendly error messages

**DON'Ts**:
- ❌ Don't perform database operations here (use repository)
- ❌ Don't return raw database objects
- ❌ Don't expose internal error details to users
- ❌ Don't skip response filtering

---

## 5. Controller Layer Implementation

### File: `app/controllers/playlist_controller.py`

#### 5.1 Create `fork_playlist()` Method
**Location**: Add after `get_playlist_hls_data()` method (around line 613, before admin methods)

**Method Signature**:
```python
async def fork_playlist(
    self,
    db: AsyncSession,
    request: Request,
    playlist_id: str,
    current_user: User
) -> JSONResponse:
```

**Implementation Steps**:

1. **Initialize Timing and Correlation**
   ```python
   start_time = time.time()
   correlation_id = self.logging_service.generate_correlation_id()
   ```

2. **Validate Input**
   - Check if `playlist_id` is empty or whitespace
   - If invalid, return 422 with error message
   - Log validation failure with metadata

3. **Call Service Layer**
   ```python
   result = await self.playlist_service.fork_playlist(
       db, 
       playlist_id, 
       current_user.id  # Use integer ID from User object
   )
   ```

4. **Calculate Duration**
   ```python
   duration_ms = (time.time() - start_time) * 1000
   ```

5. **Handle Success Response (result["success"] == True)**
   - Extract playlist integer ID from result data for logging
   - Log with:
     - Level: "INFO"
     - Category: "USER_ACTION"
     - Action: "fork_playlist_success"
     - Message: "User forked playlist successfully: {original_uuid} -> {new_uuid}"
     - Include: user_id, original_playlist_uuid, new_playlist_uuid, track_count
   - Return: 201 CREATED status
   - Content: result dict

6. **Handle Error Responses**
   
   **Sub-case A: "not found" in error message**
   - Log with WARNING level, action "fork_playlist_not_found"
   - Return: 404 NOT FOUND status
   
   **Sub-case B: "private" or "public" in error message**
   - Log with WARNING level, action "fork_playlist_forbidden"
   - Return: 403 FORBIDDEN status
   
   **Sub-case C: "already own" in error message**
   - Log with WARNING level, action "fork_playlist_already_owner"
   - Return: 400 BAD REQUEST status
   
   **Sub-case D: Generic error**
   - Log with ERROR level, action "fork_playlist_failed"
   - Return: 500 INTERNAL SERVER ERROR status

7. **Exception Handling**
   - Wrap entire method in try-except
   - Log exception with full context (traceback, error type)
   - Return: 500 INTERNAL SERVER ERROR
   - Generic error message (don't expose internals)

**Logging Metadata to Include**:
- `user_id`: current_user.id
- `user_uuid`: current_user.uuid
- `original_playlist_uuid`: playlist_id
- `new_playlist_uuid`: (extract from result data if success)
- `original_playlist_int_id`: (fetch if needed)
- `new_playlist_int_id`: (extract from result data if success)
- `track_count`: number of tracks copied
- `operation`: "playlist_fork"
- `response`: result dict

**DO's**:
- ✅ Use consistent logging pattern (match other controller methods)
- ✅ Return appropriate HTTP status codes
- ✅ Include correlation_id in all logs
- ✅ Log duration_ms for performance monitoring
- ✅ Return 201 CREATED for successful fork (not 200)
- ✅ Extract playlist integer IDs for foreign key logging
- ✅ Use current_user.id (integer) for database operations

**DON'Ts**:
- ❌ Don't return different response structure than other endpoints
- ❌ Don't skip duration calculation
- ❌ Don't log sensitive user data
- ❌ Don't return 200 OK for resource creation (use 201)
- ❌ Don't use UUID for foreign key logs (use integer ID)

---

## 6. Router Layer Implementation

### File: `app/api/routers/playlists.py`

#### 6.1 Update Imports
**Location**: Top of file (around line 24-32)

**Add**:
```python
from app.api.dependencies.auth import get_api_key, get_current_user_optional, get_current_user
from app.schemas.playlist import (
    # ... existing imports ...
    PlaylistForkRequest,  # or remove if using path param
    PlaylistForkResponse
)
```

**Why**: Import `get_current_user` for required authentication

#### 6.2 Create Fork Endpoint
**Location**: Add after `get_playlist_similarity_endpoint()` (around line 180)

**Recommended Approach**: Path parameter (more RESTful)

```python
@router.post(
    "/fork/{playlist_id}",
    response_model=PlaylistForkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Fork a Public Playlist",
    description="Create a copy of a public playlist. Requires authentication.",
    responses={
        201: {
            "model": PlaylistForkResponse,
            "description": "Playlist forked successfully"
        },
        400: {
            "model": PlaylistErrorResponse,
            "description": "User already owns this playlist"
        },
        401: {
            "model": PlaylistErrorResponse,
            "description": "Authentication required"
        },
        403: {
            "model": PlaylistErrorResponse,
            "description": "Playlist is private and cannot be forked"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def fork_playlist_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
    current_user: User = Depends(get_current_user)  # REQUIRED auth
) -> JSONResponse:
    """
    Fork (copy) a public playlist to your account.
    
    Creates a new playlist with:
    - Same name, tracks, and seed track as original
    - Owned by the authenticated user
    - Private visibility by default
    - Reset track positions (1.0, 2.0, 3.0, etc.)
    - Links back to original via fork_id
    
    **Requirements**:
    - User must be authenticated (JWT token required)
    - Original playlist must be public
    - User cannot fork their own playlists
    
    **Notes**:
    - Forked playlists maintain same track order but reset decimal positions
    - Original playlist's fork_count is incremented
    - created_at timestamp preserved from original
    
    - **playlist_id**: The UUID of the public playlist to fork
    
    Returns the forked playlist in the same format as the similarity endpoint.
    """
    return await playlist_controller.fork_playlist(db, request, playlist_id, current_user)
```

**Alternative Approach**: Request body parameter
```python
@router.post(
    "/fork",
    # ... same configuration ...
)
async def fork_playlist_endpoint(
    request: Request,
    request_data: PlaylistForkRequest,
    # ... same dependencies ...
) -> JSONResponse:
    # Call controller with request_data.playlist_id
    return await playlist_controller.fork_playlist(db, request, request_data.playlist_id, current_user)
```

**Key Decisions**:

1. **Path Parameter vs Request Body**
   - **Recommended**: Path parameter (`/fork/{playlist_id}`)
     - More RESTful for resource-specific actions
     - Simpler client implementation
     - Consistent with other GET endpoints
   - **Alternative**: Request body
     - Consistent with PUT endpoints in your codebase
     - Allows future expansion with additional fork options

2. **HTTP Method**
   - **Use POST**: Creates a new resource (forked playlist)
   - **Don't use GET**: Mutates state (creates playlist, increments counter)

3. **Status Code**
   - **Use 201 CREATED**: New playlist resource created
   - **Don't use 200 OK**: That's for successful operations without resource creation

4. **Authentication**
   - **Use `get_current_user`**: Required (not optional)
   - **Dependency type**: `current_user: User` (not `Optional[User]`)
   - **Behavior**: Automatically returns 401 if not authenticated

5. **Endpoint Path**
   - **Recommended**: `/playlists/fork/{playlist_id}`
   - **Alternative**: `/playlists/{playlist_id}/fork` (more REST-ful but breaks your pattern)
   - **Your pattern**: Verb-based paths like `/rename/`, `/visibility/`

**DO's**:
- ✅ Use descriptive OpenAPI documentation
- ✅ Include all possible response codes in responses dict
- ✅ Set appropriate status_code in decorator (201)
- ✅ Use Security(get_api_key) AND Depends(get_current_user)
- ✅ Match existing endpoint patterns in the file
- ✅ Provide clear docstring explaining requirements
- ✅ Include example in response_model schema

**DON'Ts**:
- ❌ Don't use `get_current_user_optional` (authentication is required)
- ❌ Don't use GET method (it creates a resource)
- ❌ Don't return 200 OK (use 201 CREATED)
- ❌ Don't skip API key validation (keep both auth methods)
- ❌ Don't forget to update router imports
- ❌ Don't place endpoint in wrong router file

---

## 7. Testing Strategy

### 7.1 Manual Testing Checklist

**Test Case 1: Successful Fork**
- Prerequisites: Public playlist exists, authenticated user (not owner)
- Steps:
  1. Authenticate and get JWT token
  2. POST to `/playlists/fork/{public_playlist_uuid}`
  3. Verify 201 response
  4. Verify response contains forked playlist data
  5. Verify forked playlist UUID is different
  6. Check database: new playlist exists with correct user_id
  7. Check: original fork_count increased by 1
  8. Check: track positions are reset (1.0, 2.0, 3.0, etc.)

**Test Case 2: Unauthenticated Request**
- No JWT token provided
- Expected: 401 Unauthorized

**Test Case 3: Fork Private Playlist**
- Prerequisites: Private playlist exists
- Expected: 403 Forbidden with "private playlist" message

**Test Case 4: Fork Own Playlist**
- Prerequisites: User is playlist owner
- Expected: 400 Bad Request with "already own" message

**Test Case 5: Fork Non-existent Playlist**
- Invalid UUID provided
- Expected: 404 Not Found

**Test Case 6: Position Reset Verification**
- Prerequisites: Playlist with positions like 1.0, 2.0, 2.5, 3.0
- After fork: Verify positions are 1.0, 2.0, 3.0, 4.0

**Test Case 7: Track Order Preservation**
- Prerequisites: Playlist with specific track order
- After fork: Verify exact same track order maintained

**Test Case 8: Metadata Preservation**
- After fork verify:
  - name is same
  - type is same
  - seed_track_id is same
  - created_at is same as original
  - is_public is False (not same)

### 7.2 Automated Test Structure

**File**: `tests/unit/test_routes/test_playlist_fork_routes.py`

Create tests for:
1. `test_fork_playlist_success()`
2. `test_fork_playlist_unauthenticated()`
3. `test_fork_private_playlist()`
4. `test_fork_own_playlist()`
5. `test_fork_nonexistent_playlist()`
6. `test_fork_position_reset()`
7. `test_fork_increments_count()`

**Use Fixtures**:
- `mock_db_session`
- `mock_public_playlist`
- `mock_private_playlist`
- `mock_authenticated_user`

### 7.3 Database Testing

**Verify Database State**:
```sql
-- Check new playlist exists
SELECT uuid, user_id, name, fork_id, forked_at, is_public 
FROM playlists 
WHERE uuid = 'new-forked-uuid';

-- Check fork count updated
SELECT uuid, fork_count 
FROM playlists 
WHERE uuid = 'original-playlist-uuid';

-- Check track positions reset
SELECT position, track_id 
FROM playlist_tracks 
WHERE playlist_id = (SELECT id FROM playlists WHERE uuid = 'new-forked-uuid')
ORDER BY position;
```

---

## 8. Best Practices & Considerations

### 8.1 Security

**Authentication**:
- ✅ Always use `get_current_user` (not optional)
- ✅ Verify user owns resulting forked playlist
- ✅ Only allow forking public playlists
- ✅ Prevent users from forking their own playlists

**Authorization**:
- ✅ Check is_public before allowing fork
- ✅ No need to check user permissions (public = forkable)

**API Key**:
- ✅ Keep both API key and JWT authentication
- ✅ Consistent with existing endpoint patterns

### 8.2 Performance

**Database Optimization**:
- ✅ Use bulk insert for playlist_tracks (`db.add_all()`)
- ✅ Order by position in single query (not in Python)
- ✅ Use flush() before commit for dependent operations
- ✅ Fetch original playlist with relationships loaded

**Transaction Management**:
- ✅ Keep all operations in single transaction
- ✅ Use flush() when you need generated IDs
- ✅ Commit only once at the end
- ✅ Rollback on any error

### 8.3 Data Integrity

**Position Reset**:
- ✅ Always order tracks by position first
- ✅ Use Decimal type (not float or int)
- ✅ Start from 1.0, increment by 1.0
- ✅ Preserve track order exactly

**Metadata Handling**:
- ✅ Keep: name, type, seed_track_id, created_at
- ✅ Set new: uuid, user_id, fork_id, forked_at
- ✅ Reset: is_public (to False), fork_count (to 0)
- ✅ Copy: all track scores

### 8.4 Error Handling

**Error Messages**:
- ✅ User-friendly, not technical
- ✅ Don't expose internal implementation
- ✅ Specific enough to guide user action
- ✅ Consistent with existing error messages

**Logging**:
- ✅ Log all error cases with context
- ✅ Include user_id, playlist_uuid in metadata
- ✅ Use appropriate log levels (INFO, WARNING, ERROR)
- ✅ Include correlation_id for tracing

**Exception Recovery**:
- ✅ Wrap repository calls in try-except
- ✅ Rollback transaction on failure
- ✅ Return generic error to user
- ✅ Log detailed error for debugging

### 8.5 Response Formatting

**Success Response**:
- ✅ Return same format as `/playlists/similarity/{id}`
- ✅ Include queried_track, similar_tracks, playlist
- ✅ Apply metadata filtering
- ✅ Use 201 CREATED status

**Error Response**:
- ✅ Consistent structure: `{"success": false, "error": "message"}`
- ✅ Match existing PlaylistErrorResponse schema
- ✅ Appropriate HTTP status codes
- ✅ Clear, actionable error messages

### 8.6 Code Quality

**Consistency**:
- ✅ Match existing code style and patterns
- ✅ Follow same naming conventions
- ✅ Use same import order and structure
- ✅ Maintain documentation standards

**Reusability**:
- ✅ Reuse existing methods where possible
- ✅ Don't duplicate logic (e.g., `async_get_playlist_similarity_data`)
- ✅ Extract common patterns into helper methods
- ✅ Share validation logic

**Documentation**:
- ✅ Add docstrings to all new methods
- ✅ Include Args, Returns, Raises sections
- ✅ Update OpenAPI documentation
- ✅ Provide usage examples

### 8.7 Edge Cases to Handle

1. **Playlist with no tracks**: Should fork successfully with 0 tracks
2. **Playlist with single track**: Position should be 1.0
3. **Very large playlists (1000+ tracks)**: Consider pagination or limits
4. **Concurrent fork requests**: Database transaction handles this
5. **Original playlist deleted after fork**: Fork remains (cascade SET NULL)
6. **User reaches playlist limit**: Consider adding quota check (future)

### 8.8 Future Enhancements (Not Required Now)

- [ ] Add fork name customization option
- [ ] Include fork tree visualization (original -> forks)
- [ ] Add "unfork" or sync with original feature
- [ ] Track fork lineage (forks of forks)
- [ ] Add rate limiting for fork operations
- [ ] Implement playlist quotas per user
- [ ] Add webhook/notification for fork events
- [ ] Export fork statistics for analytics

---

## Implementation Checklist

Use this checklist to track implementation progress:

### Layer 1: Schemas ✓
- [ ] Add `PlaylistForkRequest` schema (optional if using path param)
- [ ] Add `PlaylistForkResponse` schema
- [ ] Import `SimilarityByIdResponse` from similarity schemas
- [ ] Update schema imports in other files

### Layer 2: Repository ✓
- [ ] Create `async_fork_playlist()` method
- [ ] Implement playlist fetching logic
- [ ] Implement validation checks (public, not owner)
- [ ] Implement new playlist creation
- [ ] Implement track copying with position reset
- [ ] Implement fork_count increment
- [ ] Add error handling and transaction management
- [ ] Test with sample data

### Layer 3: Service ✓
- [ ] Create `fork_playlist()` method
- [ ] Call repository method
- [ ] Handle all error cases
- [ ] Apply response filtering
- [ ] Add exception handling
- [ ] Test error paths

### Layer 4: Controller ✓
- [ ] Create `fork_playlist()` method
- [ ] Add input validation
- [ ] Implement comprehensive logging
- [ ] Handle all response cases with correct status codes
- [ ] Add exception handling
- [ ] Test with mock service

### Layer 5: Router ✓
- [ ] Update imports (get_current_user, schemas)
- [ ] Create POST endpoint with correct path
- [ ] Configure OpenAPI documentation
- [ ] Set correct status codes in responses
- [ ] Use required authentication dependency
- [ ] Write comprehensive docstring
- [ ] Test endpoint manually

### Layer 6: Testing ✓
- [ ] Write unit tests for repository
- [ ] Write unit tests for service
- [ ] Write integration tests for endpoint
- [ ] Test all error cases
- [ ] Test position reset logic
- [ ] Test fork_count increment
- [ ] Verify database state after fork

### Final Steps ✓
- [ ] Run all tests
- [ ] Check linting/formatting
- [ ] Review logs for any warnings
- [ ] Test with Postman/Thunder Client
- [ ] Update API documentation
- [ ] Review code with team
- [ ] Deploy to development environment
- [ ] Monitor for errors

---

## Quick Reference

### Key Files Modified
1. `app/schemas/playlist.py` - Request/Response schemas
2. `app/repositories/playlist_repository.py` - Database operations
3. `app/services/playlist_service.py` - Business logic
4. `app/controllers/playlist_controller.py` - HTTP handling
5. `app/api/routers/playlists.py` - Endpoint definition

### Key Dependencies
- `get_current_user` from `app/api/dependencies/auth`
- `SimilarityByIdResponse` from `app/schemas/similarity`
- `Decimal` from `decimal` for position handling
- `datetime.utcnow()` for forked_at timestamp

### Response Format
```json
{
  "success": true,
  "data": {
    "queried_track": { ... },
    "similar_tracks": [ ... ],
    "playlist": {
      "id": "new-uuid",
      "name": "Playlist Name",
      "is_public": false
    }
  }
}
```

### Common Pitfalls to Avoid
1. Using `get_current_user_optional` instead of `get_current_user`
2. Forgetting to order tracks by position before copying
3. Not converting position to Decimal type
4. Forgetting to increment original playlist's fork_count
5. Not rolling back transaction on error
6. Using wrong HTTP status codes (200 instead of 201)
7. Not reusing existing similarity data formatting

---

## Summary

This implementation adds a robust playlist forking feature following your application's established patterns. The feature:

- ✅ Requires authentication (JWT)
- ✅ Only allows forking public playlists
- ✅ Prevents forking own playlists
- ✅ Resets positions while preserving order
- ✅ Tracks fork relationships and counts
- ✅ Returns data in similarity format
- ✅ Includes comprehensive error handling
- ✅ Maintains transaction integrity
- ✅ Follows RESTful conventions
- ✅ Provides detailed logging

The implementation spans 5 layers (Schema → Repository → Service → Controller → Router), each with clear responsibilities and error handling. Follow the checklist step-by-step for a clean, maintainable implementation.

