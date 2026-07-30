import React from 'react'
import { PromptDialog } from '@resomix/ui'

interface PlaylistRenameModalProps {
    isOpen: boolean
    /** Current name — seeds the input each time the modal opens. */
    initialName: string
    submitting?: boolean
    onClose: () => void
    /** Called with the validated, trimmed new name when the user confirms. */
    onSubmit: (newName: string) => void
    /**
     * Optional cover slot rendered ABOVE the name field (the library passes a
     * `<PlaylistCoverEditor>` so the cover can be changed from there too). The cover comes first
     * because it is the thing you look at while deciding the name. Omit it — as the playlist hero
     * does — and the dialog renders with no extra markup or spacing.
     */
    cover?: React.ReactNode
}

/**
 * Presentational rename dialog shared by the playlist hero and the library rows, so both surfaces
 * show the exact same modal + validation. It owns nothing but the caller's callbacks; persistence
 * lives in the caller (store update on the playlist page, list update via useLibrary in the library).
 *
 * Now a thin preset over the shared `PromptDialog`. Its own overlay was `z-50` and not portaled, so
 * it could be painted under the sticky nav and the mobile drawer, and it had no focus trap.
 *
 * One behaviour upgrade worth naming: the 2–100 character rule used to be enforced with a blocking
 * `alert()` AFTER the click. It is now enforced by the dialog — the submit button stays disabled and
 * the reason is shown inline — so the rule is identical but the user finds out before clicking.
 */
const MIN_NAME = 2;
const MAX_NAME = 100;

export const PlaylistRenameModal: React.FC<PlaylistRenameModalProps> = ({
    isOpen,
    initialName,
    submitting = false,
    onClose,
    onSubmit,
    cover,
}) => (
    <PromptDialog
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
        eyebrow="Playlist // Rename"
        title="Rename playlist"
        label="New playlist name"
        placeholder="Type new playlist name..."
        initialValue={initialName || ''}
        required
        minLength={MIN_NAME}
        maxLength={MAX_NAME}
        submitLabel="Rename"
        busy={submitting}
        busyLabel="Renaming..."
        extraAbove={cover ? <div className="mb-[var(--px-18)] flex justify-center">{cover}</div> : undefined}
    />
);

export default PlaylistRenameModal
