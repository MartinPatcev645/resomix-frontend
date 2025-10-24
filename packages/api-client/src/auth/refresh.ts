import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TokenRefreshResponse } from '../types/auth';

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    const response = await axiosWrapper<TokenRefreshResponse>(
      authClient.post('/auth/refresh', { refresh_token: refreshToken })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

