import type { ReactNode } from "react";
import { PAGE_BTN_SECONDARY as BTN_SECONDARY, PAGE_KICKER, PAGE_SUBLABEL } from "./pageChrome";

/**
 * The shared shell for every auth screen — sign in, register, forgot/reset password, verify email,
 * verify 2FA, sessions.
 *
 * Extracted because all of them wear exactly the same chrome as Profile / Library / Contact:
 * accent rule + mono kicker, uppercase heading, lead, a back control, then one bordered panel with
 * an accent tick, a head strip and an optional footer strip. Six hand-rolled copies of that markup
 * is how they drifted apart in the first place, so there is one copy and the pages supply content.
 *
 * Pages own everything inside the panel; this owns only the frame.
 */

export interface AuthScreenProps {
  /** Mono kicker above the heading, e.g. "Account // Sign in". */
  eyebrow: string;
  title: string;
  lead?: ReactNode;

  /**
   * Destination for the default back control. In both apps this is the beta workspace, so the
   * label reads "Sonic Discovery" like the Profile and Library back buttons.
   */
  backUrl?: string;
  backLabel?: string;
  /**
   * App-supplied back control, for a host that must stay inside itself (client-side navigation
   * rather than an href). Wins over backUrl. Same pattern as ContactContent.
   */
  backControl?: ReactNode;

  /** Head-strip label, e.g. "Credentials". Omit the strip entirely by passing nothing. */
  panelLabel?: string;
  /** Right-hand side of the head strip — a hint such as "* Required". */
  panelNote?: ReactNode;

  /** Panel body. */
  children: ReactNode;
  /** Optional footer strip below the body, separated by a rule — "Already have an account?" etc. */
  footer?: ReactNode;

  /**
   * Panel width. "md" (default) suits a short credentials form; "lg" is for Register and Sessions,
   * which lay fields out in two columns and would look cramped at the narrower width.
   */
  width?: "md" | "lg";
}

/**
 * This renders in both the landing site and the webapp, and an undefined var makes the whole
 * `max-width` declaration invalid — silently dropping the constraint rather than erroring. The two
 * apps' pixels.css files are now a byte-identical union, so any --px-* token is safe here; that
 * was not true when this was written, which is why the wide variant is 800 rather than 840.
 */
const WIDTH_CLASS = {
  md: "max-w-[var(--px-560)]",
  lg: "max-w-[var(--px-800)]",
} as const;

export function AuthScreen({
  eyebrow,
  title,
  lead,
  backUrl,
  backLabel = "Sonic Discovery",
  backControl,
  panelLabel,
  panelNote,
  children,
  footer,
  width = "md",
}: AuthScreenProps) {
  const back =
    backControl ??
    (backUrl ? (
      <a href={backUrl} aria-label={backLabel} className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
        <svg
          viewBox="0 0 24 24"
          className="h-[var(--px-14)] w-[var(--px-14)] shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {backLabel}
      </a>
    ) : null);

  return (
    // Spacing matches the workspace shell and the other account pages: a small inset from the
    // vertical side lines, no oversized top pad — the layout's <main> already offsets the header.
    <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
      <div className={`mx-auto w-full ${WIDTH_CLASS[width]} text-[var(--rx-color-text-primary)]`}>
        <header className="mb-[var(--px-24)]">
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            {eyebrow}
          </p>
          <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            {title}
          </h1>
          {lead ? (
            <p className="mt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-70">
              {lead}
            </p>
          ) : null}
        </header>

        {back ? <div className="mb-[var(--px-24)]">{back}</div> : null}

        <div className="relative border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] before:absolute before:left-[var(--px-24)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
          {panelLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-[var(--px-12)] border-b border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-[var(--px-20)] py-[var(--px-14)]">
              <p className={PAGE_KICKER}>{panelLabel}</p>
              {panelNote ? <span className={PAGE_SUBLABEL}>{panelNote}</span> : null}
            </div>
          ) : null}

          {children}

          {footer ? (
            <div className="flex flex-wrap items-center justify-center gap-[var(--px-8)] border-t border-[var(--rx-color-border-subtle)] px-[var(--px-20)] py-[var(--px-16)]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default AuthScreen;
