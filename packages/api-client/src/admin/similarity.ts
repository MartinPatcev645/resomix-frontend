import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";

/**
 * Rebuild the similarity search index (Admin).
 * This is an expensive operation and should be used sparingly.
 */
export const rebuildSimilarityIndex = async (partnerId: number) => {
  try {
    const response = await axiosWrapper<ApiResponse>(
      authClient.post(
        API_CONFIG.ENDPOINTS.ADMIN_SIMILARITY_REBUILD,
        {},
        { params: { partner_id: partnerId } }
      )
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
