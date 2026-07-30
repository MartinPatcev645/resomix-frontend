import React, { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  PAGE_BTN_DANGER,
  PAGE_BTN_PRIMARY,
  PAGE_BTN_SECONDARY,
} from "../Content/pageChrome";

/**
 * Dialog — the ONE modal shell for the whole product.
 * ==================================================
 *
 * Everything that pops over the page composes this: StatusDialog, ConfirmDialog, PromptDialog, and
 * any rich-body modal (exports, share, embed, cover crop, feedback…). Before this existed each
 * modal rolled its own overlay, which is why they drifted apart — four different z-layers, seven
 * widths, two backdrops, and only two of twelve escaping page stacking contexts.
 *
 * What the shell owns, so no caller has to think about it again:
 *   • a portal to <body>, so the overlay can never be clipped or covered by page chrome
 *   • ONE stacking layer (see DIALOG_LAYER)
 *   • one backdrop treatment, click-to-dismiss
 *   • Escape to dismiss
 *   • body scroll lock, ref-counted so two open dialogs can't unlock each other
 *   • focus moved in on open, TRAPPED while open, and restored to the trigger on close
 *   • role="dialog" + aria-modal + aria-labelledby/aria-describedby wiring
 *   • a top-right ✕ whenever the actions don't already offer a way out
 *
 * ── Stacking ──────────────────────────────────────────────────────────────────────────────────
 * The old numbers were guesses, and two of them were wrong. Measured app chrome:
 *
 *     page content wrapper  z-30      sticky nav header   z-80
 *     nav mega panels       z-90/95   MOBILE NAV DRAWER   z-120   ← highest app chrome
 *
 * So a dialog must clear 120. What we had:
 *   • z-50   (export/share/rating/rename/prompt) — BELOW the nav and the drawer, and not portaled,
 *            so also trapped inside the z-30 content wrapper. These could be painted under chrome.
 *   • z-100  (gate) — above the nav, still below the drawer.
 *   • z-120  (status/confirm) — exactly TIES the drawer, so the winner was DOM order.
 *   • z-9999 (terms/welcome/feedback) — arbitrarily high to dodge the problem.
 *
 * Replaced by two intent-based layers, both comfortably clear of 120:
 *   • "base" (200) — task dialogs: exports, share, rating, rename, cover crop, feedback, consent.
 *   • "top"  (210) — dialogs that report on or gate whatever sits beneath them, i.e. StatusDialog
 *                    and ConfirmDialog. This preserves the old intent, where status (120) sat above
 *                    the task modals (50) on purpose, without relying on mount order.
 *
 * Two things stay deliberately ABOVE dialogs: the upload loader (z-9999 — a full-screen progress
 * state that lowers itself before any error dialog is raised) and the third-party cookie-consent
 * banner (z-index 99999).
 */
export type DialogElevation = "base" | "top";

const ELEVATION_CLASS: Record<DialogElevation, string> = {
  base: "z-[200]",
  top: "z-[210]",
};

export type DialogSize = "sm" | "md" | "lg";

/** Widths use tokens defined in BOTH apps' pixels.css — do not swap for ones only webapp has. */
const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-[var(--px-450)]",
  md: "max-w-[var(--px-560)]",
  lg: "max-w-[var(--px-800)]",
};

export type DialogActionTone = "primary" | "secondary" | "danger";

/**
 * A footer button.
 *
 * The contract, so callers never have to guess who closes the dialog:
 *   • `dismiss: true`  → this action closes the dialog itself: it runs `onClick` (if any), then
 *                        `onClose`. Use it for Cancel / Not now — the negative half of a decision.
 *                        Do NOT add a plain "Close" action: the shell's ✕ is the universal exit on
 *                        every dialog, so a Close button would just duplicate it.
 *   • `dismiss` unset  → the dialog does NOT close on its own. It only calls `onClick`, and the
 *                        OWNER decides when to close — which is what you want for anything async
 *                        (delete, save, export), so the dialog can show `busy` and stay put if the
 *                        request fails.
 *
 * `busy` disables the button and swaps in `busyLabel`; it also blocks the whole dialog from being
 * dismissed, so a request can't be abandoned half-way.
 */
