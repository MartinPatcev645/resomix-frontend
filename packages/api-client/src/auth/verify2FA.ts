import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TwoFactorVerifyRequest, LoginResponse } from '../types/auth';

export const verify2FA = async (data: TwoFactorVerifyRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse>(
      authClient.post('/auth/verify-2fa', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

