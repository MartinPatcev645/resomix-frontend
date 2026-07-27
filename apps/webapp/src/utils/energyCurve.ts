import type { Series } from "@/pages/analysis/data.ts";

const MAX_POINTS = 64;

/** Windowed mean downsample — smooths sample noise for summary display. */
export function downsampleSeries(values: number[], maxPoints = MAX_POINTS): number[] {
  if (values.length <= maxPoints) return values;
  const out: number[] = [];
  const window = values.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * window);
    const end = Math.min(values.length, Math.floor((i + 1) * window));
    if (start >= end) {
      out.push(values[Math.min(start, values.length - 1)]);
      continue;
    }
    let sum = 0;
    for (let j = start; j < end; j++) sum += values[j];
    out.push(sum / (end - start));
  }
  return out;
}

/** Absolute ms at sample index when hopMs anchors the series at t=0. */
export function sampleTimeMs(index: number, hopMs: number): number {
  return Math.max(0, index * hopMs);
}

/**
 * True when the energy series spans most of the track — otherwise captions would lie
 * about absolute times on a partial window (server-side coverage gap).
 */
export function energySeriesCoversTrack(series: Series, durationMs: number): boolean {
  if (!series.values.length || !durationMs) return false;
  const hop = series.hopMs > 0 ? series.hopMs : 0;
  if (!hop) return false;
  const coverageMs = series.values.length * hop;
  return coverageMs >= durationMs * 0.85;
}

export function peakIndex(values: number[]): number {
  if (!values.length) return 0;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}
