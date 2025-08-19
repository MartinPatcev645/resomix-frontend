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

/**
 * Cookie helpers — allow sharing settings across sub-domains.
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 365): void {
  if (typeof document === 'undefined') return;
  const domain = (() => {
    const host = window.location.hostname;
    // Skip domain attribute for localhost-style hosts
    if (/^(localhost|127\.0\.0\.1)$/.test(host)) return '';
    const parts = host.split('.');
    const root = parts.slice(-2).join('.');
    return `; domain=.${root}`;
  })();

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}${domain}; SameSite=Lax`;
}

function getStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    // 1) Attempt localStorage first
    const rawLocal = window.localStorage.getItem(key);
    if (rawLocal !== null) return JSON.parse(rawLocal) as T;

    // 2) Fallback to cookie (cross-subdomain)
    const rawCookie = getCookie(key);
    if (rawCookie !== null) {
      const parsed = JSON.parse(rawCookie) as T;
      // Sync back to localStorage for current origin
      window.localStorage.setItem(key, rawCookie);
      return parsed;
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
    setCookie(key, serialized);
  } catch {
    /* ignore storage errors */
  }
}

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
}));

export default usePlayerStore
