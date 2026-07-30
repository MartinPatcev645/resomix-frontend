import React, { useEffect, useState } from "react";
import { Dialog, type DialogAction } from "./Dialog";
import { PAGE_FIELD, PAGE_FIELD_LABEL } from "../Content/pageChrome";

/**
 * PromptDialog — one field, then confirm.
 *
 * Absorbs the old InputModal (the disable-2FA password) and PlaylistRenameModal. Anything that
 * needs to sit alongside the field — the playlist cover editor, a hint block — goes in `extra`.
 *
 * The field is controlled internally so callers don't have to hold draft state; it re-seeds from
 * `initialValue` each time the dialog opens, and reports the TRIMMED value on submit. Enter submits
 * (when valid), which is what every one of these dialogs previously had to wire up by hand.
 *
 * Submitting does NOT close the dialog — pass `busy` while the request runs and close from the
 * owner, so a server-side rejection can be shown in place via `error`.
 */
export interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the trimmed value. */
  onSubmit: (value: string) => void;
  title: string;
  /** Mono kicker above the title. */
  eyebrow?: string;
  message?: React.ReactNode;
  label?: string;
  placeholder?: string;
  inputType?: "text" | "password";
  initialValue?: string;
  /** Blocks submit until met. */
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Server-side error, shown under the field. Clears as soon as the user edits. */
  error?: string | null;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  /** Rendered ABOVE the field — for content the user acts on first (e.g. a cover editor). */
  extraAbove?: React.ReactNode;
  /** Rendered under the field — hints, anything field-adjacent. */
  extra?: React.ReactNode;
  autoComplete?: string;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  eyebrow,
  message,
  label,
  placeholder,
  inputType = "text",
  initialValue = "",
  required = true,
  minLength,
  maxLength,
  error,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  extraAbove,
  extra,
  autoComplete,
}) => {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);

  // Re-seed on each open so a reopened dialog never shows the previous attempt's text.
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setDirty(false);
    }
  }, [isOpen, initialValue]);

  const trimmed = value.trim();
  const tooShort = minLength != null && trimmed.length > 0 && trimmed.length < minLength;
  const invalid = (required && trimmed.length === 0) || tooShort;
  const shownError = dirty ? (tooShort ? `Must be at least ${minLength} characters.` : null) : error;

  const submit = () => {
    if (invalid || busy) return;
    onSubmit(trimmed);
  };

  const actions: DialogAction[] = [
    { label: cancelLabel, dismiss: true, disabled: busy },
    {
      label: submitLabel,
      onClick: submit,
      tone: "primary",
      disabled: invalid,
      busy,
      busyLabel: busyLabel ?? "Saving…",
    },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      eyebrow={eyebrow}
      title={title}
      subtitle={message}
      actions={actions}
      dismissible={!busy}
      ariaLabel={title}
    >
      {extraAbove}
      <div className="flex flex-col gap-[var(--px-8)] pb-[var(--px-4)]">
        {label && <span className={PAGE_FIELD_LABEL}>{label}</span>}
        <input
          data-dialog-autofocus=""
          type={inputType}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className={`${PAGE_FIELD} ${shownError ? "!border-[var(--rx-color-error)]" : ""}`}
        />
        {shownError && (
          <span
            role="alert"
            className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
          >
            {shownError}
          </span>
        )}
      </div>
      {extra}
    </Dialog>
  );
};

export default PromptDialog;
