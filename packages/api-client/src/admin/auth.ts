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

/**
 * Validate the current admin session (admin JWT + `admin:access`). A 401 triggers the shared
 * client's refresh against the admin cookie; a definitive failure means "log in again".
 * Returns the current admin user on success.
 */
export const adminMe = async () => {
  try {
    const response = await axiosWrapper<{ success: boolean; data?: { user: any } }>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_AUTH_ME)
    );
    return { success: true as const, data: response?.data?.user };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Clear the admin refresh cookie server-side. */
export const adminLogout = async () => {
  try {
    await axiosWrapper<any>(authClient.post(API_CONFIG.ENDPOINTS.ADMIN_AUTH_LOGOUT));
    return { success: true as const };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
