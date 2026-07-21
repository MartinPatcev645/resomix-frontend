import React from 'react'
import { renamePlaylist } from '@resomix/api-client';
import { usePlaylistStore } from '@resomix/stores';
import { PlaylistRenameModal } from './PlaylistRenameModal.tsx';

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
    const [submitting, setSubmitting] = React.useState(false);

    // `trimmed` is already validated by the shared modal.
    const handleRename = async (trimmed: string) => {
        if (!playlistData?.playlist?.id) {
            onClose();
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

    return (
        <PlaylistRenameModal
            isOpen={isOpen}
            initialName={playlistData?.playlist?.name || ''}
            submitting={submitting}
            onClose={onClose}
            onSubmit={handleRename}
        />
    )
}

export default PlaylistRename;
