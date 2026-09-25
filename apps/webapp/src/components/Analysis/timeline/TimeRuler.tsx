import React from "react";
import { fmtClock } from "@/pages/analysis/charts.tsx";

/** How far up the baseline each mark reaches, in px. */
const TICK = 4;

/**
 * The shared time ruler, drawn once above the lanes and mirrored once below them.
 *
 * Ticks every minute on desktop and every two minutes on a phone, because a 390px lane cannot
 * carry seven labels without them touching. Both ends are always printed: the track starts at
 * 0:00 and the total length sits at the right edge, so the scale reads even on a short track with
 * no interior tick at all. An interior tick that would collide with the end label is dropped.
 *
 * Each label carries a mark on the baseline under it. The label alone says WHAT the time is; the
 * mark says exactly WHERE it falls, which is the thing a reader actually needs when they are
 * lining a section up against the clock.
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
  const marks: { ms: number; frac: number; align: "start" | "middle" | "end" }[] = [];

  if (durationMs > 0) {
    marks.push({ ms: 0, frac: 0, align: "start" });
    if (step > 0) {
      for (let t = step; t < durationMs; t += step) {
        // Drop a tick that would print under the duration label at the right edge.
        if (t / durationMs < 0.94) marks.push({ ms: t, frac: t / durationMs, align: "middle" });
      }
    }
    marks.push({ ms: durationMs, frac: 1, align: "end" });
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div
        className={`absolute inset-x-0 h-px bg-[var(--an-grid)] ${flip ? "top-0" : "bottom-0"}`}
        aria-hidden="true"
      />
      {marks.map((m) => {
        // The two ends hug the lane edges rather than centring on them, so neither the mark nor
        // its label hangs outside the chart it measures.
        const x =
          m.align === "start"
            ? { left: 0 }
            : m.align === "end"
              ? { right: 0 }
              : { left: `${m.frac * 100}%`, transform: "translateX(-50%)" };
        return (
          <React.Fragment key={m.ms}>
            <span
              aria-hidden="true"
              className="absolute w-px bg-[var(--an-grid)]"
              style={{ ...x, height: TICK, ...(flip ? { top: 0 } : { bottom: 0 }) }}
            />
            <span
              className="absolute font-fira text-[length:var(--px-9)] leading-none text-[var(--an-text-muted)]"
              style={{ ...x, ...(flip ? { bottom: 2 } : { top: 2 }) }}
            >
              {fmtClock(m.ms)}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
