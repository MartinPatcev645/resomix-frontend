import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface TrackProcessingStatus {
  transcode_status: string;
  embedding_status: string;
  peaks_status: string;
  segments_status: string;
  faiss_indexed: boolean;
  transcode_error: string | null;
  embedding_error: string | null;
  peaks_error: string | null;
  segments_error: string | null;
  transcode_completed_at: string | null;
  embedding_completed_at: string | null;
  peaks_completed_at: string | null;
  segments_completed_at: string | null;
  faiss_indexed_at: string | null;
  sftp_env: "live" | "test" | null;
  audio_filename: string | null;
}

export interface AdminTrack {
  id: number;
  uuid: string;
  title: string;
  display_artist: string;
  isrc: string | null;
  is_active: boolean;
  partner_id: number;
  /** null if no processing-status row exists yet */
  processing: TrackProcessingStatus | null;
}

/** Full single-track detail (Apple + in-house metadata) from GET /admin/tracks/{id}. */
export interface AdminTrackDetail extends AdminTrack {
  type: string | null;
  duration_seconds: number | null;
  bpm: number | null;
  musical_key: string | null;
  ingestion_source: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Enriched metadata (contributors / release / genre / label / master audio file)
  artists: string[];
  album: string | null;
  release: string | null;
  year: number | null;
  genre: string | null;
  label: string | null;
  file_size: number;
  audio_filename: string | null;
}

export interface TrackDetailResponse {
  status: string;
  track: AdminTrackDetail;
}

export interface ListTracksParams {
  /** Only tracks uploaded by this user (UUID). Used by the user detail page. */
  user_uuid?: string;
  partner_id: number;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  ingestion_source?: string;
  q?: string;
}

export interface ListTracksResponse {
  status: string;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  tracks: AdminTrack[];
}

export interface FaissEngineResult {
  success: boolean;
  data?: { index_size: number };
  error?: string;
}

export interface SetTrackLiveResponse {
  status: "success" | "partial" | "failed";
  track_id: number;
  is_active: boolean;
  faiss_indexed: boolean;
  index_results: {
    maest: FaissEngineResult;
    discogs: FaissEngineResult;
  };
}

export interface StopTrackResponse {
  status: "success" | "partial" | "failed";
  track_id: number;
  is_active: boolean;
  remove_result: { success: boolean; data?: { removed: number } };
}

export interface StopTracksBatchResponse {
  status: "success" | "partial";
  partner_id: number;
  stopped: number;
  remove_result: { success: boolean; data?: { removed: number; index_size: number } };
}

// ─── API Calls ─────────────────────────────────────────────

/**
 * List partner tracks with their current processing status.
 */
export const listAdminTracks = async (
  params: ListTracksParams,
): Promise<ListTracksResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_TRACKS, { params }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Full detail for a single track (Apple + in-house metadata + processing status).
 * Shared by the Tracks panel and the playlist tracks-table detail modals.
 */
export const getAdminTrackDetail = async (
  trackId: number,
): Promise<TrackDetailResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_TRACKS}/${trackId}`),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Activate a track and insert it into both FAISS engines (maest + discogs).
 * Embeddings must already exist on the media server before calling this.
 */
export const setTrackLive = async (
  trackId: number,
): Promise<SetTrackLiveResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(
        `${API_CONFIG.ENDPOINTS.ADMIN_TRACKS}/${trackId}/set-live`,
      ),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Deactivate a track and remove it from both FAISS engines.
 * @param trackId - The numeric ID of the track.
 * @param deleteEmbeddingFile - Also delete .npy embedding files from the media server.
 */
export const stopTrack = async (
  trackId: number,
  deleteEmbeddingFile = false,
): Promise<StopTrackResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(
        `${API_CONFIG.ENDPOINTS.ADMIN_TRACKS}/${trackId}/stop`,
        {},
        { params: { delete_embedding_file: deleteEmbeddingFile } },
      ),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Batch deactivate tracks and remove them from FAISS in one operation.
 * POST /api/v1/admin/tracks/stop-batch
 */
export const stopTracksBatch = async (
  partnerId: number,
  trackIds: number[],
): Promise<StopTracksBatchResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_TRACKS_STOP_BATCH, {
        partner_id: partnerId,
        track_ids: trackIds,
      }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
