import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

interface AudioProviderProps {
  /** Audio source URL - changes when switching tracks */
  src?: string;
  /** Callback fired when audio starts playing */
  onPlay?: () => void;
  /** Callback fired when audio pauses */
  onPause?: () => void;
  /** Callback fired when audio ends */
  onEnded?: () => void;
  /** Callback fired on time updates with current time in seconds */
  onTimeUpdate?: (currentTime: number) => void;
  /** Callback fired when metadata is loaded and audio is ready */
  onLoadedMetadata?: () => void;
  /** Callback fired on audio errors */
  onError?: (error: any) => void;
  /** Volume (0-1) */
  volume?: number;
}

export interface AudioProviderRef {
  /** Get the persistent audio element */
  getAudioElement: () => HTMLAudioElement | null;
  /** Check if provider is ready (metadata loaded) */
  isProviderReady: () => boolean;
  /** Play the audio */
  play: () => Promise<void>;
  /** Pause the audio */
  pause: () => void;
  /** Set current time */
  setCurrentTime: (time: number) => void;
  /** Get current time */
  getCurrentTime: () => number;
  /** Get duration */
  getDuration: () => number;
  /** Test gesture preservation by attempting immediate play */
  testGesturePreservation: () => Promise<boolean>;
}

/**
 * AudioProvider - BeMusic-style persistent audio element
 * Creates audio element immediately when component mounts, not on user click
 * Changes src when switching tracks, but keeps the same audio element
 */
