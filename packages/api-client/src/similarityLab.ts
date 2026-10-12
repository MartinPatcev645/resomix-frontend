import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import type { ApiResponse } from "./types/api";

/**
 * Similarity lab: live and experimental playlists side by side, for the staging lab page.
 *
 * Read only on the backend, nothing is saved. On staging the backend passes these calls through
 * to production's catalogue, so the page compares against real playlists. Everywhere else the
 * routes answer 404, which these functions report as an ordinary error.
 *
 * Plain `axiosInstance`, not `authClient`: the lab needs no user, and sending a token would only
 * make a lab call depend on the visitor's session.
 */

export interface LabExperiment {
  id: string;
  label: string;
  kind: "live" | "lab";
  description: string;
}

export interface LabTrack {
  id: string;
  rank: number;
  score: number;
  artist?: string;
  title?: string;
  label?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
  artwork_url?: string;
  preview_url?: string;
  deep_link_url?: string;
  /** Lab experiments only: the same song is also in today's live playlist. */
  in_live?: boolean;
}

export interface LabPlaylist {
  experiment: string;
  label: string;
  kind: string;
  tracks: LabTrack[];
  diagnostics: Record<string, number | string | null>;
  same_songs_as_live: number | null;
  error?: string;
}

export interface LabComparison {
  seed: LabTrack;
  top_sk: number;
  playlists: LabPlaylist[];
  took_ms: number;
}

export interface LabSeed {
  id: string;
  artist?: string;
  title?: string;
  duration?: number;
}

export interface LabCompareRequest {
  track_uuid: string;
  top_sk: number;
  experiments: string[];
}

export const getLabExperiments = async () => {
  try {
    return await axiosWrapper<ApiResponse<{ experiments: LabExperiment[] }>>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.SIMILARITY_LAB_EXPERIMENTS),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const searchLabSeeds = async (query: string) => {
  try {
    return await axiosWrapper<ApiResponse<{ tracks: LabSeed[] }>>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.SIMILARITY_LAB_SEEDS, { params: { query } }),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const compareLab = async (body: LabCompareRequest) => {
  try {
    return await axiosWrapper<ApiResponse<LabComparison>>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.SIMILARITY_LAB_COMPARE, body),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
