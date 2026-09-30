import type { StructureSegment } from "@/pages/analysis/data.ts";
import { medianValidConfidence } from "@/utils/analysisConfidence.ts";

export interface MergedStructureSegment {
  label: string;
  startMs: number;
  endMs: number;
  confidence: number;
  /** Original section count merged into this row. */
  sectionCount: number;
  /** Full rendered text with measured modifiers ("groove 1 · rising"). */
  shown?: string;
  /** Whole bars spanned. */
  bars?: number | null;
  /** Bare displayed word ("groove"), for emphasis. */
  word?: string;
}

/** The displayed word a section is called by, lower-cased: "drop" for "drop 1a". */
export function sectionWord(s: { word?: string; label: string }): string {
  return (s.word || s.label).toLowerCase();
}

/** The section under the playhead, or undefined over a hidden start / end marker. */
export function sectionAtMs<T extends { startMs: number; endMs: number; hidden?: boolean }>(
  segments: T[],
  ms: number,
): T | undefined {
  return segments.find((s) => !s.hidden && ms >= s.startMs && ms < s.endMs);
}

/**
 * The rows the structure table lists: every section a reader is shown, in order.
 *
 * NOT merged, unlike `mergeStructureSegments` below. The structure reading already numbers a
 * repeated word ("groove 1", "groove 2") because in groove-based music consecutive sections really
 * are different, so collapsing them would undo a deliberate decision. Hidden start / end markers
 * are dropped here, since a table row has no width to keep in line.
 */
export function structureTableRows(segments: StructureSegment[]): MergedStructureSegment[] {
  return segments
    .filter((s) => !s.hidden)
    .map((s) => ({
      label: s.label,
      startMs: s.startMs,
      endMs: s.endMs,
      confidence: s.confidence,
      sectionCount: 1,
      shown: s.shown || s.label,
      bars: s.bars ?? null,
      word: s.word || s.label,
    }));
}

export function mergeStructureSegments(segments: StructureSegment[]): MergedStructureSegment[] {
  if (!segments.length) return [];
  const merged: MergedStructureSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.label.toLowerCase() === seg.label.toLowerCase()) {
      prev.endMs = seg.endMs;
      prev.sectionCount += 1;
      if (seg.confidence > prev.confidence) prev.confidence = seg.confidence;
    } else {
      merged.push({
        label: seg.label,
        startMs: seg.startMs,
        endMs: seg.endMs,
        confidence: seg.confidence,
        sectionCount: 1,
      });
    }
  }
  return merged;
}

/**
 * Header meta for the structure panel — "8 sections · median confidence 0.58".
 *
 * TAKES THE MERGED ROWS, NOT THE RAW SEGMENTS. The old caption counted raw segments while the
 * strip beside it drew merged ones, so a track with two consecutive `main` segments displayed six
 * blocks under a heading that said seven sections. Now that the rows are listed and numbered
 * `01…08`, that mismatch would be impossible to miss: the reader can count them.
 *
 * The median moves with the count for the same reason — it describes the rows on screen rather
 * than a set the reader cannot see.
 *
 * `short` is the narrow-viewport form ("8 · conf 0.58"); the full wording does not fit beside the
 * panel title at 320px.
 */
export function structureListMeta(
  merged: MergedStructureSegment[],
  { short = false }: { short?: boolean } = {},
): string {
  if (!merged.length) return "";
  const median = medianValidConfidence(merged.map((s) => s.confidence));
  const n = merged.length;
  if (median == null) return short ? `${n}` : `${n} sections`;
  return short
    ? `${n} · conf ${median.toFixed(2)}`
    : `${n} sections · median confidence ${median.toFixed(2)}`;
}

/**
 * A section label short enough for a narrow block: the first three letters of the word, plus the
 * occurrence number. "groove 1" becomes "GRO 1", "wind-down" becomes "WIN".
 *
 * This is the handoff's rule for blocks too narrow for the full name. The full name is still what
 * the tooltip and the current-section chip show, so nothing is lost, only shortened where it sits.
 */
export function abbreviateSectionLabel(label: string): string {
  const match = /^\s*([a-z-]+)\s*(\d+[a-z]?)?\s*$/i.exec(label);
  if (!match) return label.trim().slice(0, 3).toUpperCase();
  const word = match[1].replace(/-/g, "").slice(0, 3).toUpperCase();
  return match[2] ? `${word} ${match[2].toUpperCase()}` : word;
}
