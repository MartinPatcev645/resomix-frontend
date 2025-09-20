// useHowler.ts
import { Howl } from 'howler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseHowlerResult {
  isLoaded: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  setVolume: (v: number) => void;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  getHtmlAudioNode: () => HTMLAudioElement | null;
}

/**
 * Minimal Howler hook (instance-per-call):
 * - Preloads /signed-audio for a uuid (HTML5 <audio> with HTTP Range)
 * - No autoplay; starts when you call play()
 * - Per-instance volume
 */
export function useHowler2(uuid?: string): UseHowlerResult {
  const url = useMemo(
    () => (uuid ? `https://media.resomix.com/signed-audio/?uuid=${uuid}` : undefined),
    [uuid]
  );

  const howlRef = useRef<Howl | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);

  // create & preload on url change
  // create & preload on url change (guard against StrictMode double-mount)
  useEffect(() => {
    if (!url) return;

    const h = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      autoplay: false,
      volume,
      onload: () => {
        setIsLoaded(true);
        setDuration(h.duration());
      },
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => setIsPlaying(false),
      onend: () => setIsPlaying(false),
    });

    howlRef.current = h;

    return () => {
      h.unload();
    };
  }, [url]);


  // keep howler volume in sync
  useEffect(() => {
    if (howlRef.current) {
      try { howlRef.current.volume(volume); } catch { }
    }
  }, [volume]);

  // lightweight ticker for currentTime
  useEffect(() => {
    let animationFrameId: number;

    const updateCurrentTime = () => {
      const h = howlRef.current;
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

  const play = useCallback(() => { howlRef.current?.play(); }, []);
  const pause = useCallback(() => { howlRef.current?.pause(); }, []);
  const seek = useCallback((t: number) => {
    setCurrentTime(t);
    howlRef.current?.seek(Math.max(0, t));
    const seekPos = howlRef.current?.seek();
    if (seekPos == 0 && t > 0) {
      setTimeout(() => seek(t), 100);
    }
  }, []);
  const getHtmlAudioNode = useCallback(() => {
    const anyHowl = howlRef.current as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
  }, []);

  return { isLoaded, isPlaying, duration, currentTime, volume, setVolume, play, pause, seek, getHtmlAudioNode };
}
