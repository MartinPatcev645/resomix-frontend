import React, { useEffect, useMemo, useState } from 'react'
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
    /**
     * Optional playlist override. The playlist page leaves this undefined and the modal reads the
     * single loaded playlist from `usePlaylistStore()` (unchanged). The LIBRARY passes it explicitly
     * — there is no single playlist in the store there — with an ALREADY-public playlist, so the
     * modal just generates the link and offers native share (it never re-hits the visibility API or
     * mutates the playlist store).
     */
    playlist?: { id: string; name?: string; is_public?: boolean }
}

interface ShareData {
    title?: string;
    text?: string;
    url?: string;
}

type NavigatorWithWebShare = Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
};

function hasWebShare(nav: Navigator): nav is NavigatorWithWebShare {
    return typeof (nav as NavigatorWithWebShare).share === 'function';
}

function useIsMobileView(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const update = () => setIsMobile(mql.matches);

        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, [breakpoint]);

    return isMobile;
}

function isAbortError(err: unknown): boolean {
    if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
        return err.name === 'AbortError';
    }
    return typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError';
}

export const PlaylistShare: React.FC<PlaylistShareProps> = ({
    isOpen,
    onClose,
    playlist,
}) => {
    const { playlistData, updatePlaylistPublicStatus } = usePlaylistStore();
    // Source of truth for what we're sharing: the explicit `playlist` prop (library) or the store's
    // loaded playlist (playlist page). `usingStore` gates the store-only side effect below.
    const usingStore = !playlist;
    const activeId = playlist?.id ?? playlistData?.playlist?.id ?? '';
    const activeName = playlist?.name ?? playlistData?.playlist?.name;
    const activeIsPublic = playlist ? !!playlist.is_public : !!playlistData?.playlist?.is_public;
    const [link, setLink] = useState('');
    const isMobileView = useIsMobileView(768);

    const canNativeShare = useMemo(() => {
        return typeof navigator !== 'undefined' && hasWebShare(navigator);
    }, []);

    const [buttonText, setButtonText] = useState("Copy Link");

    useEffect(() => {
        if (!isOpen || !activeId) return;

        const updateVisibilityAndLink = async () => {
            try {
                // Only change visibility if the playlist is not already public
                if (!activeIsPublic) {
                    const response = await changePlaylistVisibility(activeId, true);

                    if (response.success) {
                        // Reflect the new public status. Only the playlist page's store copy is
                        // touched here; the library passes an already-public playlist so this branch
                        // never runs there (and it must not mutate the unrelated store playlist).
                        if (usingStore) updatePlaylistPublicStatus(true);

                        const generated =
                            response?.details?.share_url ||
                            response?.details?.link ||
                            (BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);
                        setLink(generated);
                    } else {
                        setLink(BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);
                    }
                } else {
                    // Playlist is already public, just generate the link
                    setLink(BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);
                }
            } catch (err) {
                console.error('Failed to change visibility', err);
                setLink(BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);
            }
        };

        updateVisibilityAndLink();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setButtonText(isMobileView && canNativeShare ? "Share" : "Copy Link");
    }, [isOpen, isMobileView, canNativeShare]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
            setButtonText(isMobileView && canNativeShare ? "Share" : "Copy Link")
        }
    }, [isOpen, isMobileView, canNativeShare])

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

    const handleCopyLink = async () => {
        if (link) {
            try {
                await navigator.clipboard.writeText(link)
            } catch (e) {
                console.warn('Clipboard copy failed, link:', link, e);
            }
        }
        setButtonText("Copied!")
        setTimeout(() => {
            onClose()
        }, 2000)
    }

    const handleShare = async () => {
        if (!link) return;

        const title = activeName || 'Resomix Playlist';
        const text = 'Check out my sonic discovery on Resomix';

        try {
            const nav = navigator;
            if (hasWebShare(nav)) {
                await nav.share({ title, text, url: link });
                setButtonText("Shared!");
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                await handleCopyLink();
            }
        } catch (err: unknown) {
            if (isAbortError(err)) {
                return;
            }
            await handleCopyLink();
        }
    }

    const handlePrimaryAction = async () => {
        if (isMobileView && canNativeShare) {
            await handleShare();
        } else {
            await handleCopyLink();
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
        >
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
                onClick={onClose}
                id="playlist-share-backdrop"
                aria-hidden="true"
            />

            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">

                <img src={SuccessSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

                <div className="text-center w-full">
                    <h2 id="share-dialog-title" className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        PLAYLIST SHARED!
                    </h2>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                        {activeIsPublic
                            ? "Your playlist is publicly accessible."
                            : "Your playlist is now publicly accessible."
                        }
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className='relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center hover:cursor-pointer my-[var(--px-8)] share-link'
                    id="playlist-share-link"
                    aria-label="Copy playlist link"
                >
                    <img src={BrakesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" width={302} height={27} className="absolute top-0 left-0 h-[var(--px-27)] w-full pointer-events-none" />
                    {link || 'Generating link...'}
                </button>

                <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
                    {activeIsPublic
                        ? "Your playlist is publicly accessible."
                        : "Your playlist is now publicly accessible."
                    }
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text={buttonText} onClick={handlePrimaryAction} className="cta-button primary" id="playlist-share-action-button" />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} className="cta-button secondary" id="playlist-share-cancel-button" />
                </div>
            </div>
        </div>
    )
}

export default PlaylistShare;
