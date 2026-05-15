import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { VerifyEmailResponse, SuccessResponse } from '../types/auth';

export const verifyEmail = async (token: string) => {
  try {
    const response = await axiosWrapper<VerifyEmailResponse>(
      authClient.get(`${API_CONFIG.ENDPOINTS.AUTH_VERIFY_EMAIL}?token=${token}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const resendVerification = async (email: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_RESEND_VERIFICATION, { email })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

