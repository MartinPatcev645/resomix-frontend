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
  const hitRef = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = hitRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onSeek(frac * duration);
    },
    [duration, onSeek],
  );

  return (
    // Wrapper takes its height from the visible line only, so surrounding layout is unchanged.
    <div className="relative w-full">
      {/* Visible progress line (non-interactive). */}
      <div
        className={
          compact
            ? "relative h-[var(--px-2)] w-full overflow-hidden rounded-full bg-[var(--color-primary)]/15"
            : "relative h-[var(--px-6)] w-full overflow-hidden rounded-full bg-white/15"
        }
      >
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-primary-hover)] transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Transparent hit layer — much taller than the line so the bar is easy to click/seek. It's
          absolutely positioned and centered over the line, so it enlarges the click target without
          changing the layout height or the line's width (click→time mapping stays exact). */}
      <div
        ref={hitRef}
        onClick={handleClick}
        className="absolute inset-x-0 top-1/2 h-[var(--px-20)] -translate-y-1/2 cursor-pointer"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime) || 0}
      />
    </div>
  );
}
