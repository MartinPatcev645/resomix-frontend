import React from 'react';
import { PromptDialog } from './PromptDialog';

/**
 * InputModal — compatibility layer over `PromptDialog`.
 *
 * Its own overlay was the `z-50` variety: below the sticky nav and the mobile drawer, no portal, no
 * focus trap, no focus restore.
 *
 * The API is unchanged, so its call site (the disable-2FA password prompt) keeps working as-is, and
 * behaviour is preserved: submitting still calls `onSubmit` and then closes. Validation moves into
 * PromptDialog, which disables the submit button rather than rejecting after the click — same rules
 * (`required`, `minLength`), just enforced earlier.
 *
 * Prefer `PromptDialog` directly in new code.
 */
interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  inputLabel: string;
  inputType?: 'text' | 'password';
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  minLength?: number;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  inputLabel,
  inputType = 'text',
  inputPlaceholder,
  confirmText = 'Submit',
  cancelText = 'Cancel',
  required = true,
  minLength,
}) => (
  <PromptDialog
    isOpen={isOpen}
    onClose={onClose}
    // The old modal closed itself on submit; PromptDialog leaves that to the owner, so keep the
    // original behaviour explicitly here.
    onSubmit={(value) => {
      onSubmit(value);
      onClose();
    }}
    title={title}
    message={message}
    label={inputLabel}
    placeholder={inputPlaceholder}
    inputType={inputType}
    required={required}
    minLength={minLength}
    submitLabel={confirmText}
    cancelLabel={cancelText}
    autoComplete={inputType === 'password' ? 'current-password' : undefined}
  />
);

export default InputModal;
