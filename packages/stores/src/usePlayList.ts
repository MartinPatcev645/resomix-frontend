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
}

// Create the Zustand store
export const usePlaylistStore = create<PlaylistStore>((set) => ({
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
    } else {
      set({ error: 'Failed to load playlist data', playlistData: null })
    }
  },

  setTrackRating: (trackId, rating) => set((state) => ({ trackRatings: { ...state.trackRatings, [trackId]: rating } })),
  
  clearPlaylistData: () => set({ playlistData: null, error: null }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({ playlistData: null, isLoading: false, error: null, trackRatings: {} })
}))

// Export default store for convenience
export default usePlaylistStore
