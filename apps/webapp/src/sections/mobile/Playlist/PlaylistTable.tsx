import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import { PlaylistUnlockBand } from "@/components/Playlist/PlaylistUnlockBand.tsx";
import { LOCKED_BLUR_VISIBLE_ROWS, PlaylistLockedRegion } from "@/components/Playlist/PlaylistLockedRegion.tsx";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { formatDuration, formatPercentage, useGlobalAudioController, useAccess } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { rateTrack, deleteTrackRating, getMyPlaylistRatings } from "@resomix/api-client";
import { HoverFlow, Tooltip } from "@resomix/ui";
import PauseSvg from "@/assets/icons/pause_white.svg";
import MoreSvg from "@/assets/icons/more.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import { scoreBandWidthPct, shortlistScoreRange } from "@/utils/scoreBand.ts";
import { mobilePlaylistRowGridStyle } from "@/utils/playlistGrid.ts";

interface PlaylistTableProps {
    onMoreClick?: (trackId: string, name: string, label: string, duration: number, score: number, isInput?: boolean) => void;
}

const PlaylistTable: React.FC<PlaylistTableProps> = ({ onMoreClick }) => {
    const { playlistData, trackRatings = {}, setTrackRating, setTrackRatings, removeTrackRating } = usePlaylistStore();
    const tracks = playlistData?.similar_tracks ?? [];
    const scoreRange = useMemo(
        () => shortlistScoreRange(tracks.map((t) => t.score)),
        [tracks],
    );

    const access = useAccess();
    const [rateGate, setRateGate] = useState<"login_required" | "upgrade_required" | null>(null);
    const maxUnlocked = access.unlockedTracks;
    const isGuest = access.isGuestForCopy;
    const maxTracksPerPlaylist = access.unlockedTracks;
    const hasLockedRows = tracks.some((t) => t.rank > maxUnlocked);
    const showUnlockBand = access.teaseReady && hasLockedRows;
    const guestBlurLock = isGuest && showUnlockBand;
    const unlockedTracks = useMemo(
        () => tracks.filter((t) => t.rank <= maxUnlocked),
        [tracks, maxUnlocked],
    );
    const lockedTracks = useMemo(
        () => tracks.filter((t) => t.rank > maxUnlocked),
        [tracks, maxUnlocked],
    );
    const visibleLockedTracks = useMemo(
        () => lockedTracks.slice(0, LOCKED_BLUR_VISIBLE_ROWS),
        [lockedTracks],
    );

    const playlistId = playlistData?.playlist?.id;
    const analysis = playlistId ? loadPlaylistAnalysis(playlistId) : null;
    const footerResultCount = analysis?.resultCount ?? tracks.length;
    const footerTopMatch = analysis?.topMatchScore != null
        ? `${(analysis.topMatchScore * 100).toFixed(2)}%`
        : tracks.length > 0 ? `${(tracks[0].score * 100).toFixed(2)}%` : null;
    const footerAnalysisTime = analysis?.analysisSeconds != null
        ? `${analysis.analysisSeconds.toFixed(1)}s`
        : null;
    const hlsController = useGlobalAudioController();
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isPlaying: boolean = usePlayerStore(s => s.isPlaying);
    const [hintFor, setHintFor] = useState<string | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hydrate the user's existing thumbs for THIS playlist from the server (per-playlist source
    // of truth). Replaces the map so un-rated tracks show no thumb.
    const loadPlaylistId = playlistData?.playlist?.id;
    useEffect(() => {
        if (!loadPlaylistId) return;
        let cancelled = false;
        (async () => {
            const res = await getMyPlaylistRatings(loadPlaylistId);
            if (cancelled) return;
            if (res?.success && res.data?.track_ratings) {
                setTrackRatings(res.data.track_ratings);
            } else {
                setTrackRatings({});
            }
        })();
        return () => { cancelled = true; };
    }, [loadPlaylistId, setTrackRatings]);

    const handleTrackRating = async (trackId: string, rating: number) => {
        const v = access.verdict("rateTrack");
        if (v === "pending") return;
        if (v !== "allowed") {
            setRateGate(v === "login" ? "login_required" : "upgrade_required");
            return;
        }
        const pid = playlistData?.playlist?.id || null;
        if (!pid) return;
        const current = trackRatings[trackId];
        try {
            if (current === rating) {
                removeTrackRating(trackId);          // click active thumb → un-rate (optimistic)
                await deleteTrackRating(trackId, pid);
            } else {
                setTrackRating(trackId, rating);
                await rateTrack(trackId, rating, pid);
            }
        } catch (error) {
            console.error("Failed to rate track:", error);
        }
    };

    const handlePlayButtonClick = useCallback((trackId: string) => {
        if (!DEMO_MODE) {
            if (hintTimerRef.current) {
                clearTimeout(hintTimerRef.current);
                hintTimerRef.current = null;
            }
            setHintFor(null);

            if (currentTrackId === trackId && isPlaying) {
                hlsController.stop();
            } else {
                hlsController.load(trackId, true);
            }
            return;
        }

        setHintFor(trackId);
        if (hintTimerRef.current) {
            clearTimeout(hintTimerRef.current);
        }
        hintTimerRef.current = setTimeout(() => {
            setHintFor(null);
        }, 3000);
    }, [currentTrackId, hlsController, isPlaying]);

    useEffect(() => {
        if (!DEMO_MODE) {
            return;
        }
        return () => {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        };
    }, []);

    const renderTrackRow = (track: (typeof tracks)[number], restrictedMode: "none" | "dim" | "blur") => {
        const isRestricted = restrictedMode !== "none";
        const isThisPlaying = currentTrackId === track.id && isPlaying;
        const isTopRank = track.rank === 1;
        const bandPct = scoreBandWidthPct(track.score, scoreRange.min, scoreRange.max);
        const labelText = resolveLabel(track.label);
        const genreText = firstGenre(track.genre);
        const metaLine = [labelText, track.year, genreText, formatDuration(track.duration)]
            .filter(Boolean)
            .join(" · ");
        const currentRating = trackRatings[track.id];
        const upSelected = currentRating === 1;
        const downSelected = currentRating === 0;

        return (
            <article
                aria-hidden={restrictedMode === "blur" ? true : undefined}
                aria-label={restrictedMode === "blur" ? undefined : `${displayOrNA(track.title)} by ${displayOrNA(track.artist)}`}
                className={[
                    "relative w-full border border-dotted border-slate-200",
                    isThisPlaying && !isRestricted ? "bg-[rgba(255,255,255,.04)]" : "",
                    restrictedMode === "dim" ? "pointer-events-none select-none opacity-45" : "",
                    restrictedMode === "blur" ? "pointer-events-none select-none border-t-0 first:border-t" : "",
                ].join(" ")}
            >
                <div className="flex justify-between p-[var(--px-8)] pb-[var(--px-12)] relative">
                    <div className="flex flex-col w-full gap-[var(--px-8)]">
                        <div
                            className="grid gap-[var(--px-8)] items-start"
                            style={mobilePlaylistRowGridStyle}
                        >
                            <div
                                className={`pt-[var(--px-10)] font-fira text-[length:var(--px-13)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)]"}`}
                            >
                                {isRestricted && (
                                    <span aria-hidden="true" className="mr-[var(--px-2)] text-[length:var(--px-10)]">
                                        ⌾
                                    </span>
                                )}
                                {track.rank}
                            </div>
                            <button
                                type="button"
                                aria-label={isThisPlaying ? "Pause" : "Play"}
                                aria-hidden={restrictedMode === "blur" ? true : undefined}
                                tabIndex={restrictedMode === "blur" ? -1 : undefined}
                                disabled={restrictedMode === "blur"}
                                onClick={() => handlePlayButtonClick(track.id)}
                                className="relative flex h-[var(--px-44)] w-[var(--px-40)] items-center justify-center rounded-md border border-dotted border-slate-200 playlist-play-button"
                                id={`playlist-table-play-button-${track.id}`}
                                data-track-id={track.id}
                                data-track-artist={track.artist}
                                data-track-title={track.title}
                            >
                                {DEMO_MODE && hintFor === track.id && (
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        className="pointer-events-none absolute -top-6 left-0 z-20 whitespace-nowrap bg-[#FFCC00] text-black text-[length:var(--px-10)] font-semibold px-2 py-1 rounded shadow-md ring-2 ring-black/10"
                                    >
                                        Demo mode - Audio playback limited while we complete licensing
                                    </div>
                                )}
                                <TrackArtwork artworkUrl={track.artwork_url} className="absolute inset-0 h-full w-full rounded-md" />
                                {isThisPlaying && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-md">
                                        <img src={PauseSvg} alt="" aria-hidden="true" className="h-[var(--px-16)] w-[var(--px-16)]" />
                                    </span>
                                )}
                            </button>
                            <div className="min-w-0">
                                <div className="truncate text-[length:var(--px-13)] font-helvetica font-light uppercase leading-[var(--px-16)]">
                                    {isThisPlaying ? (
                                        <HoverFlow text={displayOrNA(track.title)} maxChars={32} delay={800} speed={40} endPause={1000} maxWidth="100%" flowAlways={true} />
                                    ) : (
                                        displayOrNA(track.title)
                                    )}
                                    {isTopRank && !isRestricted && (
                                        <span className="ml-[var(--px-6)] font-fira text-[length:var(--px-8)] uppercase tracking-[var(--px-1)] text-[var(--color-accent,#EE4A26)]">
                                            TOP
                                        </span>
                                    )}
                                </div>
                                <div className="truncate text-[length:var(--px-10)] font-helvetica font-light opacity-75">
                                    {displayOrNA(track.artist)}
                                </div>
                                <div className="mt-[var(--px-4)] truncate font-fira text-[length:var(--px-9)] tracking-[var(--px-0-5)] text-[var(--color-primary)] opacity-60">
                                    {metaLine}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-[var(--px-8)] min-w-0">
                            <span className={`shrink-0 font-fira text-[length:var(--px-10)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)] opacity-75"}`}>
                                {formatPercentage(track.score, 2)}
                            </span>
                            <div className="h-[var(--px-3)] flex-1 bg-[rgba(255,255,255,.08)] relative overflow-hidden" aria-hidden="true">
                                <div
                                    className={`absolute left-0 top-0 bottom-0 ${isTopRank && !isRestricted ? "bg-[var(--color-accent,#EE4A26)]" : "bg-[var(--color-primary-hover)]"}`}
                                    style={{ width: `${bandPct}%` }}
                                />
                            </div>
                        </div>
                        {isThisPlaying && !isRestricted && (
                            <SimilarityPlayer
                                trackId={track.id}
                                isPlaying={isThisPlaying}
                                totalDuration={track.duration}
                                label={labelText}
                                genre={genreText}
                            />
                        )}
                        {!isRestricted && (
                            <div className="flex items-center justify-between gap-[var(--px-8)]">
                                <div className="flex min-h-[var(--px-44)] items-center gap-[var(--px-10)]">
                                    <Tooltip message="Yes Similar to Input Track!">
                                        <button
                                            type="button"
                                            aria-label="Mark as similar"
                                            onClick={() => {
                                                if (upSelected) return;
                                                void handleTrackRating(track.id, 1);
                                            }}
                                            className="flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center"
                                            id={`playlist-table-thumb-up-${track.id}`}
                                        >
                                            <ThumbIcon
                                                className={`h-[var(--px-16)] w-[var(--px-16)] ${upSelected ? "fill-current" : "fill-transparent hover:fill-current"} hover:text-[var(--color-primary)]`}
                                            />
                                        </button>
                                    </Tooltip>
                                    <Tooltip message="No, Not Similar to Input Track!">
                                        <button
                                            type="button"
                                            aria-label="Mark as not similar"
                                            onClick={() => {
                                                if (downSelected) return;
                                                void handleTrackRating(track.id, 0);
                                            }}
                                            className="flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center"
                                            id={`playlist-table-thumb-down-${track.id}`}
                                        >
                                            <ThumbIcon
                                                className={`h-[var(--px-16)] w-[var(--px-16)] rotate-180 ${downSelected ? "fill-current" : "fill-transparent hover:fill-current"} hover:text-[var(--color-primary)]`}
                                            />
                                        </button>
                                    </Tooltip>
                                </div>
                                <div className="flex min-h-[var(--px-44)] items-center gap-[var(--px-8)]">
                                    {track.type === "internal" && track.deep_link_url && !isThisPlaying && (
                                        <AppleMusicBadge deepLinkUrl={track.deep_link_url} />
                                    )}
                                    <button
                                        type="button"
                                        className="flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center playlist-sonic-discovery-button"
                                        onClick={() => {
                                            window.open(`${BASE_BETA_URL}/?id=${track.id}`, "_blank");
                                        }}
                                        id={`playlist-table-sonic-discovery-${track.id}`}
                                        aria-label="Chain Discover"
                                        data-track-id={track.id}
                                    >
                                        <img src={SonicDiscoverySvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-16)] w-[var(--px-16)]" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="More"
                                        onClick={() =>
                                            onMoreClick?.(
                                                track.id,
                                                `${track.artist} - ${track.title}`,
                                                track.label,
                                                track.duration,
                                                track.score,
                                                false,
                                            )
                                        }
                                        className="flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center text-[#5C5C5C] playlist-more-button"
                                        id={`playlist-table-more-${track.id}`}
                                    >
                                        <img src={MoreSvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-14)] w-[var(--px-19)]" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </article>
        );
    };

    return (
        <section className="mt-[var(--px-25)] flex w-full flex-col items-center justify-start gap-[var(--px-10)]" aria-label="Similar tracks">
            <h2 className="sr-only">Similar Tracks</h2>
            {unlockedTracks.map((track) => (
                <React.Fragment key={track.id}>
                    {renderTrackRow(track, "none")}
                </React.Fragment>
            ))}
            {guestBlurLock && lockedTracks.length > 0 && (
                <PlaylistLockedRegion
                    isGuest={isGuest}
                    maxTracksPerPlaylist={maxTracksPerPlaylist}
                    mobile
                    rowHeightVar="var(--px-120)"
                >
                    {visibleLockedTracks.map((track) => (
                        <React.Fragment key={track.id}>
                            {renderTrackRow(track, "blur")}
                        </React.Fragment>
                    ))}
                </PlaylistLockedRegion>
            )}
            {!guestBlurLock && lockedTracks.map((track) => {
                const isFirstLockedRow = track.rank === maxUnlocked + 1;
                return (
                    <React.Fragment key={track.id}>
                        {showUnlockBand && isFirstLockedRow && (
                            <PlaylistUnlockBand
                                isGuest={isGuest}
                                maxTracksPerPlaylist={maxTracksPerPlaylist}
                                mobile
                            />
                        )}
                        {renderTrackRow(track, "dim")}
                    </React.Fragment>
                );
            })}
            <p className="mt-[var(--px-8)] w-full text-right font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
                Matched by PYXIS-1 · {footerResultCount} results
                {footerTopMatch ? ` · Top match: ${footerTopMatch}` : ""}
                {footerAnalysisTime ? ` · Analysis: ${footerAnalysisTime}` : ""}
            </p>
            <div className="mt-[var(--px-12)] flex flex-wrap gap-x-[var(--px-16)] gap-y-[var(--px-6)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-50">
                <span>▶ Authorised preview / playback</span>
                <span>Apple badge — catalogue tracks with a link</span>
                <span>⇄ Chain Discover — use as new reference</span>
                <span>Score bars compare within this shortlist — scores sit in a tight band by design</span>
            </div>
            <p className="mt-[var(--px-8)] font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
                {access.isGuestForCopy
                    ? "Sign in to keep this playlist in your Library, rename it, share it or export it to Apple Music."
                    : "Saved to your Library · rename, share or export from there."}
            </p>
            <p className="mt-[var(--px-6)] font-fira text-[length:var(--px-9)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-45">
                Apple Music is a trademark of Apple Inc. Resomix is not affiliated with or endorsed by Apple.
            </p>

            <GateCtaModal
                reason={rateGate}
                title={rateGate === "upgrade_required" ? "Upgrade to rate tracks" : "Log in to rate tracks"}
                body={rateGate === "upgrade_required"
                    ? "Your current plan does not include track rating. Subscribe to rate tracks."
                    : "Rating individual tracks needs an account. Log in or create a free account to rate."}
                onClose={() => setRateGate(null)}
            />
        </section>
    );
};

export default PlaylistTable;
