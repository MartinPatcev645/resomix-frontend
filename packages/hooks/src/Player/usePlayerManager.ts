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
    currentWs, 
    setCurrentWs,
    autoplay,
    setAutoplay,
    volume,
    setVolume
  } = usePlayerStore()

  // Keep WaveSurfer instance volume in sync with global volume
  useEffect(() => {
    if (!currentWs || typeof currentWs.setVolume !== 'function') return
    try {
      currentWs.setVolume(volume)
    } catch {}
  }, [currentWs, volume])

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
    if (!currentTrackId || !allTrackIds.length) return -1
    return allTrackIds.indexOf(currentTrackId)
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

  // Start playing a specific track
  const startPlaying = useCallback((trackId: string) => {
    if (!allTrackIds.includes(trackId)) {
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
    if (currentTrackIndex === -1 || currentTrackIndex >= allTrackIds.length - 1) {
      // No next track available
      return false
    }
    
    // Only advance to next track if autoplay is enabled
    if (!autoplay) {
      try { (currentWs && typeof currentWs.pause === 'function') && currentWs.pause() } catch {}
      setCurrentTrack(null) // Stop playback
      return false
    }
    
    const nextTrackId = allTrackIds[currentTrackIndex + 1]
    setCurrentTrack(nextTrackId)
    return true
  }, [currentTrackIndex, allTrackIds, setCurrentTrack, autoplay])

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
    
    // Autoplay control
    toggleAutoplay,
    
    // Store access (for advanced usage)
    currentWs,
    setCurrentWs
  }
}

export default usePlayerManager
