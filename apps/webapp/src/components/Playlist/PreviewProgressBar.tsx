import React, { useCallback, useRef } from "react";

/**
 * Simple clickable progress line for Apple Music preview tracks — the catalogue playback path has no
 * server peaks, so instead of a waveform we show a plain bar that spans the preview's OWN length.
 * (The full track length is shown separately as metadata.) Click maps to a seek.
 */
export function PreviewProgressBar({
  currentTime,
  duration,
  onSeek,
  compact = false,
}: {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  /** Inline row player — 2px track, ink fill on soft track. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onSeek(frac * duration);
    },
    [duration, onSeek],
  );

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={
        compact
          ? "relative h-[var(--px-2)] w-full cursor-pointer overflow-hidden rounded-full bg-[var(--color-primary)]/15"
          : "relative h-[var(--px-6)] w-full cursor-pointer overflow-hidden rounded-full bg-white/15"
      }
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(currentTime) || 0}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[var(--color-primary-hover)] transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
