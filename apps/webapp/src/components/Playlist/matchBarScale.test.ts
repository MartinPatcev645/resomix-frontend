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
 *   * the ABS figure (`90.01`, §02 [6]) becomes a score out of ten, two decimals (`9.87`);
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

/** A CSS rule's declarations, with comments removed — see the note in the track-colour test. */
const declarationsOf = (selector: string): string =>
  read("../../index.css")
    .split(selector)[1]
    .split("}")[0]
    .replace(/\/\*[\s\S]*?\*\//g, "");

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

test("the bar announces its value and its gap, in the unit shown on screen", () => {
  // Out of ten, matching the figure under the bar. Announcing "90.01" beside a visible "9.00"
  // would describe a different measurement to anyone who cannot see the bar.
  assert.equal(matchAriaLabel(0.9001, 0, 0.9001), "Match 9.00 out of 10, top match");
  assert.equal(matchAriaLabel(0.8701, 3, 0.9001), "Match 8.70 out of 10, 0.30 behind top");
});

test("the more menu shows the same figure as the row it opened from", () => {
  // It used to read `formatPercentage(score, 2)` — after this change it would have been the only
  // percentage left anywhere in the playlist UI, one tap from a bar showing the same number in a
  // different unit.
  const menu = read("../../sections/mobile/Playlist/MoreMenu.tsx");

  assert.ok(menu.includes("scoreOutOfTen(score)"));
  assert.ok(!/formatPercentage/.test(menu), "the more menu still formats a percentage");
});

// --------------------------------------------------------------------------- //
// The row itself
// --------------------------------------------------------------------------- //

const VIEW = read("./MatchBar.tsx");
const DESKTOP = read("../../sections/desktop/Playlist/PlaylistTable.tsx");
const MOBILE = read("../../sections/mobile/Playlist/PlaylistTable.tsx");

test("the score reads out of ten, two decimals", () => {
  assert.equal(scoreOutOfTen(0.9871), "9.87");
  assert.equal(scoreOutOfTen(0.9271), "9.27");
  assert.equal(scoreOutOfTen(0.8076), "8.07");
  assert.equal(scoreOutOfTen(1), "10.00");
});

test("one decimal would collapse a whole playlist onto one value", () => {
  // Why two. These are five consecutive ranks from a real playlist: at one decimal every one of
  // them reads "9.2" and the column distinguishes nothing.
  const REAL = [0.9270, 0.9262, 0.9253, 0.9204, 0.9229];
  // Truncated to one decimal — the same rule, one digit shorter. Compared like for like: `toFixed(1)`
  // would ROUND, which splits these into two values and understates the problem being fixed.
  const oneDecimal = (s: number) => (Math.floor(s * 100 + 1e-6) / 10).toFixed(1);

  assert.equal(new Set(REAL.map(scoreOutOfTen)).size, REAL.length, "two decimals still collapse rows");
  assert.equal(new Set(REAL.map(oneDecimal)).size, 1, "…and one decimal collapses all five onto 9.2");
});

test("the figure truncates rather than rounds", () => {
  // A reading off a ten-point scale, not an arithmetic result. Never rounding up means the figure
  // cannot overstate a match.
  assert.equal(scoreOutOfTen(0.92719), "9.27");
  assert.equal(scoreOutOfTen(0.99999), "9.99");
});

test("truncation stays correct despite floating-point error", () => {
  // `Math.floor(score * 1000)` without the epsilon is wrong for 88 of these — `0.41` renders as
  // "4.09" rather than "4.10", because the intermediate lands a hair under the integer and
  // truncation has no rounding to absorb it. Exhaustive rather than sampled: the failures are
  // scattered with no pattern to pick representatives from.
  let mismatches = 0;
  for (let i = 0; i <= 10000; i++) {
    const expected = (Math.floor(i / 10) / 100).toFixed(2);
    if (scoreOutOfTen(i / 10000) !== expected) mismatches++;
  }

  assert.equal(mismatches, 0, "truncation is losing a hundredth to float error");
  assert.equal(scoreOutOfTen(0.41), "4.10");
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

test("the track is a flat neutral that separates from the page and the fill", () => {
  // #2F2F2F on a #1E1E1E page. The spec's four brown bands (#1A0D07 … #2A150C) were near-black on
  // a near-black background: the empty extent never read, so a short fill looked like a floating
  // stub rather than a low value.
  // Comments stripped first: the rule documents which colours it REPLACED, and matching on the
  // raw text fails the test for explaining itself. Second time this exact trap has bitten in this
  // codebase — the migration's `track_type` note was the first.
  const bar = declarationsOf(".match-bar {");

  assert.ok(/background:\s*#2F2F2F/i.test(bar), "the track is not the lifted neutral");
  assert.ok(!/#1A0D07|#20100A|#241109|#2A150C/i.test(bar), "the banded track is back");
});

test("the fill's gradient floor clears the track's own lightness", () => {
  // .25, not the spec's .12. On the old near-black track a 12% start read as filled; on a #2F2F2F
  // track it sits below the track itself, so the fill appears to begin part-way along its length.
  const fill = declarationsOf(".match-fill {");

  assert.ok(/rgba\(255,\s*69,\s*25,\s*\.25\)/.test(fill), "the fill floor is too dark for the neutral track");
});

test("no tick rules are drawn inside the bar", () => {
  // Spec §02 [2] puts 1px rules at 7/27/97% to teach the ruler. They sit exactly on the band
  // boundaries, so they read as borders slicing the bar into four rather than as gradations — the
  // reported "faint white line between the sections". The bands mark those positions already.
  assert.ok(!/TICKS/.test(VIEW), "tick elements are back inside the bar");
  assert.ok(!/MatchBarLegend/.test(VIEW + DESKTOP + MOBILE), "the header labels are back");
});

test("the figure is anchored to the fill edge, not centred", () => {
  // Right edge under the caret, so value and position read as one unit and near-ties visibly
  // stack instead of lining up in a column that hides how close they are.
  assert.ok(/left: `max\(/.test(VIEW), "the figure is not positioned against the fill");
  assert.ok(/translateX\(-100%\)/.test(read("../../index.css").split(".match-score")[1].split("}")[0]),
    "the figure is not right-aligned to its anchor point");
});

test("a very short fill cannot push the figure off the bar", () => {
  // At the 1.5% floor, right-aligning to the fill would place the number left of the bar's start.
  assert.ok(/MIN_LABEL_OFFSET_PX/.test(VIEW));
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
