import React from 'react'
import { SineWaves } from "../Animations/SineWaves";
import { Dialog, type DialogAction } from "../Modals/Dialog";
import { StatusDialog } from "../Modals/StatusDialog";

/**
 * StatusMessage — compatibility layer over the unified modal system.
 * =================================================================
 *
 * This is the app's most-used modal (~30 render sites across both apps), so rather than touch every
 * call site it now delegates to `Dialog` / `StatusDialog` while keeping its public API byte-for-byte.
 * Every one of those sites therefore picks up the shared shell — portal, one stacking layer, focus
 * trap and restore, ref-counted scroll lock, the universal ✕, and the new surface — with no change
 * to how it is called.
 *
 * It used to be its own overlay with three inconsistencies worth naming: a dotted border on a pure
 * `--color-secondary` (black) card, which is why it looked nothing like the export modals; three
 * different widths across its own variants (390 / 393 / 400); and a `z-50` success state against
 * `z-120` for loading and error, so the success card sat BELOW the nav.
 *
 * Prefer `StatusDialog` / `ConfirmDialog` / `PromptDialog` directly in new code.
 */

type StatusType = 'loading' | 'success' | 'error' | 'custom';

interface AdditionalButtonProps {
    text: string
    transparent?: boolean
    onClick: () => void
    disabled?: boolean
}

interface StatusMessageProps {
    isOpen: boolean
    onClose: () => void
    status: StatusType
    title?: string
    message?: string
    additionalButton?: AdditionalButtonProps
    children?: React.ReactNode
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
    isOpen,
    onClose,
    status,
    title,
    message,
    additionalButton,
    children,
}) => {
    // `custom` hosts bespoke content (the confirm dialogs, the cover cropper). It supplies its own
    // heading and buttons, so the shell contributes only the frame.
    if (status === 'custom') {
        return (
            <Dialog isOpen={isOpen} onClose={onClose} size="sm" elevation="top" ariaLabel={title || 'Notice'}>
                <div className="flex flex-col items-center gap-[var(--px-15)] py-[var(--px-20)] text-center">
                    {children}
                </div>
            </Dialog>
        );
    }

    // Loading kept the brand waveform and stayed dismissible (the old backdrop closed it), so both
    // are preserved here rather than swapped for StatusDialog's non-dismissible spinner.
    if (status === 'loading') {
        return (
            <Dialog isOpen={isOpen} onClose={onClose} size="sm" elevation="top" ariaLabel={title || 'Working'}>
                <div className="flex items-center justify-center py-[var(--px-20)]">
                    <SineWaves />
                </div>
            </Dialog>
        );
    }

    // The old "Close" button is gone: the shell's ✕ is the universal exit. `additionalButton` is a
    // real follow-up action and, as before, does NOT close the dialog by itself.
    const action: DialogAction | undefined = additionalButton
        ? {
            label: additionalButton.text,
            onClick: additionalButton.onClick,
            tone: additionalButton.transparent ? 'secondary' : 'primary',
            disabled: additionalButton.disabled,
        }
        : undefined;

    return (
        <StatusDialog
            isOpen={isOpen}
            onClose={onClose}
            status={status}
            title={title || (status === 'error' ? 'Something went wrong' : undefined)}
            message={message}
            action={action}
        />
    );
};

export default StatusMessage;
