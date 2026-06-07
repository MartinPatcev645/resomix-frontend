import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

export interface AdminUserSearchItem {
  id: number;
  uuid: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  is_email_verified: boolean | null;
  is_active?: boolean | null;
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
      authClient.get("/api/v1/admin/users", { params })
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
      authClient.post(`/api/v1/admin/users/${userUuid}/roles`, { role_name: roleName })
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
      authClient.delete(`/api/v1/admin/users/${userUuid}/roles/${roleName}`)
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
      authClient.get("/api/v1/admin/roles")
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
      authClient.get("/api/v1/admin/roles/permissions")
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
      authClient.post("/api/v1/admin/users", userData)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get a single user's details by UUID (Admin)
 */
export const getAdminUser = async (userUuid: string) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}${userUuid}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Update a user's profile by UUID (Admin)
 */
export const updateAdminUser = async (userUuid: string, userData: Record<string, any>) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.patch(`${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}${userUuid}`, userData)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Toggle a user's active/inactive status (Admin)
 */
export const toggleUserStatus = async (userUuid: string) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}${userUuid}/toggle-status`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get details of a specific system role by name (Admin)
 */
export const getRoleDetails = async (roleName: string) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_ROLE_DETAIL}${encodeURIComponent(roleName)}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Update the permissions assigned to a system role (Admin)
 */
export const updateRolePermissions = async (roleName: string, permissions: string[]) => {
  try {
    const response = await axiosWrapper<any>(
      authClient.put(
        `${API_CONFIG.ENDPOINTS.ADMIN_ROLE_PERMISSIONS_UPDATE}${encodeURIComponent(roleName)}/permissions`,
        { permissions }
      )
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
