import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { SuccessResponse } from '../types/auth';

export const logout = async () => {
  try {
    // Empty body - server reads refresh token from HttpOnly cookie
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT, {})
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const logoutAll = async () => {
  try {
    // JWT is automatically sent via authClient's Authorization header
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT_ALL, {})
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

