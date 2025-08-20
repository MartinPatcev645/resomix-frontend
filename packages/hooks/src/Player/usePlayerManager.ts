import { useCallback, useMemo, useEffect } from 'react'
import { usePlaylistStore } from '@resomix/stores'
import { usePlayerStore } from '@resomix/stores'

/**
 * Hook for managing audio player functionality across the application
 * Integrates with playlist store and player store to provide centralized playback control
 */
export const usePlayerManager = () => {
  const { playlistData, trackRatings } = usePlaylistStore()
  const { 
    currentTrackId, 
    setCurrentTrack, 
    inputWs, 
    similarityWs,
    setInputWs,
    setSimilarityWs,
    autoplay,
    setAutoplay,
    volume,
    setVolume,
    topSk,
    setTopSk
  } = usePlayerStore()

  // Keep WaveSurfer instances volume in sync with global volume
  useEffect(() => {
    if (inputWs && typeof inputWs.setVolume === 'function') {
      try {
        inputWs.setVolume(volume)
      } catch {}
    }
  }, [inputWs, volume])

  useEffect(() => {
    if (similarityWs && typeof similarityWs.setVolume === 'function') {
      try {
        similarityWs.setVolume(volume)
      } catch {}
    }
  }, [similarityWs, volume])

  // Get all track IDs from the playlist in order (queried track first, then similar tracks)
  const allTrackIds = useMemo(() => {
    if (!playlistData) return []
    
    const trackIds: string[] = []
    
    // Add queried track first if it exists
    if (playlistData.queried_track?.id) {
      trackIds.push(playlistData.queried_track.id)
    }
    
    // Add similar tracks
    if (playlistData.similar_tracks?.length) {
      trackIds.push(...playlistData.similar_tracks.map(track => track.id))
    }
    
    return trackIds
  }, [playlistData])

  // Get current track index in the playlist
  const currentTrackIndex = useMemo(() => {
    if (!currentTrackId) return -1
    
    // If it's 'uploaded-local', it's not in the playlist (local upload)
    if (currentTrackId === 'uploaded-local') return -1
    
    // Check if it's in the playlist (including queried track)
    const index = allTrackIds.indexOf(currentTrackId)
    return index !== -1 ? index : -1
  }, [currentTrackId, allTrackIds])

  // Get current playing track data
  const currentPlayingTrack = useMemo(() => {
    if (!currentTrackId || !playlistData) return null
    
    // Check if it's the queried track
    if (playlistData.queried_track?.id === currentTrackId) {
      return playlistData.queried_track
    }
    
    // Check if it's a similar track
    return playlistData.similar_tracks?.find(track => track.id === currentTrackId) || null
  }, [currentTrackId, playlistData])

  // Get the next track ID that should play
  const getNextTrack = useCallback(() => {
    // If no current track, start with first available track
    if (!currentTrackId) {
      return allTrackIds.length > 0 ? allTrackIds[0] : null
    }
    
    // If playing uploaded-local, move to first playlist track if available
    if (currentTrackId === 'uploaded-local') {
      return allTrackIds.length > 0 ? allTrackIds[0] : null
    }
    
    // If playing a playlist track, get next track in playlist
    if (currentTrackIndex >= 0 && currentTrackIndex < allTrackIds.length - 1) {
      return allTrackIds[currentTrackIndex + 1]
    }
    
    // No next track available
    return null
  }, [currentTrackId, currentTrackIndex, allTrackIds])

  // Start playing a specific track
  const startPlaying = useCallback((trackId: string) => {
    // Allow special tracks (uploaded) or tracks in playlist
    if (trackId !== 'uploaded-local' && !allTrackIds.includes(trackId)) {
      console.warn(`Track ID ${trackId} not found in playlist`)
      return
    }
    
    setCurrentTrack(trackId)
  }, [allTrackIds, setCurrentTrack])

  // Stop current playback
  const stopPlaying = useCallback(() => {
    setCurrentTrack(null)
  }, [setCurrentTrack])

  // Play next track in playlist
  const playNext = useCallback(() => {
    // Fetch the latest state values directly from the store to avoid stale
    // closures (e.g. when the user toggles autoplay mid-playback).
    const {
      autoplay: latestAutoplay,
      inputWs: latestInputWs,
      similarityWs: latestSimilarityWs,
      currentTrackId: latestCurrentTrackId,
    } = usePlayerStore.getState();

    const nextTrackId = getNextTrack();

    if (!nextTrackId) {
      // No next track available
      // Only stop if autoplay is on (means we tried to advance but hit the end)
      if (latestAutoplay) {
        setCurrentTrack(null);
      }
      return false;
    }

    // Only advance to next track if autoplay is enabled
    if (!latestAutoplay) {
      // Pause the appropriate WaveSurfer instance
      if (latestCurrentTrackId === 'uploaded-local' && latestInputWs) {
        try {
          latestInputWs.pause();
        } catch {
          /* ignore */
        }
      } else if (currentTrackIndex === 0 && latestInputWs) {
        try {
          latestInputWs.pause();
        } catch {
          /* ignore */
        }
      } else if (latestSimilarityWs) {
        try {
          latestSimilarityWs.pause();
        } catch {
          /* ignore */
        }
      }

      setCurrentTrack(null); // Stop playback
      return false;
    }

    setCurrentTrack(nextTrackId);
    return true;
  }, [currentTrackIndex, getNextTrack, setCurrentTrack])

  // Play previous track in playlist
  const playPrevious = useCallback(() => {
    if (currentTrackIndex <= 0) {
      // No previous track available
      return false
    }
    
    const previousTrackId = allTrackIds[currentTrackIndex - 1]
    setCurrentTrack(previousTrackId)
    return true
  }, [currentTrackIndex, allTrackIds, setCurrentTrack])

  // Play first track in playlist
  const playFirst = useCallback(() => {
    if (allTrackIds.length === 0) return false
    
    const firstTrackId = allTrackIds[0]
    setCurrentTrack(firstTrackId)
    return true
  }, [allTrackIds, setCurrentTrack])

  // Play last track in playlist
  const playLast = useCallback(() => {
    if (allTrackIds.length === 0) return false
    
    const lastTrackId = allTrackIds[allTrackIds.length - 1]
    setCurrentTrack(lastTrackId)
    return true
  }, [allTrackIds, setCurrentTrack])

  // Check if a specific track is currently playing
  const isTrackPlaying = useCallback((trackId: string) => {
    return currentTrackId === trackId
  }, [currentTrackId])

  // Check if any track is currently playing
  const isPlaying = useMemo(() => {
    return currentTrackId !== null
  }, [currentTrackId])

  // Get track rating for a specific track
  const getTrackRating = useCallback((trackId: string) => {
    return trackRatings[trackId] || 0
  }, [trackRatings])

  // Toggle autoplay
  const toggleAutoplay = useCallback(() => {
    setAutoplay(!autoplay)
  }, [autoplay, setAutoplay])

  // Get playlist statistics
  const playlistStats = useMemo(() => {
    if (!playlistData) return null
    
    const totalTracks = allTrackIds.length
    const ratedTracks = Object.keys(trackRatings).length
    const averageRating = ratedTracks > 0 
      ? Object.values(trackRatings).reduce((sum, rating) => sum + rating, 0) / ratedTracks
      : 0
    
    return {
      totalTracks,
      ratedTracks,
      averageRating: Math.round(averageRating * 100) / 100,
      currentTrackIndex: currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0,
      progress: totalTracks > 0 ? ((currentTrackIndex + 1) / totalTracks) * 100 : 0
    }
  }, [playlistData, allTrackIds, trackRatings, currentTrackIndex])

  return {
    // State
    allTrackIds,
    currentTrackId,
    currentPlayingTrack,
    currentTrackIndex,
    isPlaying,
    isAutoplayEnabled: autoplay,
    playlistStats,

    // Volume
    volume,
    setVolume,
    
    // Similarity settings
    topSk,
    setTopSk,
    
    // WaveSurfer instances
    inputWs,
    similarityWs,
    setInputWs,
    setSimilarityWs,
    
    // Playback control
    startPlaying,
    stopPlaying,
    playNext,
    playPrevious,
    playFirst,
    playLast,
    
    // Track utilities
    isTrackPlaying,
    getTrackRating,
    getNextTrack,
    
    // Autoplay control
    toggleAutoplay,
    
    // Store access (for advanced usage)
    setCurrentTrack
  }
}

export default usePlayerManager
