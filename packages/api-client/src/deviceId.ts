/**
 * Device signal for server-authoritative guest identity (Phase 8.1)
 * =================================================================
 *
 * We compute a stable **ThumbmarkJS** device fingerprint client-side and send it as the
 * `X-Device-Hash` header. The SERVER derives the real `visitor_id` from it (sha256 of device
 * hash + IP/24 + language) and never trusts a client-sent id — this file only supplies the raw
 * signal.
 *
 * ThumbmarkJS is loaded from CDN (not bundled) so that a blocked/absent script **degrades
 * gracefully**: `getDeviceHash()` returns `null` and the server falls back to its signed guest
 * cookie + IP. The hash is computed once and cached in memory + localStorage.
 *
 * MIT-licensed. Fingerprinting here is for anti-abuse (legitimate interest), disclosed separately
 * from optional analytics consent — see the consent config.
 */

const STORAGE_KEY = "rmx_device_hash";
const CDN_URL = "https://cdn.jsdelivr.net/npm/@thumbmarkjs/thumbmarkjs/dist/thumbmark.umd.js";
const LOAD_TIMEOUT_MS = 4000;

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

function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("no document"));
      return;
    }
    if (document.querySelector("script[data-rmx-thumbmark]")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-rmx-thumbmark", "1");
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error("thumbmark load timeout"));
    }, timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("thumbmark load error"));
    };
    document.head.appendChild(script);
  });
}

/**
 * Compute (once) and cache the device hash. Idempotent + safe to call on every app start.
 * Resolves to the hash, or `null` if the fingerprint can't be produced (script blocked/offline).
 * Call early in app bootstrap so the first gated request already carries `X-Device-Hash`.
 */
export function initDeviceHash(): Promise<string | null> {
  if (cached) return Promise.resolve(cached);
  if (initPromise) return initPromise;
  if (typeof window === "undefined") return Promise.resolve(null);

  const stored = getDeviceHash();
  if (stored) return Promise.resolve(stored);

  initPromise = (async () => {
    try {
      await loadScript(CDN_URL, LOAD_TIMEOUT_MS);
      const tm = (window as unknown as { ThumbmarkJS?: { getFingerprint?: () => Promise<unknown> } }).ThumbmarkJS;
      const fn = tm?.getFingerprint;
      if (typeof fn !== "function") return null;
      const result = await fn.call(tm);
      const hash =
        typeof result === "string"
          ? result
          : ((result as { thumbmark?: string; visitorId?: string })?.thumbmark ||
             (result as { thumbmark?: string; visitorId?: string })?.visitorId ||
             null);
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
      // Blocked by an ad/tracker blocker, offline, or CDN down → degrade silently.
      return null;
    }
  })();
  return initPromise;
}
