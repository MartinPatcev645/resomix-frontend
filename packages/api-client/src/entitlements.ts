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

export interface MyEntitlements {
  is_frontend: boolean;
  is_guest: boolean;
  plan: EntitlementPlan | null;
  /** feature_key → typed value (int / bool / csv-or-enum string). */
  entitlements: Record<string, EntitlementValue>;
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
