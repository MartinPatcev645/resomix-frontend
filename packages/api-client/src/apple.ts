/**
 * Apple Music API client
 * ======================
 * Connection (link/status/disconnect) + playlist transfer. All calls go through `authClient` so the
 * user's JWT is attached automatically (these endpoints require auth). The Music-User-Token is
 * stored server-side after connect, so transfers don't send it — the backend uses the saved one.
 */
import authClient from "./authClient";
import { axiosWrapper, handleApiError } from "./utils";
import { APPLE_CONFIG } from "./config";

export interface AppleConnectionStatus {
  connected: boolean;
  storefront?: string | null;
  connected_at?: string | null;
}

export interface AppleTransferResult {
  created_playlist_id?: string;
  created_playlist_name?: string;
  storefront?: string;
  total_tracks?: number;
  matched?: number;
  tracks_added?: number;
  unmatched?: number;
  unmatched_examples?: { title: string; artist: string }[];
}

/** Standard envelope: `{success:true, data}` on OK, `{success:false, error, status}` on failure. */
export type AppleEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  reason?: string | null;
  status?: number;
};

/** Whether the current user has a saved Apple Music connection. */
export const getAppleConnection = async (): Promise<AppleEnvelope<AppleConnectionStatus>> => {
  try {
    return await axiosWrapper<AppleEnvelope<AppleConnectionStatus>>(
      authClient.get(APPLE_CONFIG.APPLE_CONNECTION)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Persist the user's Apple Music user token (verified + encrypted server-side). */
export const saveAppleConnection = async (
  musicUserToken: string
): Promise<AppleEnvelope<AppleConnectionStatus>> => {
  try {
    return await axiosWrapper<AppleEnvelope<AppleConnectionStatus>>(
      authClient.post(APPLE_CONFIG.APPLE_CONNECTION, { music_user_token: musicUserToken })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Remove the user's saved Apple Music connection. */
export const deleteAppleConnection = async (): Promise<AppleEnvelope<{ connected: boolean }>> => {
  try {
    return await axiosWrapper<AppleEnvelope<{ connected: boolean }>>(
      authClient.delete(APPLE_CONFIG.APPLE_CONNECTION)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Transfer a playlist to the user's Apple Music library (uses their saved connection). */
export const transferPlaylistToApple = async (
  playlistId: string,
  playlistName?: string | null
): Promise<AppleEnvelope<AppleTransferResult>> => {
  try {
    return await axiosWrapper<AppleEnvelope<AppleTransferResult>>(
      authClient.post(APPLE_CONFIG.APPLE_TRANSFER, {
        playlist_id: playlistId,
        playlist_name: playlistName ?? null,
      })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
