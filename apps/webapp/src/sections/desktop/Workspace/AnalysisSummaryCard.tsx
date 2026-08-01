import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData, StructureSegment } from "@/pages/analysis/data.ts";
import { ACCENT } from "@/pages/analysis/charts.tsx";
import { keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import { displayOrNA } from "@/utils/trackUtils.ts";
import { formatConfidence, withConfidenceSuffix } from "@/utils/analysisConfidence.ts";
import { resolveAnalysisReadings } from "@/utils/analysisReadings.ts";
import {
  downsampleSeries,
  energySeriesCoversTrack,
  peakIndex,
  sampleTimeMs,
} from "@/utils/energyCurve.ts";
import {
  mergeStructureSegments,
  segmentInlineLabel,
  segmentShowsLabel,
  structureStripCaption,
  type MergedStructureSegment,
} from "@/utils/structureStrip.ts";
import { SubmitPendingGlyph } from "./WorkspaceStage.tsx";
import {
  ANALYSIS_SIBLING_PLAYLIST_NOTE,
  ANALYSIS_SIBLING_PLAYLIST_UNAVAILABLE,
  ANALYSIS_SIBLING_PLAYLIST_LEGACY,
  ANALYSIS_SIBLING_PLAYLIST_PENDING,
  ANALYSIS_SIBLING_PLAYLIST_PENDING_TITLE,
  ANALYSE_ANOTHER_CTA,
  ANALYSIS_SUMMARY_HEADING,
  FIND_SIMILAR_FROM_ANALYSIS_CTA,
  OPEN_FULL_INTELLIGENCE_CTA,
  READING_CLOSER_CURATOR,
  READING_CLOSER_DJ,
  READING_CLOSER_PRODUCER,
  READING_TAB_CURATOR,
  READING_TAB_DJ,
  READING_TAB_PRODUCER,
} from "./workspaceCopy.ts";
import { WORKSPACE_BADGE, WORKSPACE_BTN_PRIMARY, WORKSPACE_BTN_SECONDARY, WORKSPACE_FOCUS_VISIBLE } from "./workspacePanelStyles.ts";

const fmtDuration = (ms: number) => {
  if (!ms) return "N/A";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const fmtBpm = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const SECTION_HOT: Record<string, boolean> = {
  drop: true,
  chorus: true,
};

function energyCaption(segments: StructureSegment[], durationMs: number, peakMs: number): string {
  if (!durationMs) return "Energy journey";
  const drop = segments.find((s) => s.label === "drop" || s.label === "chorus");
  if (drop) {
    return `Energy journey — peak around ${fmtClock(drop.startMs)}${drop.endMs < durationMs ? `, releases after ${fmtClock(drop.endMs)}` : ""}`;
  }
  return `Energy journey — peak around ${fmtClock(peakMs)}`;
}

function energyDesc(
  values: number[],
  segments: StructureSegment[],
  durationMs: number,
  peakMs: number,
): string {
  if (!values.length) return "Normalized energy curve across the track.";
  const drop = segments.find((s) => s.label === "drop");
  if (drop) {
    return `Energy rises through the arrangement, peaks through the ${drop.label} from ${fmtClock(drop.startMs)} to ${fmtClock(drop.endMs)}, then falls through the outro.`;
  }
  return `Energy peaks around ${fmtClock(peakMs)} across a ${fmtDuration(durationMs)} track.`;
}

type ReadingKey = "dj" | "producer" | "curator";

interface AnalysisSummaryCardProps {
  data: AnalysisData;
  analysisId: string;
  playlistUuid: string | null;
  /** The sibling similarity playlist is still being paired — CTA stays disabled but shows progress. */
  playlistPending: boolean;
  onReset: () => void;
}

export const AnalysisSummaryCard: React.FC<AnalysisSummaryCardProps> = ({
  data,
  analysisId,
  playlistUuid,
  playlistPending,
  onReset,
}) => {
  const navigate = useNavigate();
  const resolvedReadings = useMemo(() => resolveAnalysisReadings(data), [data]);

  const readings = useMemo(
    (): { key: ReadingKey; label: string; body: string; closer: string }[] => [
      { key: "dj", label: READING_TAB_DJ, body: resolvedReadings.forDj, closer: READING_CLOSER_DJ },
      { key: "producer", label: READING_TAB_PRODUCER, body: resolvedReadings.forProducers, closer: READING_CLOSER_PRODUCER },
      { key: "curator", label: READING_TAB_CURATOR, body: resolvedReadings.forCurators, closer: READING_CLOSER_CURATOR },
    ],
    [resolvedReadings],
  );

  const [readingTab, setReadingTab] = useState<ReadingKey>("dj");

  const keyLabel = data.tonality.camelot ? keyFromCamelot(data.tonality.camelot) : null;
  const keyDisplay =
    data.tonality.key == null
      ? "N/A"
      : keyLabel
        ? `${keyLabel.name} ${keyLabel.scale === "major" ? "maj" : "min"} · ${data.tonality.camelot ?? "—"}`
        : displayOrNA(data.tonality.camelot);

  const keyStrengthConf = formatConfidence(data.tonality.strength);

  const styleLabel =
    data.semantics.genreTop[0]?.label != null
      ? shortGenre(data.semantics.genreTop[0].label)
      : data.semantics.styleMaestTop[0]?.label != null
        ? shortGenre(data.semantics.styleMaestTop[0].label)
        : "N/A";

  const bpmLabel =
    data.rhythm.bpm == null
      ? "BPM"
      : withConfidenceSuffix("BPM", data.rhythm.confidence);

  const moodChips = useMemo(() => {
    const chips: { label: string; value: string }[] = [];
    if (data.semantics.arousal) chips.push({ label: "Arousal", value: data.semantics.arousal.toFixed(2) });
    if (data.semantics.valence) chips.push({ label: "Valence", value: data.semantics.valence.toFixed(2) });
    const energy = data.semantics.moodDimensions?.energy ?? data.semantics.moodDimensions?.Energy;
    if (typeof energy === "number") chips.push({ label: "Energy", value: energy.toFixed(2) });
    if (data.semantics.danceability) chips.push({ label: "Danceability", value: data.semantics.danceability.toFixed(2) });
    if (data.semantics.voiceInstrumental) {
      chips.push({
        label: data.semantics.voiceInstrumental === "instrumental" ? "Instrumental" : "Vocal",
        value: data.semantics.voiceScore ? data.semantics.voiceScore.toFixed(2) : "—",
      });
    }
    return chips;
  }, [data.semantics]);

  const energySeries = data.energy.energyCurve;
  const showEnergy =
    energySeries.values.length > 0 &&
    energySeriesCoversTrack(energySeries, data.identity.durationMs);

  const downsampledEnergy = useMemo(
    () => downsampleSeries(energySeries.values),
    [energySeries.values],
  );

  const peakMs = useMemo(() => {
    const hop = energySeries.hopMs > 0 ? energySeries.hopMs : 0;
    if (!hop || !downsampledEnergy.length) return 0;
    const peakIdxRaw = peakIndex(downsampledEnergy);
    const scale = energySeries.values.length / Math.max(1, downsampledEnergy.length);
    const fullIdx = Math.min(energySeries.values.length - 1, Math.round(peakIdxRaw * scale));
    return sampleTimeMs(fullIdx, hop);
  }, [downsampledEnergy, energySeries]);

  const mergedStructure = useMemo(
    () => mergeStructureSegments(data.energy.structureSegments),
    [data.energy.structureSegments],
  );
  const hasStructure = mergedStructure.length > 0;

  // Three distinct states, so a disabled button is never ambiguous: ready, still pairing, or
  // genuinely absent (a legacy upload that predates automatic pairing).
  const siblingNote = playlistUuid
    ? ANALYSIS_SIBLING_PLAYLIST_NOTE
    : playlistPending
      ? ANALYSIS_SIBLING_PLAYLIST_PENDING
      : ANALYSIS_SIBLING_PLAYLIST_LEGACY;

  return (
    <div className="space-y-[var(--px-16)]">
      <div className="flex flex-wrap items-center gap-[var(--px-12)]">
        <h2
          id="analysis-summary-heading"
          tabIndex={-1}
          className={`m-0 font-helvetica text-[length:var(--px-18)] font-medium uppercase outline-none ${WORKSPACE_FOCUS_VISIBLE}`}
        >
          {ANALYSIS_SUMMARY_HEADING}
        </h2>
        <span className={WORKSPACE_BADGE}>
          {displayOrNA(data.identity.filename)}
        </span>
      </div>

      <div
        className="grid grid-cols-2 border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] sm:grid-cols-3 lg:grid-cols-5"
        role="group"
        aria-label="Core facts"
      >
        <FactCard
          value={data.rhythm.bpm == null ? "N/A" : fmtBpm(data.rhythm.bpm)}
          label={bpmLabel}
        />
        <FactCard
          value={keyDisplay}
          label={keyStrengthConf ? `Key · Camelot · conf ${keyStrengthConf}` : "Key · Camelot"}
        />
        <FactCard value={fmtDuration(data.identity.durationMs)} label="Duration" />
        <FactCard
          value={data.technical.integratedLufs ? data.technical.integratedLufs.toFixed(1) : "N/A"}
          label={`LUFS · LRA ${data.technical.loudnessRangeLu ? data.technical.loudnessRangeLu.toFixed(1) : "—"}`}
        />
        <FactCard value={styleLabel} label="Style indicator" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-[var(--px-20)] lg:[grid-template-columns:minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-[var(--px-18)]">
          {showEnergy && (
            <figure className="m-0">
              <div
                className="border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)]"
                role="img"
                aria-labelledby="energy-journey-title energy-journey-desc"
              >
                <span id="energy-journey-title" className="sr-only">
                  Energy journey
                </span>
                <span id="energy-journey-desc" className="sr-only">
                  {energyDesc(
                    downsampledEnergy,
                    data.energy.structureSegments,
                    data.identity.durationMs,
                    peakMs,
                  )}
                </span>
                <EnergyPolyline values={downsampledEnergy} height={120} color={ACCENT} />
              </div>
              <figcaption className="mt-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-60">
                {energyCaption(data.energy.structureSegments, data.identity.durationMs, peakMs)}
              </figcaption>
            </figure>
          )}

          {hasStructure && (
            <figure className="m-0">
              <StructureStrip segments={mergedStructure} durationMs={data.identity.durationMs} />
              <figcaption className="mt-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-60">
                {structureStripCaption(data.energy.structureSegments)}
              </figcaption>
            </figure>
          )}

          {moodChips.length > 0 && (
            <div className="flex flex-wrap gap-[var(--px-8)]" aria-label="Mood indicators">
              {moodChips.map((chip) => (
                <span
                  key={chip.label}
                  className={WORKSPACE_BADGE}
                >
                  {chip.label} {chip.value}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-16)]">
          <div className="mb-[var(--px-12)] flex flex-wrap gap-[var(--px-4)]" role="tablist" aria-label="Reading">
            {readings.map((r) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={readingTab === r.key}
                onClick={() => setReadingTab(r.key)}
                className={[
                  WORKSPACE_FOCUS_VISIBLE,
                  "min-h-[var(--px-44)] border px-[var(--px-10)] py-[var(--px-6)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] transition-colors duration-[var(--rx-duration-base)]",
                  readingTab === r.key
                    ? "border-[var(--rx-color-border-default)] bg-[var(--rx-color-overlay)] text-[var(--rx-color-text-primary)] shadow-[inset_0_-2px_0_0_var(--rx-color-accent)]"
                    : "border-transparent text-[var(--rx-color-text-muted)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--rx-color-text-primary)]",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>
          {readings.map((r) =>
            readingTab === r.key ? (
              <div
                key={r.key}
                role="tabpanel"
                className="text-[length:var(--px-14)] font-helvetica font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]"
              >
                {r.body}
                <span className="mt-[var(--px-8)] block text-[length:var(--px-12)] opacity-60">{r.closer}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Stacked and full-width below lg (matching the app's own desktop/mobile switch) so all
          three read as one equal-width set instead of three content-width buttons; inline row on
          desktop. */}
      <div className="flex flex-col items-stretch gap-[var(--px-12)] lg:flex-row lg:flex-wrap lg:items-center">
        <button
          type="button"
          disabled={!playlistUuid}
          aria-busy={playlistPending || undefined}
          title={
            playlistUuid
              ? undefined
              : playlistPending
                ? ANALYSIS_SIBLING_PLAYLIST_PENDING_TITLE
                : ANALYSIS_SIBLING_PLAYLIST_UNAVAILABLE
          }
          onClick={() => playlistUuid && navigate(`/sonic-discovery?id=${playlistUuid}`)}
          className={WORKSPACE_BTN_PRIMARY}
        >
          {FIND_SIMILAR_FROM_ANALYSIS_CTA}
          {playlistPending && !playlistUuid && <SubmitPendingGlyph />}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/analysis?id=${analysisId}`)}
          className={WORKSPACE_BTN_SECONDARY}
        >
          {OPEN_FULL_INTELLIGENCE_CTA}
        </button>
        <button
          type="button"
          onClick={onReset}
          className={WORKSPACE_BTN_SECONDARY}
        >
          {ANALYSE_ANOTHER_CTA}
        </button>
      </div>
      <p className="font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] opacity-50">{siblingNote}</p>
    </div>
  );
};

const FactCard: React.FC<{ value: string; label: string; className?: string }> = ({
  value,
  label,
  className = "",
}) => (
  <div
    className={[
      "border-l border-[var(--rx-color-border-subtle)] p-[var(--px-12)] first:border-l-0",
      className,
    ].join(" ")}
  >
    <div className="font-fira text-[length:var(--px-16)] text-[var(--color-primary)]">{value}</div>
    <div className="mt-[var(--px-4)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-2)] opacity-50">
      {label}
    </div>
  </div>
);

const EnergyPolyline: React.FC<{ values: number[]; height: number; color: string }> = ({
  values,
  height,
  color,
}) => {
  const W = 600;
  const H = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * W;
    const y = (1 - (v - min) / span) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const STRUCTURE_CAP = 10;

const StructureStrip: React.FC<{ segments: MergedStructureSegment[]; durationMs: number }> = ({
  segments,
  durationMs,
}) => {
  const label = segments
    .map((s) => `${s.label} ${fmtClock(s.startMs)} to ${fmtClock(s.endMs)}`)
    .join(", ");
  const scrollable = segments.length > STRUCTURE_CAP;

  return (
    <div className={scrollable ? "overflow-x-auto overscroll-contain" : undefined}>
      <div
        className={[
          "flex h-[var(--px-28)] overflow-hidden border border-[var(--rx-color-border-default)]",
          scrollable ? "min-w-[140%]" : "",
        ].join(" ")}
        role="img"
        aria-label={`Structure: ${label}`}
      >
        {segments.map((s, i) => {
          const flex = Math.max(1, s.endMs - s.startMs);
          const hot = SECTION_HOT[s.label.toLowerCase()] ?? false;
          const showLabel = segmentShowsLabel(durationMs, flex);
          return (
            <span
              key={`${s.label}-${i}`}
              className={[
                "flex min-w-0 items-center justify-center border-l border-[var(--rx-color-border-subtle)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] first:border-l-0",
                hot ? "bg-[rgba(238,74,38,.14)] text-[var(--color-primary)]" : "bg-[rgba(255,255,255,.02)] text-[var(--color-primary)] opacity-70",
              ].join(" ")}
              style={{ flex: `${flex} 0 0` }}
            >
              {showLabel ? segmentInlineLabel(s.label) : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
