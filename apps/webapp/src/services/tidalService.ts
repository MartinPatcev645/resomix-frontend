/**
 * Tidal Integration Service (TypeScript)
 * Handles OAuth authentication and playlist transfer to Tidal
 * Uses server-side authentication for enhanced security
 */

import { API_CONFIG } from "@resomix/api-client/config.js"

// Expected shape of API_CONFIG
type Endpoints = {
  TIDAL_AUTH_AUTHORIZE: string;
  TIDAL_AUTH_TOKEN: string;
  TIDAL_TRANSFER: string;
};

interface ApiConfig {
  BASE_URL: string;
  API_KEY: string;
  ENDPOINTS: Endpoints;
}

// Cast imported config to the expected shape (adjust if your actual types differ)
const CFG = API_CONFIG as unknown as ApiConfig;

// Generic API response types
type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Token exchange response
type TokenData = {
  access_token: string;
  refresh_token?: string;
};

// Authorization response
type AuthInitData = {
  state: string;
  authorization_url: string;
};

// Transfer response (server-defined; keep flexible)
type TransferResponse = { success: boolean; error?: string } & Record<string, unknown>;

// PKCE helper functions
const generateRandomString = (length: number): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return globalThis.crypto.subtle.digest('SHA-256', data);
};

const base64urlEncode = (input: ArrayBuffer | Uint8Array): string => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
 * Generate PKCE code verifier and challenge
 */
const generatePKCEPair = async (): Promise<{ codeVerifier: string; codeChallenge: string }> => {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64urlEncode(await sha256(codeVerifier));
  return { codeVerifier, codeChallenge };
};

/**
 * Get stored Tidal access token
 */
export const getTidalAccessToken = (): string | null => {
  return localStorage.getItem('tidal_access_token');
};

/**
 * Get stored Tidal refresh token
 */
export const getTidalRefreshToken = (): string | null => {
  return localStorage.getItem('tidal_refresh_token');
};

/**
 * Check if user is authenticated with Tidal
 */
export const checkTidalAuthentication = (): boolean => {
  const accessToken = getTidalAccessToken();
  return !!accessToken;
};

/**
 * Clear Tidal authentication data
 */
export const clearTidalAuth = (): void => {
  localStorage.removeItem('tidal_access_token');
  localStorage.removeItem('tidal_refresh_token');
  localStorage.removeItem('tidal_code_verifier');
  localStorage.removeItem('tidal_oauth_state');
};

/**
 * Helper to construct URLs with API key
 */
const getUrl = (
  endpoint: string,
  queryParams: Record<string, string | number | boolean | null | undefined> = {}
): string => {
  const url = new URL(`${CFG.BASE_URL}${endpoint}`);

  // Add API key
  url.searchParams.append('api_key', CFG.API_KEY);

  // Add any additional query params
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
};

/**
 * Initialize Tidal OAuth PKCE authentication via server
 */
