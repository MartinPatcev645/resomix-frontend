import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { PasswordResetRequest, PasswordResetConfirmRequest, SuccessResponse } from '../types/auth';

export const requestPasswordReset = async (email: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_PASSWORD_RESET, { email } as PasswordResetRequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const confirmPasswordReset = async (token: string, newPassword: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_PASSWORD_RESET_CONFIRM, {
        token,
        new_password: newPassword,
      } as PasswordResetConfirmRequest)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

