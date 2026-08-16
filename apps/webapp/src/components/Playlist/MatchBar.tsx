import {
  anchorLabel,
  barFill,
  caretColor,
  isHot,
  matchAriaLabel,
  rankColor,
  scoreOutOfTen,
} from "./matchBarScale.ts";

/**
 * The weighted match bar. `RESOMIX // MATCH BAR — IMPLEMENTATION SPEC` §02, §06.
 *
 * Three requested departures from the spec:
 *
 *   * the **Δ readout** (`−3.00`) is not built;
 *   * the **ABS figure** (`90.01`) is replaced by a score out of ten (`9.87`);
 *   * the layout is **stacked** — anchor word above, bar, figure below — rather than the spec's
 *     single row. Inline, the word overflowed into the rating thumbs on desktop and shifted the
 *     bar on mobile.
 *
 * The tick marks (§02 [2]) are also dropped: sitting on the band boundaries they read as borders
 * cutting the bar into four, and the bands' own colours already mark those positions.
 *
 * Everything else is as written: the 120×8 banded track, the gradient fill on the rank ramp, and
 * the caret clamped so it never disappears.
 *
 * Typeface is Fira rather than the spec's IBM Plex Mono — the product's own mono, and with both
 * numeric readouts gone it only reaches the header labels.
 */
/**
 * Room for the widest figure ("10.00") at 9px mono, so right-aligning it to a very short fill
 * cannot push it off the left end of the bar.
 */
const MIN_LABEL_OFFSET_PX = 32;

export function MatchBar({
  score,
  rank,
  count,
  topScore,
  compact = false,
}: {
  /** Raw 0–1 similarity, as the API returns it. */
  score: number | null | undefined;
  /** 0-based. The spec's anchor is rank 0; the table's `track.rank` is 1-based, so callers subtract. */
  rank: number;
  /** Rows in this playlist — the denominator of the colour ramp. */
  count: number;
  /** The playlist's best raw score. Drives the tier gate, NOT the fill. */
  topScore: number | null | undefined;
  /** Mobile: a narrower track. Spec rule 08 puts the floor at 96px. */
  compact?: boolean;
}) {
  const hot = isHot(topScore);
  const fill = barFill(score);
  const width = `${fill.toFixed(1)}%`;

  return (
    // Stacked, not inline: beside the bar the anchor's word ran into the rating thumbs on desktop
    // and pushed the bar off-centre on mobile.
    <div className="flex flex-col items-center gap-[var(--px-2)] font-fira">
      {/* The slot is always rendered, empty on non-anchor rows. Reserving it is what keeps every
          bar in the column on the same baseline; showing it only on rank 0 would raise that one
          row's bar and misalign the whole table. */}
      <span
        className={`match-anchor ${hot ? "match-anchor--hot" : "match-anchor--dim"}`}
        aria-hidden={rank !== 0}
      >
        {rank === 0 ? anchorLabel(hot) : "\u00A0"}
      </span>

      {/* The bar's own positioning context. The figure below is placed as a percentage of THIS
          element, so it must be exactly the bar's width — and it sits outside `.match-bar`, whose
          `overflow: hidden` would otherwise clip it. Its padding reserves the figure's height so
          the row does not collapse onto the one beneath. */}
      <div className={`match-bar-wrap ${compact ? "match-bar--compact" : ""}`}>
      <div
        role="img"
        aria-label={matchAriaLabel(score, rank, topScore)}
        className={`match-bar ${compact ? "match-bar--compact" : ""}`}
      >
        {/* No tick marks. The spec puts 1px #3A1B0D rules at 7/27/97% to teach the ruler, but they
            land exactly on the band boundaries and read as borders dividing the bar into four
            pieces. The bands' own colours mark the same positions without the seam. */}
        <span
          className="match-fill"
          style={{ width, ["--rank" as string]: rankColor(rank, count, hot) }}
        />
        <span
          className="match-caret"
          style={{ left: width, ["--caret" as string]: caretColor(hot) }}
        />
      </div>

      {/* Caret-anchored: the figure's right edge sits under the fill edge, so value and position
          read as one thing and near-ties stack at almost the same x rather than lining up in a
          column that hides how close they are.

          `max()` is the guard — right-aligning to a 1.5% fill would push the number off the left
          end of the bar, so below roughly a fifth of the width it pins instead. */}
      <span
        className="match-score"
        aria-hidden="true"
        style={{ left: `max(${MIN_LABEL_OFFSET_PX}px, ${width})` }}
      >
        {scoreOutOfTen(score)}
      </span>
      </div>
    </div>
  );
}
