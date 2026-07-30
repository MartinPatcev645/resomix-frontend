import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * ConfirmModal — compatibility layer over `ConfirmDialog`.
 *
 * Its own overlay had the same drift as the rest: dotted border on a black card, a `bg-black/10`
 * backdrop (a tenth as dark as every other modal's), no focus trap and no focus restore.
 *
 * The API is unchanged, so its call site (revoke session) keeps working as-is. Behaviour is
 * preserved too: confirming still runs `onConfirm` and then closes.
 *
 * Prefer `ConfirmDialog` directly in new code — it also offers `busy`, `details` and
 * `acknowledgeOnly`.
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDanger = false,
}) => (
  <ConfirmDialog
    isOpen={isOpen}
    onClose={onClose}
    // The old modal closed itself on confirm; ConfirmDialog leaves that to the owner, so keep the
    // original behaviour explicitly here.
    onConfirm={() => {
      onConfirm();
      onClose();
    }}
    title={title}
    message={message}
    confirmLabel={confirmText}
    cancelLabel={cancelText}
    tone={confirmDanger ? 'danger' : 'default'}
  />
);

export default ConfirmModal;
