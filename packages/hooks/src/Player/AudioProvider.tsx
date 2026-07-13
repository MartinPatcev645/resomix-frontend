import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { usePlayerStore } from '@resomix/stores';
import { getOrCreateAudioController, AudioController } from "./HlsPlaylistController";

const AudioCtx = createContext<AudioController | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const controller = useMemo(() => getOrCreateAudioController(), []);

  // Publish controller to zustand AFTER initial render to avoid 'setState in render' issues.
  useEffect(() => {
    usePlayerStore.getState().setAudioController(controller);
    // When the playlist page unmounts (user navigates away, e.g. Back to Library), stop the audio
    // and tear down the HLS stream + its retry/cold-retry timers. Without this the global singleton
    // keeps the <audio> playing and keeps firing HLS segment/session/retry requests in the
    // background. unload() leaves the (singleton) controller reusable — StrictMode-safe, and the
    // next visit simply re-loads it — so we don't detach global listeners or drop the singleton.
    return () => {
      try { controller.unload(); } catch { /* noop */ }
    };
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
