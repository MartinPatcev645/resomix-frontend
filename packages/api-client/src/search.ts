import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

export const searchTracks = async (query: string, mode: 'auto' | 'artist' | 'title' = 'auto') => {
  try {
    const data = await axiosWrapper<any>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.SEARCH, { params: { query, mode: mode.toLowerCase() } }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to search tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};
