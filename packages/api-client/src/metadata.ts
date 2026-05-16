import { axiosWrapper, handleApiError, validateAudioFile } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse } from "./types/api";

/**
 * Extract ID3/Metadata tags from an audio file.
 */
export const extractTrackMetadata = async (file: File) => {
  try {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const formData = new FormData();
    formData.append("file", file);

    return await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.METADATA_EXTRACT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
