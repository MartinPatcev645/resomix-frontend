import axiosInstance, { axiosWrapper, handleApiError, validateAudioFile } from "./utils";
import { API_CONFIG } from "./config";

/**
 * Get track similarity based on uploaded audio file
 * @param file Audio file
 * @param TOPSK Number of similar tracks to return (default 20)
 * @param progressCallback Optional callback for upload progress (0-100)
 */
export const getSimilarTracks = async (
  file: File,
  TOPSK = 20,
  progressCallback?: (progress: number) => void,
) => {
  try {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const formData = new FormData();
    formData.append("file", file);

    const data = await axiosWrapper<any>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.SIMILARITY, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { top_sk: TOPSK },
        onUploadProgress: (evt) => {
          if (evt.total && progressCallback) {
            const percent = (evt.loaded / evt.total) * 100;
            progressCallback(percent);
          }
        },
        timeout: 900_000, // 15 minutes, matches legacy
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to get similar tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Get track similarity for a selected track ID
 */
export const getSimilarityForSelectedTrack = async (
  trackId: string,
  TOPSK = 20,
) => {
  try {
    const payload = { track_id: trackId, top_sk: TOPSK };

    const data = await axiosWrapper<any>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.SELECTION_SIMILARITY, payload),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to get similar tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as any);
  }
}; 