import React, { useEffect, useState } from 'react'
import { ButtonSleek } from '@resomix/ui'
import { changePlaylistVisibility } from '@resomix/api-client';
import { usePlaylistStore } from '@resomix/stores';
import BrakesSvg from "@/assets/icons/brakes.svg";
import SuccessSvg from "@/assets/icons/success.svg"
import { BASE_BETA_URL } from '@resomix/config';

interface PlaylistShareProps {
    isOpen: boolean
    onClose: () => void
    id: string
}

export const PlaylistShare: React.FC<PlaylistShareProps> = ({
    isOpen,
    onClose,
    id: _id,
}) => {
    const { playlistData } = usePlaylistStore();
    const [link, setLink] = useState('');

    // Generate share link once visibility is changed
    useEffect(() => {
        const share = async () => {
            if (!isOpen || !playlistData?.playlist.id) return;

            try {
                const response = await changePlaylistVisibility(playlistData.playlist.id, true);

                if (response.success) {
                    const generated = response?.details?.share_url || response?.details?.link || (BASE_BETA_URL + `/sonic-discovery?id=${playlistData.playlist.id}`);
                    setLink(generated);
                } else {
                    setLink(BASE_BETA_URL + `/sonic-discovery?id=${playlistData.playlist.id}`);
                }
            } catch (err) {
                console.error('Failed to change visibility', err);
                setLink(BASE_BETA_URL + `/sonic-discovery?id=${playlistData?.playlist.id}`);
            }
        };

        share();
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
            setButtonText("Copy Link")
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

    const handleCopyLink = () => {
        if (link) {
            navigator.clipboard.writeText(link)
        }
        setButtonText("Copied!")
        setTimeout(() => {
            onClose()
        }, 2000)
    }

    const [buttonText, setButtonText] = useState("Copy Link")

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">

                <img src={SuccessSvg} alt="Success" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        PLAYLIST SHARED!
                    </div>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                        Your playlist is now publicly accessible.
                    </div>
                </div>

                <div onClick={handleCopyLink} className='relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center hover:cursor-pointer my-[var(--px-8)]'>
                    <img src={BrakesSvg} alt="Brakes" className="absolute top-0 left-0 pointer-events-none" />
                    {link || 'Generating link...'}
                </div>

                <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
                    Your playlist is now publicly accessible.
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text={buttonText} onClick={handleCopyLink} />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} />
                </div>
            </div>
        </div>
    )
}

export default PlaylistShare;
