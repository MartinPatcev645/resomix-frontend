# Playlist Fork - Frontend Integration Guide

## Endpoint Overview

**POST** `/playlists/fork/{playlist_id}`

Creates a copy of a public playlist for the authenticated user.

---

## Authentication Required

- **JWT Token**: Required in Authorization header
- **API Key**: Required in X-API-Key header

```javascript
headers: {
  'Authorization': 'Bearer <jwt_token>',
  'X-API-Key': '<api_key>',
  'Content-Type': 'application/json'
}
```

---

## Request Parameters

### Path Parameters
- `playlist_id` (string, required): UUID of the public playlist to fork

### Example Request
```javascript
// JavaScript/Fetch
const response = await fetch('/playlists/fork/550e8400-e29b-41d4-a716-446655440000', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  }
});

// Axios
const response = await axios.post('/playlists/fork/550e8400-e29b-41d4-a716-446655440000', {}, {
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'X-API-Key': 'your_api_key'
  }
});
```

---

## Response Codes & Meanings

### ✅ Success Responses

#### 201 Created - Fork Successful
```json
{
  "success": true,
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
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.8956789,
        "id": "67addcb39387d00fbdc3ace0",
        "label": "Anjunabeats",
        "duration": 456,
        "artist": "Above & Beyond",
        "title": "Sun & Moon",
        "year": 2011
      }
    ],
    "playlist": {
      "id": "new-forked-playlist-uuid",
      "name": "Original Playlist Name",
      "is_public": false,
      "fork_id": "original-playlist-uuid"
    }
  }
}
```

**What this means**: Playlist was successfully forked. The `data.playlist.id` contains the UUID of your new forked playlist.

---

### ❌ Error Responses

#### 400 Bad Request - Already Own Playlist
```json
{
  "success": false,
  "error": "You already own this playlist. No need to fork it."
}
```
**What this means**: You're trying to fork a playlist you already own. You don't need to fork your own playlists.

#### 401 Unauthorized - Authentication Required
```json
{
  "success": false,
  "error": "Authentication required"
}
```
**What this means**: Missing or invalid JWT token. User needs to log in.

#### 403 Forbidden - Private Playlist
```json
{
  "success": false,
  "error": "Cannot fork private playlists. Only public playlists can be forked."
}
```
**What this means**: The playlist is private and cannot be forked. Only public playlists can be forked.

#### 404 Not Found - Playlist Not Found
```json
{
  "success": false,
  "error": "Playlist not found"
}
```
**What this means**: The playlist ID doesn't exist in the system.

#### 422 Unprocessable Entity - Invalid Playlist ID
```json
{
  "success": false,
  "error": "playlist_id cannot be empty"
}
```
**What this means**: The playlist ID is empty or invalid format.

#### 500 Internal Server Error - Server Error
```json
{
  "success": false,
  "error": "An internal server error occurred while forking the playlist"
}
```
**What this means**: Something went wrong on the server. Try again later or contact support.

---

## Frontend Implementation Examples

### React/JavaScript Example
```javascript
const forkPlaylist = async (playlistId) => {
  try {
    const response = await fetch(`/playlists/fork/${playlistId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
        'X-API-Key': process.env.REACT_APP_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Success - show success message
      console.log('Playlist forked successfully!');
      console.log('New playlist ID:', data.data.playlist.id);
      
      // Redirect to the new forked playlist
      window.location.href = `/playlist/${data.data.playlist.id}`;
    } else {
      // Error - show error message
      console.error('Fork failed:', data.error);
      alert(data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('Network error. Please try again.');
  }
};

// Usage
forkPlaylist('550e8400-e29b-41d4-a716-446655440000');
```

### Vue.js Example
```javascript
// In your Vue component
methods: {
  async forkPlaylist(playlistId) {
    try {
      const response = await this.$http.post(`/playlists/fork/${playlistId}`, {}, {
        headers: {
          'Authorization': `Bearer ${this.$store.state.auth.token}`,
          'X-API-Key': process.env.VUE_APP_API_KEY
        }
      });

      if (response.data.success) {
        this.$toast.success('Playlist forked successfully!');
        this.$router.push(`/playlist/${response.data.data.playlist.id}`);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to fork playlist';
      this.$toast.error(errorMessage);
    }
  }
}
```

### Angular Example
```typescript
// In your Angular service
forkPlaylist(playlistId: string): Observable<any> {
  const headers = {
    'Authorization': `Bearer ${this.authService.getToken()}`,
    'X-API-Key': environment.apiKey
  };

  return this.http.post(`/playlists/fork/${playlistId}`, {}, { headers })
    .pipe(
      map((response: any) => {
        if (response.success) {
          this.snackBar.open('Playlist forked successfully!', 'Close', { duration: 3000 });
          return response.data;
        }
        throw new Error(response.error);
      }),
      catchError(error => {
        const errorMessage = error.error?.error || 'Failed to fork playlist';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        return throwError(error);
      })
    );
}
```

---

## What Happens When You Fork

1. **Creates a new playlist** with the same name and tracks as the original
2. **Sets the new playlist as private** (you own it)
3. **Resets track positions** to 1.0, 2.0, 3.0, etc. (maintains order)
4. **Links back to original** via fork_id for tracking
5. **Increments fork count** on the original playlist
6. **Preserves original metadata** like created_at timestamp

---

## UI/UX Recommendations

### Fork Button States
```javascript
const [forkState, setForkState] = useState('idle'); // 'idle', 'loading', 'success', 'error'

const handleFork = async () => {
  setForkState('loading');
  try {
    await forkPlaylist(playlistId);
    setForkState('success');
  } catch (error) {
    setForkState('error');
  }
};

// In your JSX
<button 
  onClick={handleFork}
  disabled={forkState === 'loading'}
  className={forkState === 'loading' ? 'loading' : ''}
>
  {forkState === 'loading' ? 'Forking...' : 'Fork Playlist'}
</button>
```

### Error Handling UI
```javascript
const getErrorMessage = (error) => {
  const errorMap = {
    'You already own this playlist. No need to fork it.': 'You already own this playlist',
    'Cannot fork private playlists. Only public playlists can be forked.': 'This playlist is private',
    'Playlist not found': 'Playlist not found',
    'Authentication required': 'Please log in to fork playlists'
  };
  return errorMap[error] || 'Failed to fork playlist';
};
```

---

## Testing the Endpoint

### Using cURL
```bash
curl -X POST "https://your-api.com/playlists/fork/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json"
```

### Using Postman
1. Set method to **POST**
2. URL: `https://your-api.com/playlists/fork/{playlist_id}`
3. Headers:
   - `Authorization: Bearer your_jwt_token`
   - `X-API-Key: your_api_key`
   - `Content-Type: application/json`
4. Send request

---

## Notes

- **Only public playlists** can be forked
- **You cannot fork your own playlists** (you already own them)
- **Forked playlists are private** by default (you own them)
- **Track order is preserved** but positions are reset
- **Original playlist's fork count** is incremented
- **Authentication is required** for all fork operations
