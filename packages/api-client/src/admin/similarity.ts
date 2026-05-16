import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";

/**
 * Rebuild the similarity search index (Admin).
 * This is an expensive operation and should be used sparingly.
 */
export const rebuildSimilarityIndex = async () => {
  try {
    const response = await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_SIMILARITY_REBUILD)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
