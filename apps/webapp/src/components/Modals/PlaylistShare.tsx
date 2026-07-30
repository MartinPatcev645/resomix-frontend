import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, PAGE_FIELD_LABEL } from '@resomix/ui'
import { changePlaylistVisibility } from '@resomix/api-client';
import { usePlaylistStore } from '@resomix/stores';
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

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            eyebrow="Playlist // Share"
            title="Playlist shared"
            subtitle={activeIsPublic
                ? "Your playlist is publicly accessible."
                : "Your playlist is now publicly accessible."}
            ariaLabel="Playlist shared"
            actions={[
                // No Cancel/Close action — the shell's ✕ is the universal exit.
                { label: buttonText, onClick: handlePrimaryAction, tone: "primary", id: "playlist-share-action-button" },
            ]}
        >
            <div className="flex flex-col gap-[var(--px-10)] pb-[var(--px-4)]">
                <span className={PAGE_FIELD_LABEL}>Share link</span>
                {/* The link doubles as the copy control, as before. */}
                <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="flex min-h-[var(--px-40)] w-full items-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-[#0a0a0a] px-[var(--px-10)] text-left font-fira text-[length:var(--px-10)] text-[var(--rx-color-text-secondary)] transition-colors hover:border-[var(--rx-color-border-strong)] hover:text-[var(--rx-color-text-primary)] hover:cursor-pointer share-link"
                    id="playlist-share-link"
                    aria-label="Copy playlist link"
                >
                    <span className="min-w-0 truncate">{link || 'Generating link...'}</span>
                </button>
            </div>
        </Dialog>
    )
}

export default PlaylistShare;
