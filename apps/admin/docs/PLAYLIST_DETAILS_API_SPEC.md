# Playlist Details Backend API Specification

This document provides the backend API specification for retrieving detailed information about a specific playlist including all its tracks.

---

## 📋 Overview

This endpoint retrieves complete information about a single playlist, including:
- Playlist metadata
- Seed track information (if applicable)
- All tracks in the playlist with full details
- Artist, genre, and label information for each track

---

## 🔧 Endpoint Specification

### Get Playlist Details

**GET** `/admin/playlist/:id`

Retrieves detailed information about a specific playlist including all associated tracks.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Playlist ID (numeric ID, not UUID) |

#### Request Example

```http
GET /admin/playlist/123
Authorization: Bearer <admin_token>
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 123,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "My Awesome Mix",
      "is_public": true,
      "type": "similarity",
      "seed_track_id": 42,
      "created_at": "2024-01-15T10:30:00Z",
      "track_count": 25
    },
    "seed_track": {
      "id": 42,
      "uuid": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Summer Vibes",
      "artists": ["DJ Cool", "MC Flow"],
      "duration_sec": 245.5,
      "bpm": 128,
      "musical_key": "Am",
      "genre": "House",
      "label": "Cool Records",
      "year": 2024
    },
    "tracks": [
      {
        "position": 1,
        "score": 0.95000000,
        "track": {
          "id": 100,
          "uuid": "770e8400-e29b-41d4-a716-446655440002",
          "title": "Night Drive",
          "artists": ["Artist One", "Artist Two"],
          "duration_sec": 198.3,
          "file_size": 8456789,
          "type": "electrobuzz",
          "genre": "Techno",
          "label": "Underground Label",
          "album": "Night Sessions",
          "year": 2024,
          "bpm": 130,
          "musical_key": "Gm",
          "file_path": "/tracks/2024/01/night-drive.mp3",
          "preview_path": "/previews/2024/01/night-drive-preview.mp3",
          "created_at": "2024-01-10T08:20:00Z"
        }
      },
      {
        "position": 2,
        "score": 0.92000000,
        "track": {
          "id": 101,
          "uuid": "880e8400-e29b-41d4-a716-446655440003",
          "title": "Morning Light",
          "artists": ["Solo Artist"],
          "duration_sec": 215.7,
          "file_size": 9123456,
          "type": "electrobuzz",
          "genre": "Progressive House",
          "label": "Sunrise Records",
          "album": null,
          "year": 2023,
          "bpm": 125,
          "musical_key": "C#m",
          "file_path": "/tracks/2023/12/morning-light.mp3",
          "preview_path": "/previews/2023/12/morning-light-preview.mp3",
          "created_at": "2023-12-20T14:15:00Z"
        }
      }
    ]
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Playlist not found"
}
```

---

## 📊 Data Structure Details

### Playlist Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Playlist numeric ID |
| `uuid` | string | Playlist UUID |
| `user_id` | string \| null | User UUID (null for anonymous) |
| `name` | string | Playlist name |
| `is_public` | boolean | Visibility flag |
| `type` | string | Playlist type: custom/similarity/waiting_segments |
| `seed_track_id` | integer \| null | Seed track ID (for similarity playlists) |
| `created_at` | string | ISO timestamp |
| `track_count` | integer | Total number of tracks in playlist |

### Seed Track Object (Optional)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Track numeric ID |
| `uuid` | string | Track UUID |
| `title` | string | Track title |
| `artists` | array[string] | Artist names |
| `duration_sec` | decimal | Track duration in seconds |
| `bpm` | integer \| null | Beats per minute |
| `musical_key` | string \| null | Musical key (e.g., "Am", "C#m") |
| `genre` | string \| null | Genre name |
| `label` | string \| null | Label name |
| `year` | integer \| null | Release year |

### Track Object

| Field | Type | Description |
|-------|------|-------------|
| `position` | integer | Track position in playlist (1-based) |
| `score` | decimal \| null | Similarity score (for similarity playlists) |
| `track` | object | Track details (see below) |

### Track Details Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Track numeric ID |
| `uuid` | string | Track UUID |
| `title` | string | Track title |
| `artists` | array[string] | Artist names (from track_artists join) |
| `duration_sec` | decimal | Duration in seconds |
| `file_size` | integer | File size in bytes |
| `type` | string | Track type (e.g., "electrobuzz") |
| `genre` | string \| null | Genre name |
| `label` | string \| null | Label name |
| `album` | string \| null | Album title |
| `year` | integer \| null | Release year |
| `bpm` | integer \| null | Beats per minute |
| `musical_key` | string \| null | Musical key |
| `file_path` | string | Full file path |
| `preview_path` | string \| null | Preview file path |
| `created_at` | string | ISO timestamp |

