# Spotify Playlist Transfer Feature

## Overview

The Spotify Transfer feature allows users to transfer their ResomiX playlists to their personal Spotify accounts. This feature integrates with the Spotify Web API to search for tracks and create playlists in the user's Spotify library.

## Features

- **OAuth Authentication**: Secure user authentication through Spotify OAuth 2.0
- **Intelligent Track Matching**: Advanced track search algorithm with fallback strategies
- **Batch Processing**: Efficient handling of large playlists with Spotify's API limits
- **Comprehensive Reporting**: Detailed transfer statistics including success/failure counts
- **Custom Playlist Names**: Option to specify custom names for transferred playlists

## API Endpoint

### POST `/spotify/transfer-playlist/`

Transfer a ResomiX playlist to user's Spotify account.

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
- **access_token** (required): Valid Spotify OAuth access token
- **playlist_name** (optional): Custom name for the Spotify playlist

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "spotify_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
    "spotify_playlist_url": "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
    "spotify_playlist_name": "My ResomiX Playlist",
    "total_tracks": 25,
    "tracks_added": 22,
    "tracks_not_found": 3,
    "not_found_tracks": [
      "Artist Name - Track Title",
      "Another Artist - Another Track"
    ]
  },
  "message": "Successfully transferred playlist to Spotify. 22 tracks added, 3 tracks not found."
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired Spotify access token",
  "details": {
    "spotify_error": "The access token expired"
  }
}
```

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Spotify Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here  # Optional for PKCE flow
```

**Note**: For PKCE flow, only the `SPOTIFY_CLIENT_ID` is required on the frontend. The `SPOTIFY_CLIENT_SECRET` is optional and only needed if you plan to use server-side OAuth flows in the future.

### Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Note down the **Client ID** (Client Secret not needed for PKCE)
4. Set the **Redirect URIs** in your app settings:
   - For development: `http://localhost:3000/callback`
   - For production: `https://yourdomain.com/callback`
5. **Important**: Enable the following settings for PKCE:
   - No additional configuration needed - PKCE is supported by default
   - Client Secret is **not required** for PKCE flow

## Frontend Integration

### OAuth Flow (PKCE - Recommended)

The frontend should implement the **Authorization Code with PKCE Flow** as recommended by Spotify. This is the most secure method for client-side applications and doesn't require storing client secrets.

Based on the [official Spotify PKCE documentation](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), here's the complete implementation:

#### Step 1: Generate Code Verifier and Challenge

```javascript
// Generate code verifier (43-128 characters)
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const codeVerifier = generateRandomString(64);

// Generate code challenge
const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const codeChallenge = base64encode(await sha256(codeVerifier));
```

#### Step 2: Request User Authorization

```javascript
const clientId = 'YOUR_SPOTIFY_CLIENT_ID'; // Only client ID needed for PKCE
const redirectUri = 'https://beta.resomix.com/playlist-share'; // Your app's callback URL
const scope = 'playlist-modify-public playlist-modify-private';

// Store code verifier for later use
window.localStorage.setItem('code_verifier', codeVerifier);

// Build authorization URL
const authUrl = new URL("https://accounts.spotify.com/authorize");
const params = {
  response_type: 'code',
  client_id: clientId,
  scope,
  code_challenge_method: 'S256',
  code_challenge: codeChallenge,
  redirect_uri: redirectUri,
  state: generateRandomString(16) // For security
}

authUrl.search = new URLSearchParams(params).toString();

// Redirect user to Spotify authorization
window.location.href = authUrl.toString();
```

#### Step 3: Handle Authorization Callback

```javascript
// Parse the authorization code from callback URL
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  // Exchange code for access token
  await getAccessToken(code);
}
```

#### Step 4: Exchange Code for Access Token

```javascript
const getAccessToken = async (code) => {
  const codeVerifier = localStorage.getItem('code_verifier');
  
  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  }

  const response = await fetch(url, payload);
  const data = await response.json();
  
  if (data.access_token) {
    // Store access token
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    
    // Clean up
    localStorage.removeItem('code_verifier');
    
    return data.access_token;
  } else {
    throw new Error('Failed to get access token');
  }
}
```

#### Step 5: Call ResomiX Transfer API

```javascript
const transferPlaylistToSpotify = async (playlistId, customName = null) => {
  const spotifyAccessToken = localStorage.getItem('spotify_access_token');
  
  if (!spotifyAccessToken) {
    throw new Error('No Spotify access token available');
  }
  
  const response = await fetch('/spotify/transfer-playlist/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_RESOMIX_API_KEY}` // Your ResomiX API key
    },
    body: JSON.stringify({
      playlist_id: playlistId,
      access_token: spotifyAccessToken,
      playlist_name: customName
    })
  });
  
  const result = await response.json();
  return result;
}
```

### Token Refresh (Optional Enhancement)

Spotify access tokens expire after 1 hour. For better user experience, implement token refresh:

```javascript
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  
  const data = await response.json();
  
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }
    return data.access_token;
  }
  
  throw new Error('Failed to refresh token');
};

