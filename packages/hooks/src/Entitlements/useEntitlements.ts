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
  onQuotaDenied,
  onUsageChanged,
  type EntitlementValue,
  type EntitlementLimits,
  type EntitlementResets,
  type EntitlementUsage,
  type MyEntitlements,
} from "@resomix/api-client";

// Shared across all hook consumers so we issue a single request. Keyed by **identity** (guest vs
// a specific user) so logging in/out automatically invalidates it — a guest and a user resolve to
// different entitlements.
let cache: MyEntitlements | null = null;
let cachedIdentity: string | null = null;
let inflight: Promise<MyEntitlements | null> | null = null;
// The identity the current in-flight request is for. Set BEFORE the await so concurrent callers
// (multiple useEntitlements/useAccess consumers mounting on the same paint) dedupe onto the one
// request. `cachedIdentity` alone can't do this — it isn't set until the request RESOLVES, so
// during the in-flight window it's still stale and the dedup check would miss → a 2nd fetch fired.
let inflightIdentity: string | null = null;

function _cacheFresh(identity: string): boolean {
  return cache !== null && cachedIdentity === identity;
}

async function fetchEntitlements(identity: string, force = false): Promise<MyEntitlements | null> {
  if (_cacheFresh(identity) && !force) return cache;
  // Dedupe on the in-flight identity (set synchronously below), NOT cachedIdentity.
  if (inflight && inflightIdentity === identity && !force) return inflight;
  inflightIdentity = identity;
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
    inflightIdentity = null;
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
  /**
   * Pricing v2.1 — the usage chip's data. `null` inside `limits` means unlimited; `null` inside
   * `usage` means NOT KNOWN (unlimited features are never counted, and a counter read can fail),
   * which is not zero. All three are `null` until the fetch settles, and for B2B callers.
   *
   * Do not gate on these: they are a report, and the server is the guard.
   */
  limits: EntitlementLimits | null;
  usage: EntitlementUsage | null;
  resets: EntitlementResets | null;
  /** Force a refetch (call after login/logout/upgrade). */
  refresh: () => Promise<void>;
}

export function useEntitlements(): UseEntitlements {
  // A stable identity string: "guest" or the logged-in user's uuid. Changes on login/logout.
  const identity = useAuthStore((s) => (s.isAuthenticated ? (s.user?.uuid ?? "user") : "guest"));
  // HOLD guard: right after a tab reopen the store hydrates `isAuthenticated: true` from
  // localStorage while the access token (sessionStorage / refresh cookie) is still being
  // restored. Firing /entitlements/me in that window sends NO Bearer token, the server answers
  // with GUEST entitlements, and we'd cache a logged-in user as a guest. So while the client
  // claims "authenticated" but has no token yet, we stay in `loading` and wait for the token
  // (verifySession/useAuthInit resolves it, or logs the user out — either way `identity`/token
  // changes and this re-runs).
  const waitingForToken = useAuthStore((s) => s.isAuthenticated && !s.accessToken);

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
    if (waitingForToken) return; // stay loading; re-runs when the token lands or auth flips off
    if (_cacheFresh(identity)) {
      setData(cache);
      setLoading(false);
      return;
    }
    void load(false);
  }, [identity, load, waitingForToken]);

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

  // A 402 means the server just refused something on a limit, so the cached usage is stale by
  // definition — the user spent the very thing the chip is showing. Without this the chip keeps
  // reading "2/3" after the request that made it 3/3, and only a page reload fixes it.
  //
  // Forced (`load(true)`) deliberately: the shared cache is what went stale, so a cache-respecting
  // reload would return the same wrong numbers.
  useEffect(() => {
    return onQuotaDenied(() => {
      if (waitingForToken) return; // no token yet — a fetch now would come back as a guest
      void load(true);
    });
  }, [load, waitingForToken]);

  // ...and after an allowance is SPENT successfully. Without this the chip only ever corrects
  // itself once the user is refused — so it reads 0/3 immediately after their first search and
  // stays wrong until a page reload, which is the state most users would actually see.
  useEffect(() => {
    return onUsageChanged(() => {
      if (waitingForToken) return;
      void load(true);
    });
  }, [load, waitingForToken]);

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
    limits: data?.limits ?? null,
    usage: data?.usage ?? null,
    resets: data?.resets ?? null,
    refresh,
  };
}

/** Clear the shared cache (e.g. on logout) so the next hook use refetches. */
export function resetEntitlementsCache(): void {
  cache = null;
  cachedIdentity = null;
  inflight = null;
  inflightIdentity = null;
}

// Explicit invalidation on auth flips (login AND logout). The identity-keyed cache already makes
// stale reads impossible, but this drops the previous identity's data from memory outright and
// makes the invalidation self-contained (the stores package cannot call us — it sits below hooks
// in the dependency graph). Cross-tab logout is covered too: the `resomix-logout` broadcast makes
// every tab run `logout({broadcast:false})`, which flips `isAuthenticated` in that tab's store and
// lands here.
let _prevAuthedForCache = useAuthStore.getState().isAuthenticated;
useAuthStore.subscribe((state) => {
  if (state.isAuthenticated !== _prevAuthedForCache) {
    _prevAuthedForCache = state.isAuthenticated;
    resetEntitlementsCache();
  }
});
