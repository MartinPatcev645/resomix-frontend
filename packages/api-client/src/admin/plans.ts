import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export type PlanEntitlementValue = boolean | number | string;

/** Feature catalog entry (a limit/flag that plans assign values to). */
export interface AdminFeature {
  key: string;                 // e.g. "playlists_per_month"
  name: string;
  value_type: "int" | "bool" | "enum" | "csv" | string;
  window: string | null;      // e.g. "monthly" | null
  default_value: PlanEntitlementValue;
  description: string | null;
}

/** A plan with its fully-resolved entitlement values (per feature key). */
export interface AdminPlan {
  code: string;               // guest | free | basic | pro | max
  name: string;
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
  is_active: boolean;
  is_default: boolean;
  is_assignable: boolean;
  sort_order: number;
  entitlements_version: number;
  entitlements: Record<string, PlanEntitlementValue>;
}

/** A per-user entitlement override row. */
export interface AdminUserOverride {
  feature: string;
  value: PlanEntitlementValue;
  reason: string | null;
  expires_at: string | null;
}

/** A single user's resolved plan + entitlements (+ any per-user overrides). */
export interface AdminUserEffectivePlan {
  user_uuid: string;
  plan: AdminPlan;
  entitlements: Record<string, PlanEntitlementValue>;
  overrides: AdminUserOverride[];
}

export interface AdminPlansResponse {
  success: boolean;
  data?: AdminPlan[];
  error?: string;
}

export interface AdminPlanResponse {
  success: boolean;
  data?: AdminPlan;
  error?: string;
}

export interface AdminFeaturesResponse {
  success: boolean;
  data?: AdminFeature[];
  error?: string;
}

export interface AdminUserEffectivePlanResponse {
  success: boolean;
  data?: AdminUserEffectivePlan;
  error?: string;
}

export interface AdminEntitlementMetricsResponse {
  success: boolean;
  data?: Record<string, number>;
  error?: string;
}

/** Confirmation returned by a single entitlement edit (not the full plan). */
export interface SetEntitlementResult {
  plan: string;
  feature: string;
  value_type: string;
  value: PlanEntitlementValue;
  entitlements_version: number;
}

export interface SetEntitlementResponse {
  success: boolean;
  data?: SetEntitlementResult;
  error?: string;
}

export interface SimpleAdminResponse {
  success: boolean;
  error?: string;
}

// The controller wraps payloads in { success, data: { plans | features | metrics: … } } (or the
// object directly for single-item reads). axiosWrapper only unwraps the HTTP body once, so we
// extract the inner key here.
interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Reads ─────────────────────────────────────────────────

/** GET /admin/plans — all plans with their entitlement values. */
export const getAdminPlans = async (): Promise<AdminPlansResponse> => {
  try {
    const res = await axiosWrapper<Envelope<{ plans: AdminPlan[] }>>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_PLANS),
    );
    if (res.success && res.data?.plans) return { success: true, data: res.data.plans };
    return { success: false, error: res.error || "Failed to load plans.", data: [] };
  } catch (error) {
    return { ...handleApiError(error as Error), data: [] };
  }
};

/** GET /admin/features — the feature catalog (names, types, windows, defaults). */
export const getAdminFeatures = async (): Promise<AdminFeaturesResponse> => {
  try {
    const res = await axiosWrapper<Envelope<{ features: AdminFeature[] }>>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_FEATURES),
    );
    if (res.success && res.data?.features) return { success: true, data: res.data.features };
    return { success: false, error: res.error || "Failed to load features.", data: [] };
  } catch (error) {
    return { ...handleApiError(error as Error), data: [] };
  }
};

/** GET /admin/plans/{code} — one plan + entitlements. */
export const getAdminPlan = async (code: string): Promise<AdminPlanResponse> => {
  try {
    const res = await axiosWrapper<Envelope<AdminPlan>>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PLANS}/${encodeURIComponent(code)}`),
    );
    if (res.success && res.data) return { success: true, data: res.data };
    return { success: false, error: res.error || "Failed to load plan." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** GET /admin/users/{uuid}/effective-plan — support lookup for one user. */
export const getUserEffectivePlan = async (
  userUuid: string,
): Promise<AdminUserEffectivePlanResponse> => {
  try {
    const base = API_CONFIG.ENDPOINTS.ADMIN_USER_DETAIL.replace(/\/$/, "");
    const res = await axiosWrapper<Envelope<AdminUserEffectivePlan>>(
      authClient.get(`${base}/${encodeURIComponent(userUuid)}/effective-plan`),
    );
    if (res.success && res.data) return { success: true, data: res.data };
    return { success: false, error: res.error || "Failed to load user's plan." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** GET /admin/entitlements/metrics — gate/cache counters (in-process). */
export const getEntitlementMetrics = async (): Promise<AdminEntitlementMetricsResponse> => {
  try {
    const res = await axiosWrapper<Envelope<{ metrics: Record<string, number> }>>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_ENTITLEMENT_METRICS),
    );
    if (res.success && res.data?.metrics) return { success: true, data: res.data.metrics };
    return { success: false, error: res.error || "Failed to load metrics." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// ─── Writes (require the plans:manage permission) ──────────

/** PUT /admin/plans/{code}/entitlements/{feature_key} — set one plan's value for a feature.
 *  Returns a confirmation (not the whole plan) — apply the value optimistically client-side. */
export const setPlanEntitlement = async (
  code: string,
  featureKey: string,
  value: PlanEntitlementValue,
): Promise<SetEntitlementResponse> => {
  try {
    const url = `${API_CONFIG.ENDPOINTS.ADMIN_PLANS}/${encodeURIComponent(code)}/entitlements/${encodeURIComponent(featureKey)}`;
    const res = await axiosWrapper<SetEntitlementResponse>(authClient.put(url, { value }));
    if (res.success) return res;
    return { success: false, error: res.error || "Failed to save value." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** PATCH /admin/plans/{code} — update plan-level flags (name / active / default).
 *  Setting default clears it on other plans, so callers should refetch afterwards. */
export const updateAdminPlan = async (
  code: string,
  patch: { name?: string; is_active?: boolean; is_default?: boolean },
): Promise<SimpleAdminResponse> => {
  try {
    const res = await axiosWrapper<SimpleAdminResponse>(
      authClient.patch(`${API_CONFIG.ENDPOINTS.ADMIN_PLANS}/${encodeURIComponent(code)}`, patch),
    );
    if (res.success) return res;
    return { success: false, error: res.error || "Failed to update plan." };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
