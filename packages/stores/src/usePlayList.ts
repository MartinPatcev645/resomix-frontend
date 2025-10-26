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
}

export interface Playlist {
  id: string
  name: string
  is_public: boolean
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

// Cache helper functions
const saveResponseToCache = (response: PlaylistResponse): void => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const playlistId = response.data.playlist.id
    if (!playlistId) {
      console.warn('Cannot cache playlist response: missing playlist ID');
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
    cachedPlaylists = cachedPlaylists.filter(p => 
      p?.data?.playlist?.id && p.data.playlist.id !== playlistId
    )
    
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
    const foundResponse = cachedPlaylists.find(p => 
      p?.data?.playlist?.id === targetId
    )
    
    // Validate the found response structure
    if (foundResponse && !foundResponse.data?.playlist?.id) {
      console.warn('Invalid cached response structure')
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
}

// Create the Zustand store
export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  // Initial state with default data
  playlistData: null,
  isLoading: false,
  error: null,
  trackRatings: {},
  
  // Actions
  setPlaylistData: (data) => set({ playlistData: data, error: null }),
  
  setPlaylistResponse: (response) => {
    if (response.success) {
      set({ playlistData: response.data, error: null })
      // Auto-save to cache when response is set
      get().saveResponseToCache(response)
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
  }
}))

// Note: We don't pre-hydrate the store with cached data on creation
// This prevents stale data from showing up when users navigate to new playlists
// Instead, the cache is only used when explicitly requested via loadCachedResponse()

// Export default store for convenience
export default usePlaylistStore
