import { create } from 'zustand'

// TypeScript interfaces for playlist data structure
export interface Track {
  rank: number
  score: number
  id: string
  title: string
  year: number | null
  duration: number
  label: string
  artist: string
  type: 'upload' | 'internal'
  // Playback engine for this track (see docs PLAYBACK_APPLE_MUSIC_PLAN.md):
  //   'hls'     → the user's own upload; streamed via hls.js from our media server (with peaks).
  //   'preview' → a catalogue track; played from the Apple Music `preview_url` (a plain <audio> src).
  // Absent on older responses → treat as 'hls' for uploads, 'preview' otherwise.
  playback?: 'hls' | 'preview'
  // Apple Music fields (present when playback === 'preview'). `artist`/`title` stay in-house;
  // album/genre come from Apple with an in-house fallback (merged server-side).
  preview_url?: string | null
  artwork_url?: string | null
  deep_link_url?: string | null
  apple_song_id?: string | null
  album?: string | null
  genre?: string | null
}

export interface Playlist {
  id: string
  name: string
  is_public: boolean
  // Caller's engagement with this playlist (present for logged-in users; guests always see false).
  is_favorite?: boolean
  // True → a custom cover was uploaded; the UI fetches it from the media server by playlist uuid
  // (else it falls back to the seed track cover, then the bundled default).
  has_custom_cover?: boolean
  // True only when the current caller owns this playlist — drives owner-only affordances like the
  // cover pen icon. The backend still enforces owner-only on every mutating endpoint.
  is_owner?: boolean
}

export interface PlaylistData {
  queried_track: Track
  similar_tracks: Track[]
  playlist: Playlist
}

export interface PlaylistResponse {
  success: boolean
  data: PlaylistData
}

// Helper function to synthesize a virtual playlist if missing but queried_track is present
const ensurePlaylistObject = (data: PlaylistData): PlaylistData => {
  if (!data) return data;
  if (!data.playlist && data.queried_track) {
    return {
      ...data,
      playlist: {
        id: data.queried_track.id,
        name: `${data.queried_track.artist} - ${data.queried_track.title}`,
        is_public: true,
      }
    };
  }
  return data;
};

// Cache helper functions.
// The full playlist localStorage cache was REMOVED (2026-07): it could serve a stale guest/preview
// copy after login — e.g. the first tracks correct but later ones still showing the backend's
// scrambled "demo" teaser — because the cached anonymous response shadowed the fresh, full playlist.
// The playlist view now always fetches fresh from the backend (the browser's own HTTP caching still
// applies). These stay as no-ops so callers don't change; clearCache() below still purges any legacy
// `playlistsBackup` / `lastAccessedPlaylist` entries the old cache left in localStorage.
const saveResponseToCache = (_response: PlaylistResponse): void => {
  // no-op — full playlist responses are no longer persisted to localStorage.
};

const loadCachedResponse = (_id?: string): PlaylistResponse | null => {
  // no-op — always fetch fresh from the backend.
  return null;
};

const clearCache = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem('playlistsBackup')
    window.localStorage.removeItem('lastAccessedPlaylist')
  } catch (error) {
    console.warn('Failed to clear playlist cache:', error)
  }
}

// Zustand store interface
interface PlaylistStore {
  // State
  playlistData: PlaylistData | null
  isLoading: boolean
  error: string | null
  trackRatings: Record<string, number>

  // Actions
  setPlaylistData: (data: PlaylistData) => void
  setPlaylistResponse: (response: PlaylistResponse) => void
  setTrackRating: (trackId: string, rating: number) => void
  clearPlaylistData: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  // Cache actions
  saveResponseToCache: (response: PlaylistResponse) => void
  loadCachedResponse: (id?: string) => PlaylistResponse | null
  clearCache: () => void
  // Utility to check if current data matches URL context
  validateCurrentData: () => boolean
  // Update is_public flag in both state and cache
  updatePlaylistPublicStatus: (isPublic: boolean) => void
  // Update is_favorite flag in both state and cache
  updatePlaylistFavoriteStatus: (isFavorite: boolean) => void
  // Flip has_custom_cover after a successful cover upload (so the hero re-fetches the new cover)
  updatePlaylistCustomCover: (hasCustomCover: boolean) => void
}

