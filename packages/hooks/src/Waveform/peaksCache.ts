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

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export const loadPeaksData = async (
  uuid: string,
  options?: { maxRetries?: number; retryIntervalMs?: number }
): Promise<PeaksRich> => {
  const cached = peaksCache.get(uuid);
  if (cached) return cached.data;

  if (activeLoads.has(uuid)) {
    return activeLoads.get(uuid)!;
  }

  const maxRetries = options?.maxRetries ?? Infinity;
  const retryIntervalMs = options?.retryIntervalMs ?? 2000;

  const loadPromise = (async (): Promise<PeaksRich> => {
    let attempt = 0;

    while (true) {
      attempt += 1;
      try {
        // Try new v2 endpoint first
        try {
          const v2Url = `https://rmedia.resomix.com/peaks-rich/?uuid=${encodeURIComponent(uuid)}`;
          const v2 = await fetchJson(v2Url);
          const parsedV2 = parseV2Payload(v2);
          if (parsedV2) {
            peaksCache.set(uuid, { data: parsedV2, timestamp: Date.now() });
            return parsedV2;
          }
        } catch (e) {
          // Silently fall back to legacy
        }

        // Fallback to legacy: returns number[] (fullband only)
        const legacyUrl = `https://rmedia.resomix.com/peaks/?uuid=${encodeURIComponent(uuid)}`;
        const legacy = await fetchJson(legacyUrl) as number[];

        const payload: PeaksRich = {
          fullband: Array.isArray(legacy) ? legacy : [],
          lowband: undefined,
          durationSeconds: Array.isArray(legacy) ? legacy.length : undefined
        };

        peaksCache.set(uuid, { data: payload, timestamp: Date.now() });
        return payload;

      } catch (err) {
        const canRetry = attempt < maxRetries || maxRetries === Infinity;
        console.warn(`Failed to load peaks (attempt ${attempt})`, err);

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