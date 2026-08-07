import type { KeyboardEvent, ReactNode } from "react";

/**
 * The marketing pages' section furniture, reused here so the pricing page reads as part of the
 * same site: a mono eyebrow led by a short accent rule, a heavy uppercase section heading, and a
 * hairline divider.
 *
 * Mirrors `.xx-eyebrow`, `.xx-h2b` and the hairline treatment in the landing's section CSS. The
 * old pricing page centred everything and used dotted slate borders with rounded, blurred panels;
 * the marketing system is left-aligned with 1px hairlines and square corners.
 */

/** Mono kicker with the accent rule — the marker that opens every marketing section. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-[var(--px-20)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-2)] text-[var(--color-text-secondary)]">
      <span aria-hidden="true" className="block w-[var(--px-32)] border-t border-[var(--color-neon-orange)]" />
      {children}
    </p>
  );
}

/** Section heading — Helvetica 700 uppercase, the `.xx-h2b` treatment. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 font-helvetica font-bold uppercase leading-[1.15] tracking-[var(--px-1)] text-[length:var(--px-23)] lg:text-[length:var(--px-34)] text-[var(--color-text-secondary)]">
      {children}
    </h2>
  );
}

/** Supporting copy — 17 / 300 / 1.65, the body spec shared by every hero subtitle. */
export function SectionBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`m-0 font-helvetica text-[length:var(--px-17)] font-light leading-[1.65] text-[var(--color-primary-hover)] ${className}`}
    >
      {children}
    </p>
  );
}

/** Full-width hairline carrying a centred mono label. */
export function LabelledRule({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[var(--px-16)]" aria-hidden="true">
      <span className="h-px flex-1 bg-white/15" />
      <span className="whitespace-nowrap font-fira text-[length:var(--px-11)] uppercase tracking-[0.18em] text-[var(--color-primary-hover)] opacity-75">
        {children}
      </span>
      <span className="h-px flex-1 bg-white/15" />
    </div>
  );
}

/**
 * Panel shell for a plan card.
 *
 * Square (2px) corners and a 1px hairline, replacing the 10px radius + `backdrop-blur-md` of the
 * old design. `highlighted` swaps the edge to the accent, which is how the marketing pages mark a
 * selected or recommended item.
 */
export function PlanPanel({
  highlighted = false,
  children,
  className = "",
}: {
  highlighted?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative flex flex-col justify-between rounded-[var(--px-2)] p-[var(--px-24)]",
        "bg-[#0c0c0d]/60 transition-colors duration-200",
        highlighted
          ? "border border-[var(--color-neon-orange)]"
          : "border border-white/13 hover:border-white/32",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/** Small square chip — "Your plan", "Most popular". Square, not a pill. */
export function Chip({ tone = "accent", children }: { tone?: "accent" | "muted"; children: ReactNode }) {
  const styles =
    tone === "accent"
      ? "bg-[var(--color-neon-orange)] text-[#101010]"
      : "border border-white/25 text-[var(--color-primary-hover)]";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[var(--px-2)] px-[var(--px-8)] py-[var(--px-2)] font-fira text-[length:var(--px-9)] uppercase tracking-[0.14em] ${styles}`}
    >
      {children}
    </span>
  );
}

/** Quiet 1px white/8 panel — guest rail, secondary bands. */
export function QuietPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border border-white/8 bg-white/[0.012] p-[var(--px-18)] ${className}`}>{children}</div>
  );
}

/** Accent-edge panel used by the see-Pro band. */
export function SoftPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border border-white/13 bg-[#0c0c0d]/60 p-[var(--px-26)] ${className}`}>{children}</div>
  );
}

/** Mono text link matching the preview `.tlink`. */
export function TextLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="inline-block border-b border-white/13 pb-[var(--px-3)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] no-underline transition-colors hover:border-[var(--color-primary-hover)] hover:text-[var(--color-text-secondary)]"
    >
      {children}
    </a>
  );
}

/** Accent saving chip next to the interval control. */
export function SaveTag({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap border border-[var(--color-neon-orange)]/40 px-[var(--px-9-6)] py-[var(--px-6)] font-fira text-[length:var(--px-11)] tracking-[0.12em] text-[var(--color-neon-orange)]">
      {children}
    </span>
  );
}

export type BillingInterval = "month" | "year";

/**
 * Monthly / yearly radiogroup. Arrow keys and Space change selection; focus follows.
 * Only render when the API returns more than one offer interval.
 */
export function IntervalRadiogroup({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: BillingInterval;
  options: BillingInterval[];
  onChange: (next: BillingInterval) => void;
  "aria-label": string;
}) {
  if (options.length < 2) return null;

  const labelFor = (interval: BillingInterval) => (interval === "year" ? "Yearly" : "Monthly");

  const move = (from: BillingInterval, dir: 1 | -1) => {
    const i = options.indexOf(from);
    if (i < 0) return;
    const next = options[(i + dir + options.length) % options.length];
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, interval: BillingInterval) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(interval, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(interval, -1);
    } else if (e.key === " ") {
      e.preventDefault();
      onChange(interval);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex border border-white/22"
    >
      {options.map((interval) => {
        const checked = value === interval;
        return (
          <button
            key={interval}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(interval)}
            onKeyDown={(e) => onKeyDown(e, interval)}
            className={[
              "min-h-[var(--px-44)] px-[var(--px-26)] py-[var(--px-14)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em]",
              checked
                ? "bg-[var(--color-neon-orange)] font-semibold text-[#101010]"
                : "bg-transparent text-[var(--color-primary-hover)] hover:text-[var(--color-text-secondary)]",
            ].join(" ")}
          >
            {labelFor(interval)}
          </button>
        );
      })}
    </div>
  );
}

/** Stable skeleton block — no layout shift between loading and loaded. */
export function PriceSkeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block min-h-[var(--px-26)] min-w-[var(--px-48)] bg-gradient-to-r from-white/5 via-white/10 to-white/5 motion-safe:animate-pulse ${className}`}
    />
  );
}
