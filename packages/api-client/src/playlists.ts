import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse } from "./types/api";


export const renamePlaylist = async (playlistId: string, newName: string) => {
  try {
    const payload = { playlist_id: playlistId, new_name: newName };
    const data = await axiosWrapper<ApiResponse>(
      authClient.put(API_CONFIG.ENDPOINTS.PLAYLIST_RENAME, payload),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to rename playlist.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const changePlaylistVisibility = async (playlistId: string, isPublic = true) => {
  try {
    const payload = { playlist_id: playlistId, is_public: isPublic };
    const data = await axiosWrapper<ApiResponse>(
      authClient.put(API_CONFIG.ENDPOINTS.PLAYLIST_VISIBILITY, payload),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to change playlist visibility.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const getPlaylistSimilarity = async (playlistId: string) => {
  try {
    const data = await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.PLAYLIST_SIMILARITY}${playlistId}`),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to get playlist similarity data.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const rateTrack = async (
  trackId: string,
  rating: number,
  playlistId: string | null = null,
) => {
  try {
    const payload: Record<string, unknown> = { track_id: trackId, rating };
    if (playlistId !== null && playlistId !== undefined) {
      payload.playlist_id = playlistId;
    }

    const data = await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.TRACK_RATING, payload),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to rate track.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const ratePlaylist = async (
  playlistId: string,
  rating: number,
  message: string | null = null,
) => {
  try {
    const payload: Record<string, unknown> = { playlist_id: playlistId, rating };
    if (message && message.trim()) {
      payload.message = message.trim();
    }

    const data = await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.PLAYLIST_RATING, payload),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to rate playlist.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const forkPlaylist = async (playlistId: string) => {
  try {
    const data = await axiosWrapper<ApiResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.PLAYLIST_FORK}${playlistId}`),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to fork playlist.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
