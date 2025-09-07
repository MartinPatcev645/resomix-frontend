import {useCallback, useRef, useEffect, useState} from 'react';
import { Howl } from 'howler';
import { usePlayerStore } from '@resomix/stores';

export interface HowlerController {
  load: (url: string, trackId: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSeconds: number) => void;
  getCurrentTime: () => number;
  currentTime: number;
  getDuration: () => number;
  unload: () => void;
  getHtmlAudioNode: () => HTMLAudioElement | null;
  preloadNext: (url: string, trackId: string) => void;
  isLoaded: () => boolean;
  getLoadingProgress: () => number;
}

export function useHowlerController(): HowlerController {
  const currentHowlRef = useRef<Howl | null>(null);
  const nextHowlRef = useRef<Howl | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const {
    setCurrentTrack,
    volume,
    setInputCurrentTime,
    setAudioNode,
    autoplay,
  } = usePlayerStore();

  const load = useCallback((url: string, trackId: string) => {
    // Unload previous
    if (currentHowlRef.current) {
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
      setAudioNode(null);
    }

    // If we have a preloaded next track and it matches, use it
    if (nextHowlRef.current && trackId === (nextHowlRef.current as any)._trackId) {
      currentHowlRef.current = nextHowlRef.current;
      nextHowlRef.current = null;
      currentTrackIdRef.current = trackId;
      
      // Update audio node
      const node = (currentHowlRef.current as any)?._sounds?.[0]?._node ?? null;
      if (node) {
        setAudioNode(node);
        // Setup MediaSession for iOS/Android lock screen
        setupMediaSession(node);
      }
      return;
    }

    const howl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,    // streaming with range support for smart loading
      preload: true,  // start loading immediately
      volume,
      onload: () => {
        const node = (howl as any)?._sounds?.[0]?._node ?? null;
        if (node) {
          setAudioNode(node);
          // Setup MediaSession for iOS/Android lock screen
          setupMediaSession(node);
        }
      },
      onplay: () => {
        setIsPlaying(true);
        setCurrentTrack(trackId);
        // Update MediaSession playback state
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        
        // Ensure progress ticker is running
        if (progressTimerRef.current == null) {
          progressTimerRef.current = window.setInterval(() => {
            const t = (howl.seek() as number) || 0;
            setInputCurrentTime(t);
          }, 200); // 5 fps is enough
        }
      },
      onpause: () => {
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
        if (progressTimerRef.current != null) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      },
      onstop: () => {
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
        }
        if (progressTimerRef.current != null) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      },
      onend: () => {
        setIsPlaying(false);
        if (progressTimerRef.current != null) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        
        // Trigger autoplay next if enabled
        if (autoplay) {
          window.dispatchEvent(new CustomEvent('resomix:track-ended'));
        } else {
          setCurrentTrack(null);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
          }
        }
      },
      onloaderror: (_id, error) => {
        console.error('[HowlerController] Load error:', error);
      },
      onplayerror: (_id, error) => {
        console.error('[HowlerController] Play error:', error);
        // Try to unlock audio on mobile
        howl.once('unlock', () => {
          howl.play();
        });
      }
    });

    currentHowlRef.current = howl;
    currentTrackIdRef.current = trackId;
  }, [volume, setCurrentTrack, setAudioNode, setInputCurrentTime, autoplay]);

  const play = useCallback(() => currentHowlRef.current?.play(), []);
  const pause = useCallback(() => currentHowlRef.current?.pause(), []);
  const stop  = useCallback(() => currentHowlRef.current?.stop(),  []);
  const seek = useCallback((t: number) => {
    setInputCurrentTime(t);
    setCurrentTime(t);
    currentHowlRef.current?.seek(Math.max(0, t));
    const seekPos =  currentHowlRef.current?.seek();
    if (seekPos == 0 && t > 0) {
      setTimeout(() => seek(t), 100);
    }
  }, []);

  // lightweight ticker for currentTime
  useEffect(() => {
    let animationFrameId: number;

    const updateCurrentTime = () => {
      const h = currentHowlRef.current;
      if (h && h.playing()) {
        setCurrentTime((h.seek() as number) || 0);
      }
      animationFrameId = requestAnimationFrame(updateCurrentTime);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateCurrentTime);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying]);

  const getCurrentTime = useCallback(() => {
    return currentTime
  }, []);

  const getDuration = useCallback(() => {
    return currentHowlRef.current?.duration() ?? 0;
  }, []);

  const unload = useCallback(() => {
    if (progressTimerRef.current != null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (currentHowlRef.current) {
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
    }
    if (nextHowlRef.current) {
      nextHowlRef.current.unload();
      nextHowlRef.current = null;
    }
    setAudioNode(null);
    currentTrackIdRef.current = null;
  }, [setAudioNode]);

  const getHtmlAudioNode = useCallback(() => {
    const anyHowl = currentHowlRef.current as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
  }, []);

  const preloadNext = useCallback((url: string, trackId: string) => {
    // Clean up previous preload
    if (nextHowlRef.current) {
      nextHowlRef.current.unload();
      nextHowlRef.current = null;
    }

    // Create preload Howl
    const nextHowl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume,
      onload: () => {
        console.log('[HowlerController] Next track preloaded:', trackId);
      },
      onloaderror: (_id, error) => {
        console.error('[HowlerController] Preload error:', error);
      }
    });

    // Store reference with trackId for matching
    (nextHowl as any)._trackId = trackId;
    nextHowlRef.current = nextHowl;
  }, [volume]);

  const isLoaded = useCallback(() => {
    return currentHowlRef.current?.state() === 'loaded';
  }, []);

  const getLoadingProgress = useCallback(() => {
    const howl = currentHowlRef.current;
    if (!howl) return 0;
    
    const audioNode = getHtmlAudioNode();
    if (!audioNode) return 0;
    
    const buffered = audioNode.buffered;
    const duration = audioNode.duration;
    
    if (buffered.length > 0 && duration > 0) {
      return buffered.end(buffered.length - 1) / duration;
    }
    
    return 0;
  }, [getHtmlAudioNode]);

  // Sync volume -> howl
  useEffect(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.volume(volume);
    }
    if (nextHowlRef.current) {
      nextHowlRef.current.volume(volume);
    }
  }, [volume]);


  return { 
    load, 
    play, 
    pause, 
    stop, 
    seek,
    getCurrentTime,
    currentTime,
    getDuration, 
    unload, 
    getHtmlAudioNode,
    preloadNext,
    isLoaded,
    getLoadingProgress
  };
}

// MediaSession setup for iOS/Android lock screen controls
function setupMediaSession(audioElement: HTMLAudioElement) {
  if (!('mediaSession' in navigator)) return;

  // Set iOS-specific attributes for better mobile support
  audioElement.setAttribute('playsinline', '');
  audioElement.setAttribute('webkit-playsinline', '');
  
  // Setup MediaSession action handlers
  navigator.mediaSession.setActionHandler('play', () => {
    audioElement.play();
  });
  
  navigator.mediaSession.setActionHandler('pause', () => {
    audioElement.pause();
  });
  
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    window.dispatchEvent(new CustomEvent('resomix:previous-track'));
  });
  
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    window.dispatchEvent(new CustomEvent('resomix:next-track'));
  });
  
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime) {
      audioElement.currentTime = details.seekTime;
    }
  });
}