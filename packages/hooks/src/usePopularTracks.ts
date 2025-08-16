import React from "react";
import type { SearchResult } from "./useSearch";

const POPULAR_TRACKS: SearchResult[] = [
  { id: "p1", title: "CHAMPAGNE DANCER", artist: "Schatrax", duration: "5:10" },
  { id: "p2", title: "ARSENIC (ORIGINAL MIX)", artist: "Rone White, Deetech", duration: "6:20" },
  { id: "p3", title: "WHOLE LIFE", artist: "Oxia", duration: "8:05" },
  { id: "p4", title: "MEMENTO MORI", artist: "Murahni", duration: "7:15" },
  { id: "p5", title: "AD ASTRA", artist: "Solara", duration: "4:44" },
];

export const usePopularTracks = () => {
  const popularTracks = React.useMemo(() => POPULAR_TRACKS, []);

  return {
    popularTracks,
  } as const;
};
