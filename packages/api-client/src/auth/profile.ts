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
      authClient.get('/users/me')
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

// Update user profile
export const updateProfile = async (updates: ProfileUpdateRequest) => {
  try {
    const response = await axiosWrapper<ProfileResponse>(
      authClient.patch('/users/me', updates)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

// Change password
export const changePassword = async (data: ChangePasswordRequest) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/users/me/change-password', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

// Delete account
export const deleteAccount = async (password: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete('/users/me', {
        data: { password } as DeleteAccountRequest,
      })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

