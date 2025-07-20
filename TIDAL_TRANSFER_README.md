# Tidal Playlist Transfer Feature

## Overview

The Tidal Transfer feature allows users to transfer their ResomiX playlists to their personal Tidal accounts. This feature integrates with the Tidal API (both official v2 and unofficial endpoints) to search for tracks and create playlists in the user's Tidal library.

## Features

- **OAuth PKCE Authentication**: Secure user authentication through Tidal OAuth 2.0 with PKCE flow
- **Intelligent Track Matching**: Advanced track search algorithm with fallback strategies
- **Batch Processing**: Efficient handling of large playlists with Tidal's API limits
- **Comprehensive Reporting**: Detailed transfer statistics including success/failure counts
- **Custom Playlist Names**: Option to specify custom names for transferred playlists
- **Caching System**: Prevents repeated searches by caching Tidal track IDs

## API Endpoint

### POST `/tidal/transfer-playlist/`

Transfer a ResomiX playlist to user's Tidal account.

#### Request Body

```json
{
  "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
  "access_token": "BQC4YqJ...",
  "playlist_name": "My ResomiX Playlist"
}
```

#### Parameters

- **playlist_id** (required): UUID of the ResomiX playlist to transfer
- **access_token** (required): Valid Tidal OAuth access token
- **playlist_name** (optional): Custom name for the Tidal playlist

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "tidal_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
    "tidal_playlist_url": "https://listen.tidal.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
    "tidal_playlist_name": "My ResomiX Playlist",
    "total_tracks": 25,
    "tracks_added": 22,
    "tracks_not_found": 3,
    "not_found_tracks": [
      "Artist Name - Track Title",
      "Another Artist - Another Track"
    ],
    "transfer_time_seconds": 45.2
  },
  "message": "Successfully transferred playlist to Tidal. 22 tracks added, 3 tracks not found."
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired Tidal access token"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Playlist with ID 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

**Error (422):**
```json
{
  "success": false,
  "error": "Playlist 550e8400-e29b-41d4-a716-446655440000 has no tracks to transfer"
}
```

**Error (429):**
```json
{
  "success": false,
  "error": "Tidal API rate limit exceeded. Please try again later."
}
```

## Frontend Integration Guide

### Step 1: Set up Tidal OAuth with Server-Side Authentication

The ResomiX server now handles Tidal client credentials server-side for enhanced security. The frontend only needs to handle the OAuth flow without exposing client secrets.

#### Required Tidal Scopes
- `playlists.read` - To read user playlists
- `playlists.write` - To create and modify playlists

#### Step 2: Generate PKCE Parameters (Frontend)

```javascript
// Generate code verifier (43-128 characters)
const generateCodeVerifier = () => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(64));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// Generate code challenge
const generateCodeChallenge = async (codeVerifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Store code verifier for later use
localStorage.setItem('tidal_code_verifier', codeVerifier);
```

#### Step 3: Get Authorization URL from Server

```javascript
const getAuthorizationUrl = async () => {
  const redirectUri = `${window.location.origin}/tidal-callback`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier for token exchange
  localStorage.setItem('tidal_code_verifier', codeVerifier);
  
  const response = await fetch('/tidal/auth/authorize?api_key=YOUR_API_KEY', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      redirect_uri: redirectUri,
      code_challenge: codeChallenge
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Store state for validation
    localStorage.setItem('tidal_oauth_state', result.data.state);
    
    // Redirect to Tidal authorization
    window.location.href = result.data.authorization_url;
  } else {
    throw new Error(result.error || 'Failed to get authorization URL');
  }
}
```

#### Step 4: Handle OAuth Callback and Exchange Code for Token

```javascript
const handleTidalCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const storedState = localStorage.getItem('tidal_oauth_state');
  
  // Validate state parameter
  if (!state || state !== storedState) {
    throw new Error('Invalid OAuth state parameter');
  }
  
  if (code) {
    const codeVerifier = localStorage.getItem('tidal_code_verifier');
    const redirectUri = `${window.location.origin}/tidal-callback`;
    
    // Exchange code for tokens using server endpoint
    const response = await fetch('/tidal/auth/token?api_key=YOUR_API_KEY', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store access token
      localStorage.setItem('tidal_access_token', result.data.access_token);
      localStorage.setItem('tidal_refresh_token', result.data.refresh_token);
      
      // Clean up temporary storage
      localStorage.removeItem('tidal_code_verifier');
      localStorage.removeItem('tidal_oauth_state');
      
      return result.data.access_token;
    } else {
      throw new Error(result.error || 'Failed to exchange code for token');
    }
  } else {
    throw new Error('No authorization code received');
  }
}
```

#### Step 5: Call ResomiX Transfer API

