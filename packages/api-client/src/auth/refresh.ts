import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TokenRefreshResponse } from '../types/auth';
import { API_CONFIG } from '../config';

export const refreshAccessToken = async () => {
  try {
    // Empty body - server reads refresh token from HttpOnly cookie
    // Explicitly ensure withCredentials is true to include cookies
    const response = await axiosWrapper<TokenRefreshResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_REFRESH, {}, {
        withCredentials: true, // Ensure cookies are included (server reads the refresh token from an HttpOnly cookie)
      })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

