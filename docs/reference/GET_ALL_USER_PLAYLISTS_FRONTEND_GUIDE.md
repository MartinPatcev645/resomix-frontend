# Get All User Playlists - Frontend Integration Guide

## Endpoint
```
GET /playlists/get-all-playlists/
```

## Authentication
**Required**: JWT token in `Authorization` header
```
Authorization: Bearer <jwt_token>
```

## Request
Query params:
```
?page=1&page_size=20  // page_size defaults to 20
```

## Response

### Success (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Playlist",
      "is_public": false,
      "seed_track_title": "Whole Life (Original Mix)",
      "fork_id": "",
      "num_tracks": 10,
      "play_time": 3600,
      "created_at": "2025-01-15T10:30:00",
      "is_favorite": false,
      "is_following": false
    },
    ...
  ],
  "total": 123
}
```

### Error (401 Unauthorized)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

## Frontend Example

### JavaScript/TypeScript (Fetch)
```typescript
async function getUserPlaylists(page = 1, pageSize = 20) {
  const response = await fetch(`/playlists/get-all-playlists/?page=${page}&page_size=${pageSize}` , {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data; // { data: playlists[], total }
  } else {
    throw new Error(data.error);
  }
}
```

### React Hook Example
```typescript
import { useState, useEffect } from 'react';

function useUserPlaylists(initialPage = 1, pageSize = 20) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const response = await fetch(`/playlists/get-all-playlists/?page=${page}&page_size=${pageSize}` , {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        
        if (data.success) {
          setPlaylists(data.data);
          setTotal(data.total || 0);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPlaylists();
  }, [page, pageSize]);

  return { playlists, total, page, setPage, loading, error };
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Playlist UUID |
| `name` | string | Playlist name |
| `is_public` | boolean | Visibility status |
| `seed_track_title` | string\|null | Seed track title (if available) |
| `fork_id` | string | Original playlist UUID if forked (empty string if not) |
| `num_tracks` | number | Number of tracks in playlist |
| `play_time` | number | Total duration in seconds |
| `created_at` | string\|null | ISO timestamp |
| `is_favorite` | boolean | Favorite status |
| `is_following` | boolean | Follow status |
| `total` | number | Total playlists for the user (top-level field) |

## Notes
- Playlists are ordered by `created_at` descending (newest first)
- Returns both public and private playlists owned by the user
- `play_time` includes seed track duration
- `num_tracks` does not include seed track count

