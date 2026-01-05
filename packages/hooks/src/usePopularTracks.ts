import React from "react";
import type { SearchResult } from "./useSearch";

const POPULAR_TRACKS: SearchResult[] = [
  { id: "bb9e0241-3ccc-4098-9b86-c25647fdc0b7", title: "Harry McFly", artist: "Lomov", duration: "5:45" },
  { id: "7923b7c9-8e43-488c-a1d6-66814cd52e14", title: "About To Do It", artist: "Bobby Marleni", duration: "5:16" },
  { id: "f726bc72-427c-4c7d-8032-745a040a5cd8", title: "Deelites", artist: "Bobby Marleni", duration: "6:52" },
  { id: "e2b9e15e-fd94-4df8-9ea5-517999f06a5d", title: "Hi-4", artist: "Superbus feat. Loop Loops Clan", duration: "6:09" },
  { id: "ea3f8387-5f26-43bf-b181-f0ac6ba3c5ca", title: "Cry Over You", artist: "Psychadelik Pedestrian", duration: "8:03" }
];

export const usePopularTracks = () => {
  const popularTracks = React.useMemo(() => POPULAR_TRACKS, []);

  return {
    popularTracks,
  } as const;
};
