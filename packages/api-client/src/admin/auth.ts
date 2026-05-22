import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { AdminLoginRequest, LoginResponse } from "../types/auth";

/**
 * Administrative login to obtain an Admin JWT.
 * Requires an email and password for a user with the 'admin' role.
 */
export const adminLogin = async (data: AdminLoginRequest) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_AUTH_LOGIN, data)
    );
    return {
      success: true as const,
      data: response,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
