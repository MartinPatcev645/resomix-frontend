import axiosInstance, { axiosWrapper, handleApiError, getUrl } from "./utils";
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

/**
 * Fetch the signed HLS (.m3u8) playlist for a similarity playlist.
 * - playlistUuid: UUID of the playlist (without “.m3u8”).
 * Returns raw playlist text or the standard error object.
 */
export const getSimilarityPlaylistHls = async (playlistUuid: string) => {
  try {
    const endpoint = `${API_CONFIG.ENDPOINTS.PLAYLIST_SIMILARITY_HLS}${playlistUuid}.m3u8`;

    const data = await axiosWrapper<string>(
      axiosInstance.get(endpoint, {
        headers: { Accept: "application/vnd.apple.mpegurl" },
        responseType: "text",
      }),
    );
    return data;
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const getSimilarityPlaylistHlsUrl = (
  playlistUuid: string,
  extraParams: Record<string, unknown> = {},
): string => {
  // const endpoint = `${API_CONFIG.ENDPOINTS.PLAYLIST_SIMILARITY_HLS}${playlistUuid}.m3u8`;
  const endpoint = `/dummy/dummy-hls/${playlistUuid}.m3u8`;
  return getUrl(endpoint, extraParams);
};

