/**
 * Precision-industrial chrome for the profile screen and the panels that plug into it
 * (PlanBillingCard here, LinkedAccounts in the webapp). Matches the workspace panels: square
 * corners, token borders, a solid surface and the small accent tick on section panels.
 *
 * Written with the shared --rx-* tokens rather than either app's local helper classes (ws-btn-*,
 * font-benzin), since these render in both the landing site and the webapp.
 */

/**
 * THE block signifier — a short accent bar tucked into the top-left corner.
 *
 * Its WEIGHT carries the meaning: a few pixels means the block is something you operate, a
 * hairline means it only presents. That single rule replaces the old full-height bar down the left
 * edge, which is now reserved for *state* (playing, selected) rather than affordance — two
 * different signals that were previously fighting over the same treatment.
 *
 * Same geometry either way, so blocks of both kinds line up along a shared top edge.
 */
const PAGE_MARK_BASE =
  "relative before:absolute before:left-[var(--px-20)] before:top-0 before:block " +
  "before:w-[var(--px-28)] before:border-[var(--rx-color-accent)] before:content-['']";

/** The block itself is a control — a card you press, a row you open. */
export const PAGE_MARK_INTERACTIVE = `${PAGE_MARK_BASE} before:border-t-[length:var(--px-3)]`;

/** The block only presents. Hairline — present for alignment, not for attention. */
export const PAGE_MARK_STATIC = `${PAGE_MARK_BASE} before:border-t`;

/** Bordered surface, no mark — compose with one of the PAGE_MARK_* above. */
const PAGE_SURFACE =
  "border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-18)]";

/** Section panel — presentational, so it wears the hairline mark. */
export const PAGE_PANEL = `${PAGE_SURFACE} ${PAGE_MARK_STATIC}`;

/** Section panel whose whole surface is an affordance — wears the full-weight mark. */
export const PAGE_PANEL_INTERACTIVE = `${PAGE_SURFACE} ${PAGE_MARK_INTERACTIVE}`;

/** Same surface, no accent tick — for sub-panels and the tab nav. */
export const PAGE_PANEL_PLAIN =
  "border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-18)]";

/** Section heading inside a panel — mono uppercase, as on the workspace panels. */
export const PAGE_KICKER =
  "m-0 font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-primary)]";

/** Small mono label for a group of rows (e.g. "This month's usage"). */
export const PAGE_SUBLABEL =
  "font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]";

export const PAGE_BTN_BASE =
  "inline-flex min-h-[var(--px-36)] cursor-pointer items-center justify-center rounded-[var(--rx-radius-control)] " +
  "px-[var(--px-14)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] whitespace-nowrap " +
  "transition-[background-color,border-color,color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rx-color-accent)] " +
  "disabled:cursor-not-allowed disabled:border-[rgba(255,255,255,0.12)] disabled:text-[var(--rx-color-disabled)]";

export const PAGE_BTN_SECONDARY =
  `${PAGE_BTN_BASE} border border-[var(--rx-color-border-default)] bg-transparent text-[var(--rx-color-text-primary)] ` +
  "hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]";

export const PAGE_BTN_PRIMARY =
  `${PAGE_BTN_BASE} border border-[var(--rx-color-accent)] bg-[var(--rx-color-accent)] font-medium text-[#050505] ` +
  "hover:border-[var(--rx-color-accent-hover)] hover:bg-[var(--rx-color-accent-hover)]";

export const PAGE_BTN_DANGER =
  `${PAGE_BTN_BASE} border border-[var(--rx-color-error)] bg-transparent text-[var(--rx-color-error)] ` +
  "hover:bg-[rgba(255,118,96,0.12)]";

export const PAGE_FIELD_LABEL =
  "font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]";

export const PAGE_FIELD =
  "min-h-[var(--px-40)] w-full rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] " +
  "bg-[#0a0a0a] px-[var(--px-10)] font-helvetica text-[length:var(--px-13)] font-light " +
  "text-[var(--rx-color-text-primary)] transition-[border-color] duration-[var(--rx-duration-base)] " +
  "hover:border-[var(--rx-color-border-strong)] focus:border-[var(--rx-color-border-strong)] focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** Small inline text link — "Forgot password?", "Sign in here", "Resend email". */
export const PAGE_TEXT_LINK =
  "cursor-pointer font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] " +
  "text-[var(--rx-color-text-secondary)] underline-offset-2 transition-colors " +
  "duration-[var(--rx-duration-base)] hover:text-[var(--rx-color-accent)] hover:underline";

/** Inset row inside a panel — subtler border than the panel that holds it. */
export const PAGE_INSET_ROW =
  "flex items-center justify-between gap-[var(--px-16)] border border-[var(--rx-color-border-subtle)] " +
  "bg-[rgba(255,255,255,0.02)] p-[var(--px-12)]";

/** Row primary text. */
export const PAGE_ROW_TITLE = "font-helvetica text-[length:var(--px-13)] font-light";

/** Row secondary text. */
export const PAGE_ROW_META =
  "mt-[var(--px-2)] font-helvetica text-[length:var(--px-11)] font-light text-[var(--rx-color-text-secondary)] opacity-70";
