import React from "react";
import { Dialog, type DialogAction } from "./Dialog";

/**
 * ConfirmDialog — "are you sure?" and "you need to do X first".
 *
 * Absorbs the old ConfirmModal plus the six confirms that were hand-built inside
 * StatusMessage's `status="custom"` slot (delete track, delete playlist, both visibility toggles,
 * "set a password first"), which is why those had all drifted apart.
 *
 * `tone="danger"` paints the confirm button destructive and does NOT auto-focus it — the safe
 * action keeps the focus, so Enter can never delete something by accident.
 *
 * Confirming does NOT close the dialog by itself: pass `busy` while the request runs and close it
 * from the owner when it settles, so a failure can stay on screen. Cancel always closes.
 */
export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Cancel / ✕ / backdrop / Escape. */
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: React.ReactNode;
  /** Bullets under the message — "what happens" detail for destructive actions. */
  details?: React.ReactNode[];
  /** Heading above the bullets, e.g. "This will permanently delete:". */
  detailsTitle?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Blocks the confirm button — e.g. a deliberate countdown on a destructive action. */
  confirmDisabled?: boolean;
  /** "danger" for irreversible actions. */
  tone?: "default" | "danger";
  /** In-flight: disables both buttons and locks dismissal until the owner resolves it. */
  busy?: boolean;
  busyLabel?: string;
  /** Drop the cancel button for acknowledge-only notices (the ✕ still appears). */
  acknowledgeOnly?: boolean;
  /** Mono kicker above the title. Defaults to "Confirm" / "Confirm // Irreversible". */
  eyebrow?: string;
  /** Extra body content between the message and the footer (a warning box, a nested field…). */
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  detailsTitle,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  tone = "default",
  busy = false,
  busyLabel,
  acknowledgeOnly = false,
  eyebrow,
  children,
}) => {
  const danger = tone === "danger";

  const confirmAction: DialogAction = {
    label: confirmLabel,
    onClick: onConfirm,
    tone: danger ? "danger" : "primary",
    disabled: confirmDisabled,
    busy,
    busyLabel: busyLabel ?? "Working…",
    // Acknowledge-only dialogs have nothing to wait for, so the single button also closes.
    dismiss: acknowledgeOnly,
    // Never pre-focus a destructive button; Cancel holds the focus instead.
    autoFocus: !danger && acknowledgeOnly,
  };

  const actions: DialogAction[] = acknowledgeOnly
    ? [confirmAction]
    : [{ label: cancelLabel, dismiss: true, disabled: busy, autoFocus: danger }, confirmAction];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      // Confirms gate whatever is beneath them (a row, a menu, or another dialog).
      elevation="top"
      eyebrow={eyebrow ?? (danger ? "Confirm // Irreversible" : "Confirm")}
      title={title}
      subtitle={message}
      actions={actions}
      dismissible={!busy}
      ariaLabel={title}
    >
      {details?.length ? (
        <div className="mt-[var(--px-4)] border border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] p-[var(--px-14)] text-left">
          {detailsTitle && (
            <p className="mb-[var(--px-10)] font-fira text-[length:var(--px-10)] font-medium uppercase leading-[var(--px-15)] tracking-[var(--px-1)] text-[var(--rx-color-text-primary)]">
              {detailsTitle}
            </p>
          )}
          <ul className="m-0 flex list-disc flex-col gap-[var(--px-4)] pl-[var(--px-15)] font-fira text-[length:var(--px-11)] font-light leading-[var(--px-16)] text-[var(--rx-color-text-secondary)] opacity-80">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {children}
    </Dialog>
  );
};

export default ConfirmDialog;
