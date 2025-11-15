import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TokenRefreshResponse } from '../types/auth';
import { API_CONFIG } from '../config';

export const refreshAccessToken = async () => {
  try {
    // Empty body - server reads refresh token from HttpOnly cookie
    // Explicitly ensure withCredentials is true to include cookies
    const response = await axiosWrapper<TokenRefreshResponse>(
      authClient.post('/auth/refresh', {}, {
        withCredentials: true, // Ensure cookies are included
        params: { api_key: API_CONFIG.API_KEY } // Include api_key for auth endpoints
      })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

