// useHowler.ts
import { Howl } from 'howler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseHowlerResult {
  isLoaded: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  getHtmlAudioNode: () => HTMLAudioElement | null;
}

/**
 * Minimal Howler hook:
 * - Preloads /signed-audio for a uuid (HTML5 <audio> with HTTP Range)
 * - No autoplay; starts when you call play()
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

  // create & preload on url change
  useEffect(() => {
    if (!url) return;
    if (howlRef.current) {
      try { howlRef.current.unload(); } catch {}
      howlRef.current = null;
    }

    const h = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,      // <audio> element with Range requests
      preload: true,    // start loading immediately
      autoplay: false,
      onload: () => {
        setIsLoaded(true);
        setDuration(h.duration());
      },
      onplay:  () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop:  () => setIsPlaying(false),
      onend:   () => setIsPlaying(false),
    });

    howlRef.current = h;
    return () => {
      try { h.unload(); } catch {}
      howlRef.current = null;
    };
  }, [url]);

  // lightweight ticker for currentTime
  useEffect(() => {
    const id = window.setInterval(() => {
      const h = howlRef.current;
      if (h && h.playing()) {
        setCurrentTime((h.seek() as number) || 0);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const play = useCallback(() => { howlRef.current?.play(); }, []);
  const pause = useCallback(() => { howlRef.current?.pause(); }, []);
  const seek = useCallback((t: number) => { howlRef.current?.seek(Math.max(0, t)); }, []);
  const getHtmlAudioNode = useCallback(() => {
    const anyHowl = howlRef.current as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
  }, []);

  return { isLoaded, isPlaying, duration, currentTime, play, pause, seek, getHtmlAudioNode };
}
