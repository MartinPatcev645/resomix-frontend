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

    // React 18 StrictMode runs this effect twice in dev.
    // Prevent double creation that exhausts the HTML5 audio pool.
    const createdFlag = { value: false };
    if ((useHowler2 as any)._devCreated?.has(url)) {
      // already created once for this URL in this session (dev)
      return;
    }
    (useHowler2 as any)._devCreated = (useHowler2 as any)._devCreated || new Set<string>();
    (useHowler2 as any)._devCreated.add(url);
    createdFlag.value = true;

    if (howlRef.current) {
      try { howlRef.current.unload(); } catch { }
      howlRef.current = null;
    }

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
      // Real unmount/URL change: clean up.
      try { h.unload(); } catch { }
      howlRef.current = null;
      // allow a later fresh mount (different page) to create again
      if (createdFlag.value) {
        (useHowler2 as any)._devCreated.delete(url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);


  // keep howler volume in sync
  useEffect(() => {
    if (howlRef.current) {
      try { howlRef.current.volume(volume); } catch { }
    }
  }, [volume]);

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

  return { isLoaded, isPlaying, duration, currentTime, volume, setVolume, play, pause, seek, getHtmlAudioNode };
}
