import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { LoginRequest, LoginResponse } from "../types/auth";

/**
 * Administrative login to obtain an Admin JWT.
 * Requires an email and password for a user with the 'admin' role.
 */
export const adminLogin = async (data: LoginRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_AUTH_LOGIN, data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
