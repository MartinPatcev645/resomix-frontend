import React, { useMemo } from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { fmtClock, Spinner, TimeAxis } from "@/pages/analysis/charts.tsx";
import { ChromaView, SpectrogramView, StemArea, STEM_COLORS } from "@/pages/analysis/heatviz.tsx";
import { sectionAtMs } from "@/utils/structureStrip.ts";
import { topSeriesByMean } from "@/utils/analysisTimeline.ts";
import { StructureStrip } from "../StructureStrip.tsx";
import { EnergyLane } from "./EnergyLane.tsx";
import { HeatRows } from "./HeatRows.tsx";
import { TimelineLane, LANE_GRID } from "./TimelineLane.tsx";
import { TimeRuler } from "./TimeRuler.tsx";

/** Lane heights, in px at the design root size. Compact halves the tall ones for short viewports. */
const HEIGHTS = {
  desktop: { ruler: 18, structure: 64, energy: 120, spectrum: 140, pitch: 96, row: 14, stems: 110 },
  compact: { ruler: 18, structure: 52, energy: 80, spectrum: 96, pitch: 64, row: 10, stems: 72 },
  mobile: { ruler: 16, structure: 48, energy: 72, spectrum: 84, pitch: 60, row: 12, stems: 72 },
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

  const genreRows = useMemo(() => topSeriesByMean(data.timeline.genreOverTime, 5), [data.timeline.genreOverTime]);
  const moodRows = useMemo(() => topSeriesByMean(data.timeline.moodOverTime, 4), [data.timeline.moodOverTime]);
  const instrumentRows = useMemo(
    () => topSeriesByMean(data.timeline.instrumentOverTime, 5),
    [data.timeline.instrumentOverTime],
  );

  const nyquist = data.identity.sampleRateHz > 0 ? data.identity.sampleRateHz / 2 : 22050;
  const spectrumAxis = [1, 0.75, 0.5, 0.25, 0].map((f) => fmtHz(nyquist * f));
  const tonic = data.tonality.key ? data.tonality.key.replace(/\s.*$/, "") : null;
  const bpmText = data.rhythm.bpm == null ? null : `${Number.isInteger(data.rhythm.bpm) ? data.rhythm.bpm : data.rhythm.bpm.toFixed(1)} BPM`;

  const spectrogram = data.spectral.linearSpectrogram ?? data.spectral.melSpectrogram;

  return (
    <div className="flex flex-col gap-[var(--px-10)]">
      <div className={`flex flex-wrap items-baseline justify-between gap-[var(--px-8)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)] lg:text-[length:var(--px-11)]`}>
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
              className="cursor-pointer rounded-[var(--px-4)] border border-[var(--an-border)] px-[var(--px-8)] py-[var(--px-2)] uppercase tracking-[0.06em] text-[var(--an-text-muted)] transition-colors duration-[var(--an-fast)] hover:border-[var(--an-tab-border-hover)] hover:text-[var(--an-text-strong)]"
            >
              {compact ? "full height" : "compact"}
            </button>
          )}
        </span>
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

        {genreRows.length > 0 && <HeatRows title="Genre" rows={genreRows} rowHeight={h.row} />}
        {moodRows.length > 0 && <HeatRows title="Mood" rows={moodRows} rowHeight={h.row} />}
        {instrumentRows.length > 0 && <HeatRows title="Instruments" rows={instrumentRows} rowHeight={h.row} />}

        {Object.keys(data.composition.stems).length > 0 ? (
          <TimelineLane
            title="Stems"
            meta="source separation"
            gutterExtra={
              <span className="flex flex-col gap-[var(--px-2)]">
                {Object.keys(data.composition.stems).map((name) => (
                  <span key={name} className="flex items-center gap-[var(--px-5)] font-fira text-[length:var(--px-9)] text-[var(--an-text-muted)]">
                    <span className="inline-block h-[var(--px-6)] w-[var(--px-6)] rounded-full" style={{ background: STEM_COLORS[name] ?? "#888" }} />
                    {name} · {data.composition.stems[name].presencePct.toFixed(0)}%
                  </span>
                ))}
              </span>
            }
          >
            <StemArea
              stems={data.composition.stems}
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

      {data.structure?.summary && (
        <p className="m-0 max-w-[900px] font-helvetica text-[length:var(--px-12)] font-light leading-[1.6] text-[var(--an-text-secondary)] lg:text-[length:var(--px-13)]">
          {data.structure.summary}
        </p>
      )}
    </div>
  );
};

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
