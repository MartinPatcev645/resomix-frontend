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
                                                            }) => {
    const { playlistData } = usePlaylistStore();
    const [link, setLink] = useState('');
    const isMobileView = useIsMobileView(768);

    const canNativeShare = useMemo(() => {
        return typeof navigator !== 'undefined' && hasWebShare(navigator);
    }, []);

    const [buttonText, setButtonText] = useState("Copy Link");

    useEffect(() => {
        if (!isOpen || !playlistData?.playlist.id) return;

        const updateVisibilityAndLink = async () => {
            try {
                const response = await changePlaylistVisibility(playlistData.playlist.id, true);

                if (response.success) {
                    const generated =
                      response?.details?.share_url ||
                      response?.details?.link ||
                      (BASE_BETA_URL + `/sonic-discovery?id=${playlistData.playlist.id}`);
                    setLink(generated);
                } else {
                    setLink(BASE_BETA_URL + `/sonic-discovery?id=${playlistData.playlist.id}`);
                }
            } catch (err) {
                console.error('Failed to change visibility', err);
                setLink(BASE_BETA_URL + `/sonic-discovery?id=${playlistData?.playlist.id}`);
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

        const title = playlistData?.playlist?.name || 'Resomix Playlist';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
            onClick={onClose}
            id="playlist-share-backdrop"
          />

          <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">

              <img src={SuccessSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Success" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

              <div className="text-center w-full">
                  <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                      PLAYLIST SHARED!
                  </div>
                  <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                      Your playlist is now publicly accessible.
                  </div>
              </div>

              <div onClick={handlePrimaryAction} className='relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center hover:cursor-pointer my-[var(--px-8)] share-link' id="playlist-share-link">
                  <img src={BrakesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Brakes" className="absolute top-0 left-0 pointer-events-none" />
                  {link || 'Generating link...'}
              </div>

              <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
                  Your playlist is now publicly accessible.
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