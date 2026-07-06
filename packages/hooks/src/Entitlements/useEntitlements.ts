/**
 * useEntitlements (Phase 8.2)
 * ===========================
 *
 * Fetches the caller's effective entitlements once (shared module cache) and exposes typed
 * accessors so components can drive UI: grey dropdown options beyond `dropdownMaxTracks`,
 * show/hide export/rename/rate, and read the current plan. The SERVER remains the guard — this
 * only powers convenience UX.
 *
 * Refetch after an auth change (login/logout/upgrade) via `refresh()`.
 */

import { useCallback, useEffect, useState } from "react";
import {
  FEATURE_KEYS,
  getMyEntitlements,
  type EntitlementValue,
  type MyEntitlements,
} from "@resomix/api-client";

// Shared across all hook consumers so we issue a single request.
let cache: MyEntitlements | null = null;
let inflight: Promise<MyEntitlements | null> | null = null;

async function fetchEntitlements(force = false): Promise<MyEntitlements | null> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const res = await getMyEntitlements();
    if (res && typeof res === "object" && "data" in res && (res as { success?: boolean }).success !== false) {
      cache = (res as { data: MyEntitlements }).data;
      return cache;
    }
    return null;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export interface UseEntitlements {
  entitlements: Record<string, EntitlementValue>;
  plan: MyEntitlements["plan"];
  isGuest: boolean;
  loading: boolean;
  error: boolean;
  /** Typed getters (with sensible fallbacks) keyed by FEATURE_KEYS. */
  getInt: (key: string, fallback?: number) => number;
  getBool: (key: string) => boolean;
  getStr: (key: string, fallback?: string) => string;
  /** True if a boolean capability is enabled (alias of getBool). */
  can: (key: string) => boolean;
  /** Convenience for the most-used caps. */
  dropdownMaxTracks: number;
  /** How many result tracks are unlocked in a created playlist; the rest are teased. */
  maxTracksPerPlaylist: number;
  /** Playlists creatable per monthly period (resets on the subject's billing anchor). */
  playlistsPerMonth: number;
  /** Force a refetch (call after login/logout/upgrade). */
  refresh: () => Promise<void>;
}

export function useEntitlements(): UseEntitlements {
  const [data, setData] = useState<MyEntitlements | null>(cache);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<boolean>(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    const result = await fetchEntitlements(force);
    setData(result);
    setError(result === null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (cache) {
      setData(cache);
      setLoading(false);
      return;
    }
    void load(false);
  }, [load]);

  const map = data?.entitlements ?? {};

  const getInt = useCallback(
    (key: string, fallback = 0) => {
      const v = map[key];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    },
    [map]
  );
  const getBool = useCallback((key: string) => map[key] === true || map[key] === "true", [map]);
  const getStr = useCallback((key: string, fallback = "") => {
    const v = map[key];
    return v === undefined || v === null ? fallback : String(v);
  }, [map]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    entitlements: map,
    plan: data?.plan ?? null,
    isGuest: data?.is_guest ?? true,
    loading,
    error,
    getInt,
    getBool,
    getStr,
    can: getBool,
    dropdownMaxTracks: getInt(FEATURE_KEYS.DROPDOWN_MAX_TRACKS, 20),
    maxTracksPerPlaylist: getInt(FEATURE_KEYS.MAX_TRACKS_PER_PLAYLIST, 10),
    playlistsPerMonth: getInt(FEATURE_KEYS.PLAYLISTS_PER_MONTH, 5),
    refresh,
  };
}

/** Clear the shared cache (e.g. on logout) so the next hook use refetches. */
export function resetEntitlementsCache(): void {
  cache = null;
  inflight = null;
}
