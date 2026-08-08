import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";


// ─── Types ─────────────────────────────────────────────────

export interface PlaylistItem {
  id: number;
  uuid: string;
  user_id: string | null;
  /** Creator's username for registered-user playlists; null for guests. */
  creator_username?: string | null;
  /** Hashed guest visitor id for anonymously-created playlists; null for registered users. */
  guest_visitor_id?: string | null;
  name: string;
  is_public: boolean;
  type: 'custom' | 'similarity' | 'waiting_segments';
  seed_track_id: number | null;
  created_at: string; // ISO datetime string
  fork_id?: string;
}

/** Who created a playlist (from the admin detail endpoint). */
export interface PlaylistCreator {
  type: 'user' | 'guest' | 'unknown';
  // Registered-user fields
  id?: number | null;
  uuid?: string | null;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  is_email_verified?: boolean | null;
  created_at?: string | null;
  // Guest fields
  visitor_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  seen_at?: string | null;
}

export interface PlaylistListParams {
  /** Only playlists owned by this user (UUID). Set by the user detail page link. */
  user_uuid?: string;
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'id' | 'uuid' | 'name';
  visibility?: 'public' | 'private' | 'all';
  type?: 'custom' | 'similarity' | 'waiting_segments' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface PlaylistListResponse {
  success: boolean;
  data: PlaylistItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface PlaylistDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PlaylistBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface PlaylistExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

export interface PlaylistVisibilityResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PlaylistBatchVisibilityResponse {
  success: boolean;
  updated_count: number;
  message?: string;
  error?: string;
}

export interface PlaylistDetailsResponse {
  success: boolean;
  data?: {
    playlist: {
      id: number;
      uuid: string;
      user_id: string | null;
      guest_visitor_id?: string | null;
      name: string;
      is_public: boolean;
      type: 'custom' | 'similarity' | 'waiting_segments';
      seed_track_id: number | null;
      created_at: string;
      track_count: number;
      fork_id?: string;
    };
    creator?: PlaylistCreator;
    seed_track: {
      id: number;
      uuid: string;
      title: string;
      artists: string[];
      duration_sec: number;
      bpm: number | null;
      musical_key: string | null;
      genre: string | null;
      label: string | null;
      year: number | null;
    } | null;
    tracks: Array<{
      position: number;
      score: number | null;
      track: {
        id: number;
        uuid: string;
        title: string;
        artists: string[];
        duration_sec: number;
        file_size: number;
        type: string;
        genre: string | null;
        label: string | null;
        album: string | null;
        year: number | null;
        bpm: number | null;
        musical_key: string | null;
        file_path: string;
        preview_path: string | null;
        created_at: string;
      };
    }>;
  };
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of playlists with filtering and search
 */
export const getPlaylistList = async (params: PlaylistListParams = {}) => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    // Add optional filters
    if (params.search) queryParams.search = params.search;
    if (params.search_column) queryParams.search_column = params.search_column;
    if (params.visibility && params.visibility !== 'all') {
      queryParams.is_public = params.visibility === 'public' ? '1' : '0';
    }
    if (params.type && params.type !== 'all') queryParams.type = params.type;
    // This function WHITELISTS rather than spreading, so a new field is silently dropped
    // unless it is forwarded here as well as added to PlaylistListParams.
    if (params.user_uuid) queryParams.user_uuid = params.user_uuid;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_order) queryParams.sort_order = params.sort_order;

    const data = await axiosWrapper<PlaylistListResponse>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch playlists.",
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  }
};

/**
 * Delete a single playlist by ID
 */
export const deletePlaylist = async (playlistId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_DELETE}${playlistId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Playlist deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to delete playlist.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete multiple playlists in a batch
 */
export const batchDeletePlaylist = async (playlistIds: number[]) => {
  try {
    const data = await axiosWrapper<PlaylistBatchDeleteResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_BATCH_DELETE, {
        ids: playlistIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as ApiResponse).error || "Failed to delete playlists.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      deleted_count: 0,
    };
  }
};

/**
 * Export playlist data (returns download URL to CSV file)
 */
