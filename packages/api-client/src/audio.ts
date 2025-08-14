import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

export const getAudioUrl = async (trackId: string) => {
  try {
    const data = await axiosWrapper<any>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.AUDIO_PREVIEW, { params: { track_id: trackId } }),
    );
    return data;
  } catch (error) {
    return handleApiError(error as any);
  }
}; 