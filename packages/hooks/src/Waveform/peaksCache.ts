import { getPlaybackToken, clearPlaybackToken } from '@resomix/stores';

export interface PeaksRich {
  fullband: number[];
  lowband?: number[];
  durationSeconds?: number;
}

interface CachedPeaks {
  data: PeaksRich;
  timestamp: number;
}

const peaksCache = new Map<string, CachedPeaks>();
const activeLoads = new Map<string, Promise<PeaksRich>>();
const MAX_CACHE_SIZE = 100;

/** Flush the entire peaks cache (e.g. on logout or heavy memory pressure). */
export function clearPeaksCache() {
  peaksCache.clear();
}

/** Evict the oldest entry if the cache exceeds its size limit. */
function evictIfNeeded() {
  if (peaksCache.size <= MAX_CACHE_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, val] of peaksCache) {
    if (val.timestamp < oldestTime) {
      oldestTime = val.timestamp;
      oldestKey = key;
    }
  }
  if (oldestKey) peaksCache.delete(oldestKey);
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper: decode peaks-rich payload from backend
// Expects payload:
// {
//   version: 2,
//   schema_type: "peaks-v2",
//   duration_seconds: number,
//   peaks: {
//     fullband: { encoding: "uint8", values: number[] },
//     lowband?: { encoding: "uint8", values: number[] }
//   }
// }
function parseV2Payload(payload: any): PeaksRich | null {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.schema_type !== 'peaks-v2') return null;

  const fb = payload?.peaks?.fullband?.values;
  if (!Array.isArray(fb)) return null;

  const deq = (arr: number[]) => arr.map(v => Math.max(0, Math.min(1, (v || 0) / 255)));

  const fullband = deq(fb);
  const lowRaw = payload?.peaks?.lowband?.values;
  const lowband = Array.isArray(lowRaw) ? deq(lowRaw) : undefined;

  const durationSeconds = typeof payload?.duration_seconds === 'number'
    ? payload.duration_seconds
    : (fullband?.length ?? undefined);

  return { fullband, lowband, durationSeconds };
}

/** Error carrying the HTTP status so callers can react to auth failures (401/403). */
class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function isAuthError(err: unknown): boolean {
  return err instanceof HttpError && (err.status === 401 || err.status === 403);
}

/**
 * A 4xx that won't be fixed by retrying (bad request / unprocessable). We must NOT retry-storm
 * these (e.g. a local "Missing partner_id" 400 on an uploaded track). 404 is deliberately excluded
 * — peaks may still be generating for a just-created track, so it gets a few bounded retries.
 */
function isPermanentClientError(err: unknown): boolean {
  return err instanceof HttpError && (err.status === 400 || err.status === 422);
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new HttpError(res.status);
  }
  return res.json();
}

/**
 * Fetch peaks for one uuid with the given token, trying the rich (v2) endpoint
 * first and falling back to the legacy endpoint. Auth failures (401/403) are NOT
 * swallowed by the legacy fallback — they propagate so the caller can re-mint.
 */
async function fetchPeaksOnce(uuid: string, token: string | null): Promise<PeaksRich> {
  const mediaBase = (import.meta as any).env?.VITE_SERVER_MEDIA || "https://media.resomix.com";
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';

  // Try the rich v2 endpoint first.
  try {
    const v2Url = `${mediaBase}/peaks-rich/?uuid=${encodeURIComponent(uuid)}${tokenParam}`;
    const v2 = await fetchJson(v2Url);
    const parsedV2 = parseV2Payload(v2);
    if (parsedV2) return parsedV2;
    // Parsed-but-not-v2 (e.g. legacy payload echoed): fall through to legacy.
  } catch (e) {
    if (isAuthError(e)) throw e; // don't mask a 403 behind the legacy fallback
    // otherwise fall through to legacy
  }

  // Fallback: legacy endpoint returns number[] (fullband only).
  const legacyUrl = `${mediaBase}/peaks/?uuid=${encodeURIComponent(uuid)}${tokenParam}`;
  const legacy = await fetchJson(legacyUrl) as number[];
  return {
    fullband: Array.isArray(legacy) ? legacy : [],
    lowband: undefined,
    durationSeconds: Array.isArray(legacy) ? legacy.length : undefined,
  };
}

export const loadPeaksData = async (
  uuid: string,
  options?: { maxRetries?: number; retryIntervalMs?: number; token?: string }
): Promise<PeaksRich> => {
  const cached = peaksCache.get(uuid);
  if (cached) return cached.data;

  if (activeLoads.has(uuid)) {
    return activeLoads.get(uuid)!;
  }

  // Bounded by default so a persistent failure can never retry-storm (was Infinity).
  const maxRetries = options?.maxRetries ?? 6;
  const retryIntervalMs = options?.retryIntervalMs ?? 2000;
  // An explicit token (if passed) overrides the managed token and disables re-minting.
  const explicitToken = options?.token;

  const loadPromise = (async (): Promise<PeaksRich> => {
    let attempt = 0;
    let remintAttempted = false;

    while (true) {
      attempt += 1;
      try {
        const token = explicitToken ?? (await getPlaybackToken());

        let payload: PeaksRich;
        try {
          payload = await fetchPeaksOnce(uuid, token);
        } catch (e) {
          // The Media server rejected the token (expired / missing / stale). If we
          // manage the token ourselves, force one re-mint and retry immediately.
          if (isAuthError(e) && !explicitToken && !remintAttempted) {
            remintAttempted = true;
            clearPlaybackToken();
            const fresh = await getPlaybackToken(true);
            payload = await fetchPeaksOnce(uuid, fresh);
          } else {
            throw e;
          }
        }

        peaksCache.set(uuid, { data: payload, timestamp: Date.now() });
        evictIfNeeded();
        return payload;

      } catch (err) {
        // A persistent auth failure means playback isn't permitted for this partner
        // (or the token was rejected even after re-minting). Do NOT retry-storm —
        // surface it so the outer handler returns empty peaks.
        if (isAuthError(err)) {
          console.warn('Peaks request rejected (auth) — playback may not be enabled for this partner', err);
          throw err;
        }

        // Permanent client errors (400/422) will never succeed on retry — stop immediately.
        if (isPermanentClientError(err)) {
          console.warn(`Peaks request failed (${(err as HttpError).status}) — permanent, not retrying`, err);
          throw err;
        }

        const canRetry = attempt < maxRetries;
        console.warn(`Failed to load peaks (attempt ${attempt}/${maxRetries})`, err);

        if (!canRetry) {
          throw err;
        }

        await sleep(retryIntervalMs);
      }
    }
  })();

  activeLoads.set(uuid, loadPromise);

  try {
    return await loadPromise;
  } catch (error) {
    console.error('Failed to load peaks data after retries:', error);
    return { fullband: [], lowband: undefined, durationSeconds: 0 };
  } finally {
    activeLoads.delete(uuid);
  }
};