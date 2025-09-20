import { useCallback, useMemo, useEffect, useRef } from 'react'
import { Track, usePlaylistStore } from '@resomix/stores'
import { usePlayerStore } from '@resomix/stores'
import { useGlobalHowlerController } from "./useGlobalHowlerController";
import { loadPeaksData } from "../index";


/**
 * Hook for managing audio player functionality across the application
 * Integrates with playlist store and player store to provide centralized playback control
 */
export const usePlayerManager = () => {
  const { playlistData, trackRatings } = usePlaylistStore();
  const {
    currentTrackId,
    setCurrentTrack,
    setTrackTime,
    autoplay,
    setAutoplay,
    volume,
    setVolume,
    topSk,
    setTopSk
  } = usePlayerStore()
  const howlerController = useGlobalHowlerController();

  const currentTime = usePlayerStore(s => s.trackTimes?.[currentTrackId || ''] ?? 0);
  const currentTimeRef = useRef<number>(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Get all track IDs from the playlist in order (queried track first, then similar tracks)
  const allTrackIds = useMemo(() => {
    if (!playlistData) return []

    let tracks: Track[] = [];

    // Add queried track first if it exists
    if (playlistData.queried_track?.id) {
      tracks.push(playlistData.queried_track);
    }

    // Add similar tracks
    if (playlistData.similar_tracks?.length) {
      tracks = [...tracks, ...playlistData.similar_tracks];
    }

    return tracks.map(el => el.id);
  }, [playlistData, howlerController])

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

  // BeMusic pattern: Synchronous track cueing with async loading
  const cueTrack = useCallback((trackId: string) => {
    // Allow special tracks (uploaded) or tracks in playlist
    if (trackId !== 'uploaded-local' && !allTrackIds.includes(trackId)) {
      console.warn(`Track ID ${trackId} not found in playlist`)
      return false
    }

    // Immediate synchronous state change (preserves gesture)
    setCurrentTrack(trackId)

    console.log('[PlayerManager] Track cued immediately:', trackId)
    return true
  }, [allTrackIds, setCurrentTrack])

  // Start playing a specific track (synchronous)
  const startPlaying = useCallback((trackId: string) => {
    return cueTrack(trackId)
  }, [cueTrack])

  // Stop current playback
  const stopPlaying = useCallback(() => {
    if (howlerController) {
      howlerController.pause();
    }
    setCurrentTrack(null)
  }, [setCurrentTrack, howlerController])

  // Play next track in playlist (synchronous)
  const playNext = useCallback(() => {

    const nextTrackId = getNextTrack();

    if (!nextTrackId) {
      // No next track available
      howlerController.pause();
      setCurrentTrack(null);
      console.log('[PlayerManager] Playlist ended, stopping playback');
      return false;
    }

    // BeMusic pattern: Synchronous track change
    const success = cueTrack(nextTrackId);
    if (success) {
      console.log('[PlayerManager] Advanced to next track:', nextTrackId);
      howlerController.load(nextTrackId, true);
    }
    return success;
  }, [getNextTrack, setCurrentTrack, cueTrack, howlerController])

  // Play previous track in playlist
  const playPrevious = useCallback(() => {
    if (currentTrackIndex <= 0) {
      // No previous track available
      return false
    }

    const previousTrackId = allTrackIds[currentTrackIndex - 1]
    setCurrentTrack(previousTrackId)
    const success = cueTrack(previousTrackId);
    if (success) {
      console.log('[PlayerManager] Advanced to previous track:', previousTrackId);
      howlerController.load(previousTrackId, true);
    }
    return success;
  }, [currentTrackIndex, allTrackIds, setCurrentTrack])

  // Listen for track ended events from Howler controller
  useEffect(() => {
    const onEnded = () => {
      playNext(); // obeys autoplay flag inside playNext already
    };

    const onPrevious = () => {
      playPrevious();
    };

    const onNext = () => {
      playNext();
    };

    window.addEventListener('resomix:track-ended', onEnded);
    window.addEventListener('resomix:previous-track', onPrevious);
    window.addEventListener('resomix:next-track', onNext);

    return () => {
      window.removeEventListener('resomix:track-ended', onEnded);
      window.removeEventListener('resomix:previous-track', onPrevious);
      window.removeEventListener('resomix:next-track', onNext);
    };
  }, [playNext, playPrevious]);

  // Smart preloading: preload next track when current is fully loaded
  useEffect(() => {
    if (!howlerController || !currentTrackId) return;

    const checkAndPreload = () => {
      if (howlerController.isLoaded) {
        const nextTrackId = getNextTrack();
        if (nextTrackId && nextTrackId !== 'uploaded-local') {
          howlerController.preloadNext(nextTrackId);
          loadPeaksData(nextTrackId);
          console.log('[PlayerManager] Preloading next track:', nextTrackId);
        }
        clearInterval(interval);
      }
    };

    // Check periodically if current track is loaded
    const interval = setInterval(checkAndPreload, 1000);

    return () => {
      clearInterval(interval);
    }
  }, [howlerController, currentTrackId, autoplay, getNextTrack]);

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

  // MediaSession API integration for notification controls
  useEffect(() => {
    const handleMediaSessionPreviousTrack = () => {
      if (howlerController) {
        howlerController.pause();
        playPrevious();
      }
    };

    const handleMediaSessionNextTrack = () => {
      if (howlerController) {
        howlerController.pause();
        playNext();
      }
    };

    // Listen for MediaSession events from AudioProvider
    window.addEventListener('mediaSessionPreviousTrack', handleMediaSessionPreviousTrack);
    window.addEventListener('mediaSessionNextTrack', handleMediaSessionNextTrack);

    return () => {
      window.removeEventListener('mediaSessionPreviousTrack', handleMediaSessionPreviousTrack);
      window.removeEventListener('mediaSessionNextTrack', handleMediaSessionNextTrack);
    };
  }, [playPrevious, playNext, howlerController]);

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

    // Note: howlerController should be used directly via useHowlerController() in components

    // Playback control
    cueTrack,
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
