import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import { IconComp, Tooltip } from "@resomix/ui";
import { formatDuration, useGlobalAudioController, useAccess } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { rateTrack, deleteTrackRating, getMyPlaylistRatings } from "@resomix/api-client";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import { scoreBandWidthPct, shortlistScoreRange } from "@/utils/scoreBand.ts";
import { prefetchAudio } from "@/utils/prefetchAudio.ts";
import { PlaylistUnlockBand } from "@/components/Playlist/PlaylistUnlockBand.tsx";
import { LOCKED_BLUR_VISIBLE_ROWS, PlaylistLockedRegion } from "@/components/Playlist/PlaylistLockedRegion.tsx";
import { PLAYLIST_ROW_GRID_CLASS, playlistRowGridStyle } from "@/utils/playlistGrid.ts";
import {
  PLAYLIST_DIVIDER_BORDER,
  PLAYLIST_DIVIDER_STRONG,
  PLAYLIST_PANEL_BORDER,
  PLAYLIST_ROW_SEPARATOR,
  PLAYLIST_STICKY_HEADER_TOP,
  PLAYLIST_VISIBLE_PAGE,
} from "@/utils/playlistChrome.ts";
import { useVisibleResultWindow } from "@/hooks/useVisibleResultWindow.ts";

const PlaylistTable: React.FC = () => {
    const { playlistData, trackRatings = {}, setTrackRating, setTrackRatings, removeTrackRating } = usePlaylistStore();
    const hlsController = useGlobalAudioController();
    const [hintFor, setHintFor] = useState<string | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isPlaying: boolean = usePlayerStore(s => s.isPlaying);
    const networkError = usePlayerStore(s => s.networkError);

    const access = useAccess();
    const [rateGate, setRateGate] = useState<"login_required" | "upgrade_required" | null>(null);
    const maxUnlocked = access.unlockedTracks;
    const isGuest = access.isGuestForCopy;
    const maxTracksPerPlaylist = access.unlockedTracks;

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

    const tracks = useMemo(
        () => playlistData?.similar_tracks ?? [],
        [playlistData?.similar_tracks],
    );
    const playlistId = playlistData?.playlist?.id;
    const { visibleCount, canLoadMore, loadMore, remaining } = useVisibleResultWindow(
        playlistId,
        tracks.length,
    );

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
    const scoreRange = useMemo(
        () => shortlistScoreRange(tracks.map((t) => t.score)),
        [tracks],
    );

    const analysis = playlistId ? loadPlaylistAnalysis(playlistId) : null;
    const footerResultCount = analysis?.resultCount ?? tracks.length;
    const footerTopMatch = analysis?.topMatchScore != null
        ? `${(analysis.topMatchScore * 100).toFixed(2)}%`
        : tracks.length > 0 ? `${(tracks[0].score * 100).toFixed(2)}%` : null;
    const footerAnalysisTime = analysis?.analysisSeconds != null
        ? `${analysis.analysisSeconds.toFixed(1)}s`
        : null;

    // Hydrate the user's existing thumbs for THIS playlist from the server (source of truth, and
    // correctly per-playlist). Replaces the map so tracks the user hasn't rated show no thumb.
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
        // Optimistic update, but roll back if the server call doesn't actually succeed — otherwise
        // a failed POST leaves a thumb showing "rated" while nothing was saved.
        const prev = trackRatings[trackId];
        const restore = () => (prev === undefined ? removeTrackRating(trackId) : setTrackRating(trackId, prev));
        try {
            if (prev === rating) {
                removeTrackRating(trackId); // clicking the active thumb un-rates it
                const res = await deleteTrackRating(trackId, pid);
                if (!res?.success) restore();
            } else {
                setTrackRating(trackId, rating);
                const res = await rateTrack(trackId, rating, pid);
                if (!res?.success) restore();
            }
        } catch (error) {
            console.error('Failed to rate track:', error);
            restore();
        }
    };

    const renderTrackRow = (track: (typeof tracks)[number], restrictedMode: "none" | "dim" | "blur", rowIndex: number) => {
        const isRestricted = restrictedMode !== "none";
        const isSelected = currentTrackId === track.id;
        const isTrackPlaying = isSelected && isPlaying;
        const isUnavailable = isSelected && networkError;
        const isTopRank = track.rank === 1;
        const bandPct = scoreBandWidthPct(track.score, scoreRange.min, scoreRange.max);
        const scorePctLabel = `${(track.score * 100).toFixed(2)}%`;
        const isAlternate = rowIndex % 2 === 1;
        const playLabel = isTrackPlaying ? "Pause" : "Play";

        return (
            <div
                className={[
                    PLAYLIST_ROW_SEPARATOR,
                    "first:border-t-0",
                    !isRestricted && isAlternate && !isTrackPlaying && !isSelected
                        ? "bg-[rgba(255,255,255,.015)]"
                        : "",
                    isTrackPlaying && !isRestricted
                        ? "border-l-[length:var(--px-3)] border-l-[var(--color-accent,#EE4A26)] bg-[rgba(238,74,38,.07)]"
                        : "",
                    isSelected && !isTrackPlaying && !isRestricted && !isUnavailable
                        ? "border-l-[length:var(--px-2)] border-l-[rgba(238,74,38,.55)] bg-[rgba(255,255,255,.03)]"
                        : "",
                    isUnavailable && !isRestricted
                        ? "bg-[rgba(255,255,255,.02)] opacity-80"
                        : "",
                    !isRestricted && !isTrackPlaying && !isSelected
                        ? "hover:bg-[rgba(255,255,255,.04)]"
                        : "",
                    restrictedMode === "dim" ? "pointer-events-none select-none opacity-45" : "",
                    restrictedMode === "blur" ? "pointer-events-none select-none" : "",
                    restrictedMode === "none" ? "select-text" : "",
                ].join(" ")}
                aria-current={isTrackPlaying && !isRestricted ? "true" : undefined}
                onMouseEnter={!isRestricted ? () => prefetchAudio((track as { preview_url?: string | null }).preview_url) : undefined}
            >
                <div
                    className={`${PLAYLIST_ROW_GRID_CLASS} min-h-[var(--px-48)] px-[var(--px-16)] py-[var(--px-12)]`}
                    style={playlistRowGridStyle}
                    role="row"
                >
                    <div className={`font-fira text-[length:var(--px-11)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)] opacity-70"}`} role="cell">
                        {isRestricted && (
                            <span aria-hidden="true" className="mr-[var(--px-2)] text-[length:var(--px-10)]">
                                ⌾
                            </span>
                        )}
                        {isTrackPlaying && !isRestricted && (
                            <span className="sr-only">Now playing: </span>
                        )}
                        {track.rank}
                    </div>
                    <div role="cell" className="relative inline-flex min-h-[var(--px-44)] min-w-[var(--px-44)] items-center justify-center">
                        {DEMO_MODE && hintFor === track.id && (
                            <div
                                role="status"
                                aria-live="polite"
                                className="absolute -top-8 -left-2 whitespace-nowrap bg-[#FFCC00] text-black text-[length:var(--px-10)] font-semibold px-2 py-1 rounded shadow-md ring-2 ring-black/10 z-20"
                            >
                                Demo mode - Audio playback limited while we complete licensing
                            </div>
                        )}
                        <IconComp
                            className={[
                                "relative z-20 flex h-[var(--px-36)] w-[var(--px-36)] items-center justify-center rounded-full border border-solid border-[var(--playlist-divider-strong)] playlist-play-button",
                                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]",
                                isTrackPlaying ? "border-[var(--color-accent,#EE4A26)]" : "",
                            ].join(" ")}
                            svg={<img
                                src={isTrackPlaying ? PauseSvg : PlaySvg}
                                alt={playLabel}
                                className='w-[var(--px-11)] h-[var(--px-11)] opacity-90'
                            />}
                            padding='p-[var(--px-8)]'
                            onClick={restrictedMode === "blur" ? undefined : () => handlePlayButtonClick(track.id)}
                            asDiv={restrictedMode === "blur"}
                            id={`playlist-table-play-button-${track.id}`}
                            dataAttributes={{
                                'data-testid': 'table-play-button',
                                'data-track-id': track.id,
                                'data-track-artist': track.artist,
                                'data-track-title': track.title,
                                'data-track-name': track.title,
                            }}
                        />
                    </div>
                    <TrackArtwork artworkUrl={track.artwork_url} className="w-[var(--px-32)] h-[var(--px-32)] rounded-xs" />
                    <div className="flex items-center justify-center" role="cell">
                        {track.type === "internal" && track.deep_link_url && !isTrackPlaying && (
                            <AppleMusicBadge deepLinkUrl={track.deep_link_url} />
                        )}
                    </div>
                    <div
                        className="min-w-0 truncate text-[length:var(--px-13)] font-helvetica font-light text-[var(--color-primary-hover)]"
                        role="cell"
                        title={displayOrNA(track.artist)}
                    >
                        {displayOrNA(track.artist)}
                    </div>
                    <div
                        className="min-w-0 truncate text-[length:var(--px-14)] font-helvetica font-light uppercase text-[var(--color-primary)]"
                        role="cell"
                        title={displayOrNA(track.title)}
                    >
                        {displayOrNA(track.title)}
                    </div>
                    <div className="font-fira text-[length:var(--px-11)] leading-[var(--px-15)] text-[var(--color-primary-hover)]" role="cell">
                        {!isTrackPlaying && resolveLabel(track.label) && (
                            <div className="truncate" title={resolveLabel(track.label) || undefined}>{resolveLabel(track.label)}</div>
                        )}
                        <div className="opacity-90">{track.year ?? "—"}</div>
                    </div>
                    <div className="font-fira text-[length:var(--px-11)] leading-[var(--px-15)] text-[var(--color-primary-hover)]" role="cell">
                        {!isTrackPlaying && firstGenre(track.genre) && (
                            <div className="truncate" title={firstGenre(track.genre) || undefined}>{firstGenre(track.genre)}</div>
                        )}
                        <div className="opacity-90">{formatDuration(track.duration)}</div>
                    </div>
                    <div className="flex flex-col gap-[var(--px-4)] min-w-0" role="cell">
                        <div className={`font-fira text-[length:var(--px-11)] ${isTopRank || isTrackPlaying ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)]"}`}>
                            {scorePctLabel}
                            {isTopRank && (
                                <span className="ml-[var(--px-6)] text-[length:var(--px-8)] uppercase tracking-[var(--px-1)] text-[var(--color-accent,#EE4A26)]">TOP</span>
                            )}
                        </div>
                        <div className="h-[var(--px-3)] bg-[rgba(255,255,255,.14)] relative overflow-hidden" aria-hidden="true">
                            <div
                                className={`absolute left-0 top-0 bottom-0 ${isTopRank || isTrackPlaying ? "bg-[var(--color-accent,#EE4A26)]" : "bg-[var(--color-primary-hover)]"}`}
                                style={{ width: `${bandPct}%` }}
                            />
                        </div>
                    </div>
                    {!isRestricted && (
                        <div className="flex items-center gap-[var(--px-4)]" role="cell">
                            {(() => {
                                const currentRating = trackRatings[track.id];
                                const upSelected = currentRating === 1;
                                const downSelected = currentRating === 0;
                                return (
                                    <>
                                        <Tooltip message="Yes Similar to Input Track!">
                                            <button
                                                type="button"
                                                aria-label="Mark as similar"
                                                className="flex h-[var(--px-44)] w-[var(--px-36)] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                                                onClick={() => void handleTrackRating(track.id, 1)}
                                            >
                                                <ThumbIcon
                                                    className={`w-[var(--px-16)] h-[var(--px-16)] ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} text-[var(--color-primary)] opacity-80 hover:opacity-100 hover:cursor-pointer playlist-rating-thumb-up`}
                                                    id={`playlist-table-thumb-up-${track.id}`}
                                                    data-track-id={track.id}
                                                    data-track-artist={track.artist}
                                                    data-track-title={track.title}
                                                    data-track-name={track.title}
                                                />
                                            </button>
                                        </Tooltip>
                                        <Tooltip message="No, Not Similar to Input Track!">
                                            <button
                                                type="button"
                                                aria-label="Mark as not similar"
                                                className="flex h-[var(--px-44)] w-[var(--px-36)] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                                                onClick={() => void handleTrackRating(track.id, 0)}
                                            >
                                                <ThumbIcon
                                                    className={`w-[var(--px-16)] h-[var(--px-16)] transform rotate-180 ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} text-[var(--color-primary)] opacity-80 hover:opacity-100 hover:cursor-pointer playlist-rating-thumb-down`}
                                                    id={`playlist-table-thumb-down-${track.id}`}
                                                    data-track-id={track.id}
                                                    data-track-artist={track.artist}
                                                    data-track-title={track.title}
                                                    data-track-name={track.title}
                                                />
                                            </button>
                                        </Tooltip>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                    {isRestricted && <div role="cell" aria-hidden="true" />}
                    {!isRestricted && (
                        <div role="cell" className="flex min-h-[var(--px-44)] min-w-[var(--px-36)] items-center justify-center">
                            <button
                                type="button"
                                className="flex h-[var(--px-44)] w-[var(--px-36)] items-center justify-center hover:cursor-pointer playlist-sonic-discovery-button bg-transparent border-0 p-0 opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                                onClick={() => {
                                    window.open(`${BASE_BETA_URL}/sonic-discovery?discover=${track.id}`, '_blank');
                                }}
                                id={`playlist-table-sonic-discovery-${track.id}`}
                                aria-label="Chain Discover"
                                data-track-id={track.id}
                                data-track-artist={track.artist}
                                data-track-title={track.title}
                                data-track-name={track.title}
                            >
                                <Tooltip message="Use this track as a new reference to find more matches">
                                    <img src={SonicDiscoverySvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)] hover:scale-110 transition-transform duration-200" />
                                </Tooltip>
                            </button>
                        </div>
                    )}
                    {isRestricted && <div role="cell" aria-hidden="true" />}
                    {isTrackPlaying && !isRestricted && (
                        <div
                            className={`col-span-full border-t ${PLAYLIST_DIVIDER_BORDER} pt-[var(--px-8)]`}
                            style={{ gridColumn: "1 / -1" }}
                            role="cell"
                        >
                            <SimilarityPlayer
                                trackId={track.id}
                                isPlaying={isTrackPlaying}
                                totalDuration={track.duration}
                                label={resolveLabel(track.label)}
                                genre={firstGenre(track.genre)}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    let rowIndex = 0;

    return (
        <div className="flex flex-col w-full mt-[var(--px-16)]" role="table" aria-label="Similar tracks">
            <div className="mb-[var(--px-12)] flex items-center gap-[var(--px-10)]">
                <span
                    aria-hidden="true"
                    className="block h-[var(--px-2)] w-[var(--px-28)] bg-[var(--color-accent,#EE4A26)]"
                />
                <h2 className="m-0 font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-primary)]">
                    Similar tracks for this reference
                </h2>
            </div>

            <div
                className={`${PLAYLIST_ROW_GRID_CLASS} sticky z-[30] px-[var(--px-16)] py-[var(--px-10)] border ${PLAYLIST_DIVIDER_STRONG} border-b bg-[#0b0b0b] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-80`}
                style={{ ...playlistRowGridStyle, top: PLAYLIST_STICKY_HEADER_TOP }}
                role="row"
            >
                <div role="columnheader">#</div>
                <div role="columnheader" aria-label="Play" />
                <div role="columnheader" aria-label="Cover" />
                <div role="columnheader" aria-label="Apple Music" />
                <div role="columnheader">Artist</div>
                <div role="columnheader">Title</div>
                <div role="columnheader">Label · Year</div>
                <div role="columnheader">Genre · Length</div>
                <div role="columnheader">Match</div>
                <div role="columnheader">Feedback</div>
                <div role="columnheader">Chain</div>
            </div>

            <div className={`${PLAYLIST_PANEL_BORDER} border-t-0 bg-[rgba(255,255,255,.02)]`}>
            {unlockedTracks.map((track) => {
                const idx = rowIndex++;
                return (
                    <React.Fragment key={track.id}>
                        {renderTrackRow(track, "none", idx)}
                    </React.Fragment>
                );
            })}
            {guestBlurLock && lockedTracks.length > 0 && (
                <PlaylistLockedRegion
                    isGuest={isGuest}
                    maxTracksPerPlaylist={maxTracksPerPlaylist}
                    rowHeightVar="var(--px-56)"
                >
                    {visibleLockedTracks.map((track) => {
                        const idx = rowIndex++;
                        return (
                            <React.Fragment key={track.id}>
                                {renderTrackRow(track, "blur", idx)}
                            </React.Fragment>
                        );
                    })}
                </PlaylistLockedRegion>
            )}
            {!guestBlurLock && lockedTracks.map((track) => {
                const isFirstLockedRow = track.rank === maxUnlocked + 1;
                const idx = rowIndex++;
                return (
                    <React.Fragment key={track.id}>
                        {showUnlockBand && isFirstLockedRow && (
                            <PlaylistUnlockBand
                                isGuest={isGuest}
                                maxTracksPerPlaylist={maxTracksPerPlaylist}
                            />
                        )}
                        {renderTrackRow(track, "dim", idx)}
                    </React.Fragment>
                );
            })}
            </div>

            <div className="mt-[var(--px-14)] flex flex-col items-center gap-[var(--px-8)]">
                {canLoadMore ? (
                    <button
                        type="button"
                        onClick={loadMore}
                        className="inline-flex min-h-[var(--px-44)] items-center justify-center border border-solid border-[var(--playlist-divider-strong)] px-[var(--px-22)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-90 hover:border-[rgba(255,255,255,.28)] hover:bg-[rgba(255,255,255,.04)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                        id="playlist-load-more"
                    >
                        Load {Math.min(PLAYLIST_VISIBLE_PAGE, remaining)} more
                    </button>
                ) : null}
                <p className="m-0 font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-70">
                    Showing {Math.min(visibleCount, tracks.length)} of {tracks.length} results
                </p>
            </div>

            <p className="mt-[var(--px-8)] text-right font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
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

            <p className="mt-[var(--px-12)] font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
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
        </div>
    );
};

export default PlaylistTable;
