import axiosInstance, { axiosWrapper, handleApiError, validateAudioFile } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";

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

    // Pre-emptively refresh token if expired by calling /me
    // This prevents token refresh from happening during the large file upload
    try {
      const { getMyProfile } = await import("./auth");
      await getMyProfile();
    } catch (e) {
      // Ignore errors - if token refresh fails, the upload request will handle it
      console.warn("Pre-upload token check failed:", e);
    }

    // Use authClient to include Authorization header if user is logged in
    const data = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.SIMILARITY, formData, {
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

    // Use authClient instead of axiosInstance to include credentials and Authorization header
    const data = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.SELECTION_SIMILARITY, payload),
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
 * Polls the /segment_status/ endpoint until segmentation is complete or timeout.
 * Returns true when segmentation_completed === true, false on timeout or fatal error.
 * 
 * COMMENTED OUT - Segmentation polling no longer needed
 */
// export const waitForSegmentation = async (
//   playlistUuid: string,
//   timeoutMs = 300_000, // 5 minutes
//   pollIntervalMs = 4_000,
// ) => {
//   const deadline = Date.now() + timeoutMs;

//   while (Date.now() < deadline) {
//     try {
//       const res = await axiosInstance.get<{ segmentation_completed: boolean }>(
//         `${API_CONFIG.ENDPOINTS.SEGMENT_STATUS}${playlistUuid}`,
//       );

//       if (res.data?.segmentation_completed) {
//         return true; // ✅ ready
//       }
//       // Not ready → sleep and retry
//       await new Promise((r) => setTimeout(r, pollIntervalMs));
//     } catch (err: any) {
//       // 404 means playlist vanished – abort early
//       if (err?.response?.status === 404) {
//         console.error("Playlist not found");
//         return false;
//       }
//       // Log and retry on transient errors
//       console.warn("Segment status polling error", err);
//       await new Promise((r) => setTimeout(r, pollIntervalMs));
//     }
//   }

//   return false;
// };
