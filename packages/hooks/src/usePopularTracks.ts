import React from "react";
import type { SearchResult } from "./useSearch";

const POPULAR_TRACKS: SearchResult[] = [
  { id: "eb436061-2a26-53cc-8995-4399a6a0f400", title: "Cognitive Dissonance", artist: "J Tijn", duration: "6:01" },
  { id: "2b8682c0-2c55-50d5-9810-207eec26a172", title: "Fire It Out (Fango Remix) [feat. Ruede Hagelstein]", artist: "Tiefschwarz", duration: "6:37" },
  { id: "c564c7a7-a608-5ad1-850c-b8614173e1b2", title: "Sticky Fingers", artist: "Full Bloom", duration: "5:13" },
  { id: "b3a3264d-c26f-5ffe-b721-59d45684a51f", title: "4 Love", artist: "Nick Curly", duration: "6:56" },
  { id: "26999457-fe02-5f87-888b-a1bff3c2df21", title: "Unfinished", artist: "nthng", duration: "4:09" },
  { id: "78130a18-f58c-59a4-b6be-71a3b83ba26a", title: "Exos", artist: "Alex Niggemann", duration: "7:19" }
];

export const usePopularTracks = () => {
  const popularTracks = React.useMemo(() => POPULAR_TRACKS, []);

  return {
    popularTracks,
  } as const;
};
