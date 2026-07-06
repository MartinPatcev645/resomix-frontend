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
  /** Guests get a "log in" nudge on locked options; users get an "upgrade" nudge. */
  isGuest: boolean;
}

export function useTrackCountOptions(): UseTrackCountOptions {
  const { dropdownMaxTracks, loading, isGuest } = useEntitlements();
  const { topSk, setTopSk } = usePlayerStore();

  // While entitlements load, don't lock anything (never falsely grey a paid user's options).
  const effectiveCap = loading ? Number.POSITIVE_INFINITY : dropdownMaxTracks;

  const options = useMemo<TrackCountOption[]>(
    () =>
      TRACK_COUNT_VALUES.map((value) => ({
        value,
        label: `${value} tracks`,
        locked: value > effectiveCap,
      })),
    [effectiveCap]
  );

  // Keep the selected depth within the plan cap once entitlements are known.
  useEffect(() => {
    if (!loading && typeof topSk === "number" && topSk > dropdownMaxTracks) {
      setTopSk(dropdownMaxTracks);
    }
  }, [loading, topSk, dropdownMaxTracks, setTopSk]);

  return { options, cap: dropdownMaxTracks, loading, isGuest };
}
