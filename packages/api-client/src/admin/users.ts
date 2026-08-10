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

/** Complimentary, time-boxed plan access granted by an admin. No money, no Stripe object. */
export interface AdminPlanGrant {
  plan_code: string | null;
  plan_name: string | null;
  reason: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  /** Rounded up, so something with hours left still reads as "1 day". */
  days_remaining: number;
}

/** The durations an admin may pick. A fixed set — mirrors GRANT_DURATIONS on the server. */
export const PLAN_GRANT_DURATIONS = [
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
] as const;

export const PLAN_GRANT_REASONS = [
  { value: "trial", label: "Trial" },
  { value: "goodwill", label: "Goodwill" },
  { value: "partner", label: "Partner" },
  { value: "support", label: "Support" },
  { value: "compensation", label: "Compensation" },
] as const;

/** Give a user a plan free of charge for a fixed period. */
export const grantUserPlan = async (
  userUuid: string,
  body: { plan_code?: string; duration: string; reason?: string; note?: string }
) => {
  try {
    return await axiosWrapper<{ success: boolean; data?: AdminPlanGrant; message?: string; error?: string }>(
      authClient.post(`/api/v1/admin/users/${userUuid}/plan-grant`, {
        plan_code: body.plan_code ?? "pro",
        duration: body.duration,
        reason: body.reason ?? "trial",
        note: body.note,
      })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** End a complimentary plan early. The record is kept, stamped as revoked. */
export const revokeUserPlanGrant = async (userUuid: string) => {
  try {
    return await axiosWrapper<{ success: boolean; message?: string; error?: string }>(
      authClient.delete(`/api/v1/admin/users/${userUuid}/plan-grant`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Cancel a user's paid subscription.
 *
 * NEVER refunds — money is returned only from the Stripe dashboard. Defaults to cancelling at the
 * end of the paid period, exactly like the customer doing it from the billing portal.
 */
export const cancelUserSubscription = async (userUuid: string, immediate = false) => {
  try {
    return await axiosWrapper<{ success: boolean; message?: string; error?: string }>(
      authClient.post(`/api/v1/admin/users/${userUuid}/cancel-subscription`, null, {
        params: { immediate },
      })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

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
    /** When the scrub ran. Null = still restorable; set = terminal, and reactivation is refused. */
    anonymized_at?: string | null;
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
  /** A complimentary plan an admin granted. NOT a subscription — nothing to manage in Stripe. */
  grant: AdminPlanGrant | null;
  /** Every past grant, newest first. "Has this account been comped before?" */
  grant_history: Array<{
    id: number;
    plan_name: string | null;
    reason: string;
    note: string | null;
    starts_at: string | null;
    ends_at: string | null;
    revoked_at: string | null;
  }>;
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

/* ------------------------------------------------------------------------- *
 * Account deletion
 *
 * Two steps, and the second is manual. A user's request deactivates the account and nothing more;
 * an admin runs the scrub later from the queue below. Nothing fires on a timer.
 * ------------------------------------------------------------------------- */

/** What a scrub would change, or did. Returned by both the dry run and the real thing. */
export interface ScrubManifest {
  user_id: number;
  user_uuid: string;
  email: string;
  dry_run: boolean;
  already_scrubbed: boolean;
  /** table -> rows deleted outright */
  deleted: Record<string, number>;
  /** table -> rows kept with their identifying columns cleared */
  scrubbed: Record<string, number>;
  /** table -> rows left completely untouched */
  kept: Record<string, number>;
  playlists_made_private: number;
  waitlist_entries: number;
  media_assets_queued: number;
  profile_picture: string | null;
  /** Tables or columns this database could not reach — those rows keep their personal data. */
  warnings: string[];
  deletion_requested_at: string | null;
  purge_due_at: string | null;
}

export interface PendingDeletion {
  uuid: string;
  email: string;
  name: string | null;
  deletion_requested_at: string | null;
  purge_due_at: string | null;
  /** Days since the request. The legal clock, computed server-side so screens cannot disagree. */
  waiting_days: number;
  /** Past two-thirds of the SLA — act now, while there is still time. */
  approaching: boolean;
  /** Past the Art. 12(3) month. Needs either the scrub or an extension notice. */
  overdue: boolean;
}

/**
 * Accounts that asked to be deleted and have not been actioned, oldest first.
 *
 * The only surface where the one-month obligation is visible: nothing scrubs automatically, and
 * the user is told "within 4 weeks" rather than a date, so an unwatched queue is a silent breach.
 */
export const getPendingDeletions = async () => {
  try {
    return await axiosWrapper<{
      success: boolean;
      data?: { items: PendingDeletion[]; total: number; sla_days: number; overdue: number };
      error?: string;
    }>(authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}pending-deletions`));
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Scrub an account, or preview what that would change.
 *
 * `dryRun` defaults to TRUE, matching the server. The irreversible call is the one you have to ask
 * for by name, in both places — an admin confirms against the manifest this returns, not against a
 * description of it that might have drifted from what the scrub does.
 */
export const scrubUser = async (userUuid: string, dryRun = true) => {
  try {
    return await axiosWrapper<{ success: boolean; data?: ScrubManifest; error?: string }>(
      authClient.delete(
        `${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}${userUuid}?dry_run=${dryRun}`
      )
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Tell a user their erasure request is running past a month.
 *
 * Art. 12(3) permits extending to three months only if the person is told inside the first one,
 * *with reasons* — so `reason` is written by the admin and the server rejects an empty one.
 */
export const notifyDeletionDelay = async (userUuid: string, reason: string) => {
  try {
    return await axiosWrapper<{ success: boolean; message?: string; error?: string }>(
      authClient.post(
        `${API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL}${userUuid}/deletion-delay-notice`,
        { reason }
      )
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
