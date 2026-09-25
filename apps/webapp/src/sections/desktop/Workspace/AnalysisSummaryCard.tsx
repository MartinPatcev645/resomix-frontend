import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortGenre, useAccess } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import type { AnalysisData, StructureSegment } from "@/pages/analysis/data.ts";
import { ACCENT } from "@/pages/analysis/charts.tsx";
import { keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import { displayOrNA } from "@/utils/trackUtils.ts";
import { formatConfidence, withConfidenceSuffix } from "@/utils/analysisConfidence.ts";
import { resolveAnalysisReadings } from "@/utils/analysisReadings.ts";
import { buildCharacteristics } from "@/utils/analysisCharacteristics.ts";
import {
  downsampleSeries,
  energySeriesCoversTrack,
  peakIndex,
  sampleTimeMs,
} from "@/utils/energyCurve.ts";
import { sectionWord, structureTableRows } from "@/utils/structureStrip.ts";
// By path, not through `@/components`: App.tsx loads that barrel eagerly.
import { StructureList } from "@/components/Analysis/StructureList.tsx";
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

/**
 * The sentence under the energy graph.
 *
 * Was a 10px all-caps caption reading "ENERGY JOURNEY: PEAK AROUND 0:33, RELEASES AFTER 0:46" —
 * a heading and a finding welded together in the one type size that is hardest to read. The
 * heading is now drawn separately, so this is just the finding, in a normal sentence.
 *
 * Matches on the DISPLAYED word, not the canonical class: a groove track's sections are stored as
 * `drop` but called "groove", and must never be described as having a drop.
 */
function energySentence(segments: StructureSegment[], durationMs: number, peakMs: number): string {
  if (!durationMs) return "Energy across the track.";
  const drop = segments.find((s) => !s.hidden && ["drop", "chorus"].includes(sectionWord(s)));
  if (drop) {
    return drop.endMs < durationMs
      ? `Peak detected around ${fmtClock(drop.startMs)}, with release after ${fmtClock(drop.endMs)}.`
      : `Peak detected around ${fmtClock(drop.startMs)}.`;
  }
  return `Peak detected around ${fmtClock(peakMs)}.`;
}

function energyDesc(
  values: number[],
  segments: StructureSegment[],
  durationMs: number,
  peakMs: number,
): string {
  if (!values.length) return "Normalized energy curve across the track.";
  const drop = segments.find((s) => !s.hidden && sectionWord(s) === "drop");
  if (drop) {
    return `Energy rises through the arrangement, peaks through the drop from ${fmtClock(drop.startMs)} to ${fmtClock(drop.endMs)}, then falls through the outro.`;
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
  const access = useAccess();
  // Answered from the plan we already hold, so an unentitled reader is told here rather than being
  // sent to a page that would only tell them the same thing after a route change.
  const [fullGate, setFullGate] = useState<"login_required" | "upgrade_required" | null>(null);
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

  /**
   * The four tiles beside the structure list, or under everything when there is none.
   *
   * ENERGY IS DELIBERATELY ABSENT. A fifth chip used to render it from `moodDimensions`; the
   * energy graph sits directly above and shows the same thing over time, which is strictly more
   * information than one averaged number.
   */
  const characteristics = useMemo(() => buildCharacteristics(data.semantics), [data.semantics]);

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

  // Only from the `structure` block: the v1 / v2 readings were withdrawn and must not reappear on
  // an old result that still carries them.
  const structureRows = useMemo(
    () => (data.structure?.status === "ok" ? structureTableRows(data.energy.structureSegments) : []),
    [data.structure, data.energy.structureSegments],
  );
  const characteristicsBeside = characteristics.length > 0 && structureRows.length > 0;

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
        <div className="flex min-w-0 flex-col gap-[var(--px-18)] lg:h-full">
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
                {/* Endpoints, so the curve is readable as a timeline rather than an abstract
                    shape — until now nothing on the graph said where it started or ended. */}
                <div className="flex justify-between px-[var(--px-12)] pb-[var(--px-8)] font-fira text-[length:var(--px-11)] tabular-nums text-[var(--rx-color-text-muted)]">
                  <span>0:00</span>
                  <span>{fmtDuration(data.identity.durationMs)}</span>
                </div>
              </div>
              <figcaption className="mt-[var(--px-10)]">
                <div className="font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]">
                  Energy journey
                </div>
                <div className="mt-[var(--px-4)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]">
                  {energySentence(data.energy.structureSegments, data.identity.durationMs, peakMs)}
                </div>
              </figcaption>
            </figure>
          )}

          {structureRows.length > 0 && <StructureList segments={structureRows} className="lg:flex-1" />}
          {data.structure?.status === "gate" && data.structure.gate && (
            <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--rx-color-text-muted)]">
              {data.structure.gate}
            </p>
          )}
        </div>

        {/* Both columns run to the full height of the grid row (`lg:h-full`). The structure list
            sits under the energy graph on the left, so either column can be the taller one, and
            `h-full` keeps them from drifting apart. A track with no structure reading is just the
            energy graph against the reading panel. */}
        <div className="flex min-w-0 flex-col gap-[var(--px-18)] lg:h-full">
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

        {/* Beside a structure table the tiles stack one per row down the right column, filling
            the space the table leaves under the reading. */}
        {characteristicsBeside && <CharacteristicsPanel tiles={characteristics} stacked className="lg:flex-1" />}
        </div>
      </div>

      {/* With no structure table there is no tall column to balance, so the tiles run as one
          full-width row instead: four across on desktop, 2×2 on phones. */}
      {characteristics.length > 0 && !characteristicsBeside && <CharacteristicsPanel tiles={characteristics} />}

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
          onClick={() => {
            const reason = access.gateReason("viewFullAnalysis");
            if (reason) {
              setFullGate(reason);
              return;
            }
            navigate(`/track-intelligence/full?id=${analysisId}`);
          }}
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

      <GateCtaModal
        reason={fullGate}
        title="Full Track Intelligence is a Pro feature"
        body={
          "Your summary — BPM, key and energy — stays free. Pro adds the full breakdown: " +
          "spectrograms, the chromagram, beat and phrase grids, mood and genre over time, and stem " +
          "composition."
        }
        onClose={() => setFullGate(null)}
      />
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

