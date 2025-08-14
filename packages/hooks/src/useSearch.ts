import React from "react";
import { searchTracks } from "@resomix/api-client";

export interface SearchResult {
  uuid: string | number;
  title: string;
  artist?: string;
  duration?: string;
}

const formatSecondsToMmSs = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

export const useSearch = () => {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await searchTracks(searchQuery);
      
      if (response.success && response.data?.tracks) {
        const tracks = response.data.tracks;
        const mappedResults = tracks.map((track: any) => ({
          uuid: track.id,
          title: track.title,
          artist: track.artist,
          duration: formatSecondsToMmSs(track.duration)
        }));
        setResults(mappedResults);
      } else {
        setError(response.error || "Search failed");
        setResults([]);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  const handleQueryChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    []
  );

  return {
    query,
    results,
    isLoading,
    error,
    handleQueryChange,
    setQuery,
  } as const;
};
