import React from "react";
import { fmtClock } from "@/pages/analysis/charts.tsx";

/**
 * The shared time ruler, drawn once above the lanes and mirrored once below them.
 *
 * Ticks every minute on desktop and every two minutes on a phone, because a 390px lane cannot
 * carry seven labels without them touching. The last tick is dropped when it would collide with
 * the end of the lane, and the track's total length is always printed at the right edge so the
 * scale is readable even on a short track with a single tick.
 */
export const TimeRuler: React.FC<{
  durationMs: number;
  /** Seconds between ticks. 60 on desktop, 120 on a phone. */
  stepSeconds?: number;
  height: number;
  /** The bottom ruler mirrors the top one: baseline above the ticks instead of below. */
  flip?: boolean;
}> = ({ durationMs, stepSeconds = 60, height, flip = false }) => {
  const step = stepSeconds * 1000;
  const ticks: number[] = [];
  if (durationMs > 0 && step > 0) {
    for (let t = step; t < durationMs; t += step) {
      // Drop a tick that would print under the duration label at the right edge.
      if (t / durationMs < 0.94) ticks.push(t);
    }
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div
        className={`absolute inset-x-0 h-px bg-[var(--an-grid)] ${flip ? "top-0" : "bottom-0"}`}
        aria-hidden="true"
      />
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute font-fira text-[length:var(--px-9)] leading-none text-[var(--an-text-muted)]"
          style={{ left: `${(t / durationMs) * 100}%`, transform: "translateX(-50%)", ...(flip ? { bottom: 2 } : { top: 2 }) }}
        >
          {fmtClock(t)}
        </span>
      ))}
      <span
        className="absolute right-0 font-fira text-[length:var(--px-9)] leading-none text-[var(--an-text-muted)]"
        style={flip ? { bottom: 2 } : { top: 2 }}
      >
        {fmtClock(durationMs)}
      </span>
    </div>
  );
};
