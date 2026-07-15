/**
 * Device signal for server-authoritative guest identity (Phase 8.1)
 * =================================================================
 *
 * We compute a stable **ThumbmarkJS** device fingerprint client-side and send it as the
 * `X-Device-Hash` header. The SERVER derives the real `visitor_id` from it (sha256 of device
 * hash + IP/24 + language) and never trusts a client-sent id — this file only supplies the raw
 * signal.
 *
 * ThumbmarkJS is now **bundled from npm** (`@thumbmarkjs/thumbmarkjs`), not loaded from a CDN, so
 * the fingerprint is available immediately at bootstrap with no network race. If it can't be
 * computed for any reason, `getDeviceHash()` returns `null` and the server degrades gracefully to
 * its signed guest cookie + IP. The hash is computed once and cached in memory + localStorage.
 *
 * MIT-licensed. Fingerprinting here is for anti-abuse (legitimate interest), disclosed separately
 * from optional analytics consent — see the consent config.
 */

import { getFingerprint } from "@thumbmarkjs/thumbmarkjs";

const STORAGE_KEY = "rmx_device_hash";

let cached: string | null = null;
let initPromise: Promise<string | null> | null = null;

/** Synchronous accessor for request interceptors: cached hash or `null` (never computes). */
export function getDeviceHash(): string | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    /* localStorage blocked (private mode / cookie wall) — degrade */
  }
  return null;
}

/**
 * Compute (once) and cache the device hash. Idempotent + safe to call on every app start.
 * Resolves to the hash, or `null` if the fingerprint can't be produced.
 *
 * Call (and ideally `await`) this before the first gated request so it already carries
 * `X-Device-Hash` — otherwise the first guest action would fall back to the degraded IP-only
 * visitor id, which (e.g.) would leave that first playlist un-reparentable on login.
 */
export function initDeviceHash(): Promise<string | null> {
  if (cached) return Promise.resolve(cached);
  if (initPromise) return initPromise;
  if (typeof window === "undefined") return Promise.resolve(null);

  const stored = getDeviceHash();
  if (stored) return Promise.resolve(stored);

  initPromise = (async () => {
    try {
      const hash = await getFingerprint(); // bundled — resolves to the fingerprint string
      if (hash) {
        cached = hash;
        try {
          window.localStorage.setItem(STORAGE_KEY, hash);
        } catch {
          /* ignore persistence failure — in-memory cache still works this session */
        }
      }
      return cached;
    } catch {
      // Fingerprint couldn't be computed (very old browser, hardened privacy env) → degrade silently.
      return null;
    }
  })();
  return initPromise;
}
