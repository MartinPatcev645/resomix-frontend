import React from "react";
import { useUsageChip } from "@resomix/hooks";

/**
 * UsageChip — what is left of today's allowance, in the workspace header (pricing v2.1, E1).
 *
 * `⌕ 2/3 today · ↑ 4/5 this month`
 *
 * Every decision about *what* to show lives in `useUsageChip`; this only renders. It disappears
 * entirely when there is nothing true to say — still loading, or every limit is unlimited — rather
 * than showing a placeholder, because a chip that reads "—/—" looks broken and a chip that guesses
 * is worse than no chip at all.
 *
 * It re-fetches on any 402 (wired in `useEntitlements`), so the numbers change on the request that
 * spends them rather than at the next page load.
 */
export const UsageChip: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { metrics, hidden } = useUsageChip();

  if (hidden) return null;

  return (
    <span
      className={[
        "inline-flex flex-wrap items-center gap-x-[var(--px-10)] gap-y-[var(--px-4)]",
        "border border-[var(--rx-color-border-default)] px-[var(--px-13)] py-[var(--px-7)]",
        "font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)]",
        "text-[var(--rx-color-text-secondary)]",
        className,
      ].join(" ")}
    >
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.key}>
          {index > 0 && (
            <i aria-hidden="true" className="not-italic opacity-40">
              ·
            </i>
          )}
          <span
            className={`inline-flex items-center gap-[var(--px-5)] ${
              // Spent reads as the accent, the same colour every other "you've hit a limit" state
              // in the app uses — the chip should look like the modal the user is about to see.
              metric.spent ? "text-[var(--color-accent,#EE4A26)]" : ""
            }`}
            // The glyph carries the meaning visually; a screen reader gets it in words instead.
            aria-label={`${metric.label}: ${metric.used} of ${metric.limit}`}
          >
            <i aria-hidden="true" className="not-italic opacity-70">
              {metric.glyph}
            </i>
            <span aria-hidden="true">
              {metric.used}/{metric.limit}
              {metric.period ? ` ${metric.period}` : ""}
            </span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
};

export default UsageChip;
