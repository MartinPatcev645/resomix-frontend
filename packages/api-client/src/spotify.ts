import { API_CONFIG, SPOTIFY_CONFIG } from "./config";

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

// Performs the raw token exchange request to Spotify (PKCE flow)
export const fetchSpotifyToken = (code: string, codeVerifier: string): Promise<Response> => {
  return fetch(SPOTIFY_CONFIG.TOKEN_URL, {
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
};

// Performs the raw transfer request to our backend for Spotify playlist creation
export const postSpotifyTransfer = (body: {
  playlist_id: string;
  access_token: string;
  playlist_name: string | null;
}): Promise<Response> => {
  return fetch(getUrl(SPOTIFY_CONFIG.SPOTIFY_TRANSFER), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
};