export const exportPlaylist = async (
  format: 'csv',
  params: PlaylistListParams = {}
) => {
  try {
    const requestBody: Record<string, any> = {
      format,
    };

    // Add optional filters to the request body
    if (params.page) requestBody.page = params.page;
    if (params.page_size) requestBody.page_size = params.page_size;
    if (params.search) requestBody.search = params.search;
    if (params.search_column) requestBody.search_column = params.search_column;
    if (params.visibility && params.visibility !== 'all') {
      requestBody.is_public = params.visibility === 'public' ? '1' : '0';
    }
    if (params.type && params.type !== 'all') requestBody.type = params.type;
    if (params.date_from) requestBody.date_from = params.date_from;
    if (params.date_to) requestBody.date_to = params.date_to;
    if (params.sort_by) requestBody.sort_by = params.sort_by;
    if (params.sort_order) requestBody.sort_order = params.sort_order;

    const data = await axiosWrapper<PlaylistExportResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to export playlists.",
      download_url: "",
      filename: "",
      expires_at: "",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      download_url: "",
      filename: "",
      expires_at: "",
    };
  }
};

/**
 * Get detailed information about a specific playlist including all tracks
 * @param playlistUuid - The UUID of the playlist (e.g., "44e77239-b716-4c82-9cd6-7175a152a750")
 */
export const getPlaylistDetails = async (playlistUuid: string) => {
  try {
    const data = await axiosWrapper<PlaylistDetailsResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_DETAILS}${playlistUuid}`)
    );

    if (data.success && data.data) return data;

    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch playlist details.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// ─── Playlist ratings (admin) ──────────────────────────────────────────────────

export interface AdminPlaylistRatingEntry {
  user_id: number | null;
  visitor_id: string | null;
  email: string | null;
  name: string | null;
  is_creator: boolean;
  rating: number | null;   // 0–3 stars
  message: string | null;
  rated_at: string | null;
}

export interface AdminTrackRatingRow {
  track_id: string;        // track UUID
  title: string | null;
  artist: string | null;
  position: number | null;
  plus: number;
  minus: number;
  total: number;
  creator_rating: number | null;  // 1 up, 0 down, null = creator didn't rate
}

export interface AdminPlaylistRatingsDetail {
  playlist: {
    uuid: string;
    name: string;
    type: string;
    num_tracks: number;
    created_at: string | null;
    creator: { user_id: number; email: string | null; name: string | null } | null;
  };
  playlist_ratings: AdminPlaylistRatingEntry[];
  playlist_rating_summary: {
    count: number;
    average: number | null;
    distribution: Record<string, number>;
  };
  tracks: AdminTrackRatingRow[];
}

/**
 * Admin: full ratings breakdown for a playlist — playlist-level ratings (creator highlighted)
 * plus per-track thumb aggregates and the creator's own thumb.
 */
export const getPlaylistRatings = async (playlistUuid: string) => {
  try {
    return await axiosWrapper<ApiResponse<AdminPlaylistRatingsDetail>>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_DETAILS}${playlistUuid}/ratings`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Change visibility of a single playlist by ID (Admin)
 * @param playlistId - The numeric ID of the playlist
 * @param isPublic - Whether the playlist should be public (true) or private (false)
 */
export const adminChangePlaylistVisibility = async (playlistId: number, isPublic: boolean) => {
  try {
    const data = await axiosWrapper<PlaylistVisibilityResponse>(
      authClient.patch(`${API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_VISIBILITY}${playlistId}/visibility`, {
        is_public: isPublic,
      })
    );

    if (data.success) {
      return {
        success: true,
        message: data.message || "Playlist visibility updated successfully",
      };
    }
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to change playlist visibility.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Change visibility of multiple playlists in a batch (Admin)
 * @param playlistIds - Array of playlist numeric IDs
 * @param isPublic - Whether the playlists should be public (true) or private (false)
 */
export const adminBatchChangePlaylistVisibility = async (playlistIds: number[], isPublic: boolean) => {
  try {
    const data = await axiosWrapper<PlaylistBatchVisibilityResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_BATCH_VISIBILITY, {
        ids: playlistIds,
        is_public: isPublic,
      })
    );

    if (data.success) {
      return {
        success: true,
        updated_count: data.updated_count,
        message: data.message || `Successfully updated ${data.updated_count} playlist${data.updated_count === 1 ? '' : 's'}`,
      };
    }
    
    return {
      success: false,
      updated_count: 0,
      error: (data as ApiResponse).error || "Failed to change playlist visibility.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      updated_count: 0,
    };
  }
};
