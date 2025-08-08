import React from "react";

export interface SearchResult {
  uuid: string | number;
  title: string;
  artist?: string;
  duration?: string;
}

const SEARCH_DATA: SearchResult[] = [
  { uuid: 1, title: "CHAMPAGNE DANCER", artist: "Schatrax", duration: "5:10" },
  { uuid: 2, title: "ARSENIC (ORIGINAL MIX)", artist: "Rone White, Deetech", duration: "6:20" },
  { uuid: 3, title: "WHOLE LIFE", artist: "Oxia", duration: "8:05" },
  { uuid: 4, title: "MEMENTO MORI", artist: "Murahni", duration: "7:15" },
  { uuid: 5, title: "CHAMPAGNE DANCER", artist: "Schatrax", duration: "5:10" },
];

export const useSearch = () => {
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    return SEARCH_DATA.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        (item.artist && item.artist.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query]);

  const handleQueryChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    []
  );

  return {
    query,
    results,
    handleQueryChange,
    setQuery,
  } as const;
};
