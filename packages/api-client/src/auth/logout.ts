import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { SuccessResponse } from '../types/auth';

export const logout = async () => {
  try {
    // Empty body - server reads refresh token from HttpOnly cookie
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/auth/logout', {})
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const logoutAll = async (userId: number) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/auth/logout-all', { user_id: userId })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

