/**
 * Pure maths behind the Timeline tab and the Harmony / Genre tabs.
 *
 * Kept out of the components so the parts that can be wrong on a real track — a beatless grid, a
 * curve that ends before the audio does, a Camelot code the wheel has never seen — are testable
 * without rendering a canvas. Nothing here touches the DOM.
 */

import type { ScoredLabel, Series, TimelineTrack } from "@/pages/analysis/data.ts";

/** One musical bar of the track, in milliseconds. */
export interface Bar {
  index: number;
  startMs: number;
  endMs: number;
}

/**
 * The bar grid the Energy lane draws one column per.
 *
 * Downbeats are the truth when the rhythm stage found them. When it did not — `beatless` profiles,
 * and anything where the grid degraded — the lane still has to be drawn, so it falls back to equal
 * slices of the duration. That is the same choice the old Energy journey made by being time-based
 * in the first place: a track with no beat still has an energy shape worth seeing.
 */
export function barsFromDownbeats(downbeatsSeconds: number[], durationMs: number, fallbackCount = 64): Bar[] {
  if (durationMs <= 0) return [];
  const edges = downbeatsSeconds
    .filter((s) => Number.isFinite(s) && s >= 0)
    .map((s) => s * 1000)
    .filter((ms) => ms < durationMs)
    .sort((a, b) => a - b);

  if (edges.length < 2) {
    const n = Math.max(1, fallbackCount);
    const step = durationMs / n;
    return Array.from({ length: n }, (_, i) => ({ index: i, startMs: i * step, endMs: (i + 1) * step }));
  }

  const bars: Bar[] = [];
  // A track rarely starts on a downbeat, and the lane must cover the audio from 0 or the bars sit
  // shifted against the ruler and the playhead above them.
  if (edges[0] > 0) bars.push({ index: 0, startMs: 0, endMs: edges[0] });
  for (let i = 0; i < edges.length; i++) {
    const start = edges[i];
    const end = i + 1 < edges.length ? edges[i + 1] : durationMs;
    if (end > start) bars.push({ index: bars.length, startMs: start, endMs: end });
  }
  return bars.map((b, i) => ({ ...b, index: i }));
}