// Use before making API calls
const getValidAccessToken = async () => {
  let accessToken = localStorage.getItem('spotify_access_token');
  
  // Check if token needs refresh (you can store expiry time)
  try {
    // Try a simple API call to test token validity
    const testResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (testResponse.status === 401) {
      // Token expired, refresh it
      accessToken = await refreshAccessToken();
    }
  } catch (error) {
    // Try to refresh token
    accessToken = await refreshAccessToken();
  }
  
  return accessToken;
};
```

### Required Scopes

Your frontend OAuth flow should request these scopes:

- `playlist-modify-public`: **Required** - Create and modify public playlists
- `playlist-modify-private`: **Optional** - Create and modify private playlists

### Complete Frontend Example

Here's a complete React component example:

```jsx
import React, { useState, useEffect } from 'react';

const SpotifyPlaylistTransfer = ({ playlistId, playlistName }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const redirectUri = `${window.location.origin}/callback`;
  
  useEffect(() => {
    // Check if user is already authorized
    const token = localStorage.getItem('spotify_access_token');
    setIsAuthorized(!!token);
    
    // Handle callback from Spotify
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleSpotifyCallback(code);
    }
  }, []);
  
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }
  
  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }
  
  const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
  
  const authorizeSpotify = async () => {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64encode(await sha256(codeVerifier));
    
    localStorage.setItem('code_verifier', codeVerifier);
    
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    const params = {
      response_type: 'code',
      client_id: clientId,
      scope: 'playlist-modify-public playlist-modify-private',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      state: generateRandomString(16)
    };
    
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
  };
  
  const handleSpotifyCallback = async (code) => {
    try {
      const codeVerifier = localStorage.getItem('code_verifier');
      
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.removeItem('code_verifier');
        setIsAuthorized(true);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }
  };
  
  const transferPlaylist = async () => {
    setIsTransferring(true);
    try {
      const spotifyAccessToken = localStorage.getItem('spotify_access_token');
      
      const response = await fetch('/spotify/transfer-playlist/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_RESOMIX_API_KEY}`
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          access_token: spotifyAccessToken,
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
  
  return (
    <div className="spotify-transfer">
      {!isAuthorized ? (
        <button onClick={authorizeSpotify} className="spotify-auth-button">
          🎵 Connect to Spotify
        </button>
      ) : (
        <div>
          <button 
            onClick={transferPlaylist} 
            disabled={isTransferring}
            className="transfer-button"
          >
            {isTransferring ? 'Transferring...' : 'Transfer to Spotify'}
          </button>
          
          {transferResult && (
            <div className={`result ${transferResult.success ? 'success' : 'error'}`}>
              {transferResult.success ? (
                <div>
                  <p>✅ {transferResult.message}</p>
                  <a href={transferResult.data.spotify_playlist_url} target="_blank" rel="noopener noreferrer">
                    Open in Spotify
                  </a>
                </div>
              ) : (
                <p>❌ {transferResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyPlaylistTransfer;
```

## Track Matching Algorithm

The service uses an intelligent track matching algorithm:

1. **Primary Search**: Searches using cleaned track title and artist name
2. **Fallback Search**: If no results, searches using title only
3. **Scoring System**: Ranks matches based on title and artist similarity
4. **Best Match Selection**: Selects the highest scoring match

### Track Cleaning

The algorithm cleans track metadata before searching:

- Removes common strings like "(Original Mix)"
- Handles stopper strings that indicate URLs or unwanted content
- Normalizes special characters and spacing
- Limits search query length to 100 characters

## Error Handling

The API handles various error scenarios:

- **404**: Playlist not found
- **401**: Invalid or expired Spotify access token
- **422**: Invalid request data or playlist has no tracks
- **500**: Internal server errors

## Rate Limiting

The service respects Spotify's API rate limits:

- Tracks are added to playlists in batches of 100
- Searches are performed with appropriate delays
- Failed requests are logged for debugging

## Security Considerations

- Access tokens are never stored by the API
- All Spotify API calls are made server-side
- User authentication is handled through existing API key system
- Spotify credentials are stored securely in environment variables

## Dependencies

The feature requires the following Python package:

```
spotipy==2.24.0
```

This is already included in the updated `requirements.txt` file.

## Testing

To test the feature:

1. Set up a Spotify Developer account and app
2. Configure environment variables
3. Use a tool like Postman or curl to test the endpoint
4. Verify playlists are created correctly in Spotify

## Troubleshooting

### Common Issues

1. **Invalid Access Token**: Ensure the frontend OAuth flow is working correctly
2. **Track Not Found**: Some tracks may not be available on Spotify
3. **Rate Limiting**: Large playlists may take time to process
4. **Permission Errors**: Ensure correct scopes are requested in OAuth flow

### Logs

The service logs detailed information about:
- Track search results
- Failed track matches
- Spotify API errors
- Transfer statistics

Check the application logs for detailed error information.

## Future Enhancements

Potential improvements for future versions:

- **Batch Transfer**: Transfer multiple playlists at once
- **Sync Feature**: Keep ResomiX and Spotify playlists synchronized
- **Advanced Matching**: Use audio features for better track matching
- **User Preferences**: Allow users to configure matching preferences
- **Transfer History**: Track previous transfers and prevent duplicates