export interface DialogAction {
  label: string;
  onClick?: () => void;
  /** Visual weight. One `primary` per dialog. Defaults to `secondary`. */
  tone?: DialogActionTone;
  /** Marks this as the exit affordance — closes the dialog and hides the ✕. See above. */
  dismiss?: boolean;
  disabled?: boolean;
  /** In-flight: disables the button, shows `busyLabel`, and locks dismissal. */
  busy?: boolean;
  busyLabel?: string;
  /** Renders an <a> instead of a <button> — for actions that navigate (e.g. a login CTA). */
  href?: string;
  /** Focused when the dialog opens. Never put this on a destructive action. */
  autoFocus?: boolean;
  id?: string;
}

export interface DialogProps {
  isOpen: boolean;
  /** Called for every dismissal route: ✕, backdrop, Escape, and `dismiss` actions. */
  onClose: () => void;
  /** Accessible name. Omit only when you pass your own heading and set `ariaLabel`. */
  title?: React.ReactNode;
  /**
   * Mono kicker above the title, drawn with the accent rule — the same header treatment as the
   * Library / Profile / workspace pages ("ACCOUNT // LIBRARY"). Omit it and the rule is omitted too.
   */
  eyebrow?: React.ReactNode;
  /** Supporting line under the title. */
  subtitle?: React.ReactNode;
  /** Glyph in the header's left column, beside the kicker/title block. */
  icon?: React.ReactNode;
  size?: DialogSize;
  /**
   * Replaces the `size` width entirely. Escape hatch for a bespoke width — prefer `size`, since two
   * competing `max-w-*` classes resolve by stylesheet order, not by the order you list them.
   */
  widthClassName?: string;
  /** Footer buttons, left to right. See DialogAction for who closes what. */
  actions?: DialogAction[];
  /** Replaces the generated footer entirely, when a modal needs bespoke controls. */
  footer?: React.ReactNode;
  /**
   * false → the user cannot dismiss: no ✕, backdrop and Escape ignored. For unskippable states
   * (a running upload, a required consent). Defaults to true.
   */
  dismissible?: boolean;
  /** Accessible name when `title` is not a plain string (or absent). */
  ariaLabel?: string;
  /**
   * Which dialog layer to sit on. "base" (default) for task dialogs; "top" for dialogs that report
   * on or gate a dialog beneath them (status, confirm). See the stacking note above.
   */
  elevation?: DialogElevation;
  children?: React.ReactNode;
  className?: string;
}

/* ── body scroll lock, ref-counted ─────────────────────────────────────────────────────────────
   Each dialog used to set and clear document.body.style.overflow directly, so closing one while
   another was still open unlocked the page underneath. Counting keeps the lock honest. */
let scrollLocks = 0;
let previousOverflow = "";

function lockScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const TONE_CLASS: Record<DialogActionTone, string> = {
  primary: PAGE_BTN_PRIMARY,
  secondary: PAGE_BTN_SECONDARY,
  danger: PAGE_BTN_DANGER,
};

export const Dialog: React.FC<DialogProps> = (props) => {
  if (typeof document === "undefined" || !props.isOpen) return null;
  return createPortal(<DialogInner {...props} />, document.body);
};

