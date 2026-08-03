import type { ReactNode } from "react";

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
      <span className="whitespace-nowrap font-fira text-[length:var(--px-10)] uppercase tracking-[0.18em] text-[var(--color-primary-hover)] opacity-70">
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
