import React from "react";
import type { SearchResult } from "./useSearch";

const POPULAR_TRACKS: SearchResult[] = [
  { id: "67ad9cec799206f8d64acd07", title: "Champagne Dancer", artist: "Schatrax", duration: "5:10" },
  { id: "67ad9cec799206f8d64acdf1", title: "Whole life", artist: "Oxia", duration: "8:05" },
  { id: "67ad9eb1799206f8d64c2200", title: "Arsenic (Original Mix)", artist: "Rone White, Deetech", duration: "6:20" },
  { id: "67ad9d34799206f8d64b3315", title: "Memento Mori", artist: "Murahni", duration: "7:15" },
  { id: "67b1aa3bf4110a1ed672dd89", title: "back in 1995 (extended mix)", artist: "Andrey Exx", duration: "6:14" }
];

export const usePopularTracks = () => {
  const popularTracks = React.useMemo(() => POPULAR_TRACKS, []);

  return {
    popularTracks,
  } as const;
};
