/**
 * Match bar — the weighted ruler.
 *
 * Implements `RESOMIX // MATCH BAR — IMPLEMENTATION SPEC`, Round 5 · v1.0 · 16 Aug 2026, §01.
 *
 * WHY A PIECEWISE RULER RATHER THAN A LINEAR ONE
 *
 * Cosine similarities cluster: measured across 4,420 real rows the whole range is 46–95, the mean
 * gap between adjacent ranks is 0.63 points, and 60% of adjacent pairs differ by under half a
 * point. A linear bar spends most of its length on distinctions the engine cannot actually make.
 * This ruler spends 70 of its 100 points on the 85–95 band — where the differences are real — and
 * compresses everything below.
 *
 * THE BREAKPOINTS ARE GLOBAL, AND THAT IS THE POINT
 *
 * Spec rule 01: *"Fill compares across playlists (fixed ruler) … Never rescale the bar per
 * playlist."* A bar normalised to its own playlist's min/max was built here once before and
 * reverted — it made every playlist's top row look like 100%, so a weak shortlist and a strong one
 * were indistinguishable. These constants must never be derived from the data being rendered.
 *
 * Scores arrive as 0.9135-style floats and are multiplied by 100 once, at the component boundary;
 * everything in this module is 0–100.
 *
 * Named `matchBarScale`, not `matchBar`: `MatchBar.tsx` sits beside it, and two filenames differing
 * only by case are one file to macOS. TypeScript rejects the pair outright. This is the second time
 * in this feature — the dots version hit it too — so the rule is now explicit: a pure module never
 * shares a stem with its component.
 */

/** Spec §01. `[score, barPercent]`. Global constants — never rescaled per playlist. */
const BP: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [65, 7],
  [85, 27],
  [95, 97],
  [100, 100],
];

/**
 * Minimum fill, spec rule 02 ("caret never dies"): even the weakest score must show a position,
 * because a bar of zero width is indistinguishable from a bar that failed to render.
 */
export const MIN_FILL = 1.5;

/** Spec rule 05 — the tier gate. TOP only when the playlist's best is genuinely strong. */
export const HOT_THRESHOLD = 90;

/** Where the ticks sit, and what score each one marks. Spec §02 [2]. */
export const TICKS: ReadonlyArray<{ at: number; score: number }> = [
  { at: 7, score: 65 },
  { at: 27, score: 85 },
  { at: 97, score: 95 },
];

/**
 * Score (0–100) → bar percentage (0–100).
 *
 * Spec check values, which are the tests: 95.01 → 97.0 · 93.01 → 83.1 · 90.01 → 62.1 ·
 * 85.01 → 27.0 · 82.01 → 24.0. A 90 always out-fills an 82.
 */
export function weightedFill(score: number): number {
  if (!Number.isFinite(score)) return 0;
  for (let i = 1; i < BP.length; i++) {
    const [x1, y1] = BP[i];
    if (score <= x1) {
      const [x0, y0] = BP[i - 1];
      return y0 + ((score - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 100;
}

/**
 * The rendered width, clamped so the caret always has somewhere to sit.
 *
 * Takes the raw 0–1 score the API returns and does the ×100 here, once — the spec's own note:
 * "multiply by 100 once at the boundary, then everything downstream is 0–100".
 */
export function barFill(score: number | null | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return MIN_FILL;
  return Math.max(weightedFill(clamp(score * 100, 0, 100)), MIN_FILL);
}

/** Spec rule 05. `topScore` is the playlist's best, as a raw 0–1 score. */
export function isHot(topScore: number | null | undefined): boolean {
  return typeof topScore === "number" && Number.isFinite(topScore) && topScore * 100 >= HOT_THRESHOLD;
}

/**
 * Spec §01. Rank 0 is the anchor (brightest); the ramp darkens to the last row.
 *
 * A dim palette when the anchor is below 90 — rule 05: "closest of a weak field must not read as
 * good". The colour carries that, not the width.
 */
export function rankColor(index: number, count: number, hot: boolean): string {
  const A = hot ? [255, 93, 31] : [196, 90, 36];
  const B = hot ? [148, 48, 15] : [96, 46, 22];
  const k = count < 2 ? 0 : clamp(index / (count - 1), 0, 1);
  return `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * k)).join(",")})`;
}

/** Spec §02 [4]. White normally; the dim field gets a dimmer caret so it does not out-shout the fill. */
export function caretColor(hot: boolean): string {
  return hot ? "#FFFFFF" : "#D8D8D8";
}

/** The anchor row's word, shown ABOVE the bar. */
export function anchorLabel(hot: boolean): string {
  return hot ? "TOP" : "BEST";
}

/**
 * The figure shown under the bar: the score out of ten, one decimal.
 *
 * `92.71 → "9.2"`. **Truncated, not rounded** — rounding gives 9.3 and contradicts the worked
 * example this was specified with. It is a reading off a ten-point scale, not an arithmetic result,
 * and a value that never rounds up cannot overstate a match.
 *
 * Replaces the spec's ABS readout (`92.71`, two decimals): two decimals implied a resolution the
 * engine does not have — 60% of adjacent ranks differ by under half a point.
 */
export function scoreOutOfTen(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  const clamped = clamp(score * 10, 0, 10);
  return (Math.floor(clamped * 10) / 10).toFixed(1);
}

/** Spec rule 10. The bar is `role="img"`; this is what it announces. */
export function matchAriaLabel(
  score: number | null | undefined,
  rank: number,
  topScore: number | null | undefined,
): string {
  const s = typeof score === "number" && Number.isFinite(score) ? score * 100 : 0;
  if (rank === 0) return `Match ${s.toFixed(2)}, top match`;
  const top = typeof topScore === "number" && Number.isFinite(topScore) ? topScore * 100 : s;
  return `Match ${s.toFixed(2)}, ${Math.max(0, top - s).toFixed(2)} behind top`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
