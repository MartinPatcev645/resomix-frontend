import React from "react";
import type { StructureSegment } from "@/pages/analysis/data.ts";
import { fmtClock } from "@/pages/analysis/charts.tsx";
import { sectionTone } from "@/utils/sectionColors.ts";
import { sectionWord } from "@/utils/structureStrip.ts";

interface StructureStripProps {
  segments: StructureSegment[];
  durationMs: number;
  currentMs?: number | null;
  /**
   * Block height in pixels. Defaults to the panel size it was designed at; the Timeline tab passes
   * the lane height instead (64 desktop, 48 phone), where the strip is one lane among several.
   */
  height?: number;
  /**
   * The 0:00 / duration pair under the blocks. Off inside the Timeline tab, where the shared ruler
   * already prints the scale above and below every lane.
   */
  showEnds?: boolean;
}

/**
 * The section blocks under the player, in the approved "Spectrum" design (handoff 3a).
 *
 * Each block is a flat, dark tint of its word's hue with the label and bar count in the bright
 * tone of the same hue, a matching top stripe and a faint inner edge. No glow anywhere: hover
 * raises the inner edge to 40%, the section under the playhead takes it to 100%.
 *
 * Widths follow TIME, not bar counts as the handoff sketches it, because the strip sits inside
 * the page's `TimeAxis`: the playhead, the hover line and click-to-seek all map x to time, and
 * bar-count widths would drift away from them wherever the rounding or the tempo does. The 2px
 * gap between blocks is 1px of padding on each side, so it costs no alignment either.
 *
 * Hidden start / end markers stay in the row as empty spacers for the same reason.
 *
 * On narrow blocks the bar count goes first, then the label. The thresholds (64 and 48 at the
 * 1280px design width) are container queries in `em` of the block's 1rem font size, so they scale
 * with the fluid rem like every other size on the page.
 */
export const StructureStrip: React.FC<StructureStripProps> = ({
  segments,
  durationMs,
  currentMs = null,
  height,
  showEnds = true,
}) => (
  <div>
    <div className="flex w-full" style={{ height: height ?? "var(--px-84)" }}>
      {segments.map((s, i) => {
        const width = durationMs > 0 ? ((s.endMs - s.startMs) / durationMs) * 100 : 0;
        const key = `${s.startMs}-${i}`;
        if (s.hidden) {
          return <div key={key} aria-hidden="true" className="h-full shrink-0" style={{ width: `${width}%` }} />;
        }
        const tone = sectionTone(sectionWord(s));
        const active = currentMs != null && currentMs >= s.startMs && currentMs < s.endMs;
        return (
          <div key={key} className="h-full min-w-0 shrink-0 px-[var(--px-1)]" style={{ width: `${width}%` }}>
            <div
              className={[
                "@container flex h-full flex-col items-center justify-center gap-[var(--px-5)] overflow-hidden",
                "rounded-[var(--px-4)] border-t-[length:var(--px-3)] border-solid px-[var(--px-4)]",
                "font-[family-name:var(--section-font)] text-[length:var(--px-16)]",
                "[--edge:13%] hover:[--edge:40%]",
                "[box-shadow:inset_0_0_0_var(--px-1)_color-mix(in_srgb,var(--fg)_var(--edge),transparent)]",
                "transition-[box-shadow] duration-[var(--rx-duration-fast)] ease-[var(--rx-ease-standard)]",
              ].join(" ")}
              style={
                {
                  background: tone.bg,
                  color: tone.fg,
                  borderTopColor: tone.fg,
                  "--fg": tone.fg,
                  ...(active ? { "--edge": "100%" } : {}),
                } as React.CSSProperties
              }
            >
              <span className="block max-w-full overflow-hidden whitespace-nowrap text-[length:var(--px-11)] font-bold uppercase leading-none tracking-[0.06em] @max-[3em]:hidden">
                {s.label}
              </span>
              {s.bars ? (
                <span className="block max-w-full overflow-hidden whitespace-nowrap text-[length:var(--px-10)] font-medium leading-none tracking-[0.04em] opacity-70 @max-[4em]:hidden">
                  {s.bars} {s.bars === 1 ? "bar" : "bars"}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
    {showEnds && (
      <div className="mt-[var(--px-10)] flex justify-between font-[family-name:var(--section-font)] text-[length:var(--px-12)] font-normal text-[var(--section-meta)]">
        <span>0:00</span>
        <span>{fmtClock(durationMs)}</span>
      </div>
    )}
  </div>
);
