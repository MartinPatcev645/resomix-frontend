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
  try {
    const playlistId = response.data.playlist.id
    const lastAccessedId = localStorage.getItem('lastAccessedPlaylist')
    const cachedPlaylistsStr = localStorage.getItem('playlistsBackup')
    
    let cachedPlaylists: PlaylistResponse[] = []
    if (cachedPlaylistsStr) {
      try {
        cachedPlaylists = JSON.parse(cachedPlaylistsStr)
      } catch {
        cachedPlaylists = []
      }
    }
    
    // Remove existing response with same ID if it exists
    cachedPlaylists = cachedPlaylists.filter(p => p.data.playlist.id !== playlistId)
    
    // Add new response
    cachedPlaylists.push(response)
    
    // Keep only last 2 responses
    if (cachedPlaylists.length > 2) {
      cachedPlaylists = cachedPlaylists.slice(-2)
    }
    
    // Update localStorage
    localStorage.setItem('lastAccessedPlaylist', playlistId)
    localStorage.setItem('playlistsBackup', JSON.stringify(cachedPlaylists))
  } catch (error) {
    console.warn('Failed to save playlist to cache:', error)
  }
}

const loadCachedResponse = (id?: string): PlaylistResponse | null => {
  try {
    const targetId = id || localStorage.getItem('lastAccessedPlaylist')
    if (!targetId) return null
    
    const cachedPlaylistsStr = localStorage.getItem('playlistsBackup')
    if (!cachedPlaylistsStr) return null
    
    const cachedPlaylists: PlaylistResponse[] = JSON.parse(cachedPlaylistsStr)
    const foundResponse = cachedPlaylists.find(p => p.data.playlist.id === targetId)
    
    return foundResponse || null
  } catch (error) {
    console.warn('Failed to load playlist from cache:', error)
    return null
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
  loadCachedResponse
}))

// Pre-hydrate store with cached data on creation
const cachedResponse = loadCachedResponse()
if (cachedResponse) {
  usePlaylistStore.getState().setPlaylistData(cachedResponse.data)
}

// Export default store for convenience
export default usePlaylistStore
