import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface TrackProcessingStatus {
  embedding_status: string;
  peaks_status: string;
  segments_status: string;
  faiss_indexed: boolean;
  sftp_env: "live" | "test" | null;
  embedding_error: string | null;
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

export interface ListTracksParams {
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
