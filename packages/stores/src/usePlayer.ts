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

  /**
   * Global autoplay toggle. When true we automatically advance to the next
   * track once the current one finishes.
   */
  autoplay: boolean
  setAutoplay: (value: boolean) => void

  /**
   * Global volume (0..1)
   */
  volume: number
  setVolume: (value: number) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrackId: null,
  setCurrentTrack: (id) => set({ currentTrackId: id }),

  uploadedUrl: null,
  setUploadedUrl: (url) => set({ uploadedUrl: url }),

  currentWs: null,
  setCurrentWs: (ws) => set((state) => {
    if (state.currentWs && state.currentWs !== ws) {
      try {
        state.currentWs.pause();
      } catch { /* ignore */ }
    }
    return { currentWs: ws };
  }),

  autoplay: false,
  setAutoplay: (value) => set({ autoplay: value }),

  volume: 0.7,
  setVolume: (value) => set({ volume: Math.min(1, Math.max(0, value)) }),
}));

export default usePlayerStore;
