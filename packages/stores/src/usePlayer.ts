import { create } from 'zustand'

interface PlayerStore {
  currentTrackId: string | null
  setCurrentTrack: (id: string | null) => void

  uploadedUrl: string | null
  setUploadedUrl: (url: string | null) => void

  currentWs: any | null
  /**
   * Register the WaveSurfer instance currently playing. When a new instance
   * is set, the previous one (if any) is automatically paused to prevent
   * overlapping audio.
   */
  setCurrentWs: (ws: any | null) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrackId: null,
  setCurrentTrack: (id) => set({ currentTrackId: id }),

  uploadedUrl: null,
  setUploadedUrl: (url) => set({ uploadedUrl: url }),

  currentWs: null,
  setCurrentWs: (ws) => set((state) => {
    console.log('[PlayerStore] setCurrentWs called - prev:', !!state.currentWs, 'new:', !!ws);
    if (state.currentWs && state.currentWs !== ws) {
      console.log('[PlayerStore] Pausing previous instance');
      try {
        if (state.currentWs.isPlaying && state.currentWs.isPlaying()) {
          console.log('[PlayerStore] Previous instance was playing, pausing it');
          state.currentWs.pause();
        } else {
          console.log('[PlayerStore] Previous instance was not playing');
        }
      } catch { /* ignore */ }
    }
    console.log('[PlayerStore] Setting new current WS');
    return { currentWs: ws };
  }),
}));

export default usePlayerStore;
