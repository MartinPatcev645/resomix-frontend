/**
 * Similarity as ten dots
 * ======================
 *
 * WHAT THIS REPLACED
 *
 * A percentage with two decimal places. Measured across 4,420 real scored rows, that was false
 * precision in three separate ways:
 *
 *   * the whole observed range is **46% – 95%** — nothing has ever scored below 46, so the bottom
 *     half of the scale was dead and "62%" read as *bad* for what is in fact a typical result;
 *   * the mean gap between adjacent ranks is **0.63 points**, and **60% of adjacent pairs differ by
 *     under half a point** — two decimals implied a resolution roughly 63× finer than the signal;
 *   * ranks 2 and 3 of a real playlist sat 0.09 points apart and were rendered as 75.77% and
 *     75.69%, presenting noise as a fact.
 *
 * The ordering IS real — average top-to-bottom spread within one playlist is 15.7 points — so the
 * job was to keep the ordering and drop the digits.
 *
 * WHAT THESE TESTS PIN
 *
 * The boundaries, and the shape of the curve. The mapping is deliberately not linear-from-zero: a
 * linear map would only ever use dots 5–9, which is ten dots doing the work of five.
 *
 *     score ≥ 0.95        → 10
 *     0.46 ≤ score < 0.95 → 3 – 10   (the working range, stretched)
 *     score < 0.46        → 1 – 3
 *
 * HOW TO RUN
 *
 *     pnpm --filter webapp test:pure
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { CEILING, DOT_COUNT, FLOOR, FLOOR_DOTS, dotsForScore, dotsLabel } from "./scoreScale.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(HERE, p), "utf8");

// --------------------------------------------------------------------------- //
// The bands
// --------------------------------------------------------------------------- //

test("anything at or above the ceiling gets every dot", () => {
  assert.equal(dotsForScore(CEILING), DOT_COUNT);
  assert.equal(dotsForScore(0.97), DOT_COUNT);
  assert.equal(dotsForScore(1), DOT_COUNT);
});

test("the floor is where the two bands meet, continuously", () => {
  // Approaching 0.46 from below and landing on it must not jump. A visible step at the seam would
  // be an artefact of the mapping rather than of the data.
  assert.equal(dotsForScore(FLOOR), FLOOR_DOTS);
  assert.equal(dotsForScore(FLOOR - 0.0001), FLOOR_DOTS);
});

test("the working range spans the upper eight dots", () => {
  // Real values from a live playlist: ranks 1, 3 and 15.
  assert.equal(dotsForScore(0.8076), 8);
  assert.equal(dotsForScore(0.7643), 7);
  assert.equal(dotsForScore(0.5963), 5);
});

test("below anything the engine has produced, dots 1 to 3", () => {
  assert.equal(dotsForScore(0), 1);
  assert.equal(dotsForScore(0.23), 2);
  assert.equal(dotsForScore(0.45), 3);
});

test("the scale is monotonic — a better score never shows fewer dots", () => {
  // The one property a user would actually notice being broken, and the easiest to break by
  // adjusting a boundary in isolation.
  let previous = 0;
  for (let score = 0; score <= 1.0001; score += 0.005) {
    const dots = dotsForScore(score);
    assert.ok(dots >= previous, `${score.toFixed(3)} gave ${dots} after ${previous}`);
    previous = dots;
  }
});

test("the whole scale is reachable", () => {
  // If a boundary is wrong, some dot counts become impossible and the meter silently loses
  // resolution — ten dots that only ever render six values.
  const seen = new Set<number>();
  for (let score = 0; score <= 1.0001; score += 0.002) seen.add(dotsForScore(score));

  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the stretch is what makes the upper dots reachable at all", () => {
  // Guards the design decision. Under a linear `score * 10`, an 80% match — a strong result — would
  // render 8, and nothing in the real range would ever reach 10 except a near-perfect duplicate.
  // The stretch is why a genuinely close match looks close.
  assert.ok(dotsForScore(0.8076) >= Math.round(0.8076 * DOT_COUNT));
  assert.equal(dotsForScore(0.93), 10);
});

// --------------------------------------------------------------------------- //
// It cannot break a row
// --------------------------------------------------------------------------- //

test("junk input still renders a valid meter", () => {
  // `score` is optional on the track type and arrives from the API. A score column that throws, or
  // renders NaN dots, would be a worse bug than the precision it replaced.
  for (const bad of [null, undefined, NaN, Infinity, -Infinity, -0.5, 42]) {
    const dots = dotsForScore(bad as number);
    assert.ok(Number.isInteger(dots) && dots >= 1 && dots <= DOT_COUNT, `${bad} gave ${dots}`);
  }
});

test("the accessible label states the count", () => {
  // The dots are aria-hidden; this is the only thing a screen reader gets.
  assert.equal(dotsLabel(0.8076), "Match strength 8 out of 10");
});

// --------------------------------------------------------------------------- //
// No percentage reaches the DOM
// --------------------------------------------------------------------------- //

const DESKTOP = read("../../sections/desktop/Playlist/PlaylistTable.tsx");
const MOBILE = read("../../sections/mobile/Playlist/PlaylistTable.tsx");

test("neither playlist table renders a similarity percentage any more", () => {
  // The task, stated literally. Matches the formatting call, not the word "percent" — the string
  // that reached the screen was built by `* 100` and `toFixed`.
  for (const [name, src] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
    assert.ok(!/score\s*\*\s*100/.test(src), `${name} still computes a score percentage`);
    assert.ok(!/formatPercentage\(\s*track\.score/.test(src), `${name} still formats one`);
  }
});

test("both tables render the dots", () => {
  assert.ok(DESKTOP.includes("<ScoreDots"));
  assert.ok(MOBILE.includes("<ScoreDots"));
});

test("the tooltip no longer apologises for the tight band", () => {
  // It used to read "scores sit in a tight band by design" — an apology for a display problem that
  // no longer exists. With the number gone there is nothing to excuse.
  for (const src of [DESKTOP, MOBILE]) {
    assert.ok(!/tight band/i.test(src));
    assert.ok(src.includes("Ten dots"));
  }
});

test("every filled dot uses the brand accent, not just the top row's", () => {
  // Explicitly approved. The old meter reserved the accent for rank 1; the dot count already says
  // which is best, so tinting one row and greying the rest said it twice and made the others look
  // inactive.
  const view = read("./ScoreDots.tsx");
  const fill = view.split("i < filled")[1].split(":")[0];

  assert.ok(/--color-accent/.test(fill), "filled dots are not the accent colour");
  assert.ok(!/isTopRank|rank === 1/.test(view), "the accent is conditional on rank again");
});

test("the pure scale is not named ScoreDots", () => {
  // `ScoreDots.tsx` and `scoreDots.ts` differ only by case, which macOS cannot distinguish —
  // TypeScript rejects the pair outright and the build fails locally while behaving differently on
  // a case-sensitive server. It cost a build to find; this stops it coming back.
  assert.ok(read("./ScoreDots.tsx").includes('from "./scoreScale.ts"'));
});
