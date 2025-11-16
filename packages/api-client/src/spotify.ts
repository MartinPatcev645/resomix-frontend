import { SPOTIFY_CONFIG } from "./config";
import { axiosWrapper, handleApiError } from "./utils";
import authClient from "./authClient";

export type TransferResponse<T = any> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  details?: unknown;
  status?: number;
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
export const postSpotifyTransfer = async (body: {
  playlist_id: string;
  access_token: string;
  playlist_name: string | null;
}): Promise<TransferResponse> => {
  try {
    const data = await axiosWrapper<TransferResponse>(
      authClient.post(SPOTIFY_CONFIG.SPOTIFY_TRANSFER, body)
    );
    return data;
  } catch (error: any) {
    return handleApiError(error as any);
  }
};


