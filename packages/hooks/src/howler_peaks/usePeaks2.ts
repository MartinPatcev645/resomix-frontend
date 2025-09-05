// usePeaks2.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  setTime: (timeSec: number) => void;
};

export function usePeaks2(
  overviewRef: React.RefObject<HTMLElement | null>,
  uuid: string
): UsePeaksReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedData, setNormalizedData] = useState<number[]>([]);
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
    const barCount = Math.floor(width / (barWidth + gapWidth));
    const timePercent = duration > 0 ? currentTime / duration : 0;
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
    ctx.fillRect(cursorPosition, 0, 1, height);
  }, [normalizedData, currentTime, duration]);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !uuid) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;
    el.appendChild(canvas);

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawWaveform();
      }
    });

    resizeObserver.observe(canvas);

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, {
          cache: 'no-store'
        });

        if (!res.ok) console.error(`Peaks fetch failed (${res.status})`);

        const data = await res.json();
        setNormalizedData(data);
        setDuration(data.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (canvasRef.current) {
        el.removeChild(canvas);
      }
    };
  }, [overviewRef, uuid]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(drawWaveform);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform]);

  const setTime = useCallback((timeSec: number) => {
    setCurrentTime(timeSec);
  }, []);

  return { loading, error, setTime };
}