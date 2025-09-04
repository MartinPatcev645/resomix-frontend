import { create } from 'zustand'

/**
 * Utility helpers for syncing specific player settings with browser localStorage.
 * These helpers are **no-ops** when executed in a non-browser environment (SSR).
 */

const STORAGE_KEYS = {
  autoplay: 'resomix.player.autoplay',
  volume: 'resomix.player.volume',
  topSk: 'resomix.player.topSk',
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

  /** Current playback position (seconds) of the similarity waveform */
  similarityCurrentTime: number
  /** Setter for similarityCurrentTime */
  setSimilarityCurrentTime: (time: number) => void

  /** Provider readiness states (BeMusic pattern) */
  inputProviderReady: boolean
  setInputProviderReady: (ready: boolean) => void

  similarityProviderReady: boolean
  setSimilarityProviderReady: (ready: boolean) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrackId: null,
  setCurrentTrack: (id) => set({ currentTrackId: id }),

  uploadedUrl: null,
  setUploadedUrl: (url) => set({ uploadedUrl: url }),

  uploadedCoverArt: null,
  setUploadedCoverArt: (coverUrl) => set({ uploadedCoverArt: coverUrl }),

  howlerController: null,
  setHowlerController: (controller) => set({ howlerController: controller }),

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

  similarityCurrentTime: 0,
  setSimilarityCurrentTime: (time) => set({ similarityCurrentTime: time }),

  // Provider readiness states (BeMusic pattern)
  inputProviderReady: false,
  setInputProviderReady: (ready) => set({ inputProviderReady: ready }),

  similarityProviderReady: false,
  setSimilarityProviderReady: (ready) => set({ similarityProviderReady: ready }),
}));

export default usePlayerStore
