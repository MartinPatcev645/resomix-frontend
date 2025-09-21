import { useEffect, useRef, useState, useCallback } from 'react';
import { loadPeaksData } from './peaksCache';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  setTime: (timeSec: number, isImmediatelly?: boolean) => void;
  attachOverviewElement: (overviewElement: HTMLDivElement) => void;
};

export function useCustomPeaks(
  uuid: string
): UsePeaksReturn {
  const [overviewElement, setOverviewElement] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedData, setNormalizedData] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const debounceRef = useRef<any | null>(null);

  const barWidth = 1;
  const gapWidth = 0;
  const playedColor = '#ff5500';
  const unplayedColor = '#ffffff';
  const cursorColor = '#ffffff';
  const hoverColor = '#ffffff';
  const hoverLineWidth = 2;

  let nextDebaunceTime: number = 0;

  const setupCanvasSize = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas) return {};
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    return { ctx, width, height};
  }, []);

  const drawWaveform = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !normalizedData.length) return;

    const {width, height, ctx} = setupCanvasSize(canvas)
    if (!ctx) return;

    if (width === 0 || height === 0) return;

    const barCount = Math.floor(width / (barWidth + gapWidth));
    const timePercent = duration > 0 ? Math.min(time / duration, 1) : 0;
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
    ctx.fillRect(cursorPosition, 0.4 * height, barWidth * 2, height);
  }, [normalizedData, duration]);

  const attachOverviewElement = useCallback((el: HTMLDivElement | null) => {
    setOverviewElement(el);
  }, []);

  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const {width, height, ctx} = setupCanvasSize(overlay);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, []);

  const drawOverlay = useCallback((xCss: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const {width, height, ctx} = setupCanvasSize(overlay);
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = hoverColor;
    ctx.fillRect(Math.round(xCss - hoverLineWidth / 2), 0.3 * height, hoverLineWidth, height);
  }, [hoverColor, hoverLineWidth]);

  useEffect(() => {
    const el = overviewElement;
    if (!el || !uuid) return;

    const overlay = document.createElement('canvas');
    overlay.style.position = 'absolute';
    overlay.style.pointerEvents = 'none';
    overlayCanvasRef.current = overlay;
    el.appendChild(overlay);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;
    el.appendChild(canvas);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    overlay.width = canvas.clientWidth;
    overlay.height = canvas.clientHeight;


    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadPeaksData(uuid);
        setNormalizedData(data);
        setDuration(data.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    if (!normalizedData.length && !loading) {
      loadData();
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x >= 0 && x <= rect.width) {
        drawOverlay(x);
      }
    };

    const onMouseLeave = () => {
      clearOverlay();
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);

    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      if (canvasRef.current) {
        el.removeChild(canvas);
        el.removeChild(overlay);
        canvasRef.current = null;
        overlayCanvasRef.current = null;
      }
    };
  }, [overviewElement, uuid]);

  useEffect(() => {
    drawWaveform(currentTime);
  }, [normalizedData, duration, canvasRef, drawOverlay, clearOverlay]);


  const setTime = useCallback((timeSec: number, isImmediatelly = false) => {
    setCurrentTime(timeSec);
    nextDebaunceTime = timeSec;
    if (isImmediatelly) {
      drawWaveform(timeSec);
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      return;
    }
    if (debounceRef.current) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      drawWaveform(nextDebaunceTime);
      debounceRef.current = null;
    }, 100);

  }, [drawWaveform]);

  return { loading, error, setTime, attachOverviewElement };
}
