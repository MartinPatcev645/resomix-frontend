/**
 * Apple Service (TypeScript)
 * Handles MusicKit authorization flow and playlist transfer functionality
 *
 * Requirements:
 * - Backend endpoint that returns Apple Music developer token:
 *   Response JSON: { token: string, expires_at: number } // expires_at is ms since epoch
 * - MusicKit JS SDK will be loaded dynamically in the redirect component
 */

import { API_CONFIG, APPLE_CONFIG } from "@resomix/api-client";

export type AppleMusicAuthSuccess = {
  success: true;
  music_user_token: string;
  expires_in?: number; // developer token TTL if you want to inform UI
};

export type AppleMusicAuthError = {
  success: false;
  error: string;
};

export type AppleMusicAuthResult = AppleMusicAuthSuccess | AppleMusicAuthError;

export type TransferResponse<T = any> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

// Generate random string for state
const generateRandomString = (length: number): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).reduce((acc, x) => acc + possible[x % possible.length], "");
};

/**
 * Initialize Apple Music "auth" flow
 * Opens our internal redirect page which performs MusicKit authorization
 */
export const initializeAppleMusicAuth = async (id: string | null): Promise<void> => {
  try {
    const state = encodeURI(id || generateRandomString(16));

    localStorage.setItem("apple_auth_state", state);
    localStorage.setItem("apple_auth_started_at", String(Date.now()));

    // Open our own redirect route which will:
    // - load MusicKit SDK
    // - fetch developer token from backend
    // - call MusicKit.authorize()
    // - post result to opener and close itself
    const redirectUrl = new URL(APPLE_CONFIG.REDIRECT_URI);
    redirectUrl.searchParams.set("state", state);

    window.open(redirectUrl.toString(), "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Error initializing Apple Music auth:", error);
    throw new Error("Failed to initialize Apple Music authentication");
  }
};

/**
 * Check if user has valid Apple Music user token and a non-expired developer token
 * Note: Apple Music user token can be long-lived; developer token has JWT TTL (e.g., 6 months).
 */
export const checkAppleMusicAuthentication = (): boolean => {
  const userToken = localStorage.getItem("apple_music_user_token");
  const devToken = localStorage.getItem("apple_developer_token");
  const devExpiry = localStorage.getItem("apple_developer_token_expiry");

  if (!userToken || !devToken || !devExpiry) {
    return false;
  }

  const now = Date.now();
  const expiryTime = Number(devExpiry);
  const buffer = 5 * 60 * 1000; // 5 minutes safety buffer

  return now < expiryTime - buffer;
};

/**
 * Get current Apple Music user token
 */
export const getAppleMusicUserToken = (): string | null => {
  if (!checkAppleMusicAuthentication()) {
    return null;
  }
  return localStorage.getItem("apple_music_user_token");
};

/**
 * Get current Apple Music developer token (if present and not expired)
 */
export const getAppleDeveloperToken = (): string | null => {
  if (!checkAppleMusicAuthentication()) {
    return null;
  }
  return localStorage.getItem("apple_developer_token");
};

/**
 * Clear Apple Music authentication data
 */
export const clearAppleAuth = (): void => {
  localStorage.removeItem("apple_music_user_token");
  localStorage.removeItem("apple_developer_token");
  localStorage.removeItem("apple_developer_token_expiry");
  localStorage.removeItem("apple_auth_state");
};

/**
 * Transfer ResomiX playlist to Apple Music
 * Requires: a valid Music User Token, and (typically) the developer token on backend side
 */
export const transferPlaylistToAppleMusic = async (
  playlistId: string,
  customPlaylistName: string | null = null
): Promise<TransferResponse> => {
  try {
    const userToken = getAppleMusicUserToken();
    const developerToken = getAppleDeveloperToken();

    if (!userToken || !developerToken) {
      return {
        success: false,
        error: "No valid Apple Music tokens. Please authenticate first.",
      };
    }

    // Helper to construct URLs with API key
    const getUrl = (
      endpoint: string,
      queryParams: Record<string, string | number | null | undefined> = {}
    ): string => {
      const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);

      // Add API key
      url.searchParams.append("api_key", API_CONFIG.API_KEY);

      // Add any additional query params
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });

      return url.toString();
    };

    const response = await fetch(getUrl(APPLE_CONFIG.APPLE_TRANSFER), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Send both tokens; server may only need user token if it can create dev token itself
      body: JSON.stringify({
        playlist_id: playlistId,
        music_user_token: userToken,
        developer_token: developerToken,
        playlist_name: customPlaylistName,
      }),
    });

    if (!response.ok) {
      let errorData: TransferResponse = {
        success: false,
        error: "Failed to transfer playlist to Apple Music",
      };

      try {
        errorData = (await response.json()) as TransferResponse;
      } catch {
        // keep default errorData
      }

      if (response.status === 401) {
        clearAppleAuth();
      }

      return errorData;
    }

    const result = (await response.json()) as TransferResponse;
    return result;
  } catch (error: any) {
    console.error("Error transferring playlist to Apple Music:", error);
    return {
      success: false,
      error: error?.message || "Failed to transfer playlist to Apple Music",
    };
  }
};

const getGuardKey = (state: string) => {
  return `oauth_handled_apple_${state}`;
};

export const checkGuardKey = (state: string) => {
  return sessionStorage.getItem(getGuardKey(state));
};

export const setGuardKey = (state: string) => {
  sessionStorage.setItem(getGuardKey(state), "1");
};

export const clearGuardKey = (state: string) => {
  sessionStorage.removeItem(getGuardKey(state));
};