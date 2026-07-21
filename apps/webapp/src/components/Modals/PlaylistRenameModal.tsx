import React, { useEffect } from 'react'
import { ButtonSleek } from '@resomix/ui'

interface PlaylistRenameModalProps {
    isOpen: boolean
    /** Current name — seeds the input each time the modal opens. */
    initialName: string
    submitting?: boolean
    onClose: () => void
    /** Called with the validated, trimmed new name when the user confirms. */
    onSubmit: (newName: string) => void
}

/**
 * Presentational rename dialog shared by the playlist hero and the library rows, so both surfaces
 * show the exact same modal + validation. It owns only the input value; persistence lives in the
 * caller (store update on the playlist page, list update via useLibrary in the library).
 */
export const PlaylistRenameModal: React.FC<PlaylistRenameModalProps> = ({
    isOpen,
    initialName,
    submitting = false,
    onClose,
    onSubmit,
}) => {
    const [newName, setNewName] = React.useState('')

    // Body-scroll lock + seed the field with the current name whenever the modal opens.
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            setNewName(initialName || '')
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, initialName])

    // Close on Escape.
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        if (isOpen) document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    const handleSubmit = () => {
        const trimmed = newName.trim()
        if (trimmed.length < 2 || trimmed.length > 100) {
            alert('Playlist name must be between 2 and 100 characters.')
            return
        }
        onSubmit(trimmed)
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-dialog-title"
        >
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
                onClick={onClose}
                id="playlist-rename-backdrop"
                aria-hidden="true"
            />

            {/* Modal content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl p-[var(--px-50)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-20)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">
                <div className="text-center w-full">
                    <h2 id="rename-dialog-title" className="text-[length:var(--px-19)] font-semibold uppercase font-helvetica leading-[var(--px-24)]">
                        Rename Playlist
                    </h2>
                </div>
                <div className="w-full">
                    <label htmlFor="playlist-name-input" className="sr-only">New playlist name</label>
                    <input
                        id="playlist-name-input"
                        className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica"
                        placeholder="Type new playlist name..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                        autoFocus
                    />
                </div>

                <div className="flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text={submitting ? 'Renaming...' : 'Rename'} onClick={handleSubmit} className="cta-button primary" id="playlist-rename-submit-button" />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} className="cta-button secondary" id="playlist-rename-cancel-button" />
                </div>
            </div>
        </div>
    )
}

export default PlaylistRenameModal
