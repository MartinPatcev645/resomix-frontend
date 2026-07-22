import { useEffect, useState } from "react";
import { getMyTracks } from "@resomix/api-client";

export interface RecentAnalysis {
  /** The analysis uuid — open with /analysis?id=<this>. */
  analysisUuid: string;
  title: string;
  artist: string | null;
  topGenre: string | null;
  bpm: number | null;
  /** Camelot code (preferred) or musical key. */
  key: string | null;
}

/**
 * Recent analyses for the logged-in user, sourced from `my-tracks` (newest first) — each track row
 * already carries its `analysis_uuid` + analysis summary, so no extra endpoint is needed. Used to
 * fill the otherwise-empty Analysis page with quick previews of what's already been analysed.
 */
export function useRecentAnalyses(enabled: boolean, limit = 5): { items: RecentAnalysis[]; loading: boolean } {
  const [items, setItems] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const resp = await getMyTracks({ page: 1, page_size: 20 });
        if (cancelled) return;
        if (resp.success && Array.isArray(resp.data)) {
          const analysed = resp.data
            .filter((t: any) => t.analysis_uuid && t.analysis)
            .slice(0, limit)
            .map((t: any): RecentAnalysis => ({
              analysisUuid: t.analysis_uuid,
              title: t.title || "Untitled",
              artist: t.artist || null,
              topGenre: t.analysis?.top_genre ?? null,
              bpm: t.analysis?.bpm ?? null,
              key: t.analysis?.camelot ?? t.analysis?.music_key ?? null,
            }));
          setItems(analysed);
        }
      } catch {
        /* non-fatal — the page just shows facts without pills */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, limit]);

  return { items, loading };
}
