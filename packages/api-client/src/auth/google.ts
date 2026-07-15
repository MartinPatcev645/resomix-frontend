import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { LoginResponse } from '../types/auth';

/**
 * "Continue with Google" — sends the Google Identity Services ID token (credential) to the backend,
 * which verifies it and returns our own session (access token in the body, refresh token set in the
 * HttpOnly cookie), exactly like a password login.
 */
export const loginWithGoogle = async (credential: string) => {
  try {
    const response = await axiosWrapper<LoginResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.AUTH_GOOGLE, { credential })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
