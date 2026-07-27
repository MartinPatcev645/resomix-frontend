import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { AdminLoginRequest, LoginResponse } from "../types/auth";

export interface AdminVerify2faRequest {
  email: string;
  password: string;
  code: string;
}

/**
 * Admin login — STEP 1. Verifies email + password for an admin, then emails a 2FA code.
 * Returns `{ data: { requires_2fa: true } }` on success — NO tokens yet (complete step 2).
 * Admin login is always two-factor; this cannot be disabled.
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
 * Admin login — STEP 2. Verifies email + password + the emailed code together, then returns
 * the admin JWT (the 30-min refresh token is set as an HttpOnly cookie).
 */
export const adminVerify2fa = async (data: AdminVerify2faRequest) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_AUTH_VERIFY_2FA, data)
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
