import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

export interface AdminUserPlanRef {
  code: string;
  name: string;
}

export interface AdminUserSearchItem {
  id: number;
  uuid: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  is_email_verified: boolean | null;
  is_active?: boolean | null;
  created_at: string | null;
  /** Effective plan — the one they actually get, not just the subscription's. */
  plan?: AdminUserPlanRef | null;
  /** Last authenticated request. Distinct from last LOGIN; see the overview endpoint. */
  last_seen_at?: string | null;
  deactivated_at?: string | null;
  purge_due_at?: string | null;
}

/** Per-user admin overview. One request; see `AdminUserOverviewService` for why. */
export interface AdminUserOverview {
  identity: {
    id: number;
    uuid: string;
    /** The tracks endpoint requires a partner, so the "view their tracks" link needs it. */
    partner_id: number | null;
    email: string;
    username: string | null;
    name: string | null;
    profile_picture: string | null;
    roles: string[];
    is_active: boolean;
    is_email_verified: boolean;
    is_two_factor_enabled: boolean;
    language: string | null;
    timezone: string | null;
    created_at: string | null;
  };
  activity: {
    /** Last authenticated request (throttled write). */
    last_seen_at: string | null;
    /** Last sign-in — a different question: a long-lived session reports when it STARTED. */
    last_login: string | null;
    last_ip: string | null;
    last_user_agent: string | null;
  };
  lifecycle: {
    deactivated_at: string | null;
    deactivation_reason: string | null;
    deletion_requested_at: string | null;
    purge_due_at: string | null;
  };
  /** What they actually get. Disagrees with `subscription` on suspension or mid-cancellation. */
  effective_plan: AdminUserPlanRef | null;
  subscription: {
    plan_code: string | null;
    plan_name: string | null;
    status: string;
    currency: string | null;
    current_period_end: string | null;
    is_founding: boolean;
    founding_lock_ends_at: string | null;
    access_suspended_at: string | null;
    access_suspended_reason: string | null;
    cancellation: { pending: boolean; ended: boolean; effective_at: string | null; reason: string | null } | null;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
  } | null;
  /** -1 means the figure could not be read, which is not the same as 0. */
  counts: Record<string, number>;
  support: {
    latest_contact: { id: number; subject: string | null; excerpt: string | null; status: string; submitted_at: string | null } | null;
    latest_feedback: { id: number; category: string | null; excerpt: string | null; satisfaction: number | null; status: string; submitted_at: string | null } | null;
  };
  invoices: Array<{
    stripe_invoice_id: string;
    amount_paid_cents: number;
    currency: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    hosted_invoice_url: string | null;
    created_at: string | null;
  }>;
}

/** Everything about one user, for the admin detail page. */
export const getAdminUserOverview = async (userUuid: string) => {
  try {
    return await axiosWrapper<{ success: boolean; data?: AdminUserOverview; error?: string }>(
      authClient.get(`/api/v1/admin/users/${userUuid}/overview`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

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
