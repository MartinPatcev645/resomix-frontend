import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { loadPeaksData, PeaksRich } from './peaksCache';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  setTime: (timeSec: number, isImmediatelly?: boolean) => void;
  attachOverviewElement: (overviewElement: HTMLDivElement) => void;
  setRestrictedRange: (range: { start: number; end: number } | null) => void;
};

export function useCustomPeaks(uuid: string, isDeleted: boolean = false): UsePeaksReturn {
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
  const [restrictedRange, setRestrictedRange] = useState<{ start: number; end: number } | null>(null);

  // Refs for logic/sync to avoid stale closures in effects and event handlers
  const fullbandRef = useRef<number[]>([]);
  const lowbandRef = useRef<number[]>([]);
  const durationRef = useRef(0);
  const restrictedRangeRef = useRef<{ start: number; end: number } | null>(null);
  const currentTimeRef = useRef(0);

  useEffect(() => { fullbandRef.current = fullband; }, [fullband]);
  useEffect(() => { lowbandRef.current = lowband; }, [lowband]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { restrictedRangeRef.current = restrictedRange; }, [restrictedRange]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Drag state
  const draggingRef = useRef<boolean>(false);

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

  const playedColor = isDeleted ? '#000000' : '#f15f27';
  const unplayedColor = isDeleted ? '#000000' : '#eaeff5';

  const lowPlayedColor = isDeleted ? '#000000' : '#3171fe';
  const lowUnplayedColor = isDeleted ? '#000000' : '#b9bcc2';

  const cursorColor = isDeleted ? 'transparent' : '#ff5714';
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
      const barTime = pos01 * duration;

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
      const restrictedColor = '#5c5c5c';
      const isOutside = restrictedRange && (barTime < restrictedRange.start || barTime > restrictedRange.end);

      // Fullband
      ctx.fillStyle = isOutside ? restrictedColor : (isPlayed ? playedColor : unplayedColor);
      ctx.globalAlpha = isOutside ? 0.2 : 1.0;
      ctx.fillRect(
        x,
        height - fullHeight,
        barWidthDev,
        fullHeight
      );

      // Lowband
      if (lowHeight > 0) {
        ctx.fillStyle = isOutside ? restrictedColor : (isPlayed ? lowPlayedColor : lowUnplayedColor);
        ctx.fillRect(
          x,
          height - lowHeight,
          barWidthDev,
          lowHeight
        );
      }
      ctx.globalAlpha = 1.0;
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
  }, [fullband, lowband, duration, getCtxAndDevSize, restrictedRange]);

  const drawWaveformRef = useRef<(t?: number) => void>(() => {});
  useLayoutEffect(() => {
    drawWaveformRef.current = drawWaveform;
  }, [drawWaveform]);

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
    if (draggingRef.current) return;
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

  // Load data ONLY when uuid changes
  useEffect(() => {
    let cancelled = false;
    if (!uuid) return;
    setLoading(true);
    setError(null);

    loadPeaksData(uuid)
      .then((payload: PeaksRich) => {
        if (cancelled) return;
        setFullband(payload.fullband || []);
        setLowband(payload.lowband || []);
        const dur = payload.durationSeconds ?? (payload.fullband?.length ?? 0);
        setDuration(dur);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uuid]);

  // Setup canvases, hover and pointer listeners
  useEffect(() => {
    const el = overviewElement;
    if (!el) return;

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
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none'; // allow events to reach container
    canvasRef.current = canvas;
    el.appendChild(canvas);

    // Overlay (for hover)
    let overlay: HTMLCanvasElement | null = null;
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
    } else {
      overlayCanvasRef.current = null;
    }

    // Function to set canvas sizes to DPR and redraw current frame
    const resizeNow = () => {
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
        // Use the ref which we just updated via useLayoutEffect
        drawWaveformRef.current(currentTimeRef.current);
      }
    };

    resizeNow();

    // Hover listeners
    const onMouseMove = (e: MouseEvent) => {
      if (!supportsHover || draggingRef.current) return;
      const rect = el.getBoundingClientRect();
      const xCss = e.clientX - rect.left;
      if (xCss >= 0 && xCss <= rect.width) {
        drawOverlay(xCss);
      }
    };
    const onMouseLeave = () => {
      if (!supportsHover) return;
      clearOverlay();
    };
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);

    // Pointer-based seeking (robust)
    const updateFromPos = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const percent = rect.width > 0 ? x / rect.width : 0;
      const t = percent * (durationRef.current || 0);
      setCurrentTime(t);
      drawWaveformRef.current(t); // immediate during drag
    };

    const onPointerDown = (e: PointerEvent) => {
      draggingRef.current = true;
      clearOverlay();
      try { (e.target as Element)?.setPointerCapture?.(e.pointerId); } catch {}
      updateFromPos(e.clientX);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromPos(e.clientX);
    };
    const stopDragging = (e?: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try { e && (e.target as Element)?.releasePointerCapture?.(e.pointerId); } catch {}
    };
    const onPointerUp = (e: PointerEvent) => stopDragging(e);
    const onPointerCancel = (e: PointerEvent) => stopDragging(e);
    const onWindowBlur = () => stopDragging();

    const prevTouchAction = el.style.touchAction;
    el.style.touchAction = 'none'; // prevent scroll during drag on touch devices

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onWindowBlur);

    // Resize observers
    const ro = new ResizeObserver(() => {
      resizeNow();
    });
    ro.observe(el);
    roRef.current = ro;

    const handleViewportResize = () => {
      resizeNow();
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

      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);

      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onWindowBlur);

      el.style.touchAction = prevTouchAction;

      if (canvasRef.current && canvasRef.current.parentElement === el) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
        el.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
      if (overlayCanvasRef.current && overlayCanvasRef.current.parentElement === el) {
        overlayCanvasRef.current.width = 0;
        overlayCanvasRef.current.height = 0;
        el.removeChild(overlayCanvasRef.current);
        overlayCanvasRef.current = null;
      }

      if (restoredContainerPosRef.current) {
        el.style.position = prevContainerPositionRef.current;
        restoredContainerPosRef.current = false;
      }
    };
  }, [overviewElement, supportsHover, getCtxAndDevSize, clearOverlay, drawOverlay]);

  // Redraw when data or time changes (restrictedRange is already captured in drawWaveform's identity)
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

  return { loading, error, setTime, attachOverviewElement, setRestrictedRange };
}