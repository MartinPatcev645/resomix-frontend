/**
 * useTrackCountOptions (Phase 8.2)
 * ================================
 *
 * Single source for the "Results Count / Set Your Depth" dropdown so the desktop and mobile
 * `UploadOne` variants stay in sync. Returns the fixed option set with a per-option `locked`
 * flag (values beyond the caller's plan `dropdown_max_tracks` — guest 20, free 50, …) and keeps
 * the selected `topSk` clamped within the cap.
 *
 * The SERVER also clamps `top_sk`, so this is convenience UX (greying), never the guard.
 */

import { useEffect, useMemo } from "react";
import { usePlayerStore } from "@resomix/stores";
import { useEntitlements } from "./useEntitlements";

export const TRACK_COUNT_VALUES = [10, 20, 50, 100] as const;

export interface TrackCountOption {
  value: number;
  label: string; // e.g. "50 tracks"
  locked: boolean; // beyond the caller's plan cap
}

export interface UseTrackCountOptions {
  options: TrackCountOption[];
  /** The caller's effective cap (dropdown_max_tracks). */
  cap: number;
  /** True while entitlements are still loading (no options are locked yet, to avoid flicker). */
  loading: boolean;
  isGuest: boolean;
  /** True when at least one option is locked (i.e. show the nudge). */
  hasLockedOptions: boolean;
  /**
   * Tier-correct nudge to render next to the dropdown when options are locked, or `null`.
   * Guests are nudged to log in; logged-in users are nudged to subscribe.
   */
  lockedCtaLabel: string | null;
  /** What the nudge should do — routes the CTA without hardcoding copy in components. */
  lockedCtaAction: "login" | "subscribe" | null;
}

export function useTrackCountOptions(): UseTrackCountOptions {
  const { dropdownMaxTracks, loading, isGuest } = useEntitlements();
  const { topSk, setTopSk } = usePlayerStore();

  // While entitlements load, don't lock anything (never falsely grey a paid user's options).
  const effectiveCap = loading ? Number.POSITIVE_INFINITY : dropdownMaxTracks;

  const options = useMemo<TrackCountOption[]>(
    () =>
      TRACK_COUNT_VALUES.map((value) => {
        const locked = value > effectiveCap;
        // Locked options are greyed out and say what unlocks them. A guest's locked option opens
        // with a free account (Free creates up to 100), so "(Premium)" would send them the wrong
        // way; signed-in users only ever see a locked option when it is a paid one.
        const suffix = isGuest ? "(Log in)" : "(Premium)";
        return {
          value,
          label: locked ? `${value} tracks ${suffix}` : `${value} tracks`,
          locked,
        };
      }),
    [effectiveCap, isGuest]
  );

  // Keep the selected depth within the plan cap once entitlements are known.
  useEffect(() => {
    if (!loading && typeof topSk === "number" && topSk > dropdownMaxTracks) {
      setTopSk(dropdownMaxTracks);
    }
  }, [loading, topSk, dropdownMaxTracks, setTopSk]);

  const hasLockedOptions = !loading && options.some((o) => o.locked);
  const lockedCtaAction: "login" | "subscribe" | null = hasLockedOptions
    ? (isGuest ? "login" : "subscribe")
    : null;
  const lockedCtaLabel = hasLockedOptions
    ? (isGuest ? "Log in to unlock deeper results" : "Subscribe to unlock deeper results")
    : null;

  return { options, cap: dropdownMaxTracks, loading, isGuest, hasLockedOptions, lockedCtaLabel, lockedCtaAction };
}
