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
import { useAuthStore } from "@resomix/stores";
import {
  FEATURE_KEYS,
  getMyEntitlements,
  type EntitlementValue,
  type MyEntitlements,
} from "@resomix/api-client";

// Shared across all hook consumers so we issue a single request. Keyed by **identity** (guest vs
// a specific user) so logging in/out automatically invalidates it — a guest and a user resolve to
// different entitlements.
let cache: MyEntitlements | null = null;
let cachedIdentity: string | null = null;
let inflight: Promise<MyEntitlements | null> | null = null;

function _cacheFresh(identity: string): boolean {
  return cache !== null && cachedIdentity === identity;
}

async function fetchEntitlements(identity: string, force = false): Promise<MyEntitlements | null> {
  if (_cacheFresh(identity) && !force) return cache;
  if (inflight && cachedIdentity === identity && !force) return inflight;
  inflight = (async () => {
    const res = await getMyEntitlements();
    if (res && typeof res === "object" && "data" in res && (res as { success?: boolean }).success !== false) {
      cache = (res as { data: MyEntitlements }).data;
      cachedIdentity = identity;
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
  /** SEARCH (catalog) playlists creatable per monthly period (resets on the billing anchor). */
  searchPlaylistsPerMonth: number;
  /** Uploads per monthly period — one upload = analysis + similarity, counted once. */
  uploadsPerMonth: number;
  /** Whether the plan allows similarity-by-upload at all (upload feature availability). */
  canSimilarityUpload: boolean;
  /** Force a refetch (call after login/logout/upgrade). */
  refresh: () => Promise<void>;
}

export function useEntitlements(): UseEntitlements {
  // A stable identity string: "guest" or the logged-in user's uuid. Changes on login/logout.
  const identity = useAuthStore((s) => (s.isAuthenticated ? (s.user?.uuid ?? "user") : "guest"));

  const [data, setData] = useState<MyEntitlements | null>(_cacheFresh(identity) ? cache : null);
  const [loading, setLoading] = useState<boolean>(!_cacheFresh(identity));
  const [error, setError] = useState<boolean>(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    const result = await fetchEntitlements(identity, force);
    setData(result);
    setError(result === null);
    setLoading(false);
  }, [identity]);

  // (Re)load whenever the identity changes (login/logout) or on first mount.
  useEffect(() => {
    if (_cacheFresh(identity)) {
      setData(cache);
      setLoading(false);
      return;
    }
    void load(false);
  }, [identity, load]);

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
    searchPlaylistsPerMonth: getInt(FEATURE_KEYS.SEARCH_PLAYLISTS_PER_MONTH, 5),
    uploadsPerMonth: getInt(FEATURE_KEYS.UPLOADS_PER_MONTH, 0),
    canSimilarityUpload: getBool(FEATURE_KEYS.CAN_SIMILARITY_UPLOAD),
    refresh,
  };
}

/** Clear the shared cache (e.g. on logout) so the next hook use refetches. */
export function resetEntitlementsCache(): void {
  cache = null;
  cachedIdentity = null;
  inflight = null;
}
