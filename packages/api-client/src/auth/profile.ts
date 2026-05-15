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

// Delete account
export const deleteAccount = async (password: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete(API_CONFIG.ENDPOINTS.USER_ME, {
        data: { password } as DeleteAccountRequest,
      })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

