import React, { useMemo } from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { sectionTone } from "@/utils/sectionColors.ts";
import { sectionAtMs, sectionWord } from "@/utils/structureStrip.ts";
import { barMeans, barsFromDownbeats, lufsFrac, meanInRange } from "@/utils/analysisTimeline.ts";

/**
 * The Energy lane: what used to be three panels (waveform, loudness, energy journey).
 *
 * One bar per MUSICAL bar rather than per analysis frame, because the question a reader actually
 * has here is "where does this track lift", and a bar is the unit the arrangement is built from.
 * Each bar is tinted with the colour of the section it falls in, so energy and structure can be
 * read in one glance instead of two panels apart.
 *
 * The short-term loudness rides over the bars as a single pale line on a fixed −6 dB to −18 dB
 * scale (see `lufsFrac`), which is what makes the right-hand axis printable and comparable between
 * tracks. Both are drawn in the same box, so a quiet section with dense bars reads as compressed
 * rather than loud.
 *
 * Bars are DOM elements, not canvas, for the same reason `StructureStrip` is: the fills are
 * `--section-*` custom properties, and only the browser can resolve those.
 */
export const EnergyLane: React.FC<{
  data: AnalysisData;
  durationMs: number;
  height: number;
}> = ({ data, durationMs, height }) => {
  const bars = useMemo(
    () => barsFromDownbeats(data.rhythm.downbeatsSeconds, durationMs),
    [data.rhythm.downbeatsSeconds, durationMs],
  );
  const values = useMemo(() => barMeans(data.technical.rmsEnergyCurve, bars), [data.technical.rmsEnergyCurve, bars]);

  // The loudness line, sampled once per bar so it shares the bars' x positions exactly.
  const lufsPoints = useMemo(() => {
    const curve = data.technical.loudnessCurve;
    if (!curve?.values?.length || durationMs <= 0) return "";
    return bars
      .map((b) => {
        const db = meanInRange(curve, b.startMs, b.endMs);
        if (db == null || !Number.isFinite(db)) return null;
        const x = ((b.startMs + b.endMs) / 2 / durationMs) * 100;
        return `${x.toFixed(3)},${(lufsFrac(db) * 100).toFixed(3)}`;
      })
      .filter(Boolean)
      .join(" ");
  }, [data.technical.loudnessCurve, bars, durationMs]);

  const segments = data.energy.structureSegments;

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--px-4)] bg-[var(--an-lane)]" style={{ height }}>
      {/* Reference lines at the two printed axis values, −10 and −14 dB. */}
      {[33, 66].map((pct) => (
        <div
          key={pct}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--an-grid)]"
          style={{ top: `${pct}%` }}
        />
      ))}

      <div className="flex h-full w-full items-end">
        {bars.map((b, i) => {
          const section = sectionAtMs(segments, (b.startMs + b.endMs) / 2);
          const tone = section ? sectionTone(sectionWord(section)) : null;
          const width = durationMs > 0 ? ((b.endMs - b.startMs) / durationMs) * 100 : 0;
          return (
            // `items-end` on the column, not a percentage margin: a percentage margin resolves
            // against the container's WIDTH, which would push every bar off a narrow lane.
            <div key={b.index} className="flex h-full shrink-0 items-end px-[0.5px]" style={{ width: `${width}%` }}>
              <div
                className="w-full rounded-t-[1px]"
                style={{
                  height: `${Math.max(2, values[i] * 100)}%`,
                  // No section (a hidden start / end marker, or a result with no structure yet):
                  // fall back to the muted text tone rather than inventing a section colour.
                  background: tone ? tone.fg : "var(--an-text-muted)",
                  opacity: tone ? 1 : 0.5,
                }}
              />
            </div>
          );
        })}
      </div>

      {lufsPoints && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={lufsPoints}
            fill="none"
            stroke="var(--an-lufs-line)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};
