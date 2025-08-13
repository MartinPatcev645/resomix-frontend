import { usePlaylistStore, PlaylistData } from '@resomix/stores'
import { useCallback } from 'react'

// Dummy data in the hook
const dummyPlaylistData: PlaylistData = {
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


const generateShareLink = (id: string): string => {
  return `https://beta.resomix.com/playlist-share?id=${id}`;
};


/**
 * Simple hook to load dummy data into store and get playlist data
 * @returns playlist data and load function
 */
export function useSimplePlaylist() {
  const { 
    playlistData, 
    isLoading, 
    error, 
    setPlaylistData, 
    setLoading, 
    setError 
  } = usePlaylistStore()
  
  // Function to load dummy data into store - memoized to prevent infinite loops
  const loadDummyData = useCallback(() => {
    setLoading(true)
    setError(null)
    
    // Simulate loading
    setTimeout(() => {
      setPlaylistData(dummyPlaylistData)
      setLoading(false)
    }, 1000)
  }, [setPlaylistData, setLoading, setError])
  
  return {
    // Data
    playlistData,
    isLoading,
    error,
    generateShareLink,
    // Actions
    loadDummyData
  }
}
