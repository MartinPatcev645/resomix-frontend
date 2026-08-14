/**
 * Similarity strength as a count of ten dots.
 *
 * WHY NOT A PERCENTAGE
 *
 * The engine returns a cosine similarity, and cosine similarities are not percentages — 0.80 does
 * not mean "80% similar". Measured across 4,420 real scored rows:
 *
 *   * the whole range is **46% – 95%**; nothing is ever below 46, so the bottom half of a
 *     percentage scale is dead and "62%" reads as *bad* when it is in fact an ordinary result;
 *   * the mean gap between adjacent ranks is **0.63 points**, and **60% of adjacent pairs differ by
 *     less than half a point** — while the UI printed two decimals, implying a resolution ~63×
 *     finer than the real signal. Ranks 2 and 3 separated by 0.09 points were presented as a fact.
 *
 * The ordering is real (average top-to-bottom spread within a playlist is 15.7 points). The digits
 * were not. Ten dots keep the ordering and drop the false precision.
 *
 * THE MAPPING
 *
 *   score ≥ 0.95          → 10        every dot; nothing meaningful lives above this
 *   0.46 ≤ score < 0.95   → 3 – 10    the real working range, stretched across eight steps
 *   score < 0.46          → 1 – 3     below anything the engine has ever returned
 *
 * The middle band is stretched rather than mapped linearly from zero because a linear map would
 * only ever use dots 5–9 — ten dots doing the work of five. The floor of 3 is deliberate: nothing
 * in the catalogue is genuinely a 1/10, and rendering one would be its own kind of lie.
 *
 * Pure and dependency-free so the boundaries can be tested without rendering anything.
 *
 * Named `scoreScale`, not `scoreDots`, because `ScoreDots.tsx` sits beside it: two filenames
 * differing only by case are the same file to macOS, and TypeScript refuses the pair outright
 * ("not listed within the file list of project"). The build fails on the developer's machine and
 * would behave differently again on a case-sensitive server.
 */

/** How many dots the meter has. */
export const DOT_COUNT = 10;

/** Above this, every dot. */
export const CEILING = 0.95;

/** The bottom of the range the engine actually produces. */
export const FLOOR = 0.46;

/** Dots given to a score sitting exactly at FLOOR — the two bands meet here, continuously. */
export const FLOOR_DOTS = 3;

/**
 * Dots for one similarity score.
 *
 * Always returns a whole number in 1…10, for any input — including `null`, `undefined`, `NaN` and
 * values outside 0…1. A score column that throws or renders `NaN` dots would be a worse bug than
 * the false precision this replaces.
 */
export function dotsForScore(score: number | null | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 1;

  if (score < FLOOR) {
    // Below anything observed. Spread across the first three dots so a hypothetical weak result
    // still reads as weak rather than collapsing to one indistinguishable value. `Math.max` is the
    // only guard needed here — the expression cannot exceed FLOOR_DOTS while `score < FLOOR`.
    return Math.round(1 + (Math.max(0, score) / FLOOR) * (FLOOR_DOTS - 1));
  }

  // The working range, stretched over the remaining steps.
  //
  // There is deliberately NO separate `score >= CEILING` branch: at CEILING the position is exactly
  // 1, so this yields exactly DOT_COUNT, and the clamp covers everything above. An early return
  // would be a branch no test could distinguish from its absence — code that cannot be verified,
  // and an invitation to "simplify" it into something that behaves differently.
  const position = (score - FLOOR) / (CEILING - FLOOR);
  // The clamp IS load-bearing: `score` comes from an API and nothing upstream bounds it at 1.
  return clamp(Math.round(FLOOR_DOTS + position * (DOT_COUNT - FLOOR_DOTS)), FLOOR_DOTS, DOT_COUNT);
}

/** Screen-reader text. The dots themselves are decorative and marked `aria-hidden`. */
export function dotsLabel(score: number | null | undefined): string {
  return `Match strength ${dotsForScore(score)} out of ${DOT_COUNT}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
