import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse } from "./types/api";

export interface MyTracksParams {
  page?: number;
  page_size?: number;
}

/**
 * List the logged-in user's own uploaded tracks.
 */
export const getMyTracks = async (params: MyTracksParams = {}) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.MY_TRACKS}/`, { params })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * View full metadata for one owned uploaded track.
 */
export const getMyTrack = async (uuid: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.MY_TRACKS}/${uuid}`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Soft delete one owned uploaded track.
 */
export const deleteMyTrack = async (uuid: string) => {
  try {
    return await axiosWrapper<ApiResponse>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.MY_TRACKS}/${uuid}`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
