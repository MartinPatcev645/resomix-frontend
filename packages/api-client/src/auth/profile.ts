import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type {
  ProfileResponse,
  ProfileUpdateRequest,
  ChangePasswordRequest,
  SuccessResponse,
  DeleteAccountRequest,
} from '../types/auth';

// Get current user profile
export const getMyProfile = async () => {
  try {
    const response = await axiosWrapper<ProfileResponse>(
      authClient.get(API_CONFIG.ENDPOINTS.USER_ME)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Update user profile
export const updateProfile = async (updates: ProfileUpdateRequest) => {
  try {
    const response = await axiosWrapper<ProfileResponse>(
      authClient.patch(API_CONFIG.ENDPOINTS.USER_ME, updates)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Change password
export const changePassword = async (data: ChangePasswordRequest) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.USER_CHANGE_PASSWORD, data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Connect (link) a Google account to the CURRENT user — never switches/creates accounts, unlike
// Google login. Rejected (409) if that Google identity is already linked to another account.
export const linkGoogleProvider = async (credential: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.USER_ME}/providers/google`, { credential })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Disconnect a linked social provider (e.g. Google) from the current account.
export const unlinkProvider = async (provider: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.USER_ME}/providers/${encodeURIComponent(provider)}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Request account deletion.
 *
 * SOFT: the account is deactivated immediately and permanently deleted after a 30-day grace
 * period, during which it can still be restored. The response carries `purge_due_at`.
 *
 * `password` is optional because a social-login-only account has none — the server requires it
 * only where one exists. Sending `{password: undefined}` omits the key entirely, which is what the
 * server expects, rather than sending an explicit null.
 */
export const deleteAccount = async (password?: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete(API_CONFIG.ENDPOINTS.USER_ME, {
        data: (password ? { password } : {}) as DeleteAccountRequest,
      })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

