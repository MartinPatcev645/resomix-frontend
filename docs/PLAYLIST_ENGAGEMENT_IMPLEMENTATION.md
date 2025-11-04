# Playlist Engagement Implementation Guide

## Overview
Implementation guide for playlist favorite/follow functionality. Separate files from playlist module.

---

## Files to Create

1. `app/models/playlist_engagement.py` - SQLAlchemy models
2. `app/repositories/playlist_engagement_repository.py` - Database operations
3. `app/services/playlist_engagement_service.py` - Business logic
4. `app/controllers/playlist_engagement_controller.py` - HTTP handling
5. `app/schemas/playlist_engagement.py` - Request/Response schemas
6. `app/api/routers/playlist_engagement.py` - ✅ Already created

---

## 1. Model (`app/models/playlist_engagement.py`)

### Create `UserPlaylistEngagement` Model
- Map to `user_playlist_engagements` table
- Fields: `user_id`, `playlist_id`, `is_favorite`, `is_following`, `favorite_at`, `unfavorite_at`, `followed_at`, `unfollowed_at`, `created_at`, `updated_at`
- Relationships: `user`, `playlist`
- Primary key: composite `(user_id, playlist_id)`

### DOs
- Use `BigInteger` for user_id/playlist_id
- Use `Boolean` for is_favorite/is_following with default=False
- Use `DateTime` with `server_default=func.current_timestamp()` for timestamps
- Add `onupdate=func.current_timestamp()` for updated_at

### DON'Ts
- Don't create separate models for favorites/follows (combined table)

---

## 2. Repository (`app/repositories/playlist_engagement_repository.py`)

### Inherit from `BaseRepository[UserPlaylistEngagement]`

### Methods to Implement
1. `async_get_engagement(user_id, playlist_id)` - Get or create engagement record
2. `async_toggle_favorite(user_id, playlist_id)` - Toggle favorite state
3. `async_toggle_follow(user_id, playlist_id)` - Toggle follow state
4. `async_get_user_favorites(user_id)` - Get all favorite playlists
5. `async_get_user_following(user_id)` - Get all followed playlists

### DOs
- Use `async_get_or_create` pattern for engagement records
- Update timestamp fields (`favorite_at`/`unfavorite_at`, `followed_at`/`unfollowed_at`) based on state changes
- Use `datetime.utcnow()` for timestamp updates
- Return engagement object or dict with engagement data
- Handle None cases (playlist not found)

### DON'Ts
- Don't delete engagement records (keep history via timestamps)
- Don't mix sync/async methods
- Don't return None without handling in service layer

---

## 3. Service (`app/services/playlist_engagement_service.py`)

### Initialize `PlaylistEngagementRepository` and `PlaylistRepository`

### Methods to Implement
1. `add_favorite(playlist_uuid, user_id)` - Returns `{"success": bool, "data"/"error": ...}`
2. `remove_favorite(playlist_uuid, user_id)`
3. `follow(playlist_uuid, user_id)`
4. `unfollow(playlist_uuid, user_id)`

### DOs
- Validate playlist exists before engagement operations
- Return consistent dict format: `{"success": bool, "data": {...}}` or `{"success": False, "error": "..."}`
- Handle repository None returns (playlist not found)
- Use playlist UUID (not ID) in public interface
- Convert playlist UUID to ID internally

### DON'Ts
- Don't handle HTTP status codes (controller responsibility)
- Don't access request object directly
- Don't return raw repository objects

---

## 4. Controller (`app/controllers/playlist_engagement_controller.py`)

### Initialize `PlaylistEngagementService` and `LoggingService`

### Methods to Implement
1. `add_favorite(db, request, playlist_id, current_user)` - Returns `JSONResponse`
2. `remove_favorite(db, request, playlist_id, current_user)`
3. `follow(db, request, playlist_id, current_user)`
4. `unfollow(db, request, playlist_id, current_user)`

### DOs
- Validate input (playlist_id not empty)
- Log all operations with correlation_id
- Use `format_response()` utility for responses
- Return proper HTTP status codes: 200 (success), 404 (not found), 422 (validation), 500 (error)
- Include timing (`start_time`, `duration_ms`)
- Log with metadata: `user_uuid`, `playlist_id`, `operation`, `correlation_id`

### DON'Ts
- Don't perform database queries directly
- Don't skip logging
- Don't return inconsistent response formats

---

## 5. Schema (`app/schemas/playlist_engagement.py`)

### Create Response Schemas
1. `PlaylistEngagementResponse` - Success response with engagement data
2. `PlaylistEngagementErrorResponse` - Error response (can reuse existing error schema)

### DOs
- Use `BaseModel` from Pydantic
- Include `success: bool` field
- Include engagement state in data: `is_favorite`, `is_following`
- Add `json_schema_extra` examples for OpenAPI

### DON'Ts
- Don't create request schemas (using path parameters)

---

## 6. Router (`app/api/routers/playlist_engagement.py`)

### Already created - update to call controller

### DOs
- Uncomment controller calls
- Import controller: `from app.controllers.playlist_engagement_controller import PlaylistEngagementController`
- Initialize: `playlist_engagement_controller = PlaylistEngagementController()`
- Use `Depends(get_current_user)` for REQUIRED auth

### DON'Ts
- Don't add business logic in router
- Don't remove `pass` statements until controller exists

---

## 7. Register Router (`app/api/routers/__init__.py`)

### Add to imports and `all_routers` list
```python
from .playlist_engagement import router as playlist_engagement_router
all_routers = [..., playlist_engagement_router]
```

---

## Implementation Flow

```
Router → Controller → Service → Repository → Database
         ↓              ↓          ↓
      Logging      Validation   ORM Queries
```

---

## Key Patterns

### State Management
- Toggle `is_favorite`/`is_following` boolean flags
- Set timestamp when state becomes `True` (`favorite_at`, `followed_at`)
- Set timestamp when state becomes `False` (`unfavorite_at`, `unfollowed_at`)
- Never delete engagement records

### Error Handling
- Repository: Return None or dict with error key
- Service: Return `{"success": False, "error": "message"}`
- Controller: Return JSONResponse with appropriate status code

### Authentication
- All endpoints require `get_current_user` (REQUIRED auth)
- No optional authentication for engagement operations

---

## Testing Checklist

- [ ] Add favorite (new engagement)
- [ ] Remove favorite (existing engagement)
- [ ] Follow playlist
- [ ] Unfollow playlist
- [ ] Invalid playlist UUID
- [ ] Playlist not found
- [ ] Unauthenticated request (401)
- [ ] Timestamps update correctly
- [ ] Multiple toggles maintain state correctly
