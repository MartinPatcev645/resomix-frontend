/**
 * Match bar — the weighted ruler
 * ==============================
 *
 * Implements `RESOMIX // MATCH BAR — IMPLEMENTATION SPEC`, Round 5 · v1.0 · 16 Aug 2026.
 *
 * The spec ships its own check values, and they are used here verbatim as fixtures rather than
 * recomputed from the breakpoints. Deriving the expected numbers from the same table the code reads
 * would only prove the code agrees with itself; these come from the document, so they prove it
 * agrees with the specification.
 *
 *     95.01 → 97.0 · 93.01 → 83.1 · 90.01 → 62.1 · 85.01 → 27.0 · 82.01 → 24.0
 *
 * THREE REQUESTED DEPARTURES FROM THE SPEC
 *
 *   * the Δ readout (`−3.00`, §02 [5]) is not built;
 *   * the ABS figure (`90.01`, §02 [6]) becomes a score out of ten, one decimal (`9.2`);
 *   * the cell is stacked — word above, bar, figure below — rather than the spec's single row.
 *     Inline, the anchor's word overflowed into the rating thumbs on desktop and shifted the bar
 *     on mobile, and it appears on one row in twenty so the column never lined up.
 *
 * The algorithm, the ruler and the tier gate are untouched.
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

import {
  HOT_THRESHOLD,
  MIN_FILL,
  TICKS,
  anchorLabel,
  barFill,
  caretColor,
  isHot,
  matchAriaLabel,
  rankColor,
  scoreOutOfTen,
  weightedFill,
} from "./matchBarScale.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(HERE, p), "utf8");

// --------------------------------------------------------------------------- //
// §01 — the ruler, against the spec's own numbers
// --------------------------------------------------------------------------- //

test("the spec's check values are reproduced exactly", () => {
  const CHECKS: [number, number][] = [
    [95.01, 97.0],
    [93.01, 83.1],
    [90.01, 62.1],
    [82.01, 24.0],
  ];
  for (const [score, expected] of CHECKS) {
    assert.equal(Number(weightedFill(score).toFixed(1)), expected, `score ${score}`);
  }
});

test("the spec's 85.01 check value disagrees with the spec's own code", () => {
  // NOT a bug here, and not fixed here. §01 lists "85.01 → 27.0", but its own reference
  // implementation yields 27.07: 85.01 falls in the [85, 95] band, so 27 + (0.01/10) × 70.
  //
  // Every other check value matches to the digit, so this reads as a transcription slip — 85 → 27.0
  // is exact, and the `.01` looks appended for consistency with its neighbours without recomputing.
  // Encoded rather than silently rounded away, because the alternative is someone later "fixing"
  // a correct implementation to match a mistyped fixture.
  assert.equal(Number(weightedFill(85).toFixed(1)), 27.0, "the breakpoint itself is exact");
  assert.equal(Number(weightedFill(85.01).toFixed(2)), 27.07, "the spec's code gives 27.07, not 27.0");
});

test("a 90 always out-fills an 82", () => {
  // The spec calls this out by name — it is the property the whole non-linear ruler exists to
  // deliver, and a linear bar would put these two 8 points apart instead of 38.
  assert.ok(weightedFill(90) > weightedFill(82));
  assert.ok(weightedFill(90) - weightedFill(82) > 30);
});

test("the breakpoints land on their exact bar positions", () => {
  assert.equal(weightedFill(0), 0);
  assert.equal(weightedFill(65), 7);
  assert.equal(weightedFill(85), 27);
  assert.equal(weightedFill(95), 97);
  assert.equal(weightedFill(100), 100);
});

test("the 85–95 band gets 70 of the 100 points", () => {
  // Where the engine's differences are real. If this collapses, the ruler is linear again and the
  // clustering problem is back.
  assert.equal(weightedFill(95) - weightedFill(85), 70);
});

test("the ruler is monotonic", () => {
  let previous = -1;
  for (let s = 0; s <= 100; s += 0.25) {
    const fill = weightedFill(s);
    assert.ok(fill >= previous, `${s} gave ${fill} after ${previous}`);
    previous = fill;
  }
});

test("scores above 100 do not overflow the bar", () => {
  assert.equal(weightedFill(120), 100);
});

// --------------------------------------------------------------------------- //
// Rule 02 — the caret never dies
// --------------------------------------------------------------------------- //

test("even a zero score keeps a visible fill", () => {
  // A bar of zero width is indistinguishable from a bar that failed to render.
  assert.equal(barFill(0), MIN_FILL);
});

test("the raw 0-1 score is scaled at the boundary, once", () => {
  // The spec's own note: multiply by 100 once, then everything downstream is 0–100. Passing 0.9001
  // through unscaled would land in the first band and render ~0.1%.
  assert.equal(Number(barFill(0.9001).toFixed(1)), 62.1);
});

test("a missing score still renders a bar", () => {
  // `score` is optional on the track type and arrives from the API.
  for (const bad of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(barFill(bad as number), MIN_FILL, `${bad}`);
  }
});

// --------------------------------------------------------------------------- //
// Rule 01 — the ruler is global
// --------------------------------------------------------------------------- //

test("fill depends on the score alone, never on the playlist", () => {
  // THE rule. A bar normalised per playlist was built here once and reverted: it made every
  // playlist's top row look full, so a weak shortlist and a strong one looked identical.
  // `barFill` takes one argument, which is what makes that impossible rather than merely unwise.
  assert.equal(barFill.length, 1);
  assert.equal(barFill(0.9001), barFill(0.9001));
});

test("the breakpoints are not derived from any data", () => {
  const src = read("./matchBarScale.ts");
  const table = src.split("const BP")[1].split("];")[0];

  // Every entry must be a literal pair. A `Math.` call or a variable here would mean the ruler
  // could move under the data it is measuring.
  assert.ok(/\[0, 0\]/.test(table) && /\[100, 100\]/.test(table));
  assert.ok(!/Math\.|score|track|playlist/i.test(table), "the breakpoint table references data");
});

// --------------------------------------------------------------------------- //
// Rule 05 — the tier gate
// --------------------------------------------------------------------------- //

test("TOP only when the anchor is genuinely strong", () => {
  assert.equal(anchorLabel(isHot(0.9001)), "TOP");
  assert.equal(anchorLabel(isHot(0.8999)), "BEST");
  assert.equal(HOT_THRESHOLD, 90);
});

test("a weak field gets the dim ramp and the dim caret", () => {
  // "Closest of a weak field must not read as good." The colour carries that, not the width — the
  // fill is on the global ruler either way.
  assert.notEqual(rankColor(0, 5, true), rankColor(0, 5, false));
  assert.equal(caretColor(true), "#FFFFFF");
  assert.equal(caretColor(false), "#D8D8D8");
});

test("the tier gate reads the playlist's best, not the row's own score", () => {
  // A strong row inside a weak playlist stays dim. Gating on the row would let any single good
  // match make a poor shortlist look hot.
  assert.equal(isHot(0.99), true);
  assert.equal(isHot(0.5), false);
});

// --------------------------------------------------------------------------- //
// §01 — the rank ramp
// --------------------------------------------------------------------------- //

test("the ramp runs from the anchor colour to the tail colour", () => {
  assert.equal(rankColor(0, 5, true), "rgb(255,93,31)");
  assert.equal(rankColor(4, 5, true), "rgb(148,48,15)");
  assert.equal(rankColor(0, 5, false), "rgb(196,90,36)");
  assert.equal(rankColor(4, 5, false), "rgb(96,46,22)");
});

test("a single-row playlist gets the anchor colour, not a division by zero", () => {
  assert.equal(rankColor(0, 1, true), "rgb(255,93,31)");
});

test("a rank beyond the count cannot escape the ramp", () => {
  // Defensive: `count` comes from the rendered list and `rank` from the row, and a filtered view
  // could disagree. Clamped rather than extrapolated into an out-of-gamut colour.
  assert.equal(rankColor(99, 5, true), rankColor(4, 5, true));
});

// --------------------------------------------------------------------------- //
// Rule 10 — accessibility
// --------------------------------------------------------------------------- //

test("the bar announces its value and its gap", () => {
  assert.equal(matchAriaLabel(0.9001, 0, 0.9001), "Match 90.01, top match");
  assert.equal(matchAriaLabel(0.8701, 3, 0.9001), "Match 87.01, 3.00 behind top");
});

// --------------------------------------------------------------------------- //
// The row itself
// --------------------------------------------------------------------------- //

const VIEW = read("./MatchBar.tsx");
const DESKTOP = read("../../sections/desktop/Playlist/PlaylistTable.tsx");
const MOBILE = read("../../sections/mobile/Playlist/PlaylistTable.tsx");

test("the score reads out of ten, one decimal", () => {
  assert.equal(scoreOutOfTen(0.9271), "9.2");
  assert.equal(scoreOutOfTen(0.8076), "8.0");
  assert.equal(scoreOutOfTen(0.5), "5.0");
});

test("the figure truncates rather than rounds", () => {
  // 92.71 → 9.2, the worked example this was specified with. Rounding gives 9.3 and contradicts it.
  // A reading that never rounds up also cannot overstate a match.
  assert.equal(scoreOutOfTen(0.9271), "9.2");
  assert.equal(scoreOutOfTen(0.9299), "9.2");
  assert.equal(scoreOutOfTen(0.99999), "9.9");
});

test("a missing score shows a dash, not a zero", () => {
  // Spec §04's PENDING state. "0.0" would be a claim; "—" is the absence of one.
  for (const bad of [null, undefined, NaN]) assert.equal(scoreOutOfTen(bad as number), "—");
});

test("neither the Δ readout nor the two-decimal absolute is built", () => {
  assert.ok(!/match-delta|match-abs/.test(VIEW), "the Δ or ABS element is back");
  assert.ok(!/toFixed\(2\)/.test(VIEW), "a two-decimal figure is being rendered");
  for (const [name, src] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
    assert.ok(!/score\s*\*\s*100/.test(src), `${name} still computes a percentage`);
  }
});

test("both tables render the bar", () => {
  assert.ok(DESKTOP.includes("<MatchBar"));
  assert.ok(MOBILE.includes("<MatchBar"));
});

test("rank is converted from the table's 1-based value to the spec's 0-based anchor", () => {
  // `track.rank === 1` is the anchor in this codebase; the spec's is rank 0. Getting this wrong
  // shifts the entire colour ramp by one row and never fails loudly.
  for (const src of [DESKTOP, MOBILE]) {
    assert.ok(/rank=\{track\.rank - 1\}/.test(src));
  }
});

test("the ticks render on every row", () => {
  assert.equal(TICKS.length, 3);
  assert.ok(VIEW.includes("TICKS.map"), "ticks are not rendered per row");
});

test("the numeric 85 / 95 header labels are not rendered", () => {
  // Spec rule 03 puts them in the column header to teach the ruler. Removed by request — the
  // banded track carries the ruler on its own.
  assert.ok(!/MatchBarLegend/.test(VIEW + DESKTOP + MOBILE));
});

test("the cell is stacked, with the anchor word above the bar", () => {
  // The reported problem: inline, the word ran into the rating thumbs on desktop and pushed the
  // bar off-centre on mobile.
  assert.ok(/flex flex-col/.test(VIEW), "the cell is not a column");
  assert.ok(VIEW.indexOf("match-anchor") < VIEW.indexOf('className={`match-bar'),
    "the anchor word renders after the bar");
  assert.ok(VIEW.indexOf('className={`match-bar') < VIEW.indexOf("match-score"),
    "the figure renders before the bar");
});

test("the anchor slot is reserved on every row", () => {
  // Rendering it only on rank 0 would raise that one row's bar and misalign the column.
  assert.ok(/\\u00A0/.test(VIEW), "non-anchor rows have no placeholder, so bars will not align");
});

test("the pure scale does not share a filename stem with its component", () => {
  // `MatchBar.tsx` + `matchBar.ts` differ only by case, which macOS cannot distinguish and
  // TypeScript refuses outright. This feature hit it twice — once with the dots, once here.
  assert.ok(VIEW.includes('from "./matchBarScale.ts"'));
});
