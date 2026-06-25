// usePeaks2.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadPeaksData } from '../Waveform/peaksCache';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  setTime: (timeSec: number) => void;
  attachMediaElement: (mediaElement: HTMLMediaElement) => void;
};

export function usePeaks2(
  overviewRef: React.RefObject<HTMLElement | null>,
  uuid: string
): UsePeaksReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedData, setNormalizedData] = useState<number[]>([]);
  const [mediaElement, setMediaElement] = useState<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const barWidth = 3;
  const gapWidth = 1;
  const playedColor = '#ff5500';
  const unplayedColor = '#ffffff';
  const cursorColor = '#ffffff';

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !normalizedData.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const barCount = Math.floor(width / (barWidth + gapWidth));
    const timePercent = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    const cursorPosition = width * timePercent;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      const position = (i / barCount) * (normalizedData.length - 1);
      const index = Math.floor(position);
      const value = normalizedData[index] || 0;
      const barHeight = Math.max(1, value * height);

      const x = i * (barWidth + gapWidth);
      const isPlayed = x < cursorPosition;

      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(
        x,
        height - barHeight,
        barWidth,
        barHeight
      );
    }

    ctx.fillStyle = cursorColor;
    ctx.fillRect(cursorPosition, 0.4 * height, barWidth, height);
  }, [normalizedData, currentTime, duration]);

  const attachMediaElement = useCallback((el: HTMLAudioElement | null) => {
    setMediaElement(el);
  }, []);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !uuid || !mediaElement) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;
    el.appendChild(canvas);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;


    const loadData = async () => {
      try {
        setLoading(true);
        // Use the shared, token-aware loader (mints + attaches the edge playback
        // token, prefers the rich endpoint, and caches) instead of a bare fetch.
        const payload = await loadPeaksData(uuid);
        setNormalizedData(payload.fullband || []);
        setDuration(payload.durationSeconds ?? (payload.fullband?.length ?? 0));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
        el.removeChild(canvas);
      }
    };
  }, [overviewRef, uuid, mediaElement]);


  const setTime = useCallback((timeSec: number) => {
    setCurrentTime(timeSec);
    if (canvasRef.current) {
      drawWaveform();
    }
  }, [drawWaveform]);

  return { loading, error, setTime, attachMediaElement };
}
