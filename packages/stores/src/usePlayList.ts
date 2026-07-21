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

// --- Demo/anon redaction detection ----------------------------------------
// The backend scrambles similar-track metadata past the anonymous preview limit: track ids become a
// repeating "dEm0" pattern and text fields become "demo…". We must never persist or reuse that
// scrambled copy — otherwise a user who later logs in (and would receive the FULL playlist) keeps
// seeing the cached teaser. Detect it deterministically via the id mask.
const REDACTION_ID_PATTERN = 'dEm0';

const isMaskedTrackId = (id: unknown): boolean => {
  if (typeof id !== 'string' || id.length < REDACTION_ID_PATTERN.length) return false;
  for (let i = 0; i < id.length; i++) {
    if (id[i] !== REDACTION_ID_PATTERN[i % REDACTION_ID_PATTERN.length]) return false;
  }
  return true;
};

const isRedactedResponse = (response?: PlaylistResponse | null): boolean => {
  const tracks = response?.data?.similar_tracks;
  if (!Array.isArray(tracks)) return false;
  return tracks.some((t) => isMaskedTrackId(t?.id));
};

// Cache helper functions
const saveResponseToCache = (response: PlaylistResponse): void => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const playlistId = response.data?.playlist?.id || response.data?.queried_track?.id;
    if (!playlistId) {
      console.warn('Cannot cache playlist response: missing playlist ID');
      return;
    }

    // Never cache a redacted (anonymous preview) response — it would shadow the full playlist the
    // user receives after logging in. Any existing full cache entry for this id is left untouched.
    if (isRedactedResponse(response)) {
      return;
    }

    const cachedPlaylistsStr = window.localStorage.getItem('playlistsBackup')

    let cachedPlaylists: PlaylistResponse[] = []
    if (cachedPlaylistsStr) {
      try {
        cachedPlaylists = JSON.parse(cachedPlaylistsStr)
        // Validate that it's an array
        if (!Array.isArray(cachedPlaylists)) {
          cachedPlaylists = []
        }
      } catch {
        cachedPlaylists = []
      }
    }

    // Remove existing response with same ID if it exists
    cachedPlaylists = cachedPlaylists.filter(p => {
      const id = p?.data?.playlist?.id || p?.data?.queried_track?.id;
      return id && id !== playlistId;
    })

    // Add new response to the end (most recent)
    cachedPlaylists.push(response)

    // Keep only last 2 responses
    if (cachedPlaylists.length > 2) {
      cachedPlaylists = cachedPlaylists.slice(-2)
    }

    // Update localStorage - store the most recent playlist ID separately
    window.localStorage.setItem('lastAccessedPlaylist', playlistId)
    window.localStorage.setItem('playlistsBackup', JSON.stringify(cachedPlaylists))
  } catch (error) {
    console.warn('Failed to save playlist to cache:', error)
    // On iOS Safari in private mode, localStorage can throw errors
    // Clear potentially corrupted data
    try {
      window.localStorage.removeItem('playlistsBackup')
      window.localStorage.removeItem('lastAccessedPlaylist')
    } catch {
      // Ignore cleanup errors
    }
  }
}

const loadCachedResponse = (id?: string): PlaylistResponse | null => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    // If specific ID is requested, use that; otherwise get the last accessed one
    const targetId = id || window.localStorage.getItem('lastAccessedPlaylist')
    if (!targetId) return null

    const cachedPlaylistsStr = window.localStorage.getItem('playlistsBackup')
    if (!cachedPlaylistsStr) return null

    const cachedPlaylists: PlaylistResponse[] = JSON.parse(cachedPlaylistsStr)

    // Validate the cached data structure
    if (!Array.isArray(cachedPlaylists)) {
      console.warn('Invalid cached playlists data, clearing cache')
      window.localStorage.removeItem('playlistsBackup')
      window.localStorage.removeItem('lastAccessedPlaylist')
      return null
    }

    // Find the response with matching ID
    const foundResponse = cachedPlaylists.find(p => {
      const pId = p?.data?.playlist?.id || p?.data?.queried_track?.id;
      return pId === targetId;
    })

    // Validate the found response structure
    if (foundResponse && !foundResponse.data?.playlist?.id && !foundResponse.data?.queried_track?.id) {
      console.warn('Invalid cached response structure')
      return null
    }

    // Defensive: ignore any redacted entry cached before this guard existed so a logged-in user
    // gets a fresh (full) playlist from the backend instead of the stale anonymous teaser.
    if (foundResponse && isRedactedResponse(foundResponse)) {
      return null
    }

    return foundResponse || null
  } catch (error) {
    console.warn('Failed to load playlist from cache:', error)
    // Clear potentially corrupted cache on error
    try {
      window.localStorage.removeItem('playlistsBackup')
      window.localStorage.removeItem('lastAccessedPlaylist')
    } catch {
      // Ignore cleanup errors
    }
    return null
  }
}

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
      // Auto-save to cache when response is set
      get().saveResponseToCache({ ...response, data: processedData })
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

  // Update is_public flag in both state and localStorage cache
  updatePlaylistPublicStatus: (isPublic: boolean) => {
    const state = get()
    if (!state.playlistData || !state.playlistData.playlist) return

    const playlistId = state.playlistData.playlist.id

    // Update Zustand state
    const updatedPlaylistData = {
      ...state.playlistData,
      playlist: {
        ...state.playlistData.playlist,
        is_public: isPublic
      }
    }
    set({ playlistData: updatedPlaylistData })

    // Update localStorage cache
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedPlaylistsStr = window.localStorage.getItem('playlistsBackup')
        if (cachedPlaylistsStr) {
          const cachedPlaylists: PlaylistResponse[] = JSON.parse(cachedPlaylistsStr)

          const updatedPlaylists = cachedPlaylists.map(p => {
            if (p?.data?.playlist?.id === playlistId) {
              return {
                ...p,
                data: {
                  ...p.data,
                  playlist: {
                    ...p.data.playlist,
                    is_public: isPublic
                  }
                }
              }
            }
            return p
          })

          window.localStorage.setItem('playlistsBackup', JSON.stringify(updatedPlaylists))
        }
      } catch (error) {
        console.warn('Failed to update is_public in cache:', error)
      }
    }
  },

  // Update is_favorite flag in both Zustand state and the localStorage cache, so the heart stays
  // correct across the current view and any later navigation back to this playlist.
  updatePlaylistFavoriteStatus: (isFavorite: boolean) => {
    const state = get()
    if (!state.playlistData || !state.playlistData.playlist) return

    const playlistId = state.playlistData.playlist.id

    set({
      playlistData: {
        ...state.playlistData,
        playlist: {
          ...state.playlistData.playlist,
          is_favorite: isFavorite,
        },
      },
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedPlaylistsStr = window.localStorage.getItem('playlistsBackup')
        if (cachedPlaylistsStr) {
          const cachedPlaylists: PlaylistResponse[] = JSON.parse(cachedPlaylistsStr)
          const updatedPlaylists = cachedPlaylists.map(p => {
            if (p?.data?.playlist?.id === playlistId) {
              return {
                ...p,
                data: {
                  ...p.data,
                  playlist: {
                    ...p.data.playlist,
                    is_favorite: isFavorite,
                  },
                },
              }
            }
            return p
          })
          window.localStorage.setItem('playlistsBackup', JSON.stringify(updatedPlaylists))
        }
      } catch (error) {
        console.warn('Failed to update is_favorite in cache:', error)
      }
    }
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
