/**
 * Consumer entitlements client (Phase 8.2)
 * ========================================
 *
 * Single source the frontend uses to drive entitlement-aware UI: dropdown greying, feature
 * show/hide, and login/upgrade CTAs. Uses `authClient` so a logged-in user's JWT rides along
 * (server returns their plan); guests get the guest plan resolved from the device signal.
 */

import authClient from "./authClient";
import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

/** Canonical feature keys (mirror of the backend `FeatureKey` registry). */
export const FEATURE_KEYS = {
  SEARCH_PLAYLISTS_PER_MONTH: "search_playlists_per_month",
  MAX_TRACKS_PER_PLAYLIST: "max_tracks_per_playlist",
  DROPDOWN_MAX_TRACKS: "dropdown_max_tracks",
  CAN_EXPORT: "can_export",
  EXPORT_SCOPE: "export_scope",
  EXPORT_TRACK_LIMIT: "export_track_limit",
  EXPORT_TARGETS: "export_targets",
  CAN_RENAME: "can_rename",
  CAN_FAVORITE: "can_favorite",
  CAN_RATE_TRACKS: "can_rate_tracks",
  UPLOADS_PER_MONTH: "uploads_per_month",
  ANALYSIS_FEATURE_COUNT: "analysis_feature_count",
  CAN_SIMILARITY_UPLOAD: "can_similarity_upload",
  DEFAULT_PLAYLIST_VISIBILITY: "default_playlist_visibility",
  SIGNUP_BONUS_PLAYLISTS: "signup_bonus_playlists",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export type EntitlementValue = number | boolean | string;

export interface EntitlementPlan {
  code: string;
  name: string;
  is_default: boolean;
}

/**
 * Plan ceilings, flattened for display.
 *
 * `null` means UNLIMITED — the server maps its `-1` sentinel to null so nothing here can render as
 * "3/-1". `0` is a real limit and means denied, so it must never be treated as falsy-unlimited.
 */
export interface EntitlementLimits {
  searches_per_day: number | null;
  uploads_per_month: number | null;
  /** Tracks UNLOCKED in a result. */
  top_sk_max: number | null;
  /** Tracks SELECTABLE in the depth dropdown — larger than top_sk_max on free. */
  dropdown_max_tracks: number | null;
  library_playlists_max: number | null;
  exports_per_day: number | null;
  export_track_limit: number | null;
}

/**
 * Consumption in the current period.
 *
 * `null` means NOT KNOWN — either the feature is unlimited (unlimited features are never counted,
 * so no counter exists) or the counter could not be read. It never means zero; rendering it as 0
 * would tell a user they had used nothing.
 */
export interface EntitlementUsage {
  searches_used_today: number | null;
  uploads_used_month: number | null;
  exports_used_today: number | null;
  library_playlists_used: number | null;
}

/**
 * When each allowance returns — absolute ISO-8601 with an offset, so it renders in the viewer's
 * own local time. `null` when nothing accrues (unlimited). There is no library reset: deleting a
 * playlist frees a slot immediately.
 */
export interface EntitlementResets {
  search_at: string | null;
  upload_at: string | null;
  export_at: string | null;
}

export interface MyEntitlements {
  is_frontend: boolean;
  is_guest: boolean;
  plan: EntitlementPlan | null;
  /** feature_key → typed value (int / bool / csv-or-enum string). */
  entitlements: Record<string, EntitlementValue>;
  /** Pricing v2.1 — a flattened view of `entitlements`, not a second source of truth. */
  limits?: EntitlementLimits;
  usage?: EntitlementUsage;
  resets?: EntitlementResets;
}

interface MyEntitlementsEnvelope {
  success: boolean;
  data: MyEntitlements;
}

/** Fetch the caller's effective entitlements (guest or logged-in). */
export const getMyEntitlements = async () => {
  try {
    return await axiosWrapper<MyEntitlementsEnvelope>(
      authClient.get(API_CONFIG.ENDPOINTS.ENTITLEMENTS_ME)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
