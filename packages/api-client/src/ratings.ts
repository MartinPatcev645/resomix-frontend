import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse } from "./types/api";

// ─── Track Ratings ───────────────────────────────────────────────────────────

/**
 * Submit a rating for a track.
 */
export const rateTrack = async (
  trackId: string,
  rating: number,
  playlistId: string | null = null,
) => {
  try {
    const payload: Record<string, unknown> = { track_id: trackId, rating };
    if (playlistId) payload.playlist_id = playlistId;

    return await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.TRACK_RATING, payload),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get a specific track rating.
 */
export const getTrackRating = async (trackId: string, playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.RATING_TRACKS_DETAIL}${trackId}/playlist/${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete a track rating.
 */
export const deleteTrackRating = async (trackId: string, playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.RATING_TRACKS_DETAIL}${trackId}/playlist/${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get aggregated statistics for a track.
 */
export const getTrackRatingStats = async (trackId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.RATING_TRACK_STATS}${trackId}/stats`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// ─── Playlist Ratings ────────────────────────────────────────────────────────

/**
 * Submit a rating for a playlist.
 */
export const ratePlaylist = async (
  playlistId: string,
  rating: number,
  message: string | null = null,
) => {
  try {
    const payload: Record<string, unknown> = { playlist_id: playlistId, rating };
    if (message?.trim()) payload.message = message.trim();

    return await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.PLAYLIST_RATING, payload),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get user rating for a playlist.
 */
export const getPlaylistRating = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.RATING_PLAYLISTS_DETAIL}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete a playlist rating.
 */
export const deletePlaylistRating = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.RATING_PLAYLISTS_DETAIL}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** The current user's ratings for a whole playlist (per-track thumbs + playlist stars). */
export interface MyPlaylistRatings {
  playlist_id: string;
  /** map of track UUID → thumb rating (1 = up, 0 = down) */
  track_ratings: Record<string, number>;
  playlist_rating: { rating: number; message: string | null } | null;
}

/**
 * Load the current user's ratings for an entire playlist in one call — used to hydrate the
 * playlist screen so returning users see their thumbs already set. Guests get an empty set.
 */
export const getMyPlaylistRatings = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse<MyPlaylistRatings>>(
      authClient.get(`${API_CONFIG.ENDPOINTS.RATING_PLAYLISTS_DETAIL}${playlistId}/mine`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get aggregated statistics for a playlist.
 */
export const getPlaylistRatingStats = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.RATING_PLAYLIST_STATS}${playlistId}/stats`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
