interface CachedPeaks {
  data: number[];
  timestamp: number;
}

const peaksCache = new Map<string, CachedPeaks>();
const activeLoads = new Map<string, Promise<number[]>>();

export const loadPeaksData = async (uuid: string): Promise<number[]> => {
  const cached = peaksCache.get(uuid);
  if (cached) {
    return cached.data;
  }

  if (activeLoads.has(uuid)) {
    return activeLoads.get(uuid)!;
  }

  try {
    const loadPromise = (async () => {
      const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        console.error(`Peaks fetch failed (${res.status})`);
      }

      const data = await res.json();

      peaksCache.set(uuid, {
        data,
        timestamp: Date.now()
      });
      return data;
    })();

    activeLoads.set(uuid, loadPromise);

    const result = await loadPromise;

    activeLoads.delete(uuid);

    return result;
  } catch (error) {
    activeLoads.delete(uuid);
    console.error('Failed to load peaks data:', error);
  }
  return [];
};
