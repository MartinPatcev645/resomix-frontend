# Similarity Server API Update - Implementation Summary

## Overview
Updated the FastAPI server to work with the new similarity server endpoints that use UUID-based lookups instead of file path-based lookups.

## Key Changes

### 1. Endpoint Changes
- **Old**: `/similarity/query-by-path/` with `file_path` parameter
- **New**: `/similarity/query-by-uuid/` with `track_uuid` parameter
- **Upload endpoint**: `/similarity/query-by-upload/` remains the same but now returns UUID-based responses

### 2. Response Format Changes
**Old Response Format:**
```json
{
  "status": "success",
  "results": [
    {
      "rank": 1,
      "score": 0.9547,
      "path": "/home/usman/data/veggera/public_html/audio.mp3"
    }
  ]
}
```

**New Response Format:**
```json
{
  "status": "success",
  "duration": 180.5,
  "message": "Found 20 similar tracks",
  "results": [
    {
      "rank": 1,
      "score": 0.9547,
      "uuid": "660e8400-e29b-41d4-a716-446655440001",
      "filename": "track_001.mp3",
      "original_idx": 12345
    }
  ]
}
```

## Files Modified

### 1. `/app/services/similarity_service.py`
**Changes:**
- Removed `path_prefix_to_remove` from `__init__` (no longer needed)
- Updated `calculate_similarity_for_upload()`:
  - Now extracts UUIDs from similarity response instead of paths
  - Uses `async_get_track_details_by_uuids()` instead of `async_get_track_details_by_paths()`
  - Simplified path conversion logic (no more prefix removal)
  
- Updated `get_similarity_by_path()`:
  - Now fetches track UUID from database first using the path
  - Calls new `/similarity/query-by-uuid/` endpoint with UUID
  - Uses UUID-based response parsing
  - Better error handling (returns error if track/UUID not found)
  
- Updated `get_track_by_uuid_with_similarity()`:
  - Simplified to verify track exists first
  - Removed path prefix conversion logic
  
- Updated error messages to reference UUIDs instead of paths

### 2. `/app/repositories/similarity_repository.py`
**Changes:**
- Added new method `async_get_track_details_by_uuids()`:
  - Fetches track details using a list of UUIDs
  - Returns dictionary mapping UUID → track details
  - Mirrors the functionality of `async_get_track_details_by_paths()` but for UUIDs
  - Uses existing `TrackRepository.async_get_tracks_by_uuids()` for bulk UUID lookups

## Benefits of UUID-Based Approach

1. **Simpler Logic**: No need to convert between absolute and relative paths
2. **More Robust**: UUIDs are stable identifiers that don't depend on file system structure
3. **Better Performance**: Direct UUID lookups are faster than path-based searches
4. **Consistency**: Both endpoints now use UUIDs consistently
5. **Cleaner Code**: Removed `path_prefix_to_remove` and related conversion logic

## Data Flow Comparison

### Old Flow (Path-Based):
```
1. Similarity server returns paths
2. Strip path prefix (/home/usman/data/)
3. Look up tracks by file_path in database
4. Return enriched results
```

### New Flow (UUID-Based):
```
1. Similarity server returns UUIDs
2. Look up tracks by UUID in database (direct)
3. Return enriched results
```

## Backward Compatibility

The method `get_similarity_by_path()` still accepts a `server_track_path` parameter for backward compatibility, but internally:
1. Looks up the track UUID from the path
2. Uses the UUID to call the new similarity endpoint
3. Returns the same response format as before

This ensures existing API endpoints that call this method continue to work without changes.

## Testing Checklist

- [ ] Upload similarity: Test file upload → similarity results
- [ ] Path-based similarity: Test existing track → similarity results  
- [ ] UUID-based similarity: Test direct UUID → similarity results
- [ ] Error handling: Test with non-existent UUIDs
- [ ] Playlist creation: Verify playlists are created correctly
- [ ] Demo mode: Verify redaction still works
- [ ] Duration updates: Verify track duration updates from upload endpoint

## Notes

- The `TrackRepository.async_get_tracks_by_uuids()` method already existed and is used by the new `async_get_track_details_by_uuids()` method
- All similarity lookups now use UUIDs internally, even when the API accepts paths
- The similarity server's `duration` field in upload responses is now properly utilized