---

## 🔧 Backend Implementation Notes

### 1. SQL Query Structure

```sql
-- Get playlist details
SELECT 
  p.*,
  (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
FROM playlists p
WHERE p.id = ?

-- Get seed track (if seed_track_id is not null)
SELECT 
  t.id, t.uuid, t.title, t.duration_sec, t.bpm, t.musical_key, t.year,
  g.name as genre,
  l.name as label,
  GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as artists
FROM tracks t
LEFT JOIN genres g ON t.genre_id = g.id
LEFT JOIN labels l ON t.label_id = l.id
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
WHERE t.id = ?
GROUP BY t.id

-- Get all tracks in playlist with details
SELECT 
  pt.position,
  pt.score,
  t.id, t.uuid, t.title, t.duration_sec, t.file_size, t.type,
  t.bpm, t.musical_key, t.year, t.file_path, t.preview_path, t.created_at,
  g.name as genre,
  l.name as label,
  alb.title as album,
  GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as artists
FROM playlist_tracks pt
JOIN tracks t ON pt.track_id = t.id
LEFT JOIN genres g ON t.genre_id = g.id
LEFT JOIN labels l ON t.label_id = l.id
LEFT JOIN albums alb ON t.album_id = alb.id
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
WHERE pt.playlist_id = ?
GROUP BY pt.playlist_id, pt.track_id, t.id
ORDER BY pt.position ASC
```

### 2. Data Processing

1. **Artists Array**: Convert comma-separated artist string to array
2. **File Sizes**: Format as human-readable (e.g., "8.1 MB")
3. **Duration**: Can be formatted as MM:SS on frontend
4. **Null Handling**: Ensure null values are properly returned for optional fields

### 3. Performance Considerations

- Use JOINs efficiently with proper indexes
- Consider caching playlist details for frequently accessed playlists
- Limit maximum tracks per playlist (e.g., 1000) for response size
- Use database connection pooling

### 4. Error Handling

- Return 404 if playlist doesn't exist
- Return 404 if playlist exists but has no tracks (or return empty tracks array)
- Handle missing seed track gracefully (return null in response)
- Validate playlist ID is numeric

---

## 📋 Response Examples

### Example: Custom Playlist (No Seed Track)

```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 456,
      "uuid": "aa0e8400-e29b-41d4-a716-446655440000",
      "user_id": "bb3e4567-e89b-12d3-a456-426614174000",
      "name": "Workout Mix",
      "is_public": false,
      "type": "custom",
      "seed_track_id": null,
      "created_at": "2024-02-10T14:30:00Z",
      "track_count": 15
    },
    "seed_track": null,
    "tracks": [...]
  }
}
```

### Example: Empty Playlist

```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 789,
      "uuid": "cc0e8400-e29b-41d4-a716-446655440000",
      "user_id": null,
      "name": "New Playlist",
      "is_public": false,
      "type": "custom",
      "seed_track_id": null,
      "created_at": "2024-03-01T09:00:00Z",
      "track_count": 0
    },
    "seed_track": null,
    "tracks": []
  }
}
```

---

## 🔒 Security Considerations

1. **Authentication**: Require admin token
2. **Authorization**: Verify admin role/permissions
3. **Input Validation**: Validate playlist ID is positive integer
4. **Rate Limiting**: Limit to 60 requests/minute per admin user
5. **File Path Security**: Ensure file paths don't expose sensitive system information

---

## 🧪 Testing Checklist

- [ ] Returns correct playlist details
- [ ] Returns all tracks in correct order (by position)
- [ ] Handles playlists with seed track
- [ ] Handles playlists without seed track (custom)
- [ ] Handles empty playlists
- [ ] Returns 404 for non-existent playlist
- [ ] Correctly joins and formats artist names
- [ ] Correctly joins genre and label names
- [ ] Handles tracks with multiple artists
- [ ] Handles tracks without artists/genre/label
- [ ] Handles tracks without album
- [ ] Returns null for optional fields correctly
- [ ] Score field populated for similarity playlists
- [ ] Track count matches actual tracks
- [ ] Respects authentication requirements
