import React, { useEffect } from 'react'
import { ButtonSleek } from '@resomix/ui'

interface PlaylistRenameProps {
    isOpen: boolean
    onClose: () => void
}

export const PlaylistRename: React.FC<PlaylistRenameProps> = ({
    isOpen,
    onClose
}) => {

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    const handleRename = () => {
        console.log("Rename")
        setTimeout(() => {
            onClose()
        }, 2000)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl p-[var(--px-50)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-20)]">
                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-semibold uppercase font-helvetica leading-[var(--px-24)]">
                        Rename Playlist
                    </div>
                </div>
                <div className="w-full">
                    <input
                        className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica"
                        placeholder="Type new playlist name..."
                    />
                </div>

                <div className="flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Rename" onClick={handleRename} />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} />
                </div>
            </div>
        </div>
    )
}

export default PlaylistRename;
