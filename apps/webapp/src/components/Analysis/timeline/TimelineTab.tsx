import React, { useMemo } from "react";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { fmtClock, hexA, Spinner, TimeAxis, useToggleSet } from "@/pages/analysis/charts.tsx";
import { ChromaView, Donut, RibbonChart, SpectrogramView, StemArea, STEM_COLORS } from "@/pages/analysis/heatviz.tsx";
import { sectionAtMs } from "@/utils/structureStrip.ts";
import { StructureStrip } from "../StructureStrip.tsx";
import { EnergyLane } from "./EnergyLane.tsx";
import { TimelineLane, LANE_GRID } from "./TimelineLane.tsx";
import { TimeRuler } from "./TimeRuler.tsx";

/** Lane heights, in px at the design root size. Compact halves the tall ones for short viewports. */
const HEIGHTS = {
  desktop: { ruler: 18, structure: 64, energy: 120, spectrum: 140, pitch: 96, row: 18, stems: 110 },
  compact: { ruler: 18, structure: 52, energy: 80, spectrum: 96, pitch: 64, row: 12, stems: 72 },
  mobile: { ruler: 16, structure: 48, energy: 72, spectrum: 84, pitch: 60, row: 14, stems: 72 },
};

const CHROMA_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** `--an-pitch` (#4fd1e0) as canvas channels. */
const PITCH_TINT: [number, number, number] = [79, 209, 224];

const fmtHz = (hz: number) => (hz >= 1000 ? `${Math.round(hz / 1000)}k` : `${Math.round(hz)}`);

/**
 * The Timeline tab: everything that happens over time, on one ruler with one playhead.
 *
 * The point of the redesign is here. Thirteen panels each carried their own x-axis, so comparing
 * "where the vocal enters" with "where the energy lifts" meant measuring two charts by eye. Now a
 * single grid owns the x: each lane is `gutter · chart · right axis` with identical columns, the
 * ruler is printed once at the top and mirrored at the bottom, and ONE playhead line crosses the
 * lot. Per-chart playheads are deliberately switched off (`currentMs={null}` on every TimeAxis)
 * so there is exactly one moving line on the page; hover, tooltips and click-to-seek stay.
 */
export const TimelineTab: React.FC<{
  data: AnalysisData;
  durationMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
  isDesktop: boolean;
  compact: boolean;
  onToggleCompact: () => void;
  /** Part 2 (structure, genre, mood, stems) has not landed yet. */
  pending: boolean;
}> = ({ data, durationMs, currentMs, onSeek, isDesktop, compact, onToggleCompact, pending }) => {
  const h = !isDesktop ? HEIGHTS.mobile : compact ? HEIGHTS.compact : HEIGHTS.desktop;
  const segments = data.energy.structureSegments;
  const shownSections = segments.filter((s) => !s.hidden).length;
  const totalBars = segments.reduce((sum, s) => sum + (s.bars ?? 0), 0);
  const frac = durationMs > 0 ? Math.min(1, Math.max(0, currentMs / durationMs)) : 0;

  const stemNames = useMemo(() => Object.keys(data.composition.stems), [data.composition.stems]);
  const { hidden: stemsHidden, toggle: toggleStem } = useToggleSet(stemNames.length);

  const nyquist = data.identity.sampleRateHz > 0 ? data.identity.sampleRateHz / 2 : 22050;
  const spectrumAxis = [1, 0.75, 0.5, 0.25, 0].map((f) => fmtHz(nyquist * f));
  const tonic = data.tonality.key ? data.tonality.key.replace(/\s.*$/, "") : null;
  const bpmText = data.rhythm.bpm == null ? null : `${Number.isInteger(data.rhythm.bpm) ? data.rhythm.bpm : data.rhythm.bpm.toFixed(1)} BPM`;

  const spectrogram = data.spectral.linearSpectrogram ?? data.spectral.melSpectrogram;
  // Structure and Energy read as one block, so they stay tight. Everything below them is a
  // separate reading of the track and gets room to breathe, except in compact, which exists
  // precisely to give that room back.
  const spacedLane = compact ? "" : "mt-[var(--px-14)]";

  return (
    <div className="flex flex-col gap-[var(--px-10)]">
      {/* The reading of the track sits ABOVE the lanes, where it describes what the reader is
          about to look at. At the bottom it was a footnote to a chart nobody had reached yet. */}
      <div className="flex flex-col gap-[var(--px-8)] border-b border-[var(--an-rule)] pb-[var(--px-10)]">
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--px-10)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)] lg:text-[length:var(--px-11)]">
          <span>
            {shownSections ? `${shownSections} sections · ` : ""}
            {totalBars ? `${totalBars} bars · ` : ""}
            {bpmText ? `${bpmText} · ` : ""}
            {isDesktop ? "click a section to jump to its start" : "tap to seek"}
          </span>
          <span className="flex items-center gap-[var(--px-10)]">
            <span className="hidden lg:inline">LANE COLOR = SECTION · │ PLAYHEAD</span>
            {isDesktop && (
              <button
                type="button"
                onClick={onToggleCompact}
                aria-pressed={compact}
                className={[
                  "ws-focus-ring inline-flex min-h-[var(--px-28)] cursor-pointer items-center",
                  "rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent",
                  "px-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)]",
                  "text-[var(--rx-color-text-primary)] transition-[background-color,border-color]",
                  "duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
                  "hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]",
                ].join(" ")}
              >
                {compact ? "full height" : "compact"}
              </button>
            )}
          </span>
        </div>

        {data.structure?.summary && (
          <p className="m-0 max-w-[900px] font-helvetica text-[length:var(--px-12)] font-light leading-[1.6] text-[var(--an-text-secondary)] lg:text-[length:var(--px-13)]">
            {data.structure.summary}
          </p>
        )}
      </div>

      {/* One positioning context for the lanes AND the playhead, so both read the same two insets
          (`--an-lane-left` / `--an-lane-right`, defined in styles/analysis.css). */}
      <div className="an-lane-stack relative flex flex-col gap-[var(--px-14)]">
        <div className={LANE_GRID}>
          <span className="hidden lg:block" />
          <TimeRuler durationMs={durationMs} stepSeconds={isDesktop ? 60 : 120} height={h.ruler} />
          <span className="hidden lg:block" />
        </div>

        {segments.length > 0 ? (
          <TimelineLane title="Structure" meta={shownSections ? `${shownSections} sections` : undefined}>
            <TimeAxis
              durationMs={durationMs}
              currentMs={null}
              onSeek={(ms) => onSeek(sectionAtMs(segments, ms)?.startMs ?? ms)}
              tooltip={(f) => {
                const hovered = sectionAtMs(segments, f * durationMs);
                return hovered ? <span className="ml-[var(--px-6)] uppercase">{hovered.shown || hovered.label}</span> : null;
              }}
            >
              <StructureStrip segments={segments} durationMs={durationMs} currentMs={currentMs} height={h.structure} showEnds={false} />
            </TimeAxis>
          </TimelineLane>
        ) : (
          <LanePending label="Structure" pending={pending} height={h.structure} />
        )}

        <TimelineLane
          title="Energy"
          meta="RMS per bar · — LUFS"
          axis={["−6", "−10", "−14 dB"]}
        >
          <TimeAxis durationMs={durationMs} currentMs={null} onSeek={onSeek}>
            <EnergyLane data={data} durationMs={durationMs} height={h.energy} />
          </TimeAxis>
        </TimelineLane>

        <TimelineLane
          title="Spectrum"
          className={spacedLane}
          meta={isDesktop ? "Hz, linear" : `0 – ${fmtHz(nyquist)} Hz`}
          axis={spectrumAxis}
        >
          <SpectrogramView
            matrix={spectrogram}
            sampleRateHz={data.identity.sampleRateHz}
            durationMs={durationMs}
            currentMs={null}
            onSeek={onSeek}
            height={h.spectrum}
            linear={!!data.spectral.linearSpectrogram}
            chrome={false}
          />
        </TimelineLane>

        <TimelineLane
          title="Pitch"
          className={spacedLane}
          meta={tonic ? `chromagram · tonic ${tonic}` : "chromagram"}
          axis={[
            "B",
            <span key="tonic" className="text-[var(--an-pitch)]">{tonic ?? "—"}</span>,
            "C",
          ]}
        >
          <ChromaView
            matrix={data.tonality.chromagram}
            durationMs={durationMs}
            currentMs={null}
            onSeek={onSeek}
            height={h.pitch}
            labels={CHROMA_ORDER}
            tint={PITCH_TINT}
            showLabels={false}
          />
        </TimelineLane>

        {/* The shipped ribbons, unchanged: orange heat with the label inside the row. The lane
            gutter carries the group name, so they line up with every chart above them. */}
        {data.timeline.genreOverTime.series.length > 0 && (
          <TimelineLane title="Genre" meta="over time" className={spacedLane}>
            <TimeAxis durationMs={durationMs} currentMs={null} onSeek={onSeek}>
              <RibbonChart track={data.timeline.genreOverTime} rowHeight={h.row} labelTransform={shortGenre} />
            </TimeAxis>
          </TimelineLane>
        )}
        {data.timeline.moodOverTime.series.length > 0 && (
          <TimelineLane title="Mood" meta="over time" className={spacedLane}>
            <TimeAxis durationMs={durationMs} currentMs={null} onSeek={onSeek}>
              <RibbonChart track={data.timeline.moodOverTime} rowHeight={h.row} />
            </TimeAxis>
          </TimelineLane>
        )}
        {data.timeline.instrumentOverTime.series.length > 0 && (
          <TimelineLane title="Instruments" meta="over time" className={spacedLane}>
            <TimeAxis durationMs={durationMs} currentMs={null} onSeek={onSeek}>
              <RibbonChart track={data.timeline.instrumentOverTime} rowHeight={h.row} />
            </TimeAxis>
          </TimelineLane>
        )}

        {Object.keys(data.composition.stems).length > 0 ? (
          <TimelineLane
            title="Stems"
            className={spacedLane}
            gutterExtra={
              // The mix donut and the stem switches, both live: hiding a stem drops it from the
              // stacked area and fades its slice. They sit in the gutter rather than under the
              // chart so the lane keeps the same height as the ones around it.
              <div className="flex w-full flex-col items-start gap-[var(--px-8)]">
                <div className="w-full max-w-[var(--px-56)]">
                  <Donut stems={data.composition.stems} hidden={stemsHidden} />
                </div>
                <StemSwitches
                  stems={data.composition.stems}
                  hidden={stemsHidden}
                  onToggle={toggleStem}
                />
              </div>
            }
          >
            <StemArea
              stems={data.composition.stems}
              hidden={stemsHidden}
              onToggle={toggleStem}
              height={h.stems}
              durationMs={durationMs}
              currentMs={null}
              onSeek={onSeek}
              vocalRegions={data.composition.vocalRegions}
              showLegend={!isDesktop}
            />
          </TimelineLane>
        ) : (
          <LanePending label="Stems" pending={pending} height={h.stems} />
        )}

        <div className={LANE_GRID}>
          <span className="hidden lg:block" />
          <TimeRuler durationMs={durationMs} stepSeconds={isDesktop ? 60 : 120} height={h.ruler} flip />
          <span className="hidden lg:block" />
        </div>

        {/* The one playhead. Offset by the same lane insets the grid uses, so it crosses every
            chart at the moment it is actually playing rather than near it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[var(--an-playhead)]"
          style={{ left: `calc(var(--an-lane-left) + ${frac} * (100% - var(--an-lane-left) - var(--an-lane-right)))` }}
        >
          {isDesktop && (
            <span className="absolute -top-[var(--px-2)] left-0 -translate-x-1/2 rounded-[var(--px-3)] bg-[var(--an-playhead)] px-[var(--px-4)] py-[1px] font-fira text-[length:var(--px-10)] font-semibold leading-none text-[var(--an-page)]">
              {fmtClock(currentMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The stem switches, sized for the lane gutter.
 *
 * `ToggleLegend` is the page-wide control and it is right everywhere else, but at 112px its
 * checkbox and its `name · 81%` spacing force one switch per line and push the donut off the top
 * of the lane. Same behaviour, two to a row: the colour carries the state, and the percentage sits
 * in brackets so it costs a character rather than a gap.
 */
const StemSwitches: React.FC<{
  stems: AnalysisData["composition"]["stems"];
  hidden: Set<string>;
  onToggle: (name: string) => void;
}> = ({ stems, hidden, onToggle }) => (
  <div className="grid w-full grid-cols-2 gap-[var(--px-4)]">
    {Object.keys(stems).map((name) => {
      const on = !hidden.has(name);
      const color = STEM_COLORS[name] ?? "#888";
      return (
        <button
          key={name}
          type="button"
          onClick={() => onToggle(name)}
          aria-pressed={on}
          title={`${name} · ${stems[name].presencePct.toFixed(0)}% of the mix`}
          className={[
            "truncate rounded-[var(--px-3)] border px-[var(--px-4)] py-[var(--px-1)] text-left",
            "font-fira text-[length:var(--px-9)] capitalize transition-all hover:brightness-125",
            on ? "" : "opacity-40",
          ].join(" ")}
          style={{
            borderColor: on ? color : "var(--an-border)",
            background: on ? hexA(color, 0.14) : "transparent",
            color: on ? color : "var(--an-text-muted)",
          }}
        >
          {name} ({stems[name].presencePct.toFixed(0)}%)
        </button>
      );
    })}
  </div>
);

/** A lane whose data arrives with part 2, so the row keeps its place instead of the page jumping. */
const LanePending: React.FC<{ label: string; pending: boolean; height: number }> = ({ label, pending, height }) => (
  <TimelineLane title={label} meta={pending ? "computing" : "unavailable"}>
    <div
      className="flex items-center gap-[var(--px-8)] rounded-[var(--px-4)] bg-[var(--an-lane)] px-[var(--px-10)] font-helvetica text-[length:var(--px-11)] text-[var(--an-text-muted)]"
      style={{ height }}
    >
      {pending ? <Spinner size={14} /> : null}
      <span>{pending ? "still computing…" : "not available for this track"}</span>
    </div>
  </TimelineLane>
);
