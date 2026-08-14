import { DOT_COUNT, dotsForScore, dotsLabel } from "./scoreScale.ts";

/**
 * Ten dots showing how close a match is.
 *
 * Every filled dot is the brand accent, on every row — not just the top one. The old percentage
 * reserved the accent for rank 1 to mark it as the best; the dot count already says that, so
 * colouring only one row's meter would be saying it twice while making the other rows look
 * inactive.
 *
 * Decorative: the dots are `aria-hidden` and the count is announced through a visually-hidden
 * label, because a screen reader reading out ten identical bullets is noise.
 */
export function ScoreDots({
  score,
  compact = false,
}: {
  score: number | null | undefined;
  /** Mobile / dense rows — smaller dots and tighter spacing. */
  compact?: boolean;
}) {
  const filled = dotsForScore(score);
  const size = compact ? "var(--px-5)" : "var(--px-7)";

  return (
    <span className="inline-flex items-center" title={dotsLabel(score)}>
      <span className="sr-only">{dotsLabel(score)}</span>
      <span
        aria-hidden="true"
        className={`flex items-center ${compact ? "gap-[var(--px-2)]" : "gap-[var(--px-3)]"}`}
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <span
            key={i}
            style={{ width: size, height: size }}
            className={[
              "shrink-0 rounded-[var(--rx-radius-circle)]",
              i < filled
                ? "bg-[var(--color-accent,#EE4A26)]"
                // Unfilled reads as "the meter continues here", not as a second value — so it uses
                // the border token rather than the score fill, which would look half-lit.
                : "bg-[var(--rx-color-border-default)]",
            ].join(" ")}
          />
        ))}
      </span>
    </span>
  );
}
