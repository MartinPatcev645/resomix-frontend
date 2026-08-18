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
import {
  mergeStructureSegments,
  structureListMeta,
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

/**
 * The sentence under the energy graph.
 *
 * Was a 10px all-caps caption reading "ENERGY JOURNEY: PEAK AROUND 0:33, RELEASES AFTER 0:46" —
 * a heading and a finding welded together in the one type size that is hardest to read. The
 * heading is now drawn separately, so this is just the finding, in a normal sentence.
 */
function energySentence(segments: StructureSegment[], durationMs: number, peakMs: number): string {
  if (!durationMs) return "Energy across the track.";
  const drop = segments.find((s) => s.label === "drop" || s.label === "chorus");
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
   * The four tiles under the structure list.
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

          {hasStructure && <StructureList segments={mergedStructure} />}

          {/* Mobile only. On desktop the characteristics live in the right column, under the
              reading panel — the left column's structure list is tall and the right panel is
              short, so leaving them here stranded them below the fold beside empty space. */}
          {characteristics.length > 0 && (
            <CharacteristicsPanel tiles={characteristics} className="lg:hidden" />
          )}
        </div>

        <div className="min-w-0 space-y-[var(--px-18)]">
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

        {/* Desktop only — the counterpart of the lg:hidden instance in the left column. Stacked
            one per row: the right column is the narrow one (5fr), and four tiles across it would
            crush the definitions. */}
        {characteristics.length > 0 && (
          <CharacteristicsPanel tiles={characteristics} stacked className="hidden lg:block" />
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
          onClick={() => {
            const reason = access.gateReason("viewFullAnalysis");
            if (reason) {
              setFullGate(reason);
              return;
            }
            navigate(`/analysis/full?id=${analysisId}`);
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
          "Your summary — BPM, key, energy and structure — stays free. Pro adds the full breakdown: " +
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
 * The "Track characteristics" panel — rendered TWICE, split by breakpoint.
 *
 * On a phone it sits in the single column under the structure list, tiles 2×2. On desktop it moved
 * to the right column beneath the reading panel (`stacked`, one tile per row): the structure list
 * makes the left column tall while the reading panel is a few lines, so keeping the tiles on the
 * left stranded them below the fold with a stretch of empty right column beside them.
 *
 * Two instances (`lg:hidden` / `hidden lg:block`) rather than CSS reordering, because the two
 * positions are in different grid cells — no `order` trick can move a node across cells.
 */
const CharacteristicsPanel: React.FC<{
  tiles: { key: string; label: string; value: string; definition: string }[];
  stacked?: boolean;
  className?: string;
}> = ({ tiles, stacked = false, className = "" }) => (
  <div className={`border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] ${className}`}>
    <div className="border-b border-[var(--rx-color-border-subtle)] px-[var(--px-14)] py-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]">
      Track characteristics
    </div>
    <div className={stacked ? "grid grid-cols-1" : "grid grid-cols-2"}>
      {tiles.map((tile, i) => (
        <div
          key={tile.key}
          className={[
            "px-[var(--px-14)] py-[var(--px-12)]",
            // Dividers drawn per position so neither arrangement gets doubled or dangling lines:
            // stacked rows separate with border-t; the 2×2 grid adds border-l on the right cell.
            stacked
              ? i > 0
                ? "border-t border-[var(--rx-color-border-subtle)]"
                : ""
              : [
                  i % 2 === 1 ? "border-l border-[var(--rx-color-border-subtle)]" : "",
                  i >= 2 ? "border-t border-[var(--rx-color-border-subtle)]" : "",
                ].join(" "),
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

/** Rows shown on a phone before the rest go behind the toggle. Desktop always lists every row. */
const STRUCTURE_VISIBLE_MOBILE = 6;

/**
 * The track's arrangement, as a numbered chronological list.
 *
 * REPLACES THE PROPORTIONAL STRIP, which encoded each section's duration as its width. That is the
 * one property a reader cannot measure by eye, and it cost the two things they can read: any
 * section shorter than 4% of the track had its name suppressed entirely (`segmentShowsLabel`), so
 * the strip showed unlabelled gaps between labels, and no timings appeared anywhere. Past ten
 * sections it also became a horizontally-scrolling element inside a vertically-scrolling page.
 *
 * A list gives every section a name and a time regardless of how brief it is, and it costs nothing
 * on a narrow screen — names wrap, times do not.
 *
 * Drops carry an accent left border AND an accent name, but the timing stays white and the row
 * stays numbered, so the emphasis survives greyscale and colour-blindness rather than being the
 * only signal.
 */
const StructureList: React.FC<{ segments: MergedStructureSegment[] }> = ({ segments }) => {
  const [expanded, setExpanded] = useState(false);
  const collapsible = segments.length > STRUCTURE_VISIBLE_MOBILE;

  return (
    <div className="border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)]">
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
          const hot = SECTION_HOT[s.label.toLowerCase()] ?? false;
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
              <span
                className={`font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] [overflow-wrap:anywhere] ${
                  hot ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--rx-color-text-secondary)]"
                }`}
              >
                {s.label}
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
