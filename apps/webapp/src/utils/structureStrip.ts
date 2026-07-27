import type { StructureSegment } from "@/pages/analysis/data.ts";
import { medianValidConfidence } from "@/utils/analysisConfidence.ts";

export interface MergedStructureSegment {
  label: string;
  startMs: number;
  endMs: number;
  confidence: number;
  /** Original section count merged into this strip segment. */
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

export function structureStripCaption(segments: StructureSegment[]): string {
  if (!segments.length) return "";
  const median = medianValidConfidence(segments.map((s) => s.confidence));
  const n = segments.length;
  if (median == null) return `${n} sections`;
  return `${n} sections · median confidence ${median.toFixed(2)}`;
}

export function segmentShowsLabel(durationMs: number, segmentMs: number): boolean {
  if (!durationMs) return false;
  return segmentMs / durationMs >= 0.04;
}

export function segmentInlineLabel(label: string): string {
  return label.slice(0, 6);
}
