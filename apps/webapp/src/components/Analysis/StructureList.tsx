import React, { useState } from "react";
import { fmtClock } from "@/pages/analysis/charts.tsx";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { sectionWord, structureListMeta, type MergedStructureSegment } from "@/utils/structureStrip.ts";

/** Rows shown on a phone before the rest go behind the toggle. Desktop always lists every row. */
const STRUCTURE_VISIBLE_MOBILE = 6;

/** Words drawn with accent emphasis. Only the peak vocabulary ever says "drop". */
const SECTION_HOT: Record<string, boolean> = { drop: true };

/**
 * The track's arrangement, as a numbered chronological table.
 *
 * A table rather than the proportional strip, because a strip encodes duration as width, the one
 * property a reader cannot measure by eye, and it hides the names of short sections. A list gives
 * every section a name, a bar count and a time however brief it is, and wraps on a narrow screen.
 *
 * Drops carry an accent left border AND an accent name, with the timing and the row number left
 * plain, so the emphasis survives greyscale and colour-blindness rather than being the only signal.
 */
export const StructureList: React.FC<{ segments: MergedStructureSegment[]; className?: string }> = ({
  segments,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(false);
  const collapsible = segments.length > STRUCTURE_VISIBLE_MOBILE;

  return (
    <div className={`border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] ${className}`}>
      <div className="flex items-center justify-between gap-[var(--px-12)] border-b border-[var(--rx-color-border-subtle)] px-[var(--px-14)] py-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]">
        <span>Track structure</span>
        {/* Two forms of the same fact: the full wording does not fit beside the title at 320px. */}
        <span className="text-right tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
          <span className="lg:hidden">{structureListMeta(segments, { short: true })}</span>
          <span className="hidden lg:inline">{structureListMeta(segments)}</span>
        </span>
      </div>

      <ul className="m-0 list-none p-0">
        {segments.map((s, i) => {
          const hot = SECTION_HOT[sectionWord(s)] ?? false;
          // Hidden on a phone only; desktop has the height for the full arrangement.
          const overflow = collapsible && !expanded && i >= STRUCTURE_VISIBLE_MOBILE;
          return (
            <li
              key={`${s.label}-${s.startMs}`}
              className={[
                overflow ? "hidden lg:grid" : "grid",
                "grid-cols-[var(--px-28)_minmax(0,1fr)_auto] lg:grid-cols-[var(--px-32)_minmax(0,1fr)_auto]",
                "min-h-[var(--px-44)] items-center gap-[var(--px-10)]",
                "border-t border-[var(--rx-color-border-subtle)] first:border-t-0",
                "py-[var(--px-8)] pl-[var(--px-12)] pr-[var(--px-14)] border-l-2",
                hot ? "border-l-[var(--color-accent,#EE4A26)] bg-[rgba(238,74,38,.05)]" : "border-l-transparent",
              ].join(" ")}
            >
              <span
                className={`font-fira text-[length:var(--px-11)] tabular-nums ${
                  hot ? "text-[rgba(238,74,38,.8)]" : "text-[var(--rx-color-text-muted)]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] [overflow-wrap:anywhere] ${
                    hot ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--rx-color-text-secondary)]"
                  }`}
                >
                  {s.shown || s.label}
                </span>
                {s.bars ? (
                  <span className="block font-fira text-[length:var(--px-10)] tabular-nums text-[var(--rx-color-text-muted)]">
                    {s.bars} {s.bars === 1 ? "bar" : "bars"}
                  </span>
                ) : null}
              </span>
              {/* Tabular and nowrap: times are the column a reader scans, so they must line up and
                  must never be the thing that wraps. The name wraps instead. */}
              <span className="whitespace-nowrap text-right font-fira text-[length:var(--px-12)] tabular-nums text-[var(--rx-color-text-primary)]">
                {fmtClock(s.startMs)}–{fmtClock(s.endMs)}
              </span>
            </li>
          );
        })}
      </ul>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`block w-full min-h-[var(--px-44)] cursor-pointer border-0 border-t border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,.02)] p-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)] transition-colors hover:bg-[rgba(255,255,255,.05)] hover:text-[var(--rx-color-text-primary)] lg:hidden ${WORKSPACE_FOCUS_VISIBLE}`}
        >
          {expanded ? "Show fewer sections" : `Show all ${segments.length} sections`}
        </button>
      )}
    </div>
  );
};
