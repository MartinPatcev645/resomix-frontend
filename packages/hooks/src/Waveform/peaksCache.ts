interface CachedPeaks {
  data: number[];
  timestamp: number;
}

const peaksCache = new Map<string, CachedPeaks>();
const activeLoads = new Map<string, Promise<number[]>>();

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export const loadPeaksData = async (
  uuid: string,
  options?: { maxRetries?: number; retryIntervalMs?: number }
): Promise<number[]> => {
  const cached = peaksCache.get(uuid);
  if (cached) {
    return cached.data;
  }

  if (activeLoads.has(uuid)) {
    return activeLoads.get(uuid)!;
  }

  const maxRetries = options?.maxRetries ?? 20;
  const retryIntervalMs = options?.retryIntervalMs ?? 2000;

  const loadPromise = (async (): Promise<number[]> => {
    let attempt = 0;

    while (true) {
      attempt += 1;
      try {
        const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, {
          cache: 'no-store'
        });

        if (!res.ok) {
          console.log(`Peaks fetch failed (status ${res.status})`);
        }

        const data = (await res.json()) as number[];

        peaksCache.set(uuid, {
          data,
          timestamp: Date.now()
        });

        return data;
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
    return [];
  } finally {
    activeLoads.delete(uuid);
  }
};