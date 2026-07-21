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
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const getPlaylistSimilarityHls = async (playlistId: string) => {
  try {
    const data = await axiosWrapper<string>(
      authClient.get(`${API_CONFIG.ENDPOINTS.PLAYLIST_SIMILARITY_HLS}${playlistId}.m3u8`),
    );
    return data;
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
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export interface UserPlaylistListParams {
  page?: number;
  page_size?: number;
  /** Free-text search over playlist name / uuid. */
  search?: string;
  play_time?: string;
  /** Minimum number of tracks (>=): 10, 20, 50, 100. */
  num_tracks?: number;
  start_date?: string;
  end_date?: string;
  is_public?: boolean;
  own_favorites?: boolean;
  all_favorites?: boolean;
}

export const getAllPlaylists = async (params: UserPlaylistListParams = {}) => {
  try {
    const data = await axiosWrapper<ApiResponse>(
      authClient.get(API_CONFIG.ENDPOINTS.PLAYLISTS_GET_ALL, { params }),
    );
    return data;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const getPlaybackSession = async (playlistId: string) => {
  try {
    const url = API_CONFIG.ENDPOINTS.PLAYLIST_PLAY_SESSION.replace("{id}", playlistId);
    const data = await axiosWrapper<{ success: boolean; playback_url?: string; error?: string }>(
      authClient.post(url),
    );
    return data;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Engagement Methods
export const addFavorite = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.PLAYLIST_FAVORITE_ADD}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const removeFavorite = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.PLAYLIST_FAVORITE_REMOVE}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const followPlaylist = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.PLAYLIST_FOLLOW}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const unfollowPlaylist = async (playlistId: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.PLAYLIST_UNFOLLOW}${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const deleteMyPlaylist = async (playlistId: string) => {
  try {
    return await axiosWrapper<{ success: boolean; message: string }>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.PLAYLIST_DELETE}/${playlistId}`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Rating Methods (moved to ratings.ts)
export { rateTrack, ratePlaylist } from "./ratings";
