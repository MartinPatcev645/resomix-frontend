import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { RegisterRequest, RegisterResponse } from '../types/auth';

export const register = async (data: RegisterRequest) => {
  try {
    const response = await axiosWrapper<RegisterResponse>(
      authClient.post('/auth/register', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