export const AudioProvider = forwardRef<AudioProviderRef, AudioProviderProps>(({
  src,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onLoadedMetadata,
  onError,
  volume = 1,
}, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isProviderReady, setIsProviderReady] = useState(false);
  const [isGestureUnlocked, setIsGestureUnlocked] = useState(false);
  const unlockGestureRef = useRef<(() => Promise<void>) | null>(null);

  // BeMusic pattern: Create audio element immediately when component mounts
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // iOS optimizations - apply immediately
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';

    // Unlock gesture immediately with silent audio (iOS requirement)
    const unlockGesture = async () => {
      const startTime = performance.now();
      try {
        const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        const originalSrc = audio.src;
        
        console.log('[AudioProvider] Starting gesture unlock...');
        audio.src = silentAudio;
        
        const playPromise = audio.play();
        if (playPromise) {
          await playPromise;
          console.log('[AudioProvider] Silent audio played successfully');
          
          // Small delay to ensure audio stack is fully unlocked
          setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
            
            // Restore original src if it existed
            audio.src = originalSrc || '';
            
            const unlockTime = performance.now() - startTime;
            console.log(`[AudioProvider] Gesture unlocked successfully in ${unlockTime.toFixed(2)}ms`);
            setIsGestureUnlocked(true);
          }, 10);
        } else {
          // Fallback for older browsers
          audio.pause();
          audio.currentTime = 0;
          audio.src = originalSrc || '';
          setIsGestureUnlocked(true);
          console.log('[AudioProvider] Gesture unlocked (legacy browser)');
        }
      } catch (error) {
        const unlockTime = performance.now() - startTime;
        console.warn(`[AudioProvider] Gesture unlock failed after ${unlockTime.toFixed(2)}ms:`, error);
        // Continue anyway, might work on non-iOS or in some cases
        setIsGestureUnlocked(true);
      }
    };

    // Store unlock function for later use
    unlockGestureRef.current = unlockGesture;
    
    // Don't automatically unlock - wait for user interaction
    // Gesture unlocking will happen on first play attempt
    setIsGestureUnlocked(true); // Assume unlocked for non-iOS or after user interaction

    // Event listeners
    const handlePlay = () => onPlay?.();
    const handlePause = () => onPause?.();
    const handleEnded = () => onEnded?.();
    const handleTimeUpdate = () => onTimeUpdate?.(audio.currentTime);
    const handleError = (e: Event) => onError?.(e);
    const handleLoadedMetadata = () => {
      setIsProviderReady(true);
      onLoadedMetadata?.();
    };
    const handleCanPlay = () => {
      // Additional ready state for better compatibility
      if (!isProviderReady) {
        setIsProviderReady(true);
        onLoadedMetadata?.();
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onPlay, onPause, onEnded, onTimeUpdate, onLoadedMetadata, onError]);

  // BeMusic pattern: Handle src changes (don't create new element, just change src)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (src && audio.src !== src) {
      const loadStartTime = performance.now();
      setIsProviderReady(false);
      
      console.log('[AudioProvider] Loading new source:', src);
      audio.src = src;
      
      // Add one-time load event listener to measure timing
      const handleLoad = () => {
        const loadTime = performance.now() - loadStartTime;
        console.log(`[AudioProvider] Source loaded in ${loadTime.toFixed(2)}ms`);
        audio.removeEventListener('loadstart', handleLoad);
      };
      audio.addEventListener('loadstart', handleLoad);
      
      audio.load(); // Trigger metadata loading
    } else if (!src && audio.src) {
      // Don't clear the source if we don't have a new one
      // console.log('[AudioProvider] No source provided, keeping current');
    }
  }, [src]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && typeof volume === 'number') {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getAudioElement: () => audioRef.current,
    isProviderReady: () => isProviderReady,
    play: async () => {
      const audio = audioRef.current;
      if (!audio) {
        throw new Error('Audio element not ready');
      }

             // Try to unlock gesture on first play attempt (iOS)
       if (!isGestureUnlocked && /iP(ad|hone|od)/.test(navigator.userAgent) && unlockGestureRef.current) {
         console.log('[AudioProvider] Attempting gesture unlock on first play...');
         try {
           await unlockGestureRef.current();
         } catch (error) {
           console.warn('[AudioProvider] Gesture unlock failed, trying direct play:', error);
         }
       }

      try {
        await audio.play();
        console.log('[AudioProvider] Play successful');
      } catch (error) {
        console.error('[AudioProvider] Play failed:', error);
        throw error;
      }
    },
    pause: () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
    },
    setCurrentTime: (time: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
      }
    },
    getCurrentTime: () => {
      const audio = audioRef.current;
      return audio?.currentTime || 0;
    },
    getDuration: () => {
      const audio = audioRef.current;
      return audio?.duration || 0;
    },
    testGesturePreservation: async () => {
      const audio = audioRef.current;
      if (!audio || !isGestureUnlocked) {
        console.warn('[AudioProvider] Cannot test gesture - audio not ready or not unlocked');
        return false;
      }

      try {
        const testStartTime = performance.now();
        // Try to play a silent audio to test if gesture is preserved
        const originalSrc = audio.src;
        const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        
        audio.src = silentAudio;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.src = originalSrc;
        
        const testTime = performance.now() - testStartTime;
        console.log(`[AudioProvider] Gesture preservation test passed in ${testTime.toFixed(2)}ms`);
        return true;
      } catch (error) {
        console.warn('[AudioProvider] Gesture preservation test failed:', error);
        return false;
      }
    },
  }), [isProviderReady, isGestureUnlocked]);

  return (
    <audio
      ref={audioRef}
      style={{ display: 'none' }}
      playsInline
      webkit-playsinline="true"
    />
  );
});

AudioProvider.displayName = 'AudioProvider';

/**
 * Hook to manage audio provider reference
 */
export function useAudioProviderRef() {
  const audioProviderRef = useRef<AudioProviderRef>(null);

  const getAudioElement = useCallback(() => {
    return audioProviderRef.current?.getAudioElement() || null;
  }, []);

  const isProviderReady = useCallback(() => {
    return audioProviderRef.current?.isProviderReady() || false;
  }, []);

  return {
    audioProviderRef,
    getAudioElement,
    isProviderReady,
  };
}
