# Tidal OAuth Integration Guide for Frontend

## Overview

The ResomiX server now provides secure server-side Tidal OAuth authentication endpoints. This approach keeps client secrets secure on the server while providing a simple integration path for the frontend.

## 🔐 Security Benefits

- ✅ **Client secrets never exposed** to frontend
- ✅ **Server-side credential management**
- ✅ **PKCE flow with state validation**
- ✅ **Secure token exchange**

## 🚀 Available Endpoints

### 1. Authorization URL Generation
```http
POST /tidal/auth/authorize?api_key=YOUR_API_KEY
```

**Request Body:**
```json
{
  "redirect_uri": "https://yourapp.com/tidal-callback",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://auth.tidal.com/v1/oauth2/authorize?...",
    "state": "secure_random_state_value"
  }
}
```

### 2. Token Exchange
```http
POST /tidal/auth/token?api_key=YOUR_API_KEY
```

**Request Body:**
```json
{
  "code": "authorization_code_from_tidal",
  "redirect_uri": "https://yourapp.com/tidal-callback",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "BQC4YqJ...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "AQC4YqJ...",
    "scope": "playlists.read playlists.write"
  }
}
```

### 3. Playlist Transfer (Unchanged)
```http
POST /tidal/transfer-playlist/?api_key=YOUR_API_KEY
```

## 📱 Frontend Implementation

### Step 1: PKCE Helper Functions

```javascript
// Generate code verifier (43-128 characters)
const generateCodeVerifier = () => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(64));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

// Generate code challenge
const generateCodeChallenge = async (codeVerifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};
```

### Step 2: Start OAuth Flow

```javascript
const startTidalAuth = async () => {
  try {
    const redirectUri = `${window.location.origin}/tidal-callback`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    localStorage.setItem('tidal_code_verifier', codeVerifier);
    
    // Get authorization URL from server
    const response = await fetch(`/tidal/auth/authorize?api_key=${API_KEY}`, {
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
      
      // Redirect to Tidal
      window.location.href = result.data.authorization_url;
    } else {
      throw new Error(result.error || 'Failed to get authorization URL');
    }
  } catch (error) {
    console.error('Error starting Tidal auth:', error);
    throw error;
  }
};
```

### Step 3: Handle OAuth Callback

```javascript
const handleTidalCallback = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('tidal_oauth_state');
    
    // Validate state parameter (CSRF protection)
    if (!state || state !== storedState) {
      throw new Error('Invalid OAuth state parameter');
    }
    
    if (!code) {
      throw new Error('No authorization code received');
    }
    
    const codeVerifier = localStorage.getItem('tidal_code_verifier');
    const redirectUri = `${window.location.origin}/tidal-callback`;
    
    // Exchange code for tokens
    const response = await fetch(`/tidal/auth/token?api_key=${API_KEY}`, {
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
      // Store tokens
      localStorage.setItem('tidal_access_token', result.data.access_token);
      localStorage.setItem('tidal_refresh_token', result.data.refresh_token);
      
      // Clean up temporary data
      localStorage.removeItem('tidal_code_verifier');
      localStorage.removeItem('tidal_oauth_state');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return result.data;
    } else {
      throw new Error(result.error || 'Failed to exchange code for token');
    }
  } catch (error) {
    console.error('Error handling Tidal callback:', error);
    throw error;
  }
};
```

### Step 4: Transfer Playlist

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
    },
    body: JSON.stringify({
      playlist_id: playlistId,
      access_token: tidalAccessToken,
      playlist_name: customName
    })
  });
  
  const result = await response.json();
  return result;
};
```

## 🔧 React Hook Example

```javascript
import { useState, useEffect } from 'react';

export const useTidalAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  useEffect(() => {
    // Check if user has access token
    const token = localStorage.getItem('tidal_access_token');
    setIsConnected(!!token);
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !token) {
      handleCallback();
    }
  }, []);
  
  const connect = async () => {
    setIsAuthenticating(true);
    try {
      await startTidalAuth();
    } catch (error) {
      setIsAuthenticating(false);
      throw error;
    }
  };
  
  const handleCallback = async () => {
    try {
      await handleTidalCallback();
      setIsConnected(true);
    } catch (error) {
      console.error('OAuth callback error:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const disconnect = () => {
    localStorage.removeItem('tidal_access_token');
    localStorage.removeItem('tidal_refresh_token');
    setIsConnected(false);
  };
  
  const transferPlaylist = async (playlistId, customName) => {
    return await transferPlaylistToTidal(playlistId, customName);
  };
  
  return {
    isConnected,
    isAuthenticating,
    connect,
    disconnect,
    transferPlaylist
  };
};
```

## 🌐 Environment Variables

**Frontend (.env):**
```env
REACT_APP_RESOMIX_API_KEY=your_resomix_api_key_here
```

**Backend (.env):**
```env
TIDAL_CLIENT_ID=your_tidal_client_id_here
TIDAL_CLIENT_SECRET=your_tidal_client_secret_here
```

## 🚨 Important Notes

1. **Client secrets are never exposed** to the frontend
2. **State parameter validation** prevents CSRF attacks
3. **PKCE code verifier** must be stored temporarily during OAuth flow
4. **Error handling** should gracefully handle authentication failures
5. **Token storage** should be secure (consider httpOnly cookies for production)

## 📋 Migration Checklist

- [ ] Update frontend to use new server endpoints
- [ ] Remove client credentials from frontend environment
- [ ] Add server-side client credentials to backend environment
- [ ] Test OAuth flow end-to-end
- [ ] Verify playlist transfer still works
- [ ] Update deployment configurations

## 🆘 Troubleshooting

**Common Issues:**

1. **"Tidal authentication not properly configured"**
   - Ensure `TIDAL_CLIENT_ID` and `TIDAL_CLIENT_SECRET` are set in backend .env

2. **"Invalid OAuth state parameter"**
   - Check that state is being stored and validated correctly

3. **"Invalid authorization code or parameters"**
   - Verify redirect_uri matches exactly between authorization and token requests

4. **Network errors**
   - Check that API key is included in requests
   - Verify server is running and accessible

---

**This implementation provides a secure, production-ready Tidal OAuth integration while keeping sensitive credentials protected on the server side.** 