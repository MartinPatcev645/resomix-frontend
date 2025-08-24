import { useCallback, useRef, useEffect } from 'react';

interface AudioContextUnlocker {
  unlockAudioElement: () => Promise<HTMLAudioElement>;
  isUnlocked: boolean;
}

/**
 * Hook that implements BeMusic's strategy for preserving user gestures on iOS
 * by immediately creating and unlocking an audio element with silent audio
 */
export function useAudioContextUnlocker(): AudioContextUnlocker {
  const unlockedAudioRef = useRef<HTMLAudioElement | null>(null);
  const isUnlockedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Create AudioContext on mount
  useEffect(() => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('[AudioContextUnlocker] AudioContext not supported');
    }
  }, []);

  const unlockAudioElement = useCallback(async (): Promise<HTMLAudioElement> => {
    return new Promise((resolve, reject) => {
      try {
        // Create audio element immediately on user gesture - this is the key!
        const audio = new Audio();
        
        // iOS-specific attributes for background playback
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('x-webkit-airplay', 'allow');
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        
        // Unlock audio context immediately
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            console.log('[AudioContextUnlocker] AudioContext resumed');
          }).catch((e) => {
            console.warn('[AudioContextUnlocker] Failed to resume AudioContext:', e);
          });
        }

        // Create a tiny silent audio to unlock the audio stack - BeMusic's key trick
        const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        audio.src = silentAudio;
        
        // Try to play the silent audio to unlock
        const playPromise = audio.play();
        
        if (playPromise) {
          playPromise.then(() => {
            // Immediately pause the silent audio
            audio.pause();
            audio.currentTime = 0;
            
            // Clear the silent audio source - ready for real audio
            audio.src = '';
            
            // Now the audio context is unlocked!
            isUnlockedRef.current = true;
            unlockedAudioRef.current = audio;
            
            console.log('[AudioContextUnlocker] Audio context unlocked successfully');
            resolve(audio);
            
          }).catch((error) => {
            console.warn('[AudioContextUnlocker] Failed to unlock audio:', error);
            // Still resolve with the audio element, it might work later
            unlockedAudioRef.current = audio;
            resolve(audio);
          });
        } else {
          // Older browsers without promise support
          unlockedAudioRef.current = audio;
          isUnlockedRef.current = true;
          resolve(audio);
        }
        
      } catch (error) {
        console.error('[AudioContextUnlocker] Error creating audio element:', error);
        reject(error);
      }
    });
  }, []);

  return {
    unlockAudioElement,
    isUnlocked: isUnlockedRef.current,
  };
}
