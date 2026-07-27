/**
 * In-shortlist score band — normalises similarity scores to this result set's min–max so
 * ranking differences stay visible when absolute scores sit in a tight band.
 */

export function shortlistScoreRange(scores: number[]): { min: number; max: number } {
  if (scores.length === 0) return { min: 0, max: 1 };
  return { min: Math.min(...scores), max: Math.max(...scores) };
}

/** Bar width (0–100) using the approved preview formula: 8% floor + 92% of normalised span. */
export function scoreBandWidthPct(score: number, min: number, max: number): number {
  if (max <= min) return 100;
  return Math.round(8 + (92 * (score - min)) / (max - min));
}
