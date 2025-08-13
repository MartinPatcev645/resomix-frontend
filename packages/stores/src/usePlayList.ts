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
  
  // Actions
  setPlaylistData: (data: PlaylistData) => void
  setPlaylistResponse: (response: PlaylistResponse) => void
  clearPlaylistData: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

// Sample data to store
const defaultPlaylistData: PlaylistData = {
  "queried_track": {
    "rank": 0,
    "score": 1.0,
    "id": "1a9983daf38caac5a8e8adaf",
    "title": "Ursa Minor (Marcel Dettmann Remix)",
    "year": 2025,
    "duration": 271,
    "label": "Break New Soil Recordings",
    "artist": "Gregor Tresher, Petar Dundov"
  },
  "similar_tracks": [
    {
      "rank": 1,
      "score": 0.95250189,
      "id": "67adb0d5799206f8d65102a8",
      "title": "Chapter 1",
      "year": 2023,
      "duration": 301,
      "label": "Abstract Mechanisms",
      "artist": "Møntero"
    },
    {
      "rank": 2,
      "score": 0.94865525,
      "id": "67add9769387d00fbdc2dc3d",
      "title": "Opto",
      "year": null,
      "duration": 335,
      "label": "Balance Music",
      "artist": "Etapp Kyle"
    }
  ],
  "playlist": {
    "id": "7b821bef-e168-4511-8525-5e1664b7e483",
    "name": "Gregor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
  }
}

// Create the Zustand store
export const usePlaylistStore = create<PlaylistStore>((set) => ({
  // Initial state with default data
  playlistData: defaultPlaylistData,
  isLoading: false,
  error: null,
  
  // Actions
  setPlaylistData: (data) => set({ playlistData: data, error: null }),
  
  setPlaylistResponse: (response) => {
    if (response.success) {
      set({ playlistData: response.data, error: null })
    } else {
      set({ error: 'Failed to load playlist data', playlistData: null })
    }
  },
  
  clearPlaylistData: () => set({ playlistData: null, error: null }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({ playlistData: defaultPlaylistData, isLoading: false, error: null })
}))

// Export default store for convenience
export default usePlaylistStore

// Sample data for simulation
const samplePlaylistData: PlaylistResponse = {
  "success": true,
  "data": {
    "queried_track": {
      "rank": 0,
      "score": 1.0,
      "id": "1a9983daf38caac5a8e8adaf",
      "title": "Ursa Minor (Marcel Dettmann Remix)",
      "year": 2025,
      "duration": 271,
      "label": "Break New Soil Recordings",
      "artist": "Gregor Tresher, Petar Dundov"
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.95250189,
        "id": "67adb0d5799206f8d65102a8",
        "title": "Chapter 1",
        "year": 2023,
        "duration": 301,
        "label": "Abstract Mechanisms",
        "artist": "Møntero"
      },
      {
        "rank": 2,
        "score": 0.94865525,
        "id": "67add9769387d00fbdc2dc3d",
        "title": "Opto",
        "year": null,
        "duration": 335,
        "label": "Balance Music",
        "artist": "Etapp Kyle"
      }
    ],
    "playlist": {
      "id": "7b821bef-e168-4511-8525-5e1664b7e483",
      "name": "Gregor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
    }
  }
}

/**
 * Hook to simulate loading playlist data into the store
 * 
 * @param delay - Delay in milliseconds before resolving (default: 1500ms)
 * @param successRate - Probability of success (0-1, default: 0.9)
 * @returns Object with simulateLoad function and current state
 */
export function useSimulatePlaylistLoad(delay: number = 1500, successRate: number = 0.9) {
  const { setLoading, setPlaylistResponse, setError, isLoading, error, playlistData } = usePlaylistStore()

  const simulateLoad = async () => {
    setLoading(true)
    setError(null)

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, delay))

      // Simulate success/failure based on successRate
      const isSuccess = Math.random() < successRate

      if (isSuccess) {
        setPlaylistResponse(samplePlaylistData)
      } else {
        setPlaylistResponse({
          success: false,
          data: samplePlaylistData.data // This will be ignored due to success: false
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const simulateError = async () => {
    setLoading(true)
    setError(null)

    try {
      await new Promise(resolve => setTimeout(resolve, delay))
      throw new Error('Simulated network error')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const clearData = () => {
    usePlaylistStore.getState().clearPlaylistData()
  }

  return {
    simulateLoad,
    simulateError,
    clearData,
    isLoading,
    error,
    playlistData
  }
}
