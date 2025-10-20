/**
 * Tidal Service (TypeScript)
 * Handles Tidal OAuth PKCE flow and playlist transfer functionality
 */

import { TIDAL_CONFIG, API_CONFIG } from "@resomix/api-client/config.js";

type TidalAuthSuccess = {
  success: true;
  access_token: string;
  expires_in: number;
};

type TidalAuthError = {
  success: false;
  error: string;
};

export type TidalAuthResult = TidalAuthSuccess | TidalAuthError;

export type TransferResponse<T = any> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

type TidalTokenResponse = {
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

/**
 * Initialize Tidal OAuth PKCE flow
 * Redirects user to Tidal authorization page
 */
export const initializeTidalAuth = async (id: string | null): Promise<void> => {
  try {
    // Generate code verifier and challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64encode(await sha256(codeVerifier));
    const state = encodeURI(id || generateRandomString(16));

    // Store code verifier and state for later use
    localStorage.setItem('tidal_code_verifier', codeVerifier);
    localStorage.setItem('tidal_auth_state', state);

    // Build authorization URL
    const authUrl = new URL(TIDAL_CONFIG.AUTH_URL);
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: TIDAL_CONFIG.CLIENT_ID,
      scope: TIDAL_CONFIG.SCOPE,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: TIDAL_CONFIG.REDIRECT_URI,
      state: state,
    };

    authUrl.search = new URLSearchParams(params).toString();

    // Redirect to Tidal authorization
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Error initializing Tidal auth:', error);
    throw new Error('Failed to initialize Tidal authentication');
  }
};

/**
 * Handle Tidal OAuth callback
 * Exchange authorization code for access token via backend
 */
export const handleTidalCallback = async (code: string, state: string): Promise<TidalAuthResult> => {
  try {
    // Verify state parameter
    const storedState = localStorage.getItem('tidal_auth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    const codeVerifier = localStorage.getItem('tidal_code_verifier');
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }

    // Exchange code for access token using backend helper endpoint
    // This avoids CORS and client secret exposure issues.
    const response = await fetch(getUrl(TIDAL_CONFIG.TIDAL_AUTH_TOKEN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: TIDAL_CONFIG.REDIRECT_URI,
        client_id: TIDAL_CONFIG.CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || 'Failed to exchange code for token');
    }

    const data = (await response.json()) as Partial<TidalTokenResponse>;

    if (data.access_token) {
      // Store tokens
      localStorage.setItem('tidal_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('tidal_refresh_token', data.refresh_token);
      }

      // Store expiry time
      const expiresIn = data.expires_in ?? 3600; // Default to 1 hour
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem('tidal_token_expiry', String(expiryTime));

      // Clean up temporary storage
      localStorage.removeItem('tidal_code_verifier');
      localStorage.removeItem('tidal_auth_state');

      return {
        success: true,
        access_token: data.access_token,
        expires_in: expiresIn,
      };
    } else {
      throw new Error('No access token in response');
    }
  } catch (error: any) {
    console.error('Error handling Tidal callback:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
};

/**
 * Check if user has valid Tidal access token
 */
export const checkTidalAuthentication = (): boolean => {
  const token = localStorage.getItem('tidal_access_token');
  const expiry = localStorage.getItem('tidal_token_expiry');

  if (!token || !expiry) {
    return false;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  const expiryTime = Number(expiry);
  const buffer = 5 * 60 * 1000; // 5 minutes

  return now < expiryTime - buffer;
};

/**
 * Get current Tidal access token
 */
export const getTidalAccessToken = (): string | null => {
  if (checkTidalAuthentication()) {
    return localStorage.getItem('tidal_access_token');
  }
  return null;
};

/**
 * Clear Tidal authentication data
 */
export const clearTidalAuth = (): void => {
  localStorage.removeItem('tidal_access_token');
  localStorage.removeItem('tidal_refresh_token');
  localStorage.removeItem('tidal_token_expiry');
  localStorage.removeItem('tidal_code_verifier');
  localStorage.removeItem('tidal_auth_state');
};

/**
 * Transfer ResomiX playlist to Tidal
 */
export const transferPlaylistToTidal = async (
  playlistId: string,
  customPlaylistName: string | null = null
): Promise<TransferResponse> => {
  try {
    const accessToken = getTidalAccessToken();

    if (!accessToken) {
      return {
        success: false,
        error: 'No valid Tidal access token. Please authenticate first.',
      };
    }

    const response = await fetch(getUrl(API_CONFIG.ENDPOINTS.TIDAL_TRANSFER), {
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
        error: 'Failed to transfer playlist to Tidal',
      };

      try {
        errorData = (await response.json()) as TransferResponse;
      } catch {
        // keep default errorData
      }

      // If token expired, clear auth data
      if (response.status === 401) {
        clearTidalAuth();
      }

      return errorData;
    }

    const result = (await response.json()) as TransferResponse;
    return result;
  } catch (error: any) {
    console.error('Error transferring playlist to Tidal:', error);
    return {
      success: false,
      error: error?.message || 'Failed to transfer playlist to Tidal',
    };
  }
};