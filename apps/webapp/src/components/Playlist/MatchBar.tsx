import {
  TICKS,
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
 *   * the **ABS figure** (`90.01`) is replaced by a score out of ten, one decimal (`9.2`);
 *   * the layout is **stacked** — anchor word above, bar, figure below — rather than the spec's
 *     single row. Inline, the word overflowed into the rating thumbs on desktop and shifted the
 *     bar on mobile.
 *
 * Everything else is as written: 120×8 banded track, ticks at 7/27/97%, the gradient fill on the
 * rank ramp, and the caret clamped so it never disappears.
 *
 * Typeface is Fira rather than the spec's IBM Plex Mono — the product's own mono, and with both
 * numeric readouts gone it only reaches the header labels.
 */
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
    // Stacked, not inline. Beside the bar, the anchor's word ran into the rating thumbs on desktop
    // and pushed the bar off-centre on mobile — and only on one row in twenty, so the column never
    // lined up. Above and below, the bar keeps its position on every row.
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

      <div
        role="img"
        aria-label={matchAriaLabel(score, rank, topScore)}
        className={`match-bar ${compact ? "match-bar--compact" : ""}`}
      >
        {/* Ticks on every row — spec rule 03. The numeric marks that used to sit in the column
            header are gone; the bands themselves carry the ruler. */}
        {TICKS.map((t) => (
          <i key={t.at} style={{ left: `${t.at}%` }} />
        ))}
        <span
          className="match-fill"
          style={{ width, ["--rank" as string]: rankColor(rank, count, hot) }}
        />
        <span
          className="match-caret"
          style={{ left: width, ["--caret" as string]: caretColor(hot) }}
        />
      </div>

      {/* Out of ten, one decimal — not the spec's two-decimal absolute. */}
      <span className="match-score" aria-hidden="true">{scoreOutOfTen(score)}</span>
    </div>
  );
}
