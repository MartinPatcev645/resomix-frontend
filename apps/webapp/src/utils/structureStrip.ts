import type { StructureSegment } from "@/pages/analysis/data.ts";
import { medianValidConfidence } from "@/utils/analysisConfidence.ts";

export interface MergedStructureSegment {
  label: string;
  startMs: number;
  endMs: number;
  confidence: number;
  /** Original section count merged into this row. */
  sectionCount: number;
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
