import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { LoginRequest, LoginResponse, TwoFactorRequiredResponse } from '../types/auth';

export const login = async (data: LoginRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse | TwoFactorRequiredResponse>(
      authClient.post('/auth/login', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

