import { useCallback, useEffect, useState } from "react";
import {
  PLAYLIST_VISIBLE_PAGE,
  initialVisibleCount,
  nextVisibleCount,
} from "@/utils/playlistChrome.ts";

/**
 * Progressive disclosure for similarity results — reveals already-loaded tracks in pages of 25.
 * Does not re-fetch or re-rank; resets when the playlist identity or result length changes.
 */
export function useVisibleResultWindow(playlistId: string | undefined, totalResults: number) {
  const [visibleCount, setVisibleCount] = useState(() =>
    initialVisibleCount(totalResults, PLAYLIST_VISIBLE_PAGE),
  );

  useEffect(() => {
    setVisibleCount(initialVisibleCount(totalResults, PLAYLIST_VISIBLE_PAGE));
  }, [playlistId, totalResults]);

  const canLoadMore = visibleCount < totalResults;
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => nextVisibleCount(prev, totalResults, PLAYLIST_VISIBLE_PAGE));
  }, [totalResults]);

  return {
    visibleCount,
    canLoadMore,
    loadMore,
    pageSize: PLAYLIST_VISIBLE_PAGE,
    remaining: Math.max(0, totalResults - visibleCount),
  };
}
