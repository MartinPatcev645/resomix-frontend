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
import PlaySvg from "@/assets/icons/play.svg";
import MoreSvg from "@/assets/icons/more.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import { scoreBandWidthPct, shortlistScoreRange } from "@/utils/scoreBand.ts";
import { prefetchAudio } from "@/utils/prefetchAudio.ts";
import {
  PLAYLIST_DIVIDER_BORDER,
  PLAYLIST_VISIBLE_PAGE,
} from "@/utils/playlistChrome.ts";
import { useVisibleResultWindow } from "@/hooks/useVisibleResultWindow.ts";
import { WORKSPACE_BTN_SECONDARY, WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

interface PlaylistTableProps {
    onMoreClick?: (trackId: string, name: string, label: string, duration: number, score: number, isInput?: boolean) => void;
}

const PlaylistTable: React.FC<PlaylistTableProps> = ({ onMoreClick }) => {
    const { playlistData, trackRatings = {}, setTrackRating, setTrackRatings, removeTrackRating } = usePlaylistStore();
    const tracks = useMemo(
        () => playlistData?.similar_tracks ?? [],
        [playlistData?.similar_tracks],
    );
    const playlistId = playlistData?.playlist?.id;
    const { visibleCount, canLoadMore, loadMore, remaining } = useVisibleResultWindow(
        playlistId,
        tracks.length,
    );
    const scoreRange = useMemo(
        () => shortlistScoreRange(tracks.map((t) => t.score)),
        [tracks],
    );

    const access = useAccess();
    const [rateGate, setRateGate] = useState<"login_required" | "upgrade_required" | null>(null);
    const maxUnlocked = access.unlockedTracks;
    const isGuest = access.isGuestForCopy;
    const maxTracksPerPlaylist = access.unlockedTracks;

    const windowedTracks = useMemo(
        () => tracks.filter((t) => t.rank <= visibleCount),
        [tracks, visibleCount],
    );
    const hasLockedRows = windowedTracks.some((t) => t.rank > maxUnlocked);
    const showUnlockBand = access.teaseReady && hasLockedRows;
    const guestBlurLock = isGuest && showUnlockBand;
    const unlockedTracks = useMemo(
        () => windowedTracks.filter((t) => t.rank <= maxUnlocked),
        [windowedTracks, maxUnlocked],
    );
    const lockedTracks = useMemo(
        () => windowedTracks.filter((t) => t.rank > maxUnlocked),
        [windowedTracks, maxUnlocked],
    );
    const visibleLockedTracks = useMemo(
        () => lockedTracks.slice(0, LOCKED_BLUR_VISIBLE_ROWS),
        [lockedTracks],
    );

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
    const networkError = usePlayerStore(s => s.networkError);
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
        // Optimistic, with rollback if the server call fails — otherwise a failed POST leaves a
        // thumb showing "rated" while nothing was saved.
        const prev = trackRatings[trackId];
        const restore = () => (prev === undefined ? removeTrackRating(trackId) : setTrackRating(trackId, prev));
        try {
            if (prev === rating) {
                removeTrackRating(trackId);          // click active thumb → un-rate (optimistic)
                const res = await deleteTrackRating(trackId, pid);
                if (!res?.success) restore();
            } else {
                setTrackRating(trackId, rating);
                const res = await rateTrack(trackId, rating, pid);
                if (!res?.success) restore();
            }
        } catch (error) {
            console.error("Failed to rate track:", error);
            restore();
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
        const isSelected = currentTrackId === track.id;
        const isThisPlaying = isSelected && isPlaying;
        const isUnavailable = isSelected && networkError;
        const isTopRank = track.rank === 1;
        const bandPct = scoreBandWidthPct(track.score, scoreRange.min, scoreRange.max);
        const labelText = resolveLabel(track.label);
        const genreText = firstGenre(track.genre);
        const currentRating = trackRatings[track.id];
        const upSelected = currentRating === 1;
        const downSelected = currentRating === 0;
        const isPaused = isSelected && !isThisPlaying && !isUnavailable;

        return (
            <article
                aria-hidden={restrictedMode === "blur" ? true : undefined}
                aria-label={restrictedMode === "blur" ? undefined : `${displayOrNA(track.title)} by ${displayOrNA(track.artist)}`}
                aria-current={isThisPlaying && !isRestricted ? "true" : undefined}
                className={[
                    `pl-row relative w-full border ${PLAYLIST_DIVIDER_BORDER}`,
                    restrictedMode === "dim" ? "pointer-events-none select-none opacity-45" : "",
                    restrictedMode === "blur" ? "pointer-events-none select-none border-t-0 first:border-t" : "",
                ].join(" ")}
                data-selected={!isRestricted && isSelected && !isThisPlaying && !isUnavailable ? "true" : undefined}
                data-playing={!isRestricted && isThisPlaying ? "true" : undefined}
                data-paused={!isRestricted && isPaused ? "true" : undefined}
                data-unavailable={!isRestricted && isUnavailable ? "true" : undefined}
                onTouchStart={!isRestricted ? () => prefetchAudio((track as { preview_url?: string | null }).preview_url) : undefined}
            >
                <div className="relative flex justify-between p-[var(--px-12)]">
                    <div className="flex w-full min-w-0 flex-col gap-[var(--px-10)]">
                        <div className="flex min-w-0 items-start gap-[var(--px-10)]">
                            <div
                                className={`pl-unavailable-dim shrink-0 pt-[var(--px-12)] font-fira text-[length:var(--px-12)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--rx-color-text-muted)]"}`}
                            >
                                {isRestricted && (
                                    <span aria-hidden="true" className="mr-[var(--px-2)] text-[length:var(--px-10)]">
                                        ⌾
                                    </span>
                                )}
                                {isThisPlaying && !isRestricted && (
                                    <span className="sr-only">Now playing: </span>
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
                                className={`relative flex h-[var(--px-48)] w-[var(--px-48)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] playlist-play-button ${WORKSPACE_FOCUS_VISIBLE} ${isThisPlaying ? "bg-[rgba(238,74,38,0.16)] border-[rgba(238,74,38,0.7)]" : "hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"}`}
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
                                <TrackArtwork artworkUrl={track.artwork_url} className="absolute inset-0 h-full w-full rounded-[var(--rx-radius-control)] border-0" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--rx-radius-control)]">
                                    <img
                                        src={isThisPlaying ? PauseSvg : PlaySvg}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-[var(--px-16)] w-[var(--px-16)] opacity-95"
                                    />
                                </span>
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="pl-unavailable-dim line-clamp-2 text-[length:var(--px-14)] font-helvetica font-light uppercase leading-[var(--px-18)] text-[var(--rx-color-text-primary)]">
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
                                <div className="pl-unavailable-dim mt-[var(--px-2)] truncate text-[length:var(--px-12)] font-helvetica font-light text-[var(--rx-color-text-secondary)]">
                                    {displayOrNA(track.artist)}
                                </div>
                                <div className="pl-unavailable-dim mt-[var(--px-6)] flex flex-wrap gap-x-[var(--px-10)] gap-y-[var(--px-2)] font-fira text-[length:var(--px-11)] tracking-[var(--px-0-5)] text-[var(--rx-color-text-secondary)]">
                                    {track.year != null && <span>{track.year}</span>}
                                    <span>{formatDuration(track.duration)}</span>
                                    {genreText && <span className="truncate">{genreText}</span>}
                                </div>
                            </div>
                            {!isRestricted && (
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
                                    className={`flex h-[var(--px-44)] w-[var(--px-44)] shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)] opacity-80 transition-[background-color,border-color,color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] playlist-more-button ${WORKSPACE_FOCUS_VISIBLE}`}
                                    id={`playlist-table-more-${track.id}`}
                                >
                                    <img src={MoreSvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-14)] w-[var(--px-19)]" />
                                </button>
                            )}
                        </div>
                        <div className="flex min-w-0 items-center gap-[var(--px-10)]">
                            <span className={`pl-unavailable-dim shrink-0 font-fira text-[length:var(--px-12)] ${isTopRank || isThisPlaying ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--rx-color-text-primary)]"}`}>
                                {formatPercentage(track.score, 2)}
                            </span>
                            <div className="pl-score-rail flex-1" aria-hidden="true">
                                <div
                                    className={`pl-score-fill ${isTopRank || isThisPlaying ? "bg-[var(--color-accent,#EE4A26)]" : "bg-[var(--rx-color-score-fill)]"}`}
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
                            <div className="flex min-w-0 items-center justify-between gap-[var(--px-12)]">
                                <div className="pl-unavailable-dim flex min-h-[var(--px-44)] shrink-0 items-center gap-[8px]">
                                    <Tooltip message="Yes Similar to Input Track!">
                                        <button
                                            type="button"
                                            aria-label="Mark as similar"
                                            onClick={() => void handleTrackRating(track.id, 1)}
                                            className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center ${WORKSPACE_FOCUS_VISIBLE}`}
                                            id={`playlist-table-thumb-up-${track.id}`}
                                        >
                                            <ThumbIcon
                                                className={`h-[var(--px-16)] w-[var(--px-16)] ${upSelected ? "fill-current" : "fill-transparent hover:fill-current"} text-[var(--rx-color-text-primary)] opacity-85`}
                                            />
                                        </button>
                                    </Tooltip>
                                    <Tooltip message="No, Not Similar to Input Track!">
                                        <button
                                            type="button"
                                            aria-label="Mark as not similar"
                                            onClick={() => void handleTrackRating(track.id, 0)}
                                            className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center ${WORKSPACE_FOCUS_VISIBLE}`}
                                            id={`playlist-table-thumb-down-${track.id}`}
                                        >
                                            <ThumbIcon
                                                className={`h-[var(--px-16)] w-[var(--px-16)] rotate-180 ${downSelected ? "fill-current" : "fill-transparent hover:fill-current"} text-[var(--rx-color-text-primary)] opacity-85`}
                                            />
                                        </button>
                                    </Tooltip>
                                </div>
                                <div className="pl-unavailable-dim flex min-h-[var(--px-44)] min-w-0 shrink-0 items-center gap-[8px]">
                                    {track.type === "internal" && track.deep_link_url && !isThisPlaying && (
                                        <AppleMusicBadge deepLinkUrl={track.deep_link_url} />
                                    )}
                                    <button
                                        type="button"
                                        className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)] playlist-sonic-discovery-button opacity-85 transition-[background-color,border-color,color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] ${WORKSPACE_FOCUS_VISIBLE}`}
                                        onClick={() => {
                                            window.open(`${BASE_BETA_URL}/?id=${track.id}`, "_blank");
                                        }}
                                        id={`playlist-table-sonic-discovery-${track.id}`}
                                        aria-label="Chain Discover"
                                        data-track-id={track.id}
                                    >
                                        <img src={SonicDiscoverySvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-16)] w-[var(--px-16)]" />
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
        <section className="mt-[var(--px-20)] flex w-full flex-col items-center justify-start gap-[var(--px-8)]" aria-label="Similar tracks">
            <div className="mb-[var(--px-4)] flex w-full items-center gap-[var(--px-10)]">
                <span
                    aria-hidden="true"
                    className="block h-[var(--px-2)] w-[var(--px-28)] bg-[var(--color-accent,#EE4A26)]"
                />
                <h2 className="m-0 font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-primary)]">
                    Similar tracks for this reference
                </h2>
            </div>
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

            <div className="mt-[var(--px-10)] flex w-full flex-col items-center gap-[var(--px-8)]">
                {canLoadMore ? (
                    <button
                        type="button"
                        onClick={loadMore}
                        className={`${WORKSPACE_BTN_SECONDARY} w-full max-w-[var(--px-320)]`}
                        id="playlist-load-more"
                    >
                        Load {Math.min(PLAYLIST_VISIBLE_PAGE, remaining)} more
                    </button>
                ) : null}
                <p className="m-0 font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-70">
                    Showing {Math.min(visibleCount, tracks.length)} of {tracks.length} results
                </p>
            </div>

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
