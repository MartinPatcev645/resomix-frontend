import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { SuccessResponse } from '../types/auth';

export const logout = async (refreshToken: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post('/auth/logout', { refresh_token: refreshToken })
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const logoutAll = async (userId: number) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.post(`/auth/logout-all?user_id=${userId}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

