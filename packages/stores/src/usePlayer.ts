import { create } from 'zustand'

interface PlayerStore {
  currentTrackId: string | null
  setCurrentTrack: (id: string | null) => void

  uploadedUrl: string | null
  setUploadedUrl: (url: string | null) => void

  /**
   * Input track WaveSurfer instance (always visible)
   */
  inputWs: any | null
  setInputWs: (ws: any | null) => void

  /**
   * Similarity track WaveSurfer instance (changes based on current track)
   */
  similarityWs: any | null
  setSimilarityWs: (ws: any | null) => void

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

  /**
   * Number of similar tracks to return (TOPSK parameter)
   */
  topSk: number
  setTopSk: (value: number) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrackId: null,
  setCurrentTrack: (id) => set({ currentTrackId: id }),

  uploadedUrl: null,
  setUploadedUrl: (url) => set({ uploadedUrl: url }),

  inputWs: null,
  setInputWs: (ws) => set((state) => {
    if (state.inputWs && state.inputWs !== ws) {
      try {
        state.inputWs.pause();
      } catch { /* ignore */ }
    }
    return { inputWs: ws };
  }),

  similarityWs: null,
  setSimilarityWs: (ws) => set((state) => {
    if (state.similarityWs && state.similarityWs !== ws) {
      try {
        state.similarityWs.pause();
      } catch { /* ignore */ }
    }
    return { similarityWs: ws };
  }),

  autoplay: false,
  setAutoplay: (value) => set({ autoplay: value }),

  volume: 0.7,
  setVolume: (value) => set({ volume: Math.min(1, Math.max(0, value)) }),

  topSk: 20,
  setTopSk: (value) => set({ topSk: value }),
}));

export default usePlayerStore
