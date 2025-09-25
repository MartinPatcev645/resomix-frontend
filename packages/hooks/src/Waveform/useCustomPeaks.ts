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

  // Data
  const [fullband, setFullband] = useState<number[]>([]);
  const [lowband, setLowband] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextDebounceTimeRef = useRef<number>(0);

  // DPR/resize
  const dprRef = useRef<number>(1);
  const roRef = useRef<ResizeObserver | null>(null);

  // Ensure container positioning
  const restoredContainerPosRef = useRef<boolean>(false);
  const prevContainerPositionRef = useRef<string>('');

  // Styles/colors
  const barWidthDev = 1;
  const gapWidthDev = 0;

  const playedColor = '#ee4a26';
  const unplayedColor = '#eaeff5';

  const lowPlayedColor = '#2f73ff';
  const lowUnplayedColor = '#b9bcc2';

  const cursorColor = '#ff5714';
  const hoverColor = '#ffffff';
  const hoverLineWidthDev = 1; // 1 real pixel
  const lowbandScale = 0.4;

  const supportsHover = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  // Get ctx and size in real pixels
  const getCtxAndDevSize = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;   // device px
    const height = canvas.height; // device px
    return { ctx, width, height };
  }, []);

  const drawWaveform = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !fullband.length) return;

    const { ctx, width, height } = getCtxAndDevSize(canvas);
    if (!ctx || width === 0 || height === 0) return;

    const barCount = Math.max(1, Math.floor(width / (barWidthDev + gapWidthDev)));
    const timePercent = duration > 0 ? Math.min(time / duration, 1) : 0;
    const cursorPositionDev = Math.round(width * timePercent);

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      const pos01 = barCount > 1 ? i / (barCount - 1) : 0;

      const fi = Math.floor(pos01 * Math.max(0, fullband.length - 1));
      const fv = fullband[fi] || 0;
      const fullHeight = Math.max(1, Math.round(fv * height));

      let lowHeight = 0;
      if (lowband && lowband.length > 0) {
        const li = Math.floor(pos01 * Math.max(0, lowband.length - 1));
        const lv = lowband[li] || 0;
        lowHeight = Math.max(1, Math.round(lv * height * lowbandScale));
      }

      const x = i * (barWidthDev + gapWidthDev);
      const isPlayed = x < cursorPositionDev;

      // Fullband
      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(
        x,
        height - fullHeight,
        barWidthDev,
        fullHeight
      );

      // Lowband
      if (lowHeight > 0) {
        ctx.fillStyle = isPlayed ? lowPlayedColor : lowUnplayedColor;
        ctx.fillRect(
          x,
          height - lowHeight,
          barWidthDev,
          lowHeight
        );
      }
    }

    // Cursor: 2 device-pixel
    const cursorWidthDev = 2;
    ctx.fillStyle = cursorColor;
    ctx.fillRect(
      Math.max(0, cursorPositionDev - Math.floor(cursorWidthDev / 2)),
      Math.round(0.4 * height),
      cursorWidthDev,
      height
    );
  }, [fullband, lowband, duration, getCtxAndDevSize]);

  const resizeCanvases = useCallback(() => {
    const el = overviewElement;
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!el || !canvas) return;

    const cssWidth = el.clientWidth || 0;
    const cssHeight = el.clientHeight || 0;
    if (cssWidth === 0 || cssHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(cssWidth * dpr));
    const nextHeight = Math.max(1, Math.round(cssHeight * dpr));

    let needRedraw = false;

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      needRedraw = true;
    }

    if (overlay) {
      if (overlay.width !== nextWidth || overlay.height !== nextHeight) {
        overlay.width = nextWidth;
        overlay.height = nextHeight;
        needRedraw = true;
      }
    }

    if (needRedraw || dprRef.current !== dpr) {
      dprRef.current = dpr;
      drawWaveform(currentTime);
    }
  }, [overviewElement, drawWaveform, currentTime]);

  const attachOverviewElement = useCallback((el: HTMLDivElement | null) => {
    setOverviewElement(el);
  }, []);

  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const { ctx, width, height } = getCtxAndDevSize(overlay);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, [getCtxAndDevSize]);

  const drawOverlay = useCallback((xCss: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const { ctx, width, height } = getCtxAndDevSize(overlay);
    if (!ctx) return;

    const dpr = dprRef.current || 1;
    const xDev = Math.round(xCss * dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = hoverColor;

    const half = Math.floor(hoverLineWidthDev / 2);
    ctx.fillRect(
      Math.max(0, xDev - half),
      Math.round(0.3 * height),
      hoverLineWidthDev,
      height
    );
  }, [getCtxAndDevSize, hoverColor]);

  useEffect(() => {
    const el = overviewElement;
    if (!el || !uuid) return;

    const computedPos = window.getComputedStyle(el).position;
    if (computedPos === 'static') {
      prevContainerPositionRef.current = el.style.position;
      el.style.position = 'relative';
      restoredContainerPosRef.current = true;
    }

    // Base canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';   // CSS размеры
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvasRef.current = canvas;
    el.appendChild(canvas);

    // Overlay
    let overlay: HTMLCanvasElement | null = null;
    let onMouseMove: ((e: MouseEvent) => void) | null = null;
    let onMouseLeave: (() => void) | null = null;

    if (supportsHover) {
      overlay = document.createElement('canvas');
      overlay.style.position = 'absolute';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '2';
      overlay.style.pointerEvents = 'none';
      overlayCanvasRef.current = overlay;
      el.appendChild(overlay);

      onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const xCss = e.clientX - rect.left;
        if (xCss >= 0 && xCss <= rect.width) {
          drawOverlay(xCss);
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

    resizeCanvases();

    const loadData = async () => {
      try {
        setLoading(true);
        const payload: PeaksRich = await loadPeaksData(uuid);
        setFullband(payload.fullband || []);
        setLowband(payload.lowband || []);
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

    // Resize/dpr observers
    const ro = new ResizeObserver(() => {
      resizeCanvases();
    });
    ro.observe(el);
    roRef.current = ro;

    const handleViewportResize = () => {
      resizeCanvases();
    };
    window.addEventListener('resize', handleViewportResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
      window.removeEventListener('resize', handleViewportResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }

      if (canvasRef.current) {
        el.removeChild(canvasRef.current);
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

      if (restoredContainerPosRef.current) {
        el.style.position = prevContainerPositionRef.current;
        restoredContainerPosRef.current = false;
      }
    };
  }, [overviewElement, uuid, supportsHover, resizeCanvases, drawOverlay, clearOverlay, fullband.length, loading]);

  useEffect(() => {
    drawWaveform(currentTime);
  }, [fullband, lowband, duration, currentTime, drawWaveform]);

  const setTime = useCallback((timeSec: number, isImmediatelly = false) => {
    setCurrentTime(timeSec);
    nextDebounceTimeRef.current = timeSec;

    if (isImmediatelly) {
      drawWaveform(timeSec);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) return;

    debounceRef.current = setTimeout(() => {
      drawWaveform(nextDebounceTimeRef.current);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }, 100);
  }, [drawWaveform]);

  return { loading, error, setTime, attachOverviewElement };
}