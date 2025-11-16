import authClient from './authClient';
import { axiosWrapper, handleApiError } from './utils';

export type SpotifyClientIdResponse = {
  success: boolean;
  client_id?: string;
  error?: string;
};

// GET /spotify/app-client-id — Auth: Required (JWT)
export const getSpotifyAppClientId = async () => {
  try {
    const response = await axiosWrapper<SpotifyClientIdResponse>(
      authClient.get('/spotify/app-client-id')
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};


