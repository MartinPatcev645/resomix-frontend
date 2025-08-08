import React from "react";
import type { SearchResult } from "./useSearch";

const POPULAR_TRACKS: SearchResult[] = [
  { uuid: "p1", title: "CHAMPAGNE DANCER", artist: "Schatrax", duration: "5:10" },
  { uuid: "p2", title: "ARSENIC (ORIGINAL MIX)", artist: "Rone White, Deetech", duration: "6:20" },
  { uuid: "p3", title: "WHOLE LIFE", artist: "Oxia", duration: "8:05" },
  { uuid: "p4", title: "MEMENTO MORI", artist: "Murahni", duration: "7:15" },
  { uuid: "p5", title: "AD ASTRA", artist: "Solara", duration: "4:44" },
];

export const usePopularTracks = () => {
  const popularTracks = React.useMemo(() => POPULAR_TRACKS, []);

  return {
    popularTracks,
  } as const;
};
