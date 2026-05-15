import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TwoFactorVerifyRequest, LoginResponse } from '../types/auth';

export const verify2FA = async (data: TwoFactorVerifyRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_VERIFY_2FA, data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
