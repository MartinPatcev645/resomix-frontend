/**
 * Spotify Service (TypeScript)
 * Handles Spotify OAuth PKCE flow and playlist transfer functionality
 */

import { API_CONFIG, SPOTIFY_CONFIG } from "@resomix/api-client";

type SpotifyAuthSuccess = {
  success: true;
  access_token: string;
  expires_in: number;
};

type SpotifyAuthError = {
  success: false;
  error: string;
};

export type SpotifyAuthResult = SpotifyAuthSuccess | SpotifyAuthError;

export type TransferResponse<T = any> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type?: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
};

// Generate random string for code verifier and state
const generateRandomString = (length: number): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).reduce((acc, x) => acc + possible[x % possible.length], '');
};

// Generate SHA256 hash
const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

// Base64 encode (URL-safe)
const base64encode = (input: ArrayBuffer): string => {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

/**
 * Initialize Spotify OAuth PKCE flow
 * Redirects user to Spotify authorization page
 */
export const initializeSpotifyAuth = async (id: string | null): Promise<void> => {
  try {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64encode(await sha256(codeVerifier));
    const state = encodeURI(id || generateRandomString(16));

    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);
    localStorage.setItem('spotify_auth_started_at', String(Date.now()));

    const authUrl = new URL(SPOTIFY_CONFIG.AUTH_URL);
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: SPOTIFY_CONFIG.CLIENT_ID,
      scope: SPOTIFY_CONFIG.SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
      state,
    };
    authUrl.search = new URLSearchParams(params).toString();

    window.open(authUrl.toString(), '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Error initializing Spotify auth:', error);
    throw new Error('Failed to initialize Spotify authentication');
  }
};

/**
 * Handle Spotify OAuth callback
 * Exchange authorization code for access token
 */
export const handleSpotifyCallback = async (code: string, state: string): Promise<SpotifyAuthResult> => {
  try {
      // Verify state parameter
    const storedState = localStorage.getItem('spotify_auth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }

      // Exchange code for access token
    const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = (await response.json()) as Partial<SpotifyTokenResponse>;

    if (data.access_token) {
        // Store tokens
      localStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }

        // Store expiry time
      const expiresIn = data.expires_in ?? 3600; // Default to 1 hour
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem('spotify_token_expiry', String(expiryTime));

        // Clean up temporary storage
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_auth_state');

      return {
        success: true,
        access_token: data.access_token,
        expires_in: expiresIn,
      };
    } else {
      throw new Error('No access token in response');
    }
  } catch (error: any) {
    console.error('Error handling Spotify callback:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
};

/**
 * Check if user has valid Spotify access token
 */
export const checkSpotifyAuthentication = (): boolean => {
  const token = localStorage.getItem('spotify_access_token');
  const expiry = localStorage.getItem('spotify_token_expiry');

  if (!token || !expiry) {
    return false;
  }

    // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  const expiryTime = Number(expiry);
  const buffer = 5 * 60 * 1000;//  5 minutes

  return now < expiryTime - buffer;
};

/**
 * Get current Spotify access token
 */
export const getSpotifyAccessToken = (): string | null => {
  if (checkSpotifyAuthentication()) {
    return localStorage.getItem('spotify_access_token');
  }
  return null;
};

/**
 * Clear Spotify authentication data
 */
export const clearSpotifyAuth = (): void => {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
};

/**
 * Transfer ResomiX playlist to Spotify
 */
export const transferPlaylistToSpotify = async (
  playlistId: string,
  customPlaylistName: string | null = null
): Promise<TransferResponse> => {
  try {
    const accessToken = getSpotifyAccessToken();

    if (!accessToken) {
      return {
        success: false,
        error: 'No valid Spotify access token. Please authenticate first.',
      };
    }

      // Helper to construct URLs with API key
    const getUrl = (endpoint: string, queryParams: Record<string, string | number | null | undefined> = {}): string => {
      const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);

        // Add API key
      url.searchParams.append('api_key', API_CONFIG.API_KEY);

        // Add any additional query params
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });

      return url.toString();
    };

    const response = await fetch(getUrl(SPOTIFY_CONFIG.SPOTIFY_TRANSFER), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playlist_id: playlistId,
        access_token: accessToken,
        playlist_name: customPlaylistName,
      }),
    });

    if (!response.ok) {
      let errorData: TransferResponse = {
        success: false,
        error: 'Failed to transfer playlist to Spotify',
      };

      try {
        errorData = (await response.json()) as TransferResponse;
      } catch {
          // keep default errorData
      }

        // If token expired, clear auth data
      if (response.status === 401) {
        clearSpotifyAuth();
      }

      return errorData;
    }

    return (await response.json()) as TransferResponse;
  } catch (error: any) {
    console.error('Error transferring playlist to Spotify:', error);
    return {
      success: false,
      error: error?.message || 'Failed to transfer playlist to Spotify',
    };
  }
};

const getGuardKey = (state: string)=>{
  return `oauth_handled_spotify_${state}`
}

export const checkGuardKey = (state: string)=>{
    return sessionStorage.getItem(getGuardKey(state))
}

export const setGuardKey = (state: string)=>{
  sessionStorage.setItem(getGuardKey(state), '1');
}

export const clearGuardKey = (state: string)=>{
  sessionStorage.removeItem(getGuardKey(state));
}
