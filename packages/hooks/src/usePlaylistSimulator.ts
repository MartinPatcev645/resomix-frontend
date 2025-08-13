import { useState, useEffect, useCallback } from 'react'
import { usePlaylistStore, PlaylistResponse } from '@resomix/stores'

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
      },
      {
        "rank": 3,
        "score": 0.94512345,
        "id": "67add9769387d00fbdc2dc3e",
        "title": "Neon Dreams",
        "year": 2024,
        "duration": 298,
        "label": "Techno Records",
        "artist": "Digital Pulse"
      },
      {
        "rank": 4,
        "score": 0.94298765,
        "id": "67add9769387d00fbdc2dc3f",
        "title": "Midnight Echo",
        "year": 2023,
        "duration": 312,
        "label": "Underground Sounds",
        "artist": "Echo Chamber"
      }
    ],
    "playlist": {
      "id": "7b821bef-e168-4511-8525-5e1664b7e483",
      "name": "Gregor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
    }
  }
}

interface UsePlaylistSimulatorOptions {
  delay?: number
  successRate?: number
  autoStart?: boolean
  interval?: number
}

/**
 * Hook that simulates playlist data feeding using the playlist store
 * 
 * @param options Configuration options for the simulator
 * @returns Object with control functions and current state
 */
export function usePlaylistSimulator(options: UsePlaylistSimulatorOptions = {}) {
  const {
    delay = 1500,
    successRate = 0.9,
    autoStart = false,
    interval = 5000
  } = options

  const { setLoading, setPlaylistResponse, setError, clearPlaylistData, isLoading, error, playlistData } = usePlaylistStore()
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationCount, setSimulationCount] = useState(0)

  // Simulate a single data load
  const simulateLoad = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, delay))

      // Simulate success/failure based on successRate
      const isSuccess = Math.random() < successRate

      if (isSuccess) {
        // Add some variation to the data
        const variedData = {
          ...samplePlaylistData,
          data: {
            ...samplePlaylistData.data,
            queried_track: {
              ...samplePlaylistData.data.queried_track,
              score: 0.95 + Math.random() * 0.05 // Vary score slightly
            },
            similar_tracks: samplePlaylistData.data.similar_tracks.map((track, index) => ({
              ...track,
              score: track.score + (Math.random() - 0.5) * 0.02 // Vary scores
            }))
          }
        }
        
        setPlaylistResponse(variedData)
        setSimulationCount(prev => prev + 1)
      } else {
        setPlaylistResponse({
          success: false,
          data: samplePlaylistData.data
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation error occurred')
    } finally {
      setLoading(false)
    }
  }, [delay, successRate, setLoading, setPlaylistResponse, setError])

  // Simulate continuous data feeding
  const startSimulation = useCallback(() => {
    setIsSimulating(true)
    simulateLoad()
  }, [simulateLoad])

  const stopSimulation = useCallback(() => {
    setIsSimulating(false)
  }, [])

  const resetSimulation = useCallback(() => {
    setIsSimulating(false)
    setSimulationCount(0)
    clearPlaylistData()
  }, [clearPlaylistData])

  // Auto-start simulation if enabled
  useEffect(() => {
    if (autoStart) {
      startSimulation()
    }
  }, [autoStart, startSimulation])

  // Continuous simulation effect
  useEffect(() => {
    if (!isSimulating) return

    const intervalId = setInterval(() => {
      simulateLoad()
    }, interval)

    return () => clearInterval(intervalId)
  }, [isSimulating, interval, simulateLoad])

  return {
    // Control functions
    simulateLoad,
    startSimulation,
    stopSimulation,
    resetSimulation,
    
    // State
    isSimulating,
    simulationCount,
    isLoading,
    error,
    playlistData,
    
    // Store actions
    clearPlaylistData
  }
}
