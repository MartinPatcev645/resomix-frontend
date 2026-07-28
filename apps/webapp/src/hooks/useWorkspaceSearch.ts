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
  // Monotonic id so a slow response for an older query/mode can't clobber a newer one.
  const reqIdRef = useRef(0);

  const performSearch = useCallback(
    async (searchQuery: string, mode: typeof searchMode) => {
      const reqId = ++reqIdRef.current;

      if (!searchQuery.trim()) {
        setResults([]);
        setError(null);
        patchDiscoveryCache({ searchQuery: "", searchResults: [], searchMode: mode });
        return;
      }

      // Restore-without-refetch: only a COMPLETE cache entry (query + mode + its own results) hits.
      // handleQueryChange clears the cached results on every keystroke, so a mid-typing query can
      // never match stale results here.
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
        if (reqId !== reqIdRef.current) return; // superseded by a newer search
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
        if (reqId !== reqIdRef.current) return;
        setError("An unexpected error occurred");
        setResults([]);
        patchDiscoveryCache({ searchQuery: searchQuery, searchResults: [], searchMode: mode });
      } finally {
        if (reqId === reqIdRef.current) setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    // Debounce: fire ~half a second after the user stops typing (or after a mode change).
    const timeoutId = setTimeout(() => {
      void performSearch(query, searchMode);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [query, searchMode, performSearch]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    // Keep the typed query in the cache (so Back/Change restores it) but DROP the old results —
    // leaving stale results here is what made performSearch's cache check short-circuit and never
    // fetch the new query. performSearch repopulates the results once they arrive.
    patchDiscoveryCache({ searchQuery: next, searchResults: [] });
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
