import { create } from 'zustand'

/**
 * Utility helpers for syncing specific player settings with browser localStorage.
 * These helpers are **no-ops** when executed in a non-browser environment (SSR).
 */

const STORAGE_KEYS = {
  autoplay: 'resomix.player.autoplay',
  volume: 'resomix.player.volume',
  topSk: 'resomix.player.topSk',
  trackTimes: 'resomix.player.trackTimes'
} as const;

// NOTE: Settings are now stored only in browser localStorage.
function getStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch {
    /* ignore JSON / storage errors */
  }

  // Persist default if we found nothing
  setStoredValue(key, defaultValue);
  return defaultValue;
}

function setStoredValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
  } catch {
    /* ignore storage errors */
  }
}

interface PlayerStore {
  currentTrackId: string | null
  setCurrentTrack: (id: string | null) => void

  uploadedUrl: string | null
  setUploadedUrl: (url: string | null) => void

  uploadedCoverArt: string | null
  setUploadedCoverArt: (coverUrl: string | null) => void

  /**
   * Howler controller instance for managing audio playback
   */
  howlerController: any | null
  setHowlerController: (controller: any | null) => void

  audioController: any | null
  setAudioController: (controller: any | null) => void

  /**
   * HTML audio element from Howler for Peaks.js integration
   */
  audioNode: HTMLAudioElement | null
  setAudioNode: (node: HTMLAudioElement | null) => void

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
  /** Current playback position (seconds) of the main input waveform */
  inputCurrentTime: number
  /** Setter for inputCurrentTime */
  setInputCurrentTime: (time: number) => void

  isLoaded: boolean
  setIsLoaded: (loaded: boolean) => void

  isPlaying: boolean
  setIsPlaying: (isPlaying: boolean) => void

  /** Current playback position (seconds) of the similarity waveform */
  similarityCurrentTime: number
  /** Setter for similarityCurrentTime */
  setSimilarityCurrentTime: (time: number) => void

  trackTimes: Record<string, number>
  setTrackTime: (trackId: string, time: number) => void
  getTrackTime: (trackId: string) => number
  removeTrackTime: (trackId: string) => void
  clearTrackTimes: () => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrackId: null,
  setCurrentTrack: (id) => {
    console.log('[usePlayerStore] currentTrackId', id);
    set({ currentTrackId: id });
  },

  uploadedUrl: null,
  setUploadedUrl: (url) => set({ uploadedUrl: url }),

  uploadedCoverArt: null,
  setUploadedCoverArt: (coverUrl) => set({ uploadedCoverArt: coverUrl }),

  howlerController: null,
  setHowlerController: (controller) =>
    set((state) => state.howlerController ? state : { howlerController: controller }),

  audioController: null,
  setAudioController: (controller) =>
    set((state) => state.audioController ? state : { audioController: controller }),

  audioNode: null,
  setAudioNode: (node) => set({ audioNode: node }),

  autoplay: getStoredValue<boolean>(STORAGE_KEYS.autoplay, false),
  setAutoplay: (value) =>
    set(() => {
      setStoredValue(STORAGE_KEYS.autoplay, value);
      return { autoplay: value };
    }),

  volume: getStoredValue<number>(STORAGE_KEYS.volume, 0.7),
  setVolume: (value) =>
    set(() => {
      const clamped = Math.min(1, Math.max(0, value));
      setStoredValue(STORAGE_KEYS.volume, clamped);
      return { volume: clamped };
    }),

  topSk: getStoredValue<number>(STORAGE_KEYS.topSk, 20),
  setTopSk: (value) =>
    set(() => {
      setStoredValue(STORAGE_KEYS.topSk, value);
      return { topSk: value };
    }),

  // --- Real-time playback positions ---------------------------------------

  inputCurrentTime: 0,
  setInputCurrentTime: (time) => set({ inputCurrentTime: time }),

  isLoaded: false,
  setIsLoaded: (loaded: boolean) => set({ isLoaded: loaded }),

  isPlaying: false,
  setIsPlaying: (val: boolean) => set({ isPlaying: val }),

  similarityCurrentTime: 0,
  setSimilarityCurrentTime: (time) => set({ similarityCurrentTime: time }),

  trackTimes: getStoredValue<Record<string, number>>(STORAGE_KEYS.trackTimes, {}),
  setTrackTime: (trackId, time) =>
    set((state) => {
      const next = { ...state.trackTimes, [trackId]: time }
      setStoredValue(STORAGE_KEYS.trackTimes, next)
      return { trackTimes: next }
    }),

  getTrackTime: (trackId) => {
    if (!trackId) return 0;
    const t = get().trackTimes[trackId]
    return typeof t === 'number' ? t : 0
  },

  removeTrackTime: (trackId) =>
    set((state) => {
      const next = { ...state.trackTimes }
      delete next[trackId]
      setStoredValue(STORAGE_KEYS.trackTimes, next)
      return { trackTimes: next }
    }),

  clearTrackTimes: () =>
    set(() => {
      setStoredValue(STORAGE_KEYS.trackTimes, {})
      return { trackTimes: {} }
    }),
}));

export default usePlayerStore
