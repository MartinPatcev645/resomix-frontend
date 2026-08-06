/**
 * useAccess — the SINGLE source of truth for "can the current visitor do X?"
 * ==========================================================================
 *
 * Every gated UI action (share, rename, export, favorite, rate, similarity-upload) and the
 * track-unlock tease MUST read from this hook. Do not gate on `useAuthStore.isAuthenticated`
 * or on `useEntitlements()` fields directly — mixing those two signals is exactly what caused
 * logged-in users to be shown "log in to share" modals (the entitlements fetch resolves later
 * than, and can disagree with, the client auth flag).
 *
 * Verdicts:
 *   "allowed" — perform the action.
 *   "login"   — show the login gate (GateCtaModal reason "login_required").
 *   "upgrade" — show the subscribe gate (GateCtaModal reason "upgrade_required").
 *   "pending" — entitlements not settled yet: DISABLE/dim the control and do nothing on click.
 *               Never show a gate modal for "pending" — a wrong modal is worse than a short wait.
 *
 * Resolution order:
 *   1. Entitlements loaded for the current identity → SERVER truth (`is_guest` + capability map).
 *   2. Still loading → "pending".
 *   3. Fetch errored → fall back to the client auth flag: logged-in ⇒ "allowed" (the server is
 *      always the real guard and will reject if we're wrong — never lock a logged-in user out of
 *      the UI because OUR entitlements call failed), guest ⇒ "login".
 *
 * The verdict updates automatically on login/logout (this tab or broadcast from another tab),
 * and on token refresh — see the cache invalidation in `useEntitlements`.
 */

import { useCallback } from "react";
import { useAuthStore } from "@resomix/stores";
import { FEATURE_KEYS } from "@resomix/api-client";
import { useEntitlements } from "./useEntitlements";

export type AccessAction =
  | "share"
  | "rename"
  | "export"
  | "favorite"
  | "rateTrack"
  | "similarityUpload"
  | "exportApple"
  | "viewFullAnalysis";

export type AccessVerdict = "allowed" | "login" | "upgrade" | "pending";

/** GateCtaModal reason string for a blocking verdict, else null. */
export type GateReason = "login_required" | "upgrade_required" | null;

const ACTION_FEATURE: Record<AccessAction, string | null> = {
  share: null, // login-only; any logged-in plan can share
  rename: FEATURE_KEYS.CAN_RENAME,
  export: FEATURE_KEYS.CAN_EXPORT,
  favorite: FEATURE_KEYS.CAN_FAVORITE,
  rateTrack: FEATURE_KEYS.CAN_RATE_TRACKS,
  similarityUpload: FEATURE_KEYS.CAN_SIMILARITY_UPLOAD,
  exportApple: null, // special-cased in verdict() — a LIST capability, not a boolean
  // Decided HERE rather than by letting the user navigate and finding out server-side: the summary
  // already knows the plan, so the upgrade prompt can be shown in place instead of after a route
  // change onto a page that has nothing to render.
  viewFullAnalysis: FEATURE_KEYS.CAN_VIEW_FULL_ANALYSIS,
};

/** Guest defaults used while entitlements are unsettled — always fail-CLOSED on display. */
const GUEST_UNLOCKED_TRACKS = 10;

export interface UseAccess {
  /** The verdict for one action. Components branch on this and nothing else. */
  verdict: (action: AccessAction) => AccessVerdict;
  /** Convenience: GateCtaModal `reason` for a blocking verdict ("pending"/"allowed" → null). */
  gateReason: (action: AccessAction) => GateReason;
  /** True once entitlements are settled (loaded or errored) — controls dimming. */
  ready: boolean;
  /**
   * Guest-vs-user for CTA copy. While unsettled this falls back to the client auth flag so a
   * logged-in user is never addressed as a guest in copy.
   */
  isGuestForCopy: boolean;
  /**
   * How many result tracks are unlocked (rest are blurred + teased).
   * Unsettled → guest default (10): fail-closed, rows un-blur when the real value lands.
   */
  unlockedTracks: number;
  /** Only render the tease/upsell card when true (verdict data is real, copy won't lie). */
  teaseReady: boolean;
  /** Re-fetch entitlements (after login/upgrade flows that don't remount). */
  refresh: () => Promise<void>;
}

export function useAccess(): UseAccess {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ent = useEntitlements();

  const settled = !ent.loading;
  const errored = settled && ent.error;

  const verdict = useCallback(
    (action: AccessAction): AccessVerdict => {
      if (!settled) return "pending";
      if (errored) {
        // Our fetch failed — never block a logged-in user on our own error; server still guards.
        return isAuthenticated ? "allowed" : "login";
      }
      // Apple export is gated on a LIST capability: the `export_targets` CSV must contain "apple"
      // (the server enforces the same). This is not a boolean cap, so it can't go through the map.
      if (action === "exportApple") {
        const targets = ent.getStr(FEATURE_KEYS.EXPORT_TARGETS, "");
        const hasApple = targets.split(",").some((t) => t.trim().toLowerCase() === "apple");
        if (hasApple) return "allowed";
        return ent.isGuest ? "login" : "upgrade";
      }
      const featureKey = ACTION_FEATURE[action];
      if (featureKey === null) {
        return ent.isGuest ? "login" : "allowed";
      }
      if (ent.can(featureKey)) return "allowed";
      return ent.isGuest ? "login" : "upgrade";
    },
    [settled, errored, isAuthenticated, ent]
  );

  const gateReason = useCallback(
    (action: AccessAction): GateReason => {
      const v = verdict(action);
      if (v === "login") return "login_required";
      if (v === "upgrade") return "upgrade_required";
      return null;
    },
    [verdict]
  );

  return {
    verdict,
    gateReason,
    ready: settled,
    isGuestForCopy: settled && !errored ? ent.isGuest : !isAuthenticated,
    unlockedTracks: settled && !errored ? ent.maxTracksPerPlaylist : GUEST_UNLOCKED_TRACKS,
    teaseReady: settled && !errored,
    refresh: ent.refresh,
  };
}
