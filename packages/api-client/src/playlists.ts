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

/**
 * Owner-only custom playlist cover upload (multipart). The backend re-validates size/type + owner
 * and forwards the image to the media server, which enforces square/resolution with Pillow and
 * stores it by playlist uuid. On success the playlist's `has_custom_cover` flips to true.
 */
export const uploadPlaylistCover = async (playlistId: string, file: Blob | File) => {
  try {
    const formData = new FormData();
    // The frontend crops to a square JPEG (a Blob) before uploading; give it a filename so the
    // multipart part is well-formed (a bare Blob has no name).
    const filename = (file as File).name || "cover.jpg";
    formData.append("file", file, filename);
    const url = `${API_CONFIG.ENDPOINTS.PLAYLIST_COVER}/${encodeURIComponent(playlistId)}/cover`;
    const data = await axiosWrapper<ApiResponse>(
      authClient.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to upload cover.",
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

export interface PlaylistExportResult {
  filename: string;
  content: string;
  format: string;
  /** Tracks actually in the file. */
  track_count: number;
  /** Tracks in the playlist. */
  total_tracks: number;
  /** True when the plan's export limit trimmed the list — the copy should say so. */
  truncated: boolean;
}

/**
 * Ask the server to build the export file.
 *
 * The file used to be assembled in the browser, which meant the daily allowance could not be
 * counted and the track cap was whatever the client chose to apply. The server now formats it, so
 * a denial arrives here as a 402 with `code` = "login_required" | "plan_required" |
 * "export_limit_reached" and `quota` carrying the reset time.
 */
// Named `...File` rather than `exportPlaylist` — `admin/playlist.ts` already owns that name for the
// admin CSV dump, and both are re-exported from the package root.
export const exportPlaylistFile = async (
  playlistId: string,
  target = "txt",
  /** Ask for FEWER tracks than the plan allows. The server takes the minimum, so this can never
   *  widen an export — only narrow it (used by the demo build). */
  maxTracks?: number,
) => {
  try {
    const url = API_CONFIG.ENDPOINTS.PLAYLIST_EXPORT.replace("{id}", encodeURIComponent(playlistId));
    const data = await axiosWrapper<ApiResponse<PlaylistExportResult>>(
      authClient.post(url, maxTracks ? { target, max_tracks: maxTracks } : { target }),
    );

    if (data.success === true && data.data) return { success: true as const, data: data.data };
    return {
      success: false as const,
      error: data.error || "Failed to export playlist.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Mint (or fetch) this playlist's embed token — Pro-only, owner-only.
 *
 * Idempotent server-side: calling it again returns the SAME token, so re-opening the modal cannot
 * invalidate a snippet already pasted into a live page. Withdrawing an embed is an explicit
 * `revokeEmbedToken`.
 */
export const mintEmbedToken = async (playlistId: string) => {
  try {
    const url = API_CONFIG.ENDPOINTS.PLAYLIST_EMBED_TOKEN.replace("{id}", encodeURIComponent(playlistId));
    const data = await axiosWrapper<ApiResponse<{ token: string; playlist_uuid: string; is_public: boolean }>>(
      authClient.post(url),
    );
    if (data.success === true && data.data) return { success: true as const, data: data.data };
    return { success: false as const, error: data.error || "Couldn't create the embed." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Withdraw a playlist's embed. Snippets already pasted elsewhere stop rendering. */
export const revokeEmbedToken = async (playlistId: string) => {
  try {
    const url = API_CONFIG.ENDPOINTS.PLAYLIST_EMBED_TOKEN.replace("{id}", encodeURIComponent(playlistId));
    const data = await axiosWrapper<ApiResponse<{ revoked: boolean }>>(authClient.delete(url));
    if (data.success === true) return { success: true as const };
    return { success: false as const, error: data.error || "Couldn't withdraw the embed." };
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
