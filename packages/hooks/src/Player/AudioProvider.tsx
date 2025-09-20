import React, { createContext, useContext, useMemo } from 'react';
import { getOrCreateAudioController, AudioController } from "./HlsPlaylistController";

const AudioCtx = createContext<AudioController | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const controller = useMemo(() => getOrCreateAudioController(), []);
  return <AudioCtx.Provider value={controller}>{children}</AudioCtx.Provider>;
}

export function useGlobalAudioController(): AudioController {
  const ctx = useContext(AudioCtx);
  if (!ctx) {
    throw new Error('AudioProvider is missing in the tree');
  }
  return ctx;
}