```javascript
const transferPlaylistToTidal = async (playlistId, customName = null) => {
  const tidalAccessToken = localStorage.getItem('tidal_access_token');
  
  if (!tidalAccessToken) {
    throw new Error('No Tidal access token available');
  }
  
  const response = await fetch('/tidal/transfer-playlist/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_RESOMIX_API_KEY}` // Your ResomiX API key
    },
    body: JSON.stringify({
      playlist_id: playlistId,
      access_token: tidalAccessToken,
      playlist_name: customName
    })
  });
  
  const result = await response.json();
  return result;
}
```

### Complete React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const TidalTransferComponent = ({ playlistId, playlistName }) => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  const [tidalConnected, setTidalConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Check if user has Tidal access token
    const token = localStorage.getItem('tidal_access_token');
    setTidalConnected(!!token);
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !token) {
      handleTidalCallback();
    }
  }, []);

  const generateCodeVerifier = () => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(64));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  const generateCodeChallenge = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const handleTidalAuth = async () => {
    setIsAuthenticating(true);
    try {
      const redirectUri = `${window.location.origin}/tidal-callback`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store code verifier for token exchange
      localStorage.setItem('tidal_code_verifier', codeVerifier);
      
      const response = await fetch(`/tidal/auth/authorize?api_key=${process.env.REACT_APP_RESOMIX_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect_uri: redirectUri,
          code_challenge: codeChallenge
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Store state for validation
        localStorage.setItem('tidal_oauth_state', result.data.state);
        
        // Redirect to Tidal authorization
        window.location.href = result.data.authorization_url;
      } else {
        throw new Error(result.error || 'Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Error starting Tidal auth:', error);
      setIsAuthenticating(false);
    }
  };

  const handleTidalCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const storedState = localStorage.getItem('tidal_oauth_state');
      
      // Validate state parameter
      if (!state || state !== storedState) {
        throw new Error('Invalid OAuth state parameter');
      }
      
      if (code) {
        const codeVerifier = localStorage.getItem('tidal_code_verifier');
        const redirectUri = `${window.location.origin}/tidal-callback`;
        
        // Exchange code for tokens using server endpoint
        const response = await fetch(`/tidal/auth/token?api_key=${process.env.REACT_APP_RESOMIX_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Store access token
          localStorage.setItem('tidal_access_token', result.data.access_token);
          localStorage.setItem('tidal_refresh_token', result.data.refresh_token);
          
          // Clean up temporary storage
          localStorage.removeItem('tidal_code_verifier');
          localStorage.removeItem('tidal_oauth_state');
          
          setTidalConnected(true);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          throw new Error(result.error || 'Failed to exchange code for token');
        }
      }
    } catch (error) {
      console.error('Error handling Tidal callback:', error);
    }
    setIsAuthenticating(false);
  };

  const transferPlaylist = async () => {
    setIsTransferring(true);
    try {
      const tidalAccessToken = localStorage.getItem('tidal_access_token');
      
      const response = await fetch('/tidal/transfer-playlist/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_RESOMIX_API_KEY}`
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          access_token: tidalAccessToken,
          playlist_name: `ResomiX - ${playlistName}`
        })
      });
      
      const result = await response.json();
      setTransferResult(result);
    } catch (error) {
      console.error('Error transferring playlist:', error);
      setTransferResult({
        success: false,
        error: 'Failed to transfer playlist'
      });
    }
    setIsTransferring(false);
  };

  const disconnectTidal = () => {
    localStorage.removeItem('tidal_access_token');
    localStorage.removeItem('tidal_refresh_token');
    setTidalConnected(false);
    setTransferResult(null);
  };

  return (
    <div className="tidal-transfer">
      <h3>Transfer to Tidal</h3>
      
      {!tidalConnected ? (
        <div>
          <p>Connect your Tidal account to transfer this playlist</p>
          <button 
            onClick={handleTidalAuth} 
            disabled={isAuthenticating}
            className="btn btn-primary"
          >
            {isAuthenticating ? 'Connecting...' : 'Connect Tidal Account'}
          </button>
        </div>
      ) : (
        <div>
          <p>Tidal account connected ✓</p>
          <button 
            onClick={transferPlaylist} 
            disabled={isTransferring}
            className="btn btn-success"
          >
            {isTransferring ? 'Transferring...' : 'Transfer to Tidal'}
          </button>
          <button onClick={disconnectTidal} className="btn btn-secondary">
            Disconnect Tidal
          </button>
        </div>
      )}

      {transferResult && (
        <div className={`transfer-result ${transferResult.success ? 'success' : 'error'}`}>
          {transferResult.success ? (
            <div>
              <p>✅ Playlist transferred successfully!</p>
              <p>Added {transferResult.data.tracks_added} out of {transferResult.data.total_tracks} tracks</p>
              {transferResult.data.tracks_not_found > 0 && (
                <p>⚠️ {transferResult.data.tracks_not_found} tracks not found on Tidal</p>
              )}
              <a 
                href={transferResult.data.tidal_playlist_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-link"
              >
                Open in Tidal
              </a>
            </div>
          ) : (
            <div>
              <p>❌ Transfer failed: {transferResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TidalTransferComponent;
```

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Tidal Configuration
TIDAL_CLIENT_ID=your_tidal_client_id_here
TIDAL_CLIENT_SECRET=your_tidal_client_secret_here  # Optional for PKCE flow
```

**Note**: For PKCE flow, only the `TIDAL_CLIENT_ID` is required on the frontend. The `TIDAL_CLIENT_SECRET` is optional and only needed if you plan to use server-side OAuth flows in the future.

## Technical Implementation Details

### Architecture

The Tidal transfer feature follows a clean architecture pattern:

1. **API Router** (`app/api/routers/tidal_transfer.py`) - Handles HTTP requests
2. **Controller** (`app/controllers/tidal_transfer_controller.py`) - Coordinates business logic
3. **Service** (`app/services/tidal_transfer_service.py`) - Implements core transfer logic
4. **Repository** (`app/repositories/playlist_transfer_track_repository.py`) - Handles data persistence
5. **Schemas** (`app/schemas/tidal_transfer.py`) - Validates request/response data

### Key Features

#### Track Search Algorithm
- Uses Tidal's official API v2 for track search
- Implements intelligent query cleaning to remove remix info, featuring artists, etc.
- Calculates similarity scores between search queries and results
- Falls back to title-only search if artist+title search fails
- Caches successful matches to prevent repeated searches

#### Playlist Creation
- Uses unofficial Tidal endpoints for playlist creation (official write endpoints not yet public)
- Creates private playlists by default
- Supports custom playlist names and descriptions
- Handles batch track additions with appropriate rate limiting

#### Error Handling
- Comprehensive error handling for authentication, rate limiting, and API errors
- User-friendly error messages
- Proper HTTP status codes
- Detailed logging for debugging

#### Caching System
- Caches Tidal track IDs in `playlist_transfer_tracks` table
- Prevents repeated API calls for the same tracks
- Supports batch cache operations for performance
- Includes cache invalidation and updates

### Database Schema

The feature uses the existing `playlist_transfer_tracks` table with an added `tidal_id` column:

```sql
CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id        BIGINT UNSIGNED NOT NULL,
    spotify_id      VARCHAR(100) NULL,
    apple_music_id  VARCHAR(100) NULL,
    beatport_id     VARCHAR(100) NULL,
    deezer_id       VARCHAR(100) NULL,
    tidal_id        VARCHAR(100) NULL,  -- New column for Tidal support
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    KEY idx_ptt_tidal (tidal_id)  -- New index for Tidal queries
);
```

### Dependencies

The feature requires the following Python packages:
- `aiohttp` - For async HTTP requests to Tidal API
- `fastapi` - Web framework
- `pydantic` - Data validation
- `sqlalchemy` - Database ORM

## API Limitations and Considerations

### Tidal API Constraints
- **Official API**: Currently supports search and catalog operations
- **Unofficial Endpoints**: Required for playlist creation and modification
- **Rate Limiting**: Tidal enforces rate limits (specific limits not publicly documented)
- **Regional Availability**: Track availability varies by region

### Best Practices
1. **Rate Limiting**: Implement client-side rate limiting to avoid API limits
2. **Error Handling**: Always handle authentication errors gracefully
3. **User Feedback**: Provide clear feedback about transfer progress and results
4. **Token Management**: Implement proper token refresh logic
5. **Caching**: Leverage the built-in caching system for better performance

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check if access token is valid and not expired
- Verify required scopes are included in the token
- Implement token refresh logic

**403 Forbidden**
- User may not have necessary permissions
- Check if user's Tidal subscription supports playlist creation

**429 Rate Limited**
- Implement exponential backoff
- Reduce concurrent request limits
- Cache results to minimize API calls

**Track Not Found**
- Expected behavior due to catalog differences
- Provide user feedback about missing tracks
- Consider alternative search strategies

### Debugging

Enable detailed logging by setting the logger level:

```python
import logging
logging.getLogger('app.services.tidal_transfer_service').setLevel(logging.DEBUG)
```

## Security Considerations

1. **Never store client secrets** in frontend code
2. **Use PKCE flow** for OAuth (no client secret required)
3. **Validate all tokens** on the backend
4. **Implement proper CORS** policies
5. **Use HTTPS** in production
6. **Store tokens securely** (consider httpOnly cookies for production)

## Future Enhancements

1. **Official API Integration**: Migrate to official playlist write endpoints when available
2. **Batch Operations**: Improve batch processing for large playlists
3. **Advanced Matching**: Implement more sophisticated track matching algorithms
4. **User Preferences**: Allow users to configure transfer preferences
5. **Sync Features**: Implement two-way sync between ResomiX and Tidal

## Support

For issues related to the Tidal transfer feature:

1. Check the logs for detailed error messages
2. Verify Tidal API credentials and permissions
3. Ensure all required dependencies are installed
4. Test with a small playlist first
5. Contact the development team with specific error details

---

**Note**: This feature uses both official Tidal API v2 endpoints and unofficial endpoints. The unofficial endpoints may change without notice. Monitor Tidal's developer platform for updates on official playlist write API availability. 