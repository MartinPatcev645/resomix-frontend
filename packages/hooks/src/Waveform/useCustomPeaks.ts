import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadPeaksData, PeaksRich } from './peaksCache';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  setTime: (timeSec: number, isImmediatelly?: boolean) => void;
  attachOverviewElement: (overviewElement: HTMLDivElement) => void;
};

export function useCustomPeaks(uuid: string): UsePeaksReturn {
  const [overviewElement, setOverviewElement] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two series: fullband (required), lowband (optional)
  const [fullband, setFullband] = useState<number[]>([]);
  const [lowband, setLowband] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const debounceRef = useRef<any | null>(null);

  // Style constants (dark background friendly)
  const barWidth = 1;
  const gapWidth = 0;
  // Fullband colors
  const playedColor = '#ee4a26';
  const unplayedColor = '#eaeff5';
  // Lowband colors (distinct on dark bg)
  const lowPlayedColor = '#2f73ff';
  const lowUnplayedColor = '#b9bcc2';

  const cursorColor = '#ff5714';
  const hoverColor = '#ffffff';
  const hoverLineWidth = 2;
  const lowbandScale = 0.4; // render low-end 2x lower than fullband by height

  let nextDebaunceTime: number = 0;

  const supportsHover = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  const setupCanvasSize = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas) return {};
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    return { ctx, width, height };
  }, []);

  const drawWaveform = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !fullband.length) return;

    const { width, height, ctx } = setupCanvasSize(canvas);
    if (!ctx) return;
    if (width === 0 || height === 0) return;

    const barCount = Math.floor(width / (barWidth + gapWidth));
    const timePercent = duration > 0 ? Math.min(time / duration, 1) : 0;
    const cursorPosition = width * timePercent;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      // Use position in [0..1] to index series of potentially different length safely
      const pos01 = barCount > 1 ? i / (barCount - 1) : 0;

      const fi = Math.floor(pos01 * Math.max(0, fullband.length - 1));
      const fv = fullband[fi] || 0;
      const fullHeight = Math.max(1, fv * height);

      let lv = 0;
      let lowHeight = 0;
      if (lowband && lowband.length > 0) {
        const li = Math.floor(pos01 * Math.max(0, lowband.length - 1));
        lv = lowband[li] || 0;
        lowHeight = Math.max(1, lv * height * lowbandScale);
      }

      const x = i * (barWidth + gapWidth);
      const isPlayed = x < cursorPosition;

      // Draw fullband first
      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(
        x,
        height - fullHeight,
        barWidth,
        fullHeight
      );

      // Draw lowband on top (shorter bar, with its own color)
      if (lowHeight > 0) {
        ctx.fillStyle = isPlayed ? lowPlayedColor : lowUnplayedColor;
        ctx.fillRect(
          x,
          height - lowHeight,
          barWidth,
          lowHeight
        );
      }
    }

    // Cursor
    ctx.fillStyle = cursorColor;
    ctx.fillRect(cursorPosition, 0.4 * height, Math.max(2, barWidth * 2), height);
  }, [fullband, lowband, duration]);

  const attachOverviewElement = useCallback((el: HTMLDivElement | null) => {
    setOverviewElement(el);
  }, []);

  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const { width, height, ctx } = setupCanvasSize(overlay);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, []);

  const drawOverlay = useCallback((xCss: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const { width, height, ctx } = setupCanvasSize(overlay);
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = hoverColor;
    ctx.fillRect(Math.round(xCss - hoverLineWidth / 2), 0.3 * height, hoverLineWidth, height);
  }, [hoverColor, hoverLineWidth]);

  useEffect(() => {
    const el = overviewElement;
    if (!el || !uuid) return;

    let overlay: HTMLCanvasElement | null = null;
    let onMouseMove: ((e: MouseEvent) => void) | null = null;
    let onMouseLeave: (() => void) | null = null;

    if (supportsHover) {
      overlay = document.createElement('canvas');
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlayCanvasRef.current = overlay;
      el.appendChild(overlay);

      onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x >= 0 && x <= rect.width) {
          drawOverlay(x);
        }
      };

      onMouseLeave = () => {
        clearOverlay();
      };

      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);
    } else {
      overlayCanvasRef.current = null;
    }

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;
    el.appendChild(canvas);

    // Initial sizing
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (overlay) {
      overlay.width = canvas.clientWidth;
      overlay.height = canvas.clientHeight;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const payload: PeaksRich = await loadPeaksData(uuid);
        setFullband(payload.fullband || []);
        setLowband(payload.lowband || []);
        // Prefer duration from payload, fallback to fullband length (1 value = 1s)
        const dur = payload.durationSeconds ?? (payload.fullband?.length ?? 0);
        setDuration(dur);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    if (!fullband.length && !loading) {
      loadData();
    }

    return () => {
      if (canvasRef.current) {
        el.removeChild(canvas);
        canvasRef.current = null;
      }
      if (overlay) {
        el.removeChild(overlay);
        overlayCanvasRef.current = null;
      }
      if (supportsHover) {
        if (onMouseMove) el.removeEventListener('mousemove', onMouseMove);
        if (onMouseLeave) el.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, [overviewElement, uuid]);

  useEffect(() => {
    drawWaveform(currentTime);
  }, [fullband, lowband, duration, canvasRef, drawOverlay, clearOverlay]);

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