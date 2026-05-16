import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

export interface AdminUserSearchItem {
  id: number;
  uuid: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  is_email_verified: boolean | null;
  created_at: string | null;
}

export interface AdminUserSearchResponse {
  success: boolean;
  data?: AdminUserSearchItem[];
  error?: string;
}

/**
 * List/Search all users (Admin)
 */
export const listAdminUsers = async (params: { q?: string; limit?: number; page?: number; page_size?: number } = {}) => {
  try {
    const response = await axiosWrapper<AdminUserSearchResponse>(
      axiosInstance.get("/api/v1/admin/users", { params })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Assign a role to a user
 */
export const assignRole = async (userUuid: string, roleName: string) => {
  try {
    const response = await axiosWrapper<any>(
      axiosInstance.post(`/api/v1/admin/users/${userUuid}/roles`, { role_name: roleName })
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Remove a role from a user
 */
export const removeRole = async (userUuid: string, roleName: string) => {
  try {
    const response = await axiosWrapper<any>(
      axiosInstance.delete(`/api/v1/admin/users/${userUuid}/roles/${roleName}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * List all system roles
 */
export const listSystemRoles = async () => {
  try {
    const response = await axiosWrapper<any>(
      axiosInstance.get("/api/v1/admin/roles")
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * List all system permissions
 */
export const listSystemPermissions = async () => {
  try {
    const response = await axiosWrapper<any>(
      axiosInstance.get("/api/v1/admin/roles/permissions")
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Create a new user (Admin)
 */
export const createAdminUser = async (userData: any) => {
  try {
    const response = await axiosWrapper<any>(
      axiosInstance.post("/api/v1/admin/users", userData)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};


