import { create } from 'zustand';
import { mintPlaybackToken } from '@resomix/api-client';

/**
 * Global playback-token store.
 *
 * The Media server (Hetzner) gates playback assets (peaks / segments / audio / covers) behind an
 * Edge-Authorization "valet" JWT passed as `?token=<jwt>`. That token is partner-scoped (not
 * user-scoped) and short-lived, so we mint it ONCE and keep it in this store for its whole life —
 * every surface (playlist page, library, …) reads the same token instead of re-minting on each
 * navigation. When it's missing / near expiry / rejected (401/403), one global `refresh()` mints a
 * fresh one and updates the store, and callers get it immediately.
 *
 * Concurrent mints are de-duped via a single in-flight promise.
 */

// Re-mint this many ms before the real expiry to avoid edge-of-expiry races.
const EXPIRY_SKEW_MS = 30_000;

interface PlaybackTokenStore {
  token: string | null;
  /** Epoch ms after which the token must be re-minted. */
  expiresAt: number;
  /** Single in-flight mint, so many callers at once trigger only one request. */
  inflight: Promise<string | null> | null;

  /** Valid token from the store; mints/refreshes if missing, near-expiry, or `force`d. */
  getToken: (force?: boolean) => Promise<string | null>;
  /** Force a fresh mint and update the store. Call after a rejected (401/403) asset request. */
  refresh: () => Promise<string | null>;
  /** Drop the token (e.g. on logout). */
  clear: () => void;
}

export const usePlaybackTokenStore = create<PlaybackTokenStore>((set, get) => ({
  token: null,
  expiresAt: 0,
  inflight: null,

  getToken: async (force = false) => {
    const { token, expiresAt } = get();
    if (!force && token && Date.now() < expiresAt - EXPIRY_SKEW_MS) return token;
    return get().refresh();
  },

  refresh: async () => {
    const existing = get().inflight;
    if (existing) return existing; // de-dupe concurrent mints

    const p = (async (): Promise<string | null> => {
      try {
        const res = await mintPlaybackToken();
        if (res?.success && res.data?.token) {
          set({ token: res.data.token, expiresAt: Date.now() + (res.data.expires_in ?? 0) * 1000 });
          return res.data.token;
        }
        set({ token: null, expiresAt: 0 });
        return null;
      } catch {
        set({ token: null, expiresAt: 0 });
        return null;
      } finally {
        set({ inflight: null });
      }
    })();

    set({ inflight: p });
    return p;
  },

  clear: () => set({ token: null, expiresAt: 0, inflight: null }),
}));

// Non-hook accessors — use anywhere (async fns, non-React modules) without subscribing.
/** Get a valid playback token from the store (mints/refreshes as needed). */
export const getPlaybackToken = (force = false): Promise<string | null> =>
  usePlaybackTokenStore.getState().getToken(force);
/** The one global refresh: force-mint a fresh token and update the store. */
export const refreshPlaybackToken = (): Promise<string | null> =>
  usePlaybackTokenStore.getState().refresh();
/** Drop the stored token (logout). */
export const clearPlaybackToken = (): void => usePlaybackTokenStore.getState().clear();
