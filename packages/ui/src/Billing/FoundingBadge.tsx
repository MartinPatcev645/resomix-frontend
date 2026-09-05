import { useEffect, useState } from "react";
import type { BillingBetaWindow } from "@resomix/api-client";

/**
 * FoundingBadge — "founding price · N days left" (pricing v2.1, E4).
 *
 * WHOSE CLOCK DECIDES
 * -------------------
 * `founding_active` comes from the **server**. The browser only formats the remaining time. A
 * client clock can be wrong by hours or deliberately set back, and a page that advertises a
 * founding price checkout will refuse — or hides one it would still honour — is worse than no
 * badge. So the client never decides whether the offer is open; it only says how long is left, and
 * stops rendering the moment its own arithmetic runs out.
 *
 * Days, not seconds. This window is months long: a ticking clock on a six-month deadline is
 * pressure theatre, and it re-renders the pricing page every second for nothing.
 */


export interface FoundingBadgeProps {
  beta: BillingBetaWindow | undefined;
  className?: string;
}

/** Whole days remaining, or null when there is nothing sensible to show. */
export function daysRemaining(endDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - now.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

export function FoundingBadge({ beta, className = "" }: FoundingBadgeProps) {
  // Recomputed daily rather than per second — see above.
  const [days, setDays] = useState<number | null>(() => daysRemaining(beta?.end_date));

  useEffect(() => {
    setDays(daysRemaining(beta?.end_date));
    const id = setInterval(() => setDays(daysRemaining(beta?.end_date)), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [beta?.end_date]);

  // The server closed the window, or we have no date to count to.
  if (!beta?.founding_active || days === null) return null;

  return (
    <span
      className={[
        "inline-flex items-center gap-[var(--px-8)]",
        "border border-[var(--color-neon-orange)] px-[var(--px-12)] py-[var(--px-6)]",
        "font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em]",
        "text-[var(--color-neon-orange)]",
        className,
      ].join(" ")}
    >
      Founding price
      <i aria-hidden="true" className="not-italic opacity-50">·</i>
      {days === 1 ? "last day" : `${days} days left`}
    </span>
  );
}

export default FoundingBadge;
