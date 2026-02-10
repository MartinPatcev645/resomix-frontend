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

export const logoutAll = async () => {
  try {
    // JWT is automatically sent via authClient's Authorization header
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/auth/logout-all', {})
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

