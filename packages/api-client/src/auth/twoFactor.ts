import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { Enable2FARequest, Enable2FAResponse, Disable2FARequest, Disable2FAResponse } from '../types/auth';

// Enable 2FA
export const enable2FA = async (method: 'email' | 'app' = 'email') => {
  try {
    const response = await axiosWrapper<Enable2FAResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.USER_ENABLE_2FA, { method } as Enable2FARequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Disable 2FA
export const disable2FA = async (password: string) => {
  try {
    const response = await axiosWrapper<Disable2FAResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.USER_DISABLE_2FA, { password } as Disable2FARequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

