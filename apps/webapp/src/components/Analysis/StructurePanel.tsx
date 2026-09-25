import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { Panel, Spinner, TimeAxis } from "@/pages/analysis/charts.tsx";
import { sectionAtMs } from "@/utils/structureStrip.ts";
// By path, like this component itself: App.tsx loads the `@/components` barrel eagerly.
import { StructureStrip } from "./StructureStrip.tsx";

interface StructurePanelProps {
  data: AnalysisData;
  durationMs: number;
  currentMs: number | null;
  onSeek: (ms: number) => void;
  /** Part 2 has not landed yet. Structure is computed on the GPU, so it arrives with part 2. */
  pending: boolean;
}

/**
 * The track's structure as a strip under the player. Clicking a section seeks to its start.
 *
 * Drawn ONLY from the `structure` block. The v1 / v2 readings it replaces were withdrawn, so an
 * older result that still carries them shows no panel at all rather than bringing them back.
 *
 *   still computing   a loader, because structure arrives with part 2
 *   no beat grid      the reading's own sentence, rather than an empty strip
 *   neither           nothing: the feature is off, or the service could not produce it
 */
export const StructurePanel: React.FC<StructurePanelProps> = ({ data, durationMs, currentMs, onSeek, pending }) => {
  const structure = data.structure;

  if (!structure) {
    if (!pending) return null;
    return (
      <Panel title="Structure" subtitle="sections · computing">
        <div className="flex h-[var(--px-44)] items-center gap-[var(--px-10)] font-helvetica text-[length:var(--px-12)] opacity-60">
          <Spinner size={18} />
          <span>Reading the arrangement…</span>
        </div>
      </Panel>
    );
  }

  if (structure.status === "gate") {
    return (
      <Panel title="Structure">
        <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light opacity-70">
          {structure.gate ?? "No clear sections."}
        </p>
      </Panel>
    );
  }

  const segments = data.energy.structureSegments;
  const shownCount = segments.filter((s) => !s.hidden).length;
  const totalBars = segments.reduce((sum, s) => sum + (s.bars ?? 0), 0);
  const active = currentMs == null ? undefined : sectionAtMs(segments, currentMs);

  return (
    <Panel
      title="Structure"
      subtitle={`${shownCount} sections${totalBars ? ` · ${totalBars} bars` : ""} · click to seek`}
      right={
        <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
          {active ? (
            <span className="uppercase">{active.shown || active.label}</span>
          ) : (
            <span>bass in @ {(data.energy.bassEntryMs / 1000).toFixed(0)}s</span>
          )}
        </div>
      }
    >
      {/* A click jumps to the START of the section under it, not the exact spot, so a DJ lands on
          the phrase. Over a hidden start / end marker there is no section, so it seeks as clicked. */}
      <TimeAxis
        durationMs={durationMs}
        currentMs={currentMs}
        onSeek={(ms) => onSeek(sectionAtMs(segments, ms)?.startMs ?? ms)}
        tooltip={(f) => {
          // The full rendered text, so the tooltip carries the measured modifiers the block has no
          // room for. Nothing over a hidden start / end marker, which the reading does not name.
          const hovered = sectionAtMs(segments, f * durationMs);
          return hovered ? <span className="ml-[var(--px-6)] uppercase">{hovered.shown || hovered.label}</span> : null;
        }}
      >
        <StructureStrip segments={segments} durationMs={durationMs} currentMs={currentMs} />
      </TimeAxis>
      {structure.summary && (
        <p className="m-0 mt-[var(--px-10)] font-helvetica text-[length:var(--px-11)] font-light leading-[var(--px-16)] opacity-60">
          {structure.summary}
        </p>
      )}
    </Panel>
  );
};
