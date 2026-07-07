import React from "react";
import { ButtonSleek, HoverFlow } from "@resomix/ui";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { ThumbIcon } from "@/components/index.ts";
import { rateTrack } from "@resomix/api-client";
import { usePlaylistStore, useAuthStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { formatDuration, formatPercentage, usePlaylistExport } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { getTrackRating, saveTrackRating } from "@/utils/trackRatingsStorage.js";

interface MoreMenuProps {
    onClose?: () => void;
    trackId?: string;
    isInput?: boolean;
    name?: string;
    label?: string;
    duration?: number; // in seconds
    score?: number | null;
}

const MoreMenu: React.FC<MoreMenuProps> = ({ onClose, trackId, isInput = false, name, label, duration, score = null }) => {
    const { playlistData, trackRatings = {}, setTrackRating } = usePlaylistStore();
    const { exportAndDownloadPlaylist, canExport } = usePlaylistExport();
    // Per-track rating + export are gated: guests can click but get a login prompt (no API call).
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const [gate, setGate] = React.useState<{ reason: string; title: string; body: string } | null>(null);
    const [exportButtonText, setExportButtonText] = React.useState("Export to TXT");

    React.useEffect(() => {
        if (!trackId) return;
        const localRating = getTrackRating(trackId);
        if (localRating !== undefined && trackRatings[trackId] === undefined) {
            setTrackRating(trackId, localRating);
        }
    }, [trackId, trackRatings, setTrackRating]);

    const handleTrackRating = async (rating: number) => {
        if (!trackId) return;
        if (!isAuthenticated) {
            setGate({ reason: "login_required", title: "Log in to rate tracks", body: "Rating individual tracks needs an account. Log in or create a free account to rate." });
            return;
        }
        try {
            const playlistId = playlistData?.playlist?.id || null;
            setTrackRating(trackId, rating);
            saveTrackRating(trackId, rating);
            await rateTrack(trackId, rating, playlistId);
        } catch (error) {
            console.error('Failed to rate track:', error);
        }
    };

    const handleExportPlaylist = async () => {
        if (!canExport) {
            setGate({ reason: isAuthenticated ? "upgrade_required" : "login_required", title: "Log in to export", body: "Create a free account or log in to export your playlists." });
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
                                                        onClick={() => {
                                                            if (upSelected) return;
                                                            handleTrackRating(1);
                                                        }}
                                                        className={`w-[var(--px-26)] h-[var(--px-26)] text-white ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-up`}
                                                        id={`playlist-table-thumb-up-${trackId}`}
                                                        innerClassName="playlist-rating-thumb-up"
                                                        data-track-id={trackId}
                                                        data-track-name={name}
                                                    />
                                                    <ThumbIcon
                                                        onClick={() => {
                                                            if (downSelected) return;
                                                            handleTrackRating(0);
                                                        }}
                                                        className={`w-[var(--px-26)] h-[var(--px-26)] transform rotate-180 text-white ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-down`}
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
                                <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-sonic-discovery-button" text="Chain Discover using this Track" customWidth="w-full" onClick={() => {
                                    onClose?.();
                                    window.open(`${BASE_BETA_URL}/?id=${trackId}`, '_blank');
                                }} id={`playlist-table-sonic-discovery-${trackId}`} />
                            </div>
                        )}
                        {isInput && (
                            <div className="w-full flex gap-2 flex-col">
                                <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-export-button" text={exportButtonText} customWidth="w-full" onClick={handleExportPlaylist} id={`playlist-hero-export-button`} />
                            </div>
                        )}
                        <div className="w-full flex flex-col">
                            <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] menu-link" text="Close" customWidth="w-full" onClick={onClose || (() => { })} id={`beta-menu-close-button`} />
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
