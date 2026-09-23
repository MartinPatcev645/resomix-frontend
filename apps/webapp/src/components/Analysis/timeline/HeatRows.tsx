import React, { useEffect, useRef } from "react";
import { LANE_GRID } from "./TimelineLane.tsx";

/**
 * The genre / mood / instrument rows of the Timeline tab.
 *
 * One row per label, brightness = that label's score at that moment, drawn in the page's plain
 * text tone rather than orange: on this page orange means playhead, and a heat row that glowed
 * orange read as "this is the important one" when it only meant "this is a row".
 *
 * Each row is its own lane grid rather than a label sitting inside the chart, so the heat starts
 * at exactly the same x as every other lane and the one playhead crosses all of them honestly.
 * The row name sits in the lane gutter, right-aligned against the charts.
 *
 * A row is a 1px-tall canvas stretched to the row height, so a 900-frame series costs one bitmap
 * rather than 900 elements. Rows the model is unsure about (mean below `dimBelow`) are dimmed as a
 * whole, which is the handoff's way of saying "present, but do not read too much into it".
 */
export const HeatRows: React.FC<{
  /** Group name, printed in the gutter of the first row. */
  title: string;
  rows: { label: string; values: number[]; mean: number }[];
  rowHeight: number;
  /** Rows whose mean score is under this are drawn at 55% opacity. */
  dimBelow?: number;
  labelTransform?: (label: string) => string;
}> = ({ title, rows, rowHeight, dimBelow = 0.3, labelTransform }) => (
  <div className="flex flex-col gap-[var(--px-2)]">
    {rows.map((r, i) => {
      const label = labelTransform ? labelTransform(r.label) : r.label;
      return (
        <div key={r.label} className={`flex items-center gap-[var(--px-8)] ${LANE_GRID}`} style={{ opacity: r.mean < dimBelow ? 0.55 : 1 }}>
          <span className={`flex min-w-0 items-center gap-[var(--px-8)] ${i === 0 ? "justify-between" : "justify-between lg:justify-end"}`}>
            {i === 0 ? (
              <span className="shrink-0 font-fira text-[length:var(--px-9)] font-semibold uppercase tracking-[0.06em] text-[var(--an-text-strong)] lg:text-[length:var(--px-10)]">
                {title}
              </span>
            ) : null}
            <span
              title={label}
              className="truncate font-fira text-[length:var(--px-9)] lowercase text-[var(--an-text-muted)] lg:text-[length:var(--px-10)]"
            >
              {label}
            </span>
          </span>
          <HeatRow values={r.values} height={rowHeight} />
          <span className="hidden lg:block" />
        </div>
      );
    })}
  </div>
);

/** `--an-text-strong` (#d8d2cd) at the score's alpha. */
const TINT: [number, number, number] = [216, 210, 205];

function HeatRow({ values, height }: { values: number[]; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || values.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = values.length;
    canvas.height = 1;
    const img = ctx.createImageData(values.length, 1);
    for (let c = 0; c < values.length; c++) {
      const a = Math.max(0, Math.min(1, values[c]));
      const o = c * 4;
      img.data[o] = TINT[0];
      img.data[o + 1] = TINT[1];
      img.data[o + 2] = TINT[2];
      img.data[o + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }, [values]);

  return (
    <canvas
      ref={ref}
      className="block min-w-0 flex-1 rounded-[var(--px-2)] bg-[var(--an-lane)]"
      style={{ height, imageRendering: "pixelated" }}
    />
  );
}