const DialogInner: React.FC<DialogProps> = ({
  onClose,
  title,
  eyebrow,
  subtitle,
  icon,
  size = "sm",
  widthClassName,
  actions,
  footer,
  dismissible = true,
  ariaLabel,
  elevation = "base",
  children,
  className = "",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const bodyId = useId();

  // An action mid-flight locks dismissal — a request must not be abandoned half-way.
  const actionBusy = (actions ?? []).some((a) => a.busy);
  const canDismiss = dismissible && !actionBusy;

  const requestClose = useCallback(() => {
    if (canDismiss) onClose();
  }, [canDismiss, onClose]);

  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);

  // Move focus in, remember where it came from, and put it back on close — otherwise keyboard and
  // screen-reader users are dropped at the top of the document.
  useEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const preferred = panel.querySelector<HTMLElement>("[data-dialog-autofocus]");
      (preferred ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus?.();
    }
    return () => restoreFocusTo.current?.focus?.();
  }, []);

  // Escape closes; Tab is trapped inside the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [requestClose]);

  // The ✕ is the UNIVERSAL exit — every dismissible dialog gets one, so users always know where to
  // close from. Which means callers must NOT pass a plain "Close" action: that would be a second
  // exit for the same job. Cancel on a confirm/prompt is different — it is the negative half of a
  // decision, not merely a way out, so those keep it.
  const showCloseButton = canDismiss;

  const labelledBy = typeof title === "string" && title ? headingId : undefined;

  return (
    <div className={`fixed inset-0 ${ELEVATION_CLASS[elevation]} flex items-center justify-center p-[var(--px-16)]`}>
      <div
        aria-hidden="true"
        onClick={requestClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        style={{ WebkitBackdropFilter: "blur(12px)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={children || subtitle ? bodyId : undefined}
        tabIndex={-1}
        className={[
          // Same surface language as the workspace panels: square corners, token border, and the
          // accent tick at the top-left.
          "relative z-10 flex max-h-[calc(100vh-var(--px-32))] w-full flex-col outline-none",
          "border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface-raised)] shadow-2xl",
          "text-[var(--rx-color-text-primary)]",
          "before:absolute before:left-[var(--px-20)] before:top-0 before:block before:w-[var(--px-28)]",
          "before:border-t-2 before:border-[var(--rx-color-accent)] before:content-['']",
          "motion-safe:animate-[workspace-panel-in_150ms_ease-out_both]",
          widthClassName ?? SIZE_CLASS[size],
          className,
        ].join(" ")}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-[var(--px-10)] top-[var(--px-10)] z-20 flex h-[var(--px-28)] w-[var(--px-28)] cursor-pointer items-center justify-center rounded-[var(--rx-radius-control)] text-[var(--rx-color-text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rx-color-accent)]"
          >
            <CloseGlyph />
          </button>
        )}

        {/* Header — the page-header treatment from Library / Profile / workspace, scaled for a
            dialog: accent rule + mono kicker, then the heading, then the supporting line. The icon
            takes a left column beside that block; without one the block simply starts at the
            padding edge. Always left-aligned, never centred. */}
        {(icon || eyebrow || title || subtitle) && (
          <div
            className={[
              "shrink-0 px-[var(--px-24)] pb-[var(--px-14)] pt-[var(--px-24)] text-left",
              showCloseButton ? "pr-[var(--px-44)]" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-[var(--px-14)]">
              {icon && <div className="mt-[var(--px-2)] flex shrink-0 items-start">{icon}</div>}
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <p className="mb-[var(--px-10)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-24)] before:shrink-0 before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
                    {eyebrow}
                  </p>
                )}
                {title && (
                  <h2
                    id={headingId}
                    className="m-0 font-helvetica text-[length:var(--px-20)] font-medium uppercase leading-[var(--px-24)] text-[var(--rx-color-text-primary)]"
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="mt-[var(--px-10)] font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-80">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {children && (
          <div
            id={bodyId}
            className={[
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--px-24)] text-left",
              icon || eyebrow || title || subtitle ? "" : "pt-[var(--px-24)]",
              actions?.length || footer ? "" : "pb-[var(--px-24)]",
            ].join(" ")}
          >
            {children}
          </div>
        )}

        {footer ??
          (actions?.length ? (
            <div
              className={[
                "shrink-0 flex flex-wrap gap-[var(--px-10)] border-t border-[var(--rx-color-border-subtle)]",
                "px-[var(--px-24)] py-[var(--px-16)]",
                // A lone action reads better centred; a pair (cancel + confirm) belongs on the right.
                actions.length === 1 ? "justify-center" : "justify-end",
              ].join(" ")}
            >
              {actions.map((action) => {
                const cls = TONE_CLASS[action.tone ?? "secondary"];
                const label = action.busy ? action.busyLabel ?? action.label : action.label;
                const disabled = action.disabled || action.busy;
                // `dismiss` actions close the dialog themselves; everything else leaves that to the
                // owner, so async work can keep the dialog open while it runs.
                const handle = () => {
                  action.onClick?.();
                  if (action.dismiss) onClose();
                };

                if (action.href && !disabled) {
                  return (
                    <a
                      key={action.label}
                      id={action.id}
                      href={action.href}
                      onClick={handle}
                      className={cls}
                      {...(action.autoFocus ? { "data-dialog-autofocus": "" } : {})}
                    >
                      {label}
                    </a>
                  );
                }
                return (
                  <button
                    key={action.label}
                    id={action.id}
                    type="button"
                    disabled={disabled}
                    onClick={handle}
                    className={cls}
                    {...(action.autoFocus ? { "data-dialog-autofocus": "" } : {})}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null)}
      </div>
    </div>
  );
};

export default Dialog;