// Create the Zustand store
export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  // Initial state with default data
  playlistData: null,
  isLoading: false,
  error: null,
  trackRatings: {},

  // Actions
  setPlaylistData: (data) => {
    const processedData = ensurePlaylistObject({ ...data });
    set({
      playlistData: processedData,
      error: null
    });
  },

  setPlaylistResponse: (response) => {
    if (response.success) {
      const processedData = ensurePlaylistObject({ ...response.data });
      set({ playlistData: processedData, error: null })
    } else {
      set({ error: 'Failed to load playlist data', playlistData: null })
    }
  },

  setTrackRating: (trackId, rating) => set((state) => ({ trackRatings: { ...state.trackRatings, [trackId]: rating } })),

  clearPlaylistData: () => set({ playlistData: null, error: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set({ playlistData: null, isLoading: false, error: null, trackRatings: {} }),

  // Cache actions
  saveResponseToCache,
  loadCachedResponse,
  clearCache,

  // Utility to check if current data matches URL context
  validateCurrentData: () => {
    const state = get()
    if (!state.playlistData?.playlist?.id) return true // No data to validate

    // Check if current playlist ID matches URL parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlId = params.get('id')

      // If URL has an ID, it should match current data
      if (urlId && urlId !== state.playlistData.playlist.id) {
        return false
      }
    }

    return true
  },

  // Update is_public flag on the in-memory playlist (no localStorage cache anymore).
  updatePlaylistPublicStatus: (isPublic: boolean) => {
    const state = get()
    if (!state.playlistData || !state.playlistData.playlist) return

    set({
      playlistData: {
        ...state.playlistData,
        playlist: {
          ...state.playlistData.playlist,
          is_public: isPublic
        }
      }
    })
  },

  // Update is_favorite flag on the in-memory playlist (no localStorage cache anymore).
  updatePlaylistFavoriteStatus: (isFavorite: boolean) => {
    const state = get()
    if (!state.playlistData || !state.playlistData.playlist) return

    set({
      playlistData: {
        ...state.playlistData,
        playlist: {
          ...state.playlistData.playlist,
          is_favorite: isFavorite,
        },
      },
    })
  },

  // Flip has_custom_cover on the in-memory playlist after a successful upload.
  updatePlaylistCustomCover: (hasCustomCover: boolean) => {
    const state = get()
    if (!state.playlistData || !state.playlistData.playlist) return

    set({
      playlistData: {
        ...state.playlistData,
        playlist: {
          ...state.playlistData.playlist,
          has_custom_cover: hasCustomCover,
        },
      },
    })
  }
}))

// Note: We don't pre-hydrate the store with cached data on creation
// This prevents stale data from showing up when users navigate to new playlists
// Instead, the cache is only used when explicitly requested via loadCachedResponse()

/**
 * Remove ALL cached playlist responses (both localStorage keys). Called on auth transitions
 * (login / logout) so a previous identity's — or a guest's — cached playlists never leak to the
 * next user on the same browser. Fresh data is refetched from the backend on demand.
 */
export const clearAllPlaylistCache = (): void => clearCache();

export const clearPlaylistFromCache = (playlistId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const lastAccessed = window.localStorage.getItem('lastAccessedPlaylist');
    if (lastAccessed === playlistId) {
      window.localStorage.removeItem('lastAccessedPlaylist');
    }

    const cachedPlaylistsStr = window.localStorage.getItem('playlistsBackup');
    if (cachedPlaylistsStr) {
      let cachedPlaylists: PlaylistResponse[] = JSON.parse(cachedPlaylistsStr);
      if (Array.isArray(cachedPlaylists)) {
        cachedPlaylists = cachedPlaylists.filter(p => {
          const id = p?.data?.playlist?.id || p?.data?.queried_track?.id;
          return id !== playlistId;
        });

        if (cachedPlaylists.length === 0) {
          window.localStorage.removeItem('playlistsBackup');
        } else {
          window.localStorage.setItem('playlistsBackup', JSON.stringify(cachedPlaylists));
        }
      }
    }
  } catch (error) {
    console.warn('Failed to clear playlist from cache:', error);
  }
};

// Export default store for convenience
export default usePlaylistStore;
