import React, { useMemo } from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { sectionTone } from "@/utils/sectionColors.ts";
import { sectionAtMs, sectionWord } from "@/utils/structureStrip.ts";
import { envelopeColumns } from "@/utils/analysisTimeline.ts";

/** Enough columns for a lane about a thousand pixels wide, fewer than the curve has frames. */
const COLUMNS = 720;
/** How much of the half-height the loudest column fills, so a peak never touches the edge. */
const REACH = 0.94;

/**
 * The Waveform lane, at the top of the Timeline with the Structure strip directly beneath it.
 *
 * A DJ reads a track from its waveform first, the way every deck shows it, so it leads. It is the
 * short-term RMS mirrored around a centre line, one column per few frames keeping the loudest,
 * which is the shape a DJ recognises without a legend. The redesign had folded the old waveform
 * into the Energy lane; this brings the shape back without undoing that, because Energy answers a
 * different question (how loud each BAR is) at a different resolution.
 *
 * Each stretch is filled in the colour of the section it falls in, never the accent. The handoff
 * keeps orange for the playhead alone, and a section-coloured waveform lines up with the strip
 * below it at a glance: the drop is orange above AND below the line where the strip says drop.
 */
export const WaveformLane: React.FC<{
  data: AnalysisData;
  durationMs: number;
  height: number;
}> = ({ data, durationMs, height }) => {
  const columns = useMemo(
    () => envelopeColumns(data.technical.rmsEnergyCurve?.values, COLUMNS),
    [data.technical.rmsEnergyCurve],
  );
  const segments = data.energy.structureSegments;

  // Consecutive columns in the same section become one polygon, so a four-minute track is a
  // dozen shapes rather than seven hundred.
  const runs = useMemo(() => {
    const n = columns.length;
    if (!n || durationMs <= 0) return [];
    const colour = (c: number) => {
      const section = sectionAtMs(segments, ((c + 0.5) / n) * durationMs);
      return section ? sectionTone(sectionWord(section)).fg : null;
    };
    const out: { points: string; fill: string; muted: boolean }[] = [];
    let start = 0;
    let current = colour(0);
    const close = (end: number) => {
      const top: string[] = [];
      const bottom: string[] = [];
      for (let c = start; c < end; c++) {
        const amp = columns[c] * 50 * REACH;
        top.push(`${c},${(50 - amp).toFixed(2)}`, `${c + 1},${(50 - amp).toFixed(2)}`);
        bottom.push(`${c},${(50 + amp).toFixed(2)}`, `${c + 1},${(50 + amp).toFixed(2)}`);
      }
      out.push({
        points: [...top, ...bottom.reverse()].join(" "),
        fill: current ?? "var(--an-text-muted)",
        muted: current == null,
      });
    };
    for (let c = 1; c < n; c++) {
      const next = colour(c);
      if (next !== current) {
        close(c);
        start = c;
        current = next;
      }
    }
    close(n);
    return out;
  }, [columns, segments, durationMs]);

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--px-4)] bg-[var(--an-lane)]" style={{ height }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--an-grid)]" />
      {runs.length > 0 && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${columns.length} 100`}
          preserveAspectRatio="none"
        >
          {runs.map((run, i) => (
            <polygon key={i} points={run.points} style={{ fill: run.fill, opacity: run.muted ? 0.5 : 1 }} />
          ))}
        </svg>
      )}
    </div>
  );
};
