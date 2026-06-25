import { mintPlaybackToken } from "./partner";

/**
 * In-memory playback-token manager.
 *
 * The Media server (Hetzner) enforces Edge Authorization on playback assets
 * (peaks / segments / audio) via `require_partner_id`: external (browser)
 * callers must attach a short-lived HS256 "valet" JWT as `?token=<jwt>`.
 *
 * This module mints that token once via `POST /api/v1/partner/playback-token`
 * (which resolves the caller to their partner — the first-party webapp resolves
 * to System Partner 1 via the system key), caches it in memory until shortly
 * before it expires, de-dupes concurrent mints, and re-mints on demand when a
 * playback request is rejected (401/403) or the token lapses.
 *
 * NOTE: minting only succeeds for `similarity_playback` partners (the §9.2 gate
 * on Alwyzon). If the resolved partner is `similarity_only`, the mint returns
 * 403 and `getPlaybackToken()` resolves to `null` — callers then proceed without
 * a token and the Media server will reject the asset request, which is the
 * correct, graceful failure mode until playback is enabled for that partner.
 */

interface CachedToken {
  token: string;
  /** Epoch ms after which the token must be re-minted. */
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<string | null> | null = null;

/** Re-mint this many ms before the real expiry to avoid edge-of-expiry races. */
const EXPIRY_SKEW_MS = 30_000;

/**
 * Get a valid playback token, minting (or re-minting) as needed.
 *
 * @param force  Bypass the cache and mint a fresh token (e.g. after a 403).
 * @returns The JWT string, or `null` if minting is not permitted / failed.
 */
export async function getPlaybackToken(force = false): Promise<string | null> {
  if (force) {
    cached = null;
  } else if (cached && Date.now() < cached.expiresAt - EXPIRY_SKEW_MS) {
    return cached.token;
  }

  // De-dupe: many waveforms can mount at once — only one mint in flight.
  if (inflight) return inflight;

  inflight = (async (): Promise<string | null> => {
    try {
      const res = await mintPlaybackToken();
      if (res?.success && res.data?.token) {
        cached = {
          token: res.data.token,
          expiresAt: Date.now() + (res.data.expires_in ?? 0) * 1000,
        };
        return cached.token;
      }
      cached = null;
      return null;
    } catch {
      cached = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Drop the cached token (call on logout, or after a rejected playback request). */
export function clearPlaybackToken(): void {
  cached = null;
}
