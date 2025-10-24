import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { Enable2FARequest, Disable2FARequest, SuccessResponse } from '../types/auth';

// Enable 2FA
export const enable2FA = async (method: '2fa_email' = '2fa_email') => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/users/me/2fa/enable', { method } as Enable2FARequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

// Disable 2FA
export const disable2FA = async (password: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/users/me/2fa/disable', { password } as Disable2FARequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

