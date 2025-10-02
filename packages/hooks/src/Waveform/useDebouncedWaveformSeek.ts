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
      setTime(time, true);
      onPreview?.(time);

      lastRequestedTimeRef.current = time;

      const now = Date.now();
      holdUntilRef.current = now + (opts?.immediate ? 0 : debounceMs) + holdAfterMs;

      clearSeekTimeout();
      const delay = opts?.immediate ? 0 : debounceMs;

      seekTimeoutRef.current = window.setTimeout(() => {
        const t = lastRequestedTimeRef.current;
        if (t == null) return;

        onCommit?.(t);

        holdUntilRef.current = Date.now() + holdAfterMs;
        seekTimeoutRef.current = null;
      }, delay);
    },
    [debounceMs, holdAfterMs, onCommit, onPreview, setTime]
  );

  const handleSeekByClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (totalDuration > 0) {
        const newPosition = x * totalDuration;
        setTime(newPosition, true);
        pendingSeekPosition.current = newPosition;
      }
    },
    [totalDuration, setTime]
  );

  const applyPendingSeek = useCallback(() => {
    if (pendingSeekPosition.current !== null) {
      requestSeek(pendingSeekPosition.current);
      pendingSeekPosition.current = null;
    }
  }, [requestSeek]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      setIsDragging(true);
      handleSeekByClientX(e.clientX);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleSeekByClientX(e.clientX);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      applyPendingSeek();
    };

    const onTouchStart = (e: TouchEvent) => {
      setIsDragging(true);
      handleSeekByClientX(e.touches[0].clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging) handleSeekByClientX(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      setIsDragging(false);
      applyPendingSeek();
    };

    el.addEventListener("mousedown", onMouseDown as never);
    el.addEventListener("mousemove", onMouseMove as never);
    el.addEventListener("touchstart", onTouchStart as never);
    el.addEventListener("touchmove", onTouchMove as never);

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
  }, [applyPendingSeek, handleSeekByClientX, isDragging]);

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