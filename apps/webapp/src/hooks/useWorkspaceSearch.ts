import React, { useCallback, useEffect, useRef, useState } from "react";
import { searchTracks } from "@resomix/api-client";
import { usePlayerStore } from "@resomix/stores";
import type { SearchResult } from "@resomix/hooks";
import {
  getDiscoveryCache,
  patchDiscoveryCache,
} from "@/sections/desktop/Workspace/workspaceStateCache.ts";

const formatSecondsToMmSs = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

/**
 * Workspace search with session cache — restores query + results on Back/Change without refetch
 * when the cached query/mode still matches.
 */
export function useWorkspaceSearch() {
  const cached = getDiscoveryCache();
  const [query, setQuery] = useState(cached.searchQuery);
  const [results, setResults] = useState<SearchResult[]>(cached.searchResults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { searchMode } = usePlayerStore();
  const skipNextFetch = useRef(
    cached.searchQuery.length > 0 && cached.searchResults.length > 0 && cached.searchMode === searchMode,
  );

  const performSearch = useCallback(
    async (searchQuery: string, mode: typeof searchMode) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setError(null);
        patchDiscoveryCache({ searchQuery: "", searchResults: [], searchMode: mode });
        return;
      }

      const cache = getDiscoveryCache();
      if (
        cache.searchQuery === searchQuery &&
        cache.searchMode === mode &&
        cache.searchResults.length > 0
      ) {
        setResults(cache.searchResults);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await searchTracks(searchQuery, mode);
        if (response.success && response.data?.tracks) {
          const mappedResults = response.data.tracks.map((track: Record<string, unknown>) => ({
            id: track.id as string | number,
            title: String(track.title ?? ""),
            artist: track.artist ? String(track.artist) : undefined,
            duration: formatSecondsToMmSs(Number(track.duration ?? 0)),
          }));
          setResults(mappedResults);
          patchDiscoveryCache({
            searchQuery: searchQuery,
            searchResults: mappedResults,
            searchMode: mode,
          });
        } else {
          setError(response.error || "Search failed");
          setResults([]);
          patchDiscoveryCache({ searchQuery: searchQuery, searchResults: [], searchMode: mode });
        }
      } catch {
        setError("An unexpected error occurred");
        setResults([]);
        patchDiscoveryCache({ searchQuery: searchQuery, searchResults: [], searchMode: mode });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      void performSearch(query, searchMode);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, searchMode, performSearch]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    patchDiscoveryCache({ searchQuery: next });
  }, []);

  return {
    query,
    results,
    isLoading,
    error,
    handleQueryChange,
    setQuery,
  } as const;
}
