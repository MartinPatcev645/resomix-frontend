import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { fmtClock } from "@/pages/analysis/charts.tsx";
import { sectionTone } from "@/utils/sectionColors.ts";
import { sectionAtMs, sectionWord } from "@/utils/structureStrip.ts";

/**
 * The player, pinned to the top of the analysis page.
 *
 * It used to scroll away, which is the one thing a transport control must not do on a page this
 * tall: by the time a reader reached the stems they could no longer hear what they were looking
 * at. Pinned, it also carries the two bits of context the lanes below cannot show at a glance —
 * a miniature of the whole arrangement, and the name of the section playing right now.
 *
 * `top` clears the site's own sticky header rather than being 0: this page is in normal document
 * scroll, under a 3.25rem bar that appears on scroll, so a 0 offset tucked the player underneath
 * it. On a phone the same rule applies with a shorter bar.
 */
export const AnalysisStickyPlayer: React.FC<{
  data: AnalysisData;
  durationMs: number;
  currentMs: number;
  playing: boolean;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onVolume: (v: number) => void;
  isDesktop: boolean;
}> = ({ data, durationMs, currentMs, playing, volume, onTogglePlay, onSeek, onVolume, isDesktop }) => {
  const segments = data.energy.structureSegments;
  const current = sectionAtMs(segments, currentMs);
  const tone = current ? sectionTone(sectionWord(current)) : null;
  const barPosition =
    current && current.startBar != null && current.bars
      ? `bar ${current.startBar} · ${current.bars} bars`
      : null;

  return (
    <div className="sticky z-[5] -mx-[var(--px-20)] border-y border-[var(--an-border)] bg-[var(--an-player)] px-[var(--px-20)] py-[var(--px-12)] md:-mx-[var(--px-56)] md:px-[var(--px-56)] lg:-mx-[var(--px-80)] lg:px-[var(--px-80)]"
      style={{ top: "var(--nav-sticky-h, 3.25rem)" }}
    >
      <div className="flex flex-col gap-[var(--px-10)] lg:grid lg:grid-cols-[auto_auto_1fr_auto_auto] lg:items-center lg:gap-[var(--px-18)]">
        <div className="flex items-center gap-[var(--px-12)]">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="grid h-[var(--px-44)] w-[var(--px-44)] shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--an-accent)] text-[var(--an-page)] transition-opacity hover:opacity-90 lg:h-[var(--px-36)] lg:w-[var(--px-36)]"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] fill-current" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] translate-x-[1px] fill-current" aria-hidden="true">
                <polygon points="7,5 19,12 7,19" />
              </svg>
            )}
          </button>

          <span className="font-fira text-[length:var(--px-13)] text-[var(--an-text)]">
            {fmtClock(currentMs)}
            <span className="text-[var(--an-text-faint)]"> / {fmtClock(durationMs)}</span>
          </span>

          {/* The chip on a phone sits next to the clock; on desktop it has its own column. */}
          {!isDesktop && <SectionChip label={current?.shown || current?.label} bar={barPosition} tone={tone} bassEntryMs={data.energy.bassEntryMs} />}
        </div>

        {isDesktop && <span className="hidden lg:block" />}

        <MiniStructure segments={segments} durationMs={durationMs} currentMs={currentMs} onSeek={onSeek} />

        {isDesktop && <SectionChip label={current?.shown || current?.label} bar={barPosition} tone={tone} bassEntryMs={data.energy.bassEntryMs} />}

        <label className="hidden items-center gap-[var(--px-8)] lg:flex">
          <span className="font-fira text-[length:var(--px-10)] uppercase tracking-[0.06em] text-[var(--an-text-faint)]">vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-[var(--px-2)] w-[var(--px-80)] cursor-pointer accent-[var(--an-accent)]"
          />
        </label>
      </div>
    </div>
  );
};

/** The whole arrangement at 10px tall: where you are, and what is left. Click anywhere to seek. */
const MiniStructure: React.FC<{
  segments: AnalysisData["energy"]["structureSegments"];
  durationMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
}> = ({ segments, durationMs, currentMs, onSeek }) => {
  const frac = durationMs > 0 ? Math.min(1, Math.max(0, currentMs / durationMs)) : 0;
  return (
    <div
      role="presentation"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (r.width > 0 && durationMs > 0) onSeek(((e.clientX - r.left) / r.width) * durationMs);
      }}
      className="relative h-[var(--px-10)] w-full cursor-pointer overflow-hidden rounded-[var(--px-2)] bg-[var(--an-lane)] lg:h-[var(--px-10)]"
    >
      <div className="flex h-full w-full">
        {segments.map((s, i) => {
          const width = durationMs > 0 ? ((s.endMs - s.startMs) / durationMs) * 100 : 0;
          if (s.hidden) return <span key={`${s.startMs}-${i}`} className="h-full shrink-0" style={{ width: `${width}%` }} />;
          return (
            <span
              key={`${s.startMs}-${i}`}
              title={s.shown || s.label}
              className="h-full shrink-0 px-[0.5px]"
              style={{ width: `${width}%` }}
            >
              <span className="block h-full w-full" style={{ background: sectionTone(sectionWord(s)).fg }} />
            </span>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-[2px] bg-white"
        style={{ left: `${frac * 100}%` }}
      />
    </div>
  );
};

/** What is playing right now, in its section's own colour. */
const SectionChip: React.FC<{
  label?: string;
  bar: string | null;
  tone: { bg: string; fg: string } | null;
  bassEntryMs: number;
}> = ({ label, bar, tone, bassEntryMs }) => {
  if (!label || !tone) {
    return (
      <span className="flex h-[var(--px-28)] shrink-0 items-center rounded-[var(--px-4)] px-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase text-[var(--an-text-muted)]">
        bass in @ {(bassEntryMs / 1000).toFixed(0)}s
      </span>
    );
  }
  return (
    <span
      className="flex h-[var(--px-28)] shrink-0 items-center gap-[var(--px-6)] rounded-[var(--px-4)] px-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase"
      style={{
        background: tone.bg,
        color: tone.fg,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone.fg} 33%, transparent)`,
      }}
    >
      {label}
      {bar && <span className="opacity-60">{bar}</span>}
    </span>
  );
};
