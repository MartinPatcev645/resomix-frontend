import React from "react";
import { useUsageChip, type UsageMetric } from "@resomix/hooks";
import { Dialog } from "@resomix/ui";
import { USAGE_ICONS } from "./usageIcons.tsx";

/**
 * UsageChip — what is left of your allowance, in the workspace header (pricing v2.1, E1).
 *
 * `⌕ 0/3 · ↑ 0/5 · ⤓ 0/1 · ≡ 2/5` — icon and fraction only. Tapping one opens a dialog that
 * explains what spends it and when it comes back.
 *
 * WHY THE WORDS WENT AWAY
 *
 * It used to render the period inline: `⌕ 0/3 today · ↑ 0/5 this month · …`. On a phone a free
 * account shows four metrics, and with the wording attached the strip wrapped onto two lines and
 * still ran to the edge. A Pro account showed the opposite problem — one lone metric reading
 * "↑ 0/50 THIS MONTH", which several people read as a countdown to something being taken away
 * rather than as usage.
 *
 * Both are the same mistake: explaining every number, permanently, to someone who mostly wants to
 * glance at it. The strip now states the fraction and nothing else, and the explanation is one tap
 * away for the person who actually wants it. The period wording is not lost — it moved into the
 * dialog, where there is room to say *when* it resets and *what* counts towards it.
 *
 * `useUsageChip` still decides WHAT is shown: unlimited metrics are absent (a Pro account sees only
 * uploads), a guest's zero-limits are absent, and the whole strip disappears rather than render a
 * placeholder. This file only draws it.
 */

/** Shared by the row and by each button, so the two never drift apart. */
const CHIP_TEXT = "font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)]";

export const UsageChip: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { metrics, hidden } = useUsageChip();
  const [explaining, setExplaining] = React.useState<UsageMetric | null>(null);

  if (hidden) return null;

  return (
    <>
      <span
        className={[
          // `justify-between` matters only where the strip is given a width it does not fill: the
          // mobile task selector passes `w-full`, and once the period wording was removed the
          // content no longer reached the right edge, leaving a visibly empty quarter inside the
          // border. Spreading the items fills it. On desktop the chip is sized to its content, so
          // there is no free space and this has no effect.
          "inline-flex flex-wrap items-center justify-between gap-x-[var(--px-8)] gap-y-[var(--px-4)]",
          "select-none",
          "border border-[var(--rx-color-border-default)] px-[var(--px-10)] py-[var(--px-5)]",
          CHIP_TEXT,
          "text-[var(--rx-color-text-secondary)]",
          className,
        ].join(" ")}
      >
        {metrics.map((metric, index) => {
          const Icon = USAGE_ICONS[metric.key];
          return (
            <React.Fragment key={metric.key}>
              {index > 0 && (
                <i aria-hidden="true" className="not-italic opacity-40">
                  ·
                </i>
              )}
              <button
                type="button"
                onClick={() => setExplaining(metric)}
                // Kept from the read-only version: the icon alone is cryptic, and a native tooltip
                // works on hover without a portal inside a wrapping flex row. It is now a shortcut
                // to the dialog's content rather than the only way to get it — which matters on
                // touch, where `title` never fires at all.
                title={metric.hint}
                // The icon carries the meaning visually; a screen reader gets words instead, plus
                // the fact that this opens something.
                aria-label={`${metric.label}: ${metric.used} of ${metric.limit}. What does this mean?`}
                className={[
                  // `group` so the icon's opacity can lift with the button's hover colour.
                  "group inline-flex cursor-pointer items-center gap-[var(--px-5)]",
                  "min-h-[var(--px-28)] rounded-[var(--rx-radius-control)] px-[var(--px-3)]",
                  CHIP_TEXT,
                  "transition-colors duration-[var(--rx-duration-base,150ms)] ease-out",
                  // Spent reads as the accent — the same colour every other "you've hit a limit"
                  // state uses, so the strip already looks like the modal the user is about to see.
                  // It keeps a hover of its own rather than reusing the neon one: turning the
                  // accent into the hover colour would erase the very signal it is carrying, but a
                  // spent metric is exactly the one a user is most likely to tap, so it cannot be
                  // the only item in the row that feels dead.
                  metric.spent
                    ? "text-[var(--color-accent,#EE4A26)] hover:opacity-75"
                    : "text-[var(--rx-color-text-secondary)] hover:text-[var(--color-primary)]",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2",
                ].join(" ")}
              >
                {Icon ? (
                  // Slightly dimmed at rest so the number leads; hover brings it up with the text.
                  <Icon className="opacity-70 transition-opacity group-hover:opacity-100" />
                ) : (
                  <i aria-hidden="true" className="not-italic opacity-70">
                    {metric.glyph}
                  </i>
                )}
                <span aria-hidden="true">
                  {metric.used}/{metric.limit}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </span>

      {/* The shared Dialog shell, so this matches every other modal in the app (header rule,
          eyebrow, ✕, backdrop and Escape handling) instead of growing a bespoke popover. */}
      <Dialog
        isOpen={explaining !== null}
        onClose={() => setExplaining(null)}
        size="sm"
        eyebrow="Your plan // Usage"
        title={explaining?.title ?? ""}
        // Restates the number the user just tapped, in words. The strip is deliberately terse, so
        // the dialog has to re-establish which of the four they are looking at.
        subtitle={
          explaining
            ? `${explaining.used} of ${explaining.limit} used${
                explaining.period ? ` ${explaining.period}` : ""
              }`
            : undefined
        }
        ariaLabel={explaining ? `${explaining.title} — what this number means` : "Usage"}
        actions={[{ label: "Got it", dismiss: true, tone: "primary" }]}
      >
        <p className="font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)]">
          {explaining?.description}
        </p>
      </Dialog>
    </>
  );
};

export default UsageChip;
