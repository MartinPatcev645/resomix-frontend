import {
  TICKS,
  anchorLabel,
  barFill,
  caretColor,
  isHot,
  matchAriaLabel,
  rankColor,
} from "./matchBarScale.ts";

/**
 * The weighted match bar. `RESOMIX // MATCH BAR — IMPLEMENTATION SPEC` §02, §06.
 *
 * Built to the spec with two deliberate omissions, both requested: the **Δ readout** (`−3.00`) and
 * the **ABS figure** (`90.01`). No number appears on the row. The anchor keeps its word — TOP when
 * the playlist's best is ≥ 90, BEST otherwise — and that is the only text the cell carries.
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
    <div className="flex items-center gap-[var(--px-10)] font-fira">
      <div
        role="img"
        aria-label={matchAriaLabel(score, rank, topScore)}
        className={`match-bar ${compact ? "match-bar--compact" : ""}`}
      >
        {/* Ticks on every row — spec rule 03, "teach the ruler". The 85 / 95 labels appear once,
            in the column header, not here. */}
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
      {/* The anchor's word. Every other row's cell is bar-only — the Δ readout is not built. */}
      {rank === 0 && (
        <span
          className={`match-anchor ${hot ? "match-anchor--hot" : "match-anchor--dim"}`}
        >
          {anchorLabel(hot)}
        </span>
      )}
    </div>
  );
}

/**
 * The `85` / `95` labels that teach the ruler, rendered once above the column rather than per row.
 * Spec §02 [2] and rule 03.
 */
export function MatchBarLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`match-legend ${compact ? "match-bar--compact" : ""}`} aria-hidden="true">
      {TICKS.filter((t) => t.score >= 85).map((t) => (
        <span key={t.at} style={{ left: `${t.at}%` }}>
          {t.score}
        </span>
      ))}
    </div>
  );
}
