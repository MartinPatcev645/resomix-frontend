import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TokenRefreshResponse } from '../types/auth';

export const refreshAccessToken = async () => {
  try {
    // Empty body - server reads refresh token from HttpOnly cookie
    const response = await axiosWrapper<TokenRefreshResponse>(
      authClient.post('/auth/refresh', {})
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

