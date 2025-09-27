import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { usePlayerStore } from '@resomix/stores';
import { getOrCreateAudioController, AudioController } from "./HlsPlaylistController";

const AudioCtx = createContext<AudioController | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const controller = useMemo(() => getOrCreateAudioController(), []);

  // Publish controller to zustand AFTER initial render to avoid 'setState in render' issues.
  useEffect(() => {
    usePlayerStore.getState().setAudioController(controller);
  }, [controller]);
  return <AudioCtx.Provider value={controller}>{children}</AudioCtx.Provider>;
}

export function useGlobalAudioController(): AudioController {
  const ctx = useContext(AudioCtx);
  if (!ctx) {
    throw new Error('AudioProvider is missing in the tree');
  }
  return ctx;
}
