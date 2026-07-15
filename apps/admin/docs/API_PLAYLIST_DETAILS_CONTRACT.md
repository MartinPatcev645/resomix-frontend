# API Contract: Get Playlist Details

## Endpoint
```
GET /admin/playlist/{uuid}
```

---

## 📤 Request Format

### URL Structure
```
GET {BASE_URL}/admin/playlist/{uuid}
```

### Path Parameter
| Parameter | Type | Required | Format | Example |
|-----------|------|----------|--------|---------|
| `uuid` | string | ✅ | UUID v4 | `44e77239-b716-4c82-9cd6-7175a152a750` |

### Headers
```http
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### Example Request
```http
GET /admin/playlist/44e77239-b716-4c82-9cd6-7175a152a750
Authorization: Bearer <admin_access_token>   # admin-role JWT from POST /admin/auth/login
```

---

## ⚙️ Backend Processing (Summary)

1. **Validate UUID Format**: Check if UUID matches pattern `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
2. **Authenticate**: Verify admin bearer token
3. **Fetch Playlist**: Query `playlists` table by UUID
4. **Get Track Count**: Count total tracks in `playlist_tracks`
5. **Fetch Seed Track** (if exists): Join with `tracks`, `artists`, `genres`, `labels` tables
6. **Fetch All Tracks**: Join `playlist_tracks` with `tracks`, `track_artists`, `artists`, `genres`, `labels`, `albums`
7. **Format Artists**: Convert artist names to arrays for each track
8. **Sort by Position**: Order tracks by `position` field (ASC)
9. **Return Response**: Send formatted JSON with playlist info, seed track, and tracks array

---

## 📥 Response Format (Frontend Expects)

### Success Response (200 OK)

```typescript
{
  success: boolean;           // Always true for success
  data: {
    playlist: {
      id: number;              // Numeric ID (for internal use)
      uuid: string;            // UUID v4
      user_id: string | null;  // User UUID or null (anonymous)
      name: string;            // Playlist name
      is_public: boolean;      // Visibility flag
      type: 'custom' | 'similarity' | 'waiting_segments';
      seed_track_id: number | null;  // Reference to seed track
      created_at: string;      // ISO 8601 datetime
      track_count: number;     // Total tracks in playlist
    };
    seed_track: {
      id: number;
      uuid: string;
      title: string;
      artists: string[];       // Array of artist names
      duration_sec: number;    // Decimal (e.g., 245.5)
      bpm: number | null;
      musical_key: string | null;  // e.g., "Am", "C#m"
      genre: string | null;
      label: string | null;
      year: number | null;
    } | null;                  // null if no seed track
    tracks: Array<{
      position: number;        // Track position (1-based)
      score: number | null;    // Similarity score (0-1), null for non-similarity playlists
      track: {
        id: number;
        uuid: string;
        title: string;
        artists: string[];     // Array of artist names
        duration_sec: number;  // Decimal (e.g., 198.3)
        file_size: number;     // Bytes (integer)
        type: string;          // e.g., "electrobuzz"
        genre: string | null;
        label: string | null;
        album: string | null;
        year: number | null;
        bpm: number | null;
        musical_key: string | null;
        file_path: string;     // Full file path
        preview_path: string | null;
        created_at: string;    // ISO 8601 datetime
      };
    }>;
  };
}
```

### Example Success Response

```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 123,
      "uuid": "44e77239-b716-4c82-9cd6-7175a152a750",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Summer Mix",
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

---

## ❌ Error Responses

### 400 Bad Request (Invalid UUID)
```json
{
  "success": false,
  "error": "Invalid playlist UUID format"
}
```

### 401 Unauthorized (Missing/Invalid Token)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden (Not Admin)
```json
{
  "success": false,
  "error": "Admin privileges required"
}
```

### 404 Not Found (Playlist Doesn't Exist)
```json
{
  "success": false,
  "error": "Playlist not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 📝 Important Notes

### Data Types
- **Timestamps**: ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
- **Decimals**: Numbers with decimal points for `duration_sec` and `score`
- **Booleans**: `true` or `false` (not strings)
- **Nulls**: Use `null` (not `"null"` string) for missing values

### Artists Array
- **Backend must convert**: `GROUP_CONCAT` result to array
- **Example**: `"Artist One, Artist Two"` → `["Artist One", "Artist Two"]`
- **Empty**: Return empty array `[]` if no artists

### Track Ordering
- Tracks **must** be sorted by `position` field (ascending)
- Position is **1-based** (starts at 1, not 0)

### Score Field
- Only present for `similarity` type playlists
- Range: 0.0 to 1.0 (decimal with up to 8 decimal places)
- Set to `null` for `custom` and `waiting_segments` playlists

### Empty Playlists
- If playlist has no tracks, return empty array: `"tracks": []`
- Still include `playlist` object with `track_count: 0`
- Still include `seed_track` if it exists

### Seed Track
- Return `null` if playlist has no seed track
- Only similarity playlists typically have seed tracks
- Custom playlists: `seed_track_id` will be `null` and `seed_track` will be `null`

---
