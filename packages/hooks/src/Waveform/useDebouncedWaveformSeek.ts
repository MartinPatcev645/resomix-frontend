import { useCallback, useEffect, useRef, useState } from "react";

export interface UseDebouncedWaveformSeekOptions {
  id: string;                            // track id
  totalDuration: number;                 //   total duration for fallback
  currentTime: number;                   // current time from global store
  setTime: (t: number, isSeeking?: boolean) => void; // local set time for peak
  onPreview?: (t: number) => void;       // global store update (setTrackTime)
  onCommit?: (t: number) => void;        // real player seek and store update
  debounceMs?: number;                   // debounce default 300 ms
  holdAfterMs?: number;                  // default 200 ms
  restrictedRange?: { start: number; end: number } | null;
}

export interface UseDebouncedWaveformSeekResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  uiTime: number;
  requestSeek: (time: number, opts?: { immediate?: boolean }) => void;
}

export function useDebouncedWaveformSeek({
  id,
  totalDuration,
  currentTime,
  setTime,
  onPreview,
  onCommit,
  debounceMs = 300,
  holdAfterMs = 200,
  restrictedRange = null,
}: UseDebouncedWaveformSeekOptions): UseDebouncedWaveformSeekResult {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const pendingSeekPosition = useRef<number | null>(null);

  const seekTimeoutRef = useRef<number | null>(null);
  const lastRequestedTimeRef = useRef<number | null>(null);
  const holdUntilRef = useRef<number>(0);

  const isUiHoldActive = () => Date.now() < holdUntilRef.current;

  const clearSeekTimeout = () => {
    if (seekTimeoutRef.current !== null) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  };

  const requestSeek = useCallback(
    (time: number, opts?: { immediate?: boolean }) => {
      let t = time;
      if (restrictedRange) {
        t = Math.min(Math.max(t, restrictedRange.start), restrictedRange.end);
      }

      setTime(t, true);
      onPreview?.(t);

      lastRequestedTimeRef.current = t;

      const now = Date.now();
      holdUntilRef.current = now + (opts?.immediate ? 0 : debounceMs) + holdAfterMs;

      clearSeekTimeout();
      const delay = opts?.immediate ? 0 : debounceMs;

      seekTimeoutRef.current = window.setTimeout(() => {
        const finalT = lastRequestedTimeRef.current;
        if (finalT == null) return;

        onCommit?.(finalT);

        holdUntilRef.current = Date.now() + holdAfterMs;
        seekTimeoutRef.current = null;
      }, delay);
    },
    [debounceMs, holdAfterMs, onCommit, onPreview, setTime, restrictedRange]
  );

  const handleSeekByClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (totalDuration > 0) {
        let newPosition = x * totalDuration;
        if (restrictedRange) {
          newPosition = Math.min(Math.max(newPosition, restrictedRange.start), restrictedRange.end);
        }
        setTime(newPosition, true);
        pendingSeekPosition.current = newPosition;
      }
    },
    [totalDuration, setTime, restrictedRange]
  );

  const applyPendingSeek = useCallback(() => {
    if (pendingSeekPosition.current !== null) {
      requestSeek(pendingSeekPosition.current);
      pendingSeekPosition.current = null;
    }
  }, [requestSeek]);

  // Create a ref to hold the latest values of dependencies so we can use them in event handlers without re-binding
  const latestStateRef = useRef({
    isDragging,
    handleSeekByClientX,
    applyPendingSeek,
  });

  // Keep the ref updated with latest values on every render
  useEffect(() => {
    latestStateRef.current = {
      isDragging,
      handleSeekByClientX,
      applyPendingSeek,
    };
  }, [isDragging, handleSeekByClientX, applyPendingSeek]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      // Direct state updates are fine, but for logic dependent on current state, use ref
      setIsDragging(true);
      latestStateRef.current.handleSeekByClientX(e.clientX);
    };

    const onMouseMove = (e: MouseEvent) => {
      // Check ref instead of closure variable
      if (latestStateRef.current.isDragging) {
        latestStateRef.current.handleSeekByClientX(e.clientX);
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      latestStateRef.current.applyPendingSeek();
    };

    const onTouchStart = (e: TouchEvent) => {
      setIsDragging(true);
      latestStateRef.current.handleSeekByClientX(e.touches[0].clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (latestStateRef.current.isDragging) {
        latestStateRef.current.handleSeekByClientX(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      setIsDragging(false);
      latestStateRef.current.applyPendingSeek();
    };

    // Add listeners ONCE.
    // Note: { passive: true } is used for touch events to improve scrolling performance and remove violations.
    el.addEventListener("mousedown", onMouseDown as never);
    el.addEventListener("mousemove", onMouseMove as never);
    el.addEventListener("touchstart", onTouchStart as never, { passive: true });
    el.addEventListener("touchmove", onTouchMove as never, { passive: true });

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("mousedown", onMouseDown as never);
      el.removeEventListener("mousemove", onMouseMove as never);
      el.removeEventListener("touchstart", onTouchStart as never);
      el.removeEventListener("touchmove", onTouchMove as never);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (!isDragging && !isUiHoldActive()) {
      setTime(currentTime);
    }
  }, [currentTime, setTime, isDragging]);

  useEffect(() => clearSeekTimeout, []);

  const uiTime = (() => {
    if (isDragging && pendingSeekPosition.current != null) {
      return pendingSeekPosition.current;
    }
    if (isUiHoldActive() && lastRequestedTimeRef.current != null) {
      return lastRequestedTimeRef.current;
    }
    return currentTime;
  })();

  return {
    containerRef,
    isDragging,
    uiTime,
    requestSeek,
  };
}