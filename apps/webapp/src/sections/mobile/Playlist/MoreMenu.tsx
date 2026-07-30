import React from "react";
import { HoverFlow, PAGE_BTN_PRIMARY, PAGE_BTN_SECONDARY } from "@resomix/ui";
import { ThumbIcon } from "@/components/index.ts";
import { rateTrack, deleteTrackRating } from "@resomix/api-client";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { formatDuration, formatPercentage, usePlaylistExport, useAccess, type AccessAction } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";

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
        <div className="relative h-full min-h-screen w-full overflow-hidden bg-[var(--rx-color-surface-raised)] text-[var(--rx-color-text-primary)]">
            {/* Header mirrors the mobile nav drawer: a sticky bar carrying the accent rule + mono
                kicker, with the close control as a square token-bordered box. */}
            <div className="sticky top-0 z-20 flex h-[var(--px-56)] items-center justify-between gap-[var(--px-12)] border-b border-[var(--rx-color-border-subtle)] bg-[var(--rx-color-surface-raised)] px-[var(--px-20)]">
                <span className="flex min-w-0 items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-24)] before:shrink-0 before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
                    {isInput ? 'Playlist // Actions' : 'Track // Actions'}
                </span>
                <button
                    type="button"
                    onClick={onClose || (() => { })}
                    aria-label="Close"
                    id="beta-menu-close-button"
                    className="flex h-[var(--px-44)] w-[var(--px-44)] shrink-0 cursor-pointer items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-primary)] transition-[background-color,border-color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                    <svg viewBox="0 0 24 24" className="h-[var(--px-16)] w-[var(--px-16)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="relative z-15 flex h-full min-h-screen flex-col justify-between overflow-y-auto overflow-x-hidden px-[var(--px-20)] pb-[var(--px-60)] pt-[var(--px-24)]">
                <div className="flex flex-col gap-[var(--px-24)]">
                    <h2 className="min-w-0 truncate font-helvetica text-[length:var(--px-20)] font-medium uppercase leading-[var(--px-24)]">
                        <HoverFlow
                            text={name ?? ''}
                            maxChars={23}
                            delay={800}
                            speed={80}
                            endPause={1000}
                            maxWidth="300px"
                        />
                    </h2>
                    <div className="flex flex-col gap-[var(--px-10)] w-full">
                        <dl className="flex w-full flex-col gap-[var(--px-10)] border border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] p-[var(--px-14)]">
                            <div className="flex w-full justify-between">
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Label:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">{label && label.trim() !== '' ? label : '-'}</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Duration:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">{duration !== undefined ? formatDuration(duration) : '--:--'}</dd>
                            </div>
                            {!isInput && (
                                <div className="flex w-full justify-between">
                                    <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Score:</dt>
                                    <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">{score !== null && score !== undefined ? formatPercentage(score, 2) : '—'}</dd>
                                </div>
                            )}

                            {!isInput && (
                                <div className="flex w-full justify-between mt-[var(--px-20)]">
                                    <div className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Feedback:</div>
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
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Status:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">Active</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Mode:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">Universal</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">Peaks:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">Loaded</dd>
                            </div>
                            <div className="flex w-full justify-between">
                                <dt className="text-left font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">ID:</dt>
                                <dd className="max-w-[var(--px-220)] truncate text-right font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">{trackId}</dd>
                            </div>
                        </dl>
                    </div>
                    {/* Actions — plain buttons on the app's standard secondary control, replacing
                        the old white ButtonSleek pills. No "Close" here: the header ✕ is the exit,
                        as in every dialog. */}
                    <div className="flex flex-col gap-[var(--px-10)]">
                        {/* Chain Discover is this sheet's one accent-filled action, matching the
                            drawer's Feedback button. `self-center` is load-bearing: this is a
                            flex-COLUMN, whose default `align-items: stretch` pulls a lone child to
                            the full width — which is why it read as an orange bar rather than a
                            button. The stacked playlist actions below DO want that full width. */}
                        {!isInput && (
                            <button
                                type="button"
                                className={`${PAGE_BTN_PRIMARY} self-center px-[var(--px-24)] playlist-sonic-discovery-button`}
                                onClick={() => {
                                    onClose?.();
                                    window.open(`${BASE_BETA_URL}/sonic-discovery?discover=${trackId}`, '_blank');
                                }}
                                id={`playlist-table-sonic-discovery-${trackId}`}
                            >
                                Chain Discover using this Track
                            </button>
                        )}
                        {isInput && (
                            <>
                                <button
                                    type="button"
                                    className={`${PAGE_BTN_SECONDARY} w-full playlist-export-button`}
                                    onClick={handleExportPlaylist}
                                    id="playlist-hero-export-button"
                                >
                                    {exportButtonText}
                                </button>
                                <button
                                    type="button"
                                    className={`${PAGE_BTN_SECONDARY} w-full playlist-apple-export-button`}
                                    onClick={handleAppleExport}
                                    id="playlist-hero-apple-export-button"
                                >
                                    Export to Apple Music
                                </button>
                                <button
                                    type="button"
                                    className={`${PAGE_BTN_SECONDARY} w-full playlist-embed-button`}
                                    onClick={handleEmbed}
                                    id="playlist-hero-embed-button"
                                >
                                    Embed (iframe)
                                </button>
                                <button
                                    type="button"
                                    className={`${PAGE_BTN_SECONDARY} w-full playlist-share-button`}
                                    onClick={() => {
                                        withAccess("share", "Log in to share", "Create a free account or log in to share your playlists.", () => onShare?.());
                                    }}
                                    id="playlist-hero-share-button"
                                >
                                    Share
                                </button>
                            </>
                        )}
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
