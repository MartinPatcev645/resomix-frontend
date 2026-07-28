import React from "react";
import { ButtonSleek, HoverFlow } from "@resomix/ui";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { ThumbIcon } from "@/components/index.ts";
import { rateTrack, deleteTrackRating } from "@resomix/api-client";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { formatDuration, formatPercentage, usePlaylistExport, useAccess, type AccessAction } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { WORKSPACE_BTN_SECONDARY } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

interface MoreMenuProps {
    onClose?: () => void;
    trackId?: string;
    isInput?: boolean;
    name?: string;
    label?: string;
    duration?: number; // in seconds
    score?: number | null;
    /** Open the share modal (owned by the parent so it survives this menu closing). */
    onShare?: () => void;
    /** Open the Apple Music export modal (owned by the parent, same reason as onShare). */
    onAppleExport?: () => void;
    /** Open the Embed (iframe) modal (owned by the parent). */
    onEmbed?: () => void;
}

const MoreMenu: React.FC<MoreMenuProps> = ({ onClose, trackId, isInput = false, name, label, duration, score = null, onShare, onAppleExport, onEmbed }) => {
    const { playlistData, trackRatings = {}, setTrackRating, removeTrackRating } = usePlaylistStore();
    const { exportAndDownloadPlaylist, canExport } = usePlaylistExport();
    // Rate / export / share are gated through the single source of truth (useAccess) — one verdict
    // per action; "pending" is a silent no-op, never a wrong modal.
    const access = useAccess();
    const [gate, setGate] = React.useState<{ reason: string; title: string; body: string } | null>(null);
    /** Run `action` if allowed; otherwise raise the correct gate. Pending → no-op. */
    const withAccess = (action: AccessAction, title: string, body: string, run: () => void) => {
        const v = access.verdict(action);
        if (v === "pending") return;
        if (v === "allowed") return run();
        setGate({ reason: v === "login" ? "login_required" : "upgrade_required", title, body });
    };
    const [exportButtonText, setExportButtonText] = React.useState("Export to TXT");

    // The shared store is hydrated from the server by the playlist table on load, so the thumbs
    // here reflect the user's real, per-playlist ratings — no local seeding needed.

    const handleTrackRating = async (rating: number) => {
        if (!trackId) return;
        withAccess("rateTrack", "Log in to rate tracks", "Rating individual tracks needs an account. Log in or create a free account to rate.", async () => {
            const playlistId = playlistData?.playlist?.id || null;
            if (!playlistId) return;
            const current = trackRatings[trackId];
            try {
                if (current === rating) {
                    removeTrackRating(trackId);            // tap the active thumb → un-rate
                    await deleteTrackRating(trackId, playlistId);
                } else {
                    setTrackRating(trackId, rating);
                    await rateTrack(trackId, rating, playlistId);
                }
            } catch (error) {
                console.error('Failed to rate track:', error);
            }
        });
    };

    const handleExportPlaylist = async () => {
        const v = access.verdict("export");
        if (v === "pending") return;
        if (v !== "allowed" || !canExport) {
            setGate({ reason: v === "upgrade" ? "upgrade_required" : "login_required", title: "Log in to export", body: "Create a free account or log in to export your playlists." });
            return;
        }

        try {
            const result = await exportAndDownloadPlaylist();

            if (result.success) {
                setExportButtonText("Exported!");
                setTimeout(() => {
                    setExportButtonText("Export to TXT");
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to export playlist:', error);
        }
    };

    // Apple Music export — visible to everyone; gated on the `export_targets` entitlement. Guests
    // get a login prompt, free users an upgrade prompt, entitled users the modal (owned by parent).
    const handleAppleExport = () => {
        const v = access.verdict("exportApple");
        if (v === "pending") return;
        if (v === "allowed") {
            onAppleExport?.();
            return;
        }
        if (v === "login") {
            setGate({ reason: "login_required", title: "Log in to export", body: "Create a free account or log in to export your playlists to Apple Music." });
        } else {
            setGate({ reason: "upgrade_required", title: "Upgrade to export to Apple Music", body: "Sending your playlist straight to your Apple Music library is a Pro feature. Upgrade your plan to unlock Apple Music export." });
        }
    };

    // Embed — open for everyone; the modal guards on public/private itself.
    const handleEmbed = () => {
        onEmbed?.();
    };

    React.useEffect(() => {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';

        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, scrollY);
        };
    }, []);

    return (
        <div className="w-full h-full min-h-screen relative overflow-hidden bg-[var(--color-primary-background)]">
            <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)] py-[var(--px-60)] px-[var(--px-40)] overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col gap-[var(--px-30)] items-center">
                    <h2 className="text-[length:var(--px-22)] font-light uppercase font-helvetica text-center w-[var(--px-300)] truncate">
                        <HoverFlow
                            text={name ?? ''}
                            maxChars={23}
                            delay={800}
                            speed={80}
                            endPause={1000}
                            maxWidth="300px"
                        />
                    </h2>
                    <div className="">
                        <img src={MenuSeparator} aria-hidden="true" loading="lazy" draggable={false} alt="MenuSeparator" className="w-[var(--px-4)] h-[var(--px-49)]" />
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] w-full">
                        <dl className="flex flex-col gap-[var(--px-10)] w-full">
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Label:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{label && label.trim() !== '' ? label : '-'}</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Duration:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{duration !== undefined ? formatDuration(duration) : '--:--'}</dd>
                            </div>
                            {!isInput && (
                                <div className="flex w-full justify-between">
                                    <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Score:</dt>
                                    <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{score !== null && score !== undefined ? formatPercentage(score, 2) : '—'}</dd>
                                </div>
                            )}

                            {!isInput && (
                                <div className="flex w-full justify-between mt-[var(--px-20)]">
                                    <div className="text-left text-[length:var(--px-14)] font-light font-fira">Feedback:</div>
                                    <div className="flex items-center justify-end w-[var(--px-80)] gap-[var(--px-30)]">
                                        {(() => {
                                            const currentRating = trackId ? trackRatings[trackId] : undefined;
                                            const upSelected = currentRating === 1;
                                            const downSelected = currentRating === 0;
                                            return (
                                                <>
                                                    <ThumbIcon
                                                        onClick={() => handleTrackRating(1)}
                                                        className={`h-[var(--px-26)] w-[var(--px-26)] text-[var(--rx-color-text-primary)] ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-up`}
                                                        id={`playlist-table-thumb-up-${trackId}`}
                                                        innerClassName="playlist-rating-thumb-up"
                                                        data-track-id={trackId}
                                                        data-track-name={name}
                                                    />
                                                    <ThumbIcon
                                                        onClick={() => handleTrackRating(0)}
                                                        className={`h-[var(--px-26)] w-[var(--px-26)] rotate-180 text-[var(--rx-color-text-primary)] ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-down`}
                                                        id={`playlist-table-thumb-down-${trackId}`}
                                                        innerClassName="playlist-rating-thumb-down"
                                                        data-track-id={trackId}
                                                        data-track-name={name}
                                                    />
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                            <div className="flex w-full justify-between mt-[var(--px-20)]">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Status:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Active</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Mode:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Universal</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Peaks:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Loaded</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">ID:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{trackId}</dd>
                            </div>
                        </dl>
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] w-full px-[var(--px-3)]">
                        {!isInput && (
                            <div className="w-full flex flex-col">
                                <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] playlist-sonic-discovery-button`} text="Chain Discover using this Track" customWidth="w-full" onClick={() => {
                                    onClose?.();
                                    window.open(`${BASE_BETA_URL}/?id=${trackId}`, '_blank');
                                }} id={`playlist-table-sonic-discovery-${trackId}`} />
                            </div>
                        )}
                        {isInput && (
                            <div className="w-full flex gap-2 flex-col">
                                <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] playlist-export-button`} text={exportButtonText} customWidth="w-full" onClick={handleExportPlaylist} id={`playlist-hero-export-button`} />
                                <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] playlist-apple-export-button`} text="Export to Apple Music" customWidth="w-full" onClick={handleAppleExport} id={`playlist-hero-apple-export-button`} />
                                <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] playlist-embed-button`} text="Embed (iframe)" customWidth="w-full" onClick={handleEmbed} id={`playlist-hero-embed-button`} />
                                <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] playlist-share-button`} text="Share" customWidth="w-full" onClick={() => {
                                    withAccess("share", "Log in to share", "Create a free account or log in to share your playlists.", () => onShare?.());
                                }} id={`playlist-hero-share-button`} />
                            </div>
                        )}
                        <div className="w-full flex flex-col">
                            <ButtonSleek transparent={true} className={`${WORKSPACE_BTN_SECONDARY} w-[var(--px-276)] text-[length:var(--px-14)] menu-link`} text="Close" customWidth="w-full" onClick={onClose || (() => { })} id={`beta-menu-close-button`} />
                        </div>
                    </div>
                </div>
            </div>
            <GateCtaModal
                reason={gate?.reason ?? null}
                title={gate?.title}
                body={gate?.body}
                onClose={() => setGate(null)}
            />
        </div >
    );
};

export default MoreMenu;