/**
 * The "Track characteristics" panel, rendered once, in one of two places.
 *
 * Beside a structure table (`stacked`) it takes the right column under the reading, one tile per
 * row, and stretches so the tiles share whatever height the table leaves. Without one it sits
 * below both columns at full width, four across. Both fall back to 2×2 on a phone.
 */
const CharacteristicsPanel: React.FC<{
  tiles: { key: string; label: string; value: string; definition: string }[];
  stacked?: boolean;
  className?: string;
}> = ({ tiles, stacked = false, className = "" }) => (
  <div className={`flex flex-col border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] ${className}`}>
    <div className="border-b border-[var(--rx-color-border-subtle)] px-[var(--px-14)] py-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]">
      Track characteristics
    </div>
    <div className={stacked ? "grid grid-cols-2 lg:flex-1 lg:auto-rows-fr lg:grid-cols-1" : "grid grid-cols-2 lg:grid-cols-4"}>
      {tiles.map((tile, i) => (
        <div
          key={tile.key}
          className={[
            "px-[var(--px-14)] py-[var(--px-12)]",
            // Border COLOUR unconditionally, widths per position, so the same tile works in every
            // arrangement without doubled or dangling lines. 2×2: left edge on the right-hand
            // cell, top edge on the second row. One row of 4: a left edge on every cell but the
            // first, and no top edges at all. One column of 4: a top edge on every cell but the
            // first, and no left edges at all.
            "border-[var(--rx-color-border-subtle)]",
            ...(stacked
              ? [
                  "lg:flex lg:flex-col lg:justify-center",
                  i % 2 === 1 ? "border-l lg:border-l-0" : "",
                  i >= 2 ? "border-t" : i > 0 ? "lg:border-t" : "",
                ]
              : [
                  i % 2 === 1 ? "border-l" : "",
                  i > 0 ? "lg:border-l" : "",
                  i >= 2 ? "border-t lg:border-t-0" : "",
                ]),
          ].join(" ")}
        >
          <div className="font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)]">
            {tile.label}
          </div>
          <div className="mt-[var(--px-4)] font-fira text-[length:var(--px-22)] leading-[1.1] tabular-nums text-[var(--rx-color-text-primary)]">
            {tile.value}
          </div>
          <div className="mt-[var(--px-2)] font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-muted)]">
            {tile.definition}
          </div>
        </div>
      ))}
    </div>
  </div>
);