export const initializeTidalAuth = async (): Promise<void> => {
  try {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await generatePKCEPair();
    const redirectUri = `${window.location.origin}/test`;

    // Store code verifier for later use
    localStorage.setItem('tidal_code_verifier', codeVerifier);

    console.log('🔄 Tidal Auth Debug:', {
      redirectUri,
      codeChallenge: codeChallenge?.substring(0, 20) + '...',
      codeVerifier: codeVerifier?.substring(0, 20) + '...',
      endpoint: getUrl(CFG.ENDPOINTS.TIDAL_AUTH_AUTHORIZE),
    });

    // Get authorization URL from server
    const response = await fetch(getUrl(CFG.ENDPOINTS.TIDAL_AUTH_AUTHORIZE), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Partial<ApiError>;
      throw new Error(`Server error: ${errorData.error || response.statusText}`);
    }

    const result = (await response.json()) as ApiResponse<AuthInitData>;

    if (result.success) {
      // Store state for validation
      localStorage.setItem('tidal_oauth_state', result.data.state);

      // Log the response and next steps instead of redirecting
      console.log('Tidal authorization API response:', result);
      console.log(
        'Next step: Direct the user to the following URL to authorize:',
        result.data.authorization_url
      );
      // window.location.href = result.data.authorization_url;
    } else {
      throw new Error(result.error || 'Failed to get authorization URL');
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Error initializing Tidal auth:', err);
    throw new Error(`Failed to initialize Tidal authentication: ${err.message}`);
  }
};

/**
 * Handle Tidal OAuth callback and exchange code for access token via server
 */
export const handleTidalCallback = async (
  code: string,
  state: string
): Promise<{ success: boolean; access_token?: string; refresh_token?: string; error?: string }> => {
  try {
    // Add persistent debugging
    const debugInfo = {
      timestamp: new Date().toISOString(),
      step: 'callback_start',
      code: code?.substring(0, 20) + '...',
      state: state?.substring(0, 20) + '...',
    };
    localStorage.setItem('tidal_debug_callback', JSON.stringify(debugInfo));
    console.log('🔄 Tidal Callback Start:', debugInfo);

    // Verify state parameter
    const storedState = localStorage.getItem('tidal_oauth_state');
    if (state !== storedState) {
      const errorMsg = 'Invalid state parameter';
      localStorage.setItem(
        'tidal_debug_callback',
        JSON.stringify({
          ...debugInfo,
          step: 'state_validation_failed',
          error: errorMsg,
          storedState: storedState?.substring(0, 20) + '...',
          receivedState: state?.substring(0, 20) + '...',
        })
      );
      throw new Error(errorMsg);
    }

    // Get stored code verifier
    const codeVerifier = localStorage.getItem('tidal_code_verifier');
    if (!codeVerifier) {
      const errorMsg = 'Code verifier not found';
      localStorage.setItem(
        'tidal_debug_callback',
        JSON.stringify({
          ...debugInfo,
          step: 'code_verifier_missing',
          error: errorMsg,
        })
      );
      throw new Error(errorMsg);
    }

    const redirectUri = `${window.location.origin}/test`;

    localStorage.setItem(
      'tidal_debug_callback',
      JSON.stringify({
        ...debugInfo,
        step: 'token_exchange_start',
        redirectUri,
        codeVerifier: codeVerifier?.substring(0, 20) + '...',
        endpoint: getUrl(CFG.ENDPOINTS.TIDAL_AUTH_TOKEN),
      })
    );

    console.log('🔄 Tidal Token Exchange Debug:', {
      code: code?.substring(0, 20) + '...',
      state: state?.substring(0, 20) + '...',
      redirectUri,
      codeVerifier: codeVerifier?.substring(0, 20) + '...',
      endpoint: getUrl(CFG.ENDPOINTS.TIDAL_AUTH_TOKEN),
    });

    // Exchange code for tokens using server endpoint
    const response = await fetch(getUrl(CFG.ENDPOINTS.TIDAL_AUTH_TOKEN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    console.log('🔄 Tidal Token Exchange Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    localStorage.setItem(
      'tidal_debug_callback',
      JSON.stringify({
        ...debugInfo,
        step: 'token_exchange_response',
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Partial<ApiError>;
      const errorMsg = `Token exchange failed: ${errorData.error || response.statusText}`;

      localStorage.setItem(
        'tidal_debug_callback',
        JSON.stringify({
          ...debugInfo,
          step: 'token_exchange_failed',
          error: errorMsg,
          errorData,
          status: response.status,
        })
      );

      throw new Error(errorMsg);
    }

    const result = (await response.json()) as ApiResponse<TokenData>;

    localStorage.setItem(
      'tidal_debug_callback',
      JSON.stringify({
        ...debugInfo,
        step: 'token_exchange_success',
        hasAccessToken: !!(result as ApiSuccess<TokenData>).data?.access_token,
        hasRefreshToken: !!(result as ApiSuccess<TokenData>).data?.refresh_token,
      })
    );

    if (result.success) {
      // Store tokens
      localStorage.setItem('tidal_access_token', result.data.access_token);

      if (result.data.refresh_token) {
        localStorage.setItem('tidal_refresh_token', result.data.refresh_token);
      }

      // Clean up temporary storage
      localStorage.removeItem('tidal_code_verifier');
      localStorage.removeItem('tidal_oauth_state');

      localStorage.setItem(
        'tidal_debug_callback',
        JSON.stringify({
          ...debugInfo,
          step: 'callback_success_complete',
        })
      );

      return {
        success: true,
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
      };
    } else {
      const errorMsg = result.error || 'Failed to exchange code for token';
      localStorage.setItem(
        'tidal_debug_callback',
        JSON.stringify({
          ...debugInfo,
          step: 'callback_result_failed',
          error: errorMsg,
          result,
        })
      );
      throw new Error(errorMsg);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Failed to complete Tidal authentication');
    console.error('Error handling Tidal callback:', err);

    localStorage.setItem(
      'tidal_debug_callback',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        step: 'callback_error',
        error: err.message,
        stack: err.stack,
      })
    );

    // Clean up on error
    localStorage.removeItem('tidal_code_verifier');
    localStorage.removeItem('tidal_oauth_state');

    return {
      success: false,
      error: err.message || 'Failed to complete Tidal authentication',
    };
  }
};

/**
 * Refresh Tidal access token using refresh token via server
 * Note: This would require a server endpoint for token refresh
 */
export const refreshTidalAccessToken = async (): Promise<void> => {
  try {
    const refreshToken = getTidalRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // This would need a server endpoint for token refresh
    // For now, we'll clear auth data and require re-authentication
    console.warn('Token refresh not implemented - requiring re-authentication');
    clearTidalAuth();
    throw new Error('Token expired - please re-authenticate');
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error refreshing Tidal token');
    console.error('Error refreshing Tidal token:', err);

    // Clear auth data on refresh failure
    clearTidalAuth();

    throw err;
  }
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

    const response = await fetch(getUrl(CFG.ENDPOINTS.TIDAL_TRANSFER), {
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
      const errorData = (await response.json().catch(() => ({
        success: false,
        error: 'Failed to transfer playlist to Tidal',
      }))) as TransferResponse;

      // If token expired, clear auth data
      if (response.status === 401) {
        clearTidalAuth();
      }

      return errorData;
    }

    const result = (await response.json()) as TransferResponse;
    return result;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Failed to transfer playlist to Tidal');
    console.error('Error transferring playlist to Tidal:', err);
    return {
      success: false,
      error: err.message || 'Failed to transfer playlist to Tidal',
    };
  }
};

/**
 * Debug helper - Call this in browser console to see callback debug info
 * Usage: window.getTidalDebugInfo()
 */
export const getTidalDebugInfo = (): Record<string, unknown> | null => {
  const debugInfo = localStorage.getItem('tidal_debug_callback');
  if (debugInfo) {
    const parsed = JSON.parse(debugInfo) as Record<string, unknown>;
    console.log('🔍 Tidal Debug Info:', parsed);
    return parsed;
  } else {
    console.log('🔍 No Tidal debug info found');
    return null;
  }
};

// Make debug function available globally for easy access
declare global {
  interface Window {
    getTidalDebugInfo: typeof getTidalDebugInfo;
  }
}

if (typeof window !== 'undefined') {
  window.getTidalDebugInfo = getTidalDebugInfo;
}