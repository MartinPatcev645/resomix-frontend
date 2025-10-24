import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { VerifyEmailResponse, SuccessResponse } from '../types/auth';

export const verifyEmail = async (token: string) => {
  try {
    const response = await axiosWrapper<VerifyEmailResponse>(
      authClient.get(`/auth/verify-email?token=${token}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const resendVerification = async (email: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/auth/resend-verification', { email })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

