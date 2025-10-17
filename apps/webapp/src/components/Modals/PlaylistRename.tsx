import React, { useEffect } from 'react'
import { ButtonSleek } from '@resomix/ui'
import { renamePlaylist } from '@resomix/api-client';
import { usePlaylistStore } from '@resomix/stores';

interface PlaylistRenameProps {
    isOpen: boolean
    onClose: () => void
    onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void
}

export const PlaylistRename: React.FC<PlaylistRenameProps> = ({
    isOpen,
    onClose,
    onStatusChange,
}) => {

    const { playlistData, setPlaylistData } = usePlaylistStore();
    const [newName, setNewName] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            // Set the current playlist name as default value
            setNewName(playlistData?.playlist.name || '')
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, playlistData?.playlist.name])

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

    const handleRename = async () => {
        if (!playlistData?.playlist.id) {
            onClose();
            return;
        }

        const trimmed = newName.trim();
        if (trimmed.length < 2 || trimmed.length > 100) {
            alert('Playlist name must be between 2 and 100 characters.');
            return;
        }

        try {
            setSubmitting(true);
            onStatusChange('loading', 'Renaming playlist...');
            const response = await renamePlaylist(playlistData.playlist.id, trimmed);
            if (response.success) {
                // update local store
                setPlaylistData({
                    ...playlistData,
                    playlist: {
                        ...playlistData.playlist,
                        name: trimmed,
                    },
                });
                onStatusChange('success', '', 'Playlist renamed!');
            } else {
                onStatusChange('error', response.error || 'Failed to rename playlist');
            }
        } catch (err) {
            console.error('Rename playlist failed', err);
            onStatusChange('error', 'Unexpected error while renaming playlist');
        } finally {
            setSubmitting(false);
            onClose();
        }
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
                    />
                </div>

                <div className="flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text={submitting ? 'Renaming...' : 'Rename'} onClick={handleRename} className="cta-button primary" id="playlist-rename-submit-button" />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} className="cta-button secondary" id="playlist-rename-cancel-button" />
                </div>
            </div>
        </div>
    )
}

export default PlaylistRename;
