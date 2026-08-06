import React, { useEffect, useState } from 'react'
import { Dialog, PAGE_FIELD_LABEL } from '@resomix/ui'
import { usePlaylistExport } from '@resomix/hooks';

interface PlaylistExportProps {
    isOpen: boolean
    onClose: () => void
    onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void
}

export const PlaylistExport: React.FC<PlaylistExportProps> = ({
    isOpen,
    onClose,
    onStatusChange,
}) => {
    const { exportPlaylist, canExport } = usePlaylistExport();
    const [filename, setFilename] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [buttonText, setButtonText] = useState("Download");

    // Prepare export data when modal opens
    useEffect(() => {
        const prepareExport = async () => {
            if (!isOpen || !canExport) return;

            try {
                // Get the export data without downloading
                const result = await exportPlaylist();
                
                if (result.success) {
                    setFilename(result.filename || 'resomix_playlist.txt');
                    setFileContent(result.content || '');
                    setIsReady(true);
                } else if (!(result as { code?: string | null }).code) {
                    // A quota denial (402) already opens the global upgrade modal — see
                    // QuotaDenialModal. Showing an error toast as well would surface the same
                    // refusal twice, in two different tones.
                    onStatusChange('error', result.error || 'Failed to prepare playlist for export');
                }
            } catch (error) {
                onStatusChange('error', 'Unexpected error while preparing export');
            }
        };

        prepareExport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

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
            setFilename('');
            setFileContent('');
            setIsReady(false);
            setButtonText("Download");
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

    const handleDownload = () => {
        if (!fileContent || !filename) return;

        try {
            // Create blob with UTF-8 encoding
            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            
            // Create object URL
            const url = URL.createObjectURL(blob);
            
            // Create temporary anchor element for download
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up object URL
            URL.revokeObjectURL(url);

            // Change button text and close after 3 seconds (like PlaylistShare)
            setButtonText("Downloaded!");
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Failed to download file:', error);
            onStatusChange('error', 'Failed to download playlist file', 'Download Failed');
        }
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            eyebrow="Playlist // Export"
            title="Playlist ready"
            subtitle="Your playlist is ready to be downloaded as a text file."
            ariaLabel="Playlist ready"
            actions={[
                // No Cancel action — the shell's ✕ is the universal exit.
                {
                    label: isReady ? buttonText : 'Preparing...',
                    onClick: handleDownload,
                    tone: 'primary',
                    disabled: !isReady,
                    id: 'playlist-export-download-button',
                },
            ]}
        >
            <div className="flex flex-col gap-[var(--px-10)] pb-[var(--px-4)]">
                <span className={PAGE_FIELD_LABEL}>File</span>
                <div className="flex min-h-[var(--px-40)] w-full items-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-[#0a0a0a] px-[var(--px-10)] font-fira text-[length:var(--px-10)] text-[var(--rx-color-text-secondary)]">
                    <span className="min-w-0 truncate">{filename || 'Preparing filename...'}</span>
                </div>
            </div>
        </Dialog>
    )
}

export default PlaylistExport;
