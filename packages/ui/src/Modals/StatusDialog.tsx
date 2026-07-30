import React, { useEffect, useRef } from "react";
import { Dialog, type DialogAction } from "./Dialog";

/**
 * StatusDialog — outcome reporting: "working…", "done", "that failed", "heads up".
 *
 * Replaces the loading / success / error variants of the old StatusMessage, which was ~30 render
 * sites and the single biggest source of modal drift.
 *
 * `loading` is deliberately NOT dismissible: it represents work in flight, and letting the user
 * close it left them staring at a page that was still mutating.
 *
 * There is no "Close" button — the shell's ✕ is the universal exit, so a Close action would just
 * duplicate it. `action` is for a real follow-up ("View playlist", "Try again"), not for dismissing.
 *
 * These fire on almost every mutation (renamed, cover updated, rated, exported, link copied…), so a
 * terminal status DISMISSES ITSELF after 2.5s rather than making the user close a modal that only
 * says "done". Two states never auto-close, on purpose:
 *   • `loading` — not terminal; it closes when the work finishes.
 *   • anything with an `action` — the user has something to do here, so taking it away mid-reach
 *     would be worse than leaving it up.
 * Closing early via ✕ / backdrop / Escape works throughout; `autoDismiss={false}` opts out.
 */
const AUTO_DISMISS_MS = 2500;
export type StatusKind = "loading" | "success" | "error" | "info";

export interface StatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  status: StatusKind;
  title?: string;
  message?: React.ReactNode;
  /** An optional real follow-up — e.g. "View playlist", "Try again". Never a dismiss button. */
  action?: DialogAction;
  /** Overrides the per-state mono kicker (e.g. "Playlist // Export"). */
  eyebrow?: string;
  /** Opt out of the 2.5s self-dismiss for a message that must be read. Defaults to true. */
  autoDismiss?: boolean;
}

/* ── Glyphs ────────────────────────────────────────────────────────────────────────────────────
   Purpose-built for this system rather than reused from the old modal: a SQUARE bezel at the
   product's control radius (2px), a hairline outer frame and a bolder inner mark. The circular
   glyphs read as generic web-app icons; these match the square, instrument-panel language the rest
   of the app uses (panels, meters, controls). One 28px box for every state, so the header's left
   column never shifts. */
const GLYPH_BOX =
  "flex h-[var(--px-28)] w-[var(--px-28)] shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border";

const Spinner = () => (
  // Square bezel with a single accent edge, rotating — a progress mark in the same square language
  // rather than a circular spinner.
  <span
    role="status"
    aria-label="Working"
    className={`${GLYPH_BOX} border-[var(--rx-color-border-subtle)] border-t-[var(--rx-color-accent)] motion-safe:animate-spin`}
  />
);

const Tick = () => (
  <span className={`${GLYPH_BOX} border-[var(--rx-color-success)] bg-[rgba(99,210,143,0.10)]`} aria-hidden="true">
    <svg viewBox="0 0 16 16" className="h-[var(--px-14)] w-[var(--px-14)] text-[var(--rx-color-success)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  </span>
);

const Cross = () => (
  <span className={`${GLYPH_BOX} border-[var(--rx-color-error)] bg-[rgba(255,118,96,0.10)]`} aria-hidden="true">
    <svg viewBox="0 0 16 16" className="h-[var(--px-12)] w-[var(--px-12)] text-[var(--rx-color-error)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  </span>
);

const Info = () => (
  <span className={`${GLYPH_BOX} border-[var(--rx-color-accent)] bg-[var(--rx-color-accent-soft)]`} aria-hidden="true">
    <svg viewBox="0 0 16 16" className="h-[var(--px-14)] w-[var(--px-14)] text-[var(--rx-color-accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M8 7v5.5M8 3.75v1.5" />
    </svg>
  </span>
);

const GLYPH: Record<StatusKind, React.FC> = {
  loading: Spinner,
  success: Tick,
  error: Cross,
  info: Info,
};

const FALLBACK_TITLE: Record<StatusKind, string> = {
  loading: "Working\u2026",
  success: "Done",
  error: "Something went wrong",
  info: "Heads up",
};

/** Mono kicker per state, in the app's "CONTEXT // DETAIL" form. Override with `eyebrow`. */
const FALLBACK_EYEBROW: Record<StatusKind, string> = {
  loading: "Status // Working",
  success: "Status // Success",
  error: "Status // Error",
  info: "Status // Notice",
};

export const StatusDialog: React.FC<StatusDialogProps> = ({
  isOpen,
  onClose,
  status,
  title,
  message,
  action,
  eyebrow,
  autoDismiss = true,
}) => {
  const Glyph = GLYPH[status];
  const loading = status === "loading";
  const hasAction = Boolean(action);

  // Held in a ref so an inline `onClose={() => …}` (which most callers pass) can't restart the
  // timer on every parent render — that would keep the dialog open indefinitely.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen || loading || hasAction || !autoDismiss) return;
    const timer = window.setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // Keyed on the open/status cycle only: a fresh status restarts the countdown, a re-render does not.
  }, [isOpen, loading, hasAction, autoDismiss, status]);

  // No dismiss button — the ✕ closes it. Only a genuine follow-up action gets a footer.
  const actions: DialogAction[] =
    !loading && action ? [{ tone: "primary", autoFocus: true, ...action }] : [];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      elevation="top"
      // Work in flight: no ✕, no backdrop dismiss, no Escape.
      dismissible={!loading}
      icon={<Glyph />}
      eyebrow={eyebrow ?? FALLBACK_EYEBROW[status]}
      title={title || FALLBACK_TITLE[status]}
      actions={actions}
      ariaLabel={title || FALLBACK_TITLE[status]}
    >
      {message ? (
        <p className="whitespace-pre-line pb-[var(--px-8)] font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-85">
          {message}
        </p>
      ) : null}
    </Dialog>
  );
};

export default StatusDialog;