/** Mean of a hop-spaced series over a time window, or null when the window has no samples. */
export function meanInRange(series: Series | null | undefined, startMs: number, endMs: number): number | null {
  if (!series || !series.values.length || !(series.hopMs > 0) || endMs <= startMs) return null;
  const from = Math.max(0, Math.floor(startMs / series.hopMs));
  const to = Math.min(series.values.length - 1, Math.ceil(endMs / series.hopMs) - 1);
  if (to < from) {
    // Window shorter than one hop: take the sample it lands in rather than reporting nothing.
    const one = series.values[Math.min(series.values.length - 1, from)];
    return Number.isFinite(one) ? one : null;
  }
  let sum = 0;
  let n = 0;
  for (let i = from; i <= to; i++) {
    const v = series.values[i];
    if (Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : null;
}

/** Bar-by-bar means of a curve, scaled so the loudest bar is 1. Bars with no samples read 0. */
export function barMeans(series: Series | null | undefined, bars: Bar[]): number[] {
  const raw = bars.map((b) => meanInRange(series, b.startMs, b.endMs) ?? 0);
  const max = raw.reduce((m, v) => (v > m ? v : m), 0);
  return max > 0 ? raw.map((v) => Math.max(0, v / max)) : raw.map(() => 0);
}

/**
 * Where a loudness value sits in the lane, 0 at the top and 1 at the bottom.
 *
 * The domain is fixed at −6 dB to −18 dB so the right-hand axis can be printed as −6 / −10 / −14
 * against gridlines at 0 / 33 / 66 percent. Anything outside clamps rather than leaving the lane.
 */
export const LUFS_TOP_DB = -6;
export const LUFS_BOTTOM_DB = -18;
export function lufsFrac(db: number): number {
  const f = (LUFS_TOP_DB - db) / (LUFS_TOP_DB - LUFS_BOTTOM_DB);
  return Math.max(0, Math.min(1, f));
}

/** The n strongest rows of an over-time track, by mean score, each carrying that mean. */
export function topSeriesByMean(
  track: TimelineTrack | null | undefined,
  n: number,
): { label: string; values: number[]; mean: number }[] {
  if (!track?.series?.length) return [];
  return track.series
    .map((s) => {
      const vals = s.values.filter((v) => Number.isFinite(v));
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { label: s.label, values: s.values, mean };
    })
    .sort((a, b) => b.mean - a.mean)
    .slice(0, n);
}

/* ------------------------------------------------------------------ harmony */

/** 1A…12B, uppercase, or null when the code is missing or malformed. */
export function parseCamelot(code: string | null | undefined): { number: number; letter: "A" | "B" } | null {
  const m = /^(\d{1,2})([AB])$/.exec((code ?? "").trim().toUpperCase());
  if (!m) return null;
  const number = Number(m[1]);
  if (number < 1 || number > 12) return null;
  return { number, letter: m[2] as "A" | "B" };
}

/** Semitones above the root, natural minor and major. */
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

/**
 * The seven pitch classes a Camelot code's key actually uses, as indices into a C-first chroma.
 *
 * The wheel is the circle of fifths, so each step up the number is seven semitones, with 8B as C
 * major and 8A as A minor. Empty for a code that cannot be read, which the caller must treat as
 * "cannot say", never as "no notes are in key".
 */
export function camelotRootPitchClass(code: string | null | undefined): number | null {
  const parsed = parseCamelot(code);
  if (!parsed) return null;
  const base = parsed.letter === "B" ? 0 : 9; // 8B = C major, 8A = A minor
  return (((parsed.number - 8) * 7 + base) % 12 + 12) % 12;
}

export function inKeyPitchClasses(code: string | null | undefined): Set<number> {
  const root = camelotRootPitchClass(code);
  const parsed = parseCamelot(code);
  if (root == null || !parsed) return new Set();
  const steps = parsed.letter === "B" ? MAJOR_STEPS : MINOR_STEPS;
  return new Set(steps.map((s) => (root + s) % 12));
}

/**
 * Whole-track mean pitch-class energy from the chromagram.
 *
 * The service computes this in its semantics stage and sends it as `mean_chroma`, but it is absent
 * on results produced before that stage existed, and the Harmony tab's note chart is the only
 * thing that reads it — so it recomputes rather than showing an empty panel. Same arithmetic the
 * service uses: the mean of each of the 12 rows.
 */
export function meanChromaFromMatrix(rows: number[][] | null | undefined): number[] {
  if (!rows || rows.length !== 12 || !rows[0]?.length) return [];
  return rows.map((row) => {
    const usable = row.filter((v) => Number.isFinite(v));
    return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : 0;
  });
}

export interface CamelotNeighbour {
  code: string;
  relation: string;
}

/**
 * The four mixes a DJ actually reaches for from a given key: stay put, step either way round the
 * wheel, or swap to the relative major / minor. Returns an empty list for an unreadable code
 * rather than inventing keys.
 */
export function camelotNeighbours(code: string | null | undefined): CamelotNeighbour[] {
  const parsed = parseCamelot(code);
  if (!parsed) return [];
  const { number, letter } = parsed;
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  return [
    { code: `${number}${letter}`, relation: "same key" },
    { code: `${wrap(number - 1)}${letter}`, relation: "−1 · energy down" },
    { code: `${wrap(number + 1)}${letter}`, relation: "+1 · energy up" },
    { code: `${number}${letter === "A" ? "B" : "A"}`, relation: letter === "A" ? "relative major" : "relative minor" },
  ];
}

/* -------------------------------------------------------------------- genre */

export interface GenreRow {
  label: string;
  /** Score in the genre list, or null when that list did not rank this label. */
  genre: number | null;
  /** Score in the style list, or null when that list did not rank this label. */
  style: number | null;
  /** Sort key: the models' best claim for this label. */
  max: number;
}

/**
 * One ranked list out of the two models, joined on the displayed label.
 *
 * Sorted by the stronger model's score, then by the weaker one, so the labels both models agree on
 * rise to the top and a single model's outlier cannot outrank them on a tie.
 */
export function mergeGenreModels(
  genreTop: ScoredLabel[],
  styleTop: ScoredLabel[],
  shorten: (label: string) => string,
): GenreRow[] {
  const rows = new Map<string, GenreRow>();
  const add = (items: ScoredLabel[], field: "genre" | "style") => {
    for (const item of items) {
      const label = shorten(item.label);
      const row = rows.get(label) ?? { label, genre: null, style: null, max: 0 };
      // Keep the strongest score when shortening collapses two raw labels onto one name.
      if (row[field] == null || item.score > (row[field] as number)) row[field] = item.score;
      rows.set(label, row);
    }
  };
  add(genreTop, "genre");
  add(styleTop, "style");

  return [...rows.values()]
    .map((r) => ({ ...r, max: Math.max(r.genre ?? 0, r.style ?? 0) }))
    .sort((a, b) => {
      if (b.max !== a.max) return b.max - a.max;
      return Math.min(b.genre ?? 0, b.style ?? 0) - Math.min(a.genre ?? 0, a.style ?? 0);
    });
}

/** One sentence on how much the two models agree, for the Genre tab footer. */
export function genreAgreement(rows: GenreRow[]): string {
  const both = rows.filter((r) => r.genre != null && r.style != null);
  if (!rows.length) return "No genre prediction yet.";
  if (!both.length) return "The two models picked entirely different labels for this track.";
  const top = rows[0];
  if (top.genre != null && top.style != null) {
    const gap = Math.abs(top.genre - top.style);
    if (gap <= 0.15) return `Both models lead with ${top.label}, within ${Math.round(gap * 100)} points of each other.`;
    return `Both models rank ${top.label} first, though they disagree by ${Math.round(gap * 100)} points on how strongly.`;
  }
  return `${both.length} of ${rows.length} labels were picked by both models; the rest come from one model only.`;
}
