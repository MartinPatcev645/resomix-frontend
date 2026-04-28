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

/**
 * DEPRECATED: The static similarity HLS playlist generator.
 * Use `getPlaylistPlaybackSession` instead to retrieve an Edge Authorized token URL.
 */
export const getSimilarityPlaylistHlsUrl = (
  playlistUuid: string,
  extraParams: Record<string, unknown> = {},
): string => {
  const endpoint = `${API_CONFIG.ENDPOINTS.PLAYLIST_SIMILARITY_HLS}${playlistUuid}.m3u8`;
  return getUrl(endpoint, extraParams);
};

export interface PlaybackSessionResponse {
  playback_url: string;
}

/**
 * Pre-flights a playlist playback session with the backend.
 * Returns the Edge Authorized playback URL (which includes the JWT token).
 */
export const getPlaylistPlaybackSession = async (
  playlistUuid: string
): Promise<PlaybackSessionResponse> => {
  try {
    const endpoint = API_CONFIG.ENDPOINTS.PLAYLIST_PLAY_SESSION.replace("{id}", playlistUuid);
    const { data } = await axiosInstance.post<PlaybackSessionResponse>(endpoint);
    return data;
  } catch (error) {
    throw error;
  }
};

