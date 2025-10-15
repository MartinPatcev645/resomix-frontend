import React, { useEffect, useState } from 'react'
import { ButtonSleek } from '@resomix/ui'
import { usePlaylistExport } from '@resomix/hooks';
import SuccessSvg from "@/assets/icons/success.svg"
import BrakesSvg from "@/assets/icons/brakes.svg";

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
                } else {
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

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
                onClick={onClose}
                id="playlist-export-backdrop"
            />

            {/* Modal content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">

                <img src={SuccessSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Success" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        PLAYLIST READY!
                    </div>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                        Your playlist is ready to be downloaded as a text file.
                    </div>
                </div>

                <div className='relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center my-[var(--px-8)]'>
                    <img src={BrakesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Brakes" className="absolute top-0 left-0 pointer-events-none" />
                    <span className="">
                        {filename || 'Preparing filename...'}
                    </span>
                </div>

                <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
                    Click download to save the playlist to your device.
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek
                        text={isReady ? buttonText : "Preparing..."}
                        onClick={handleDownload}
                        disabled={!isReady}
                        className="cta-button primary"
                        id="playlist-export-download-button"
                    />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} className="cta-button secondary" id="playlist-export-cancel-button" />
                </div>
            </div>
        </div>
    )
}

export default PlaylistExport;
