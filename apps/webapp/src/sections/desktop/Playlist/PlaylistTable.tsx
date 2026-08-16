import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import { Tooltip } from "@resomix/ui";
import { formatDuration, useGlobalAudioController, useAccess } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { rateTrack, deleteTrackRating, getMyPlaylistRatings } from "@resomix/api-client";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import PlaySvg from "@/assets/icons/play_white.svg";
import PauseSvg from "@/assets/icons/pause_white.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import { prefetchAudio } from "@/utils/prefetchAudio.ts";
import { PlaylistLockedRegion } from "@/components/Playlist/PlaylistLockedRegion.tsx";
import { PLAYLIST_ROW_GRID_CLASS, playlistRowGridStyle } from "@/utils/playlistGrid.ts";
import {
  PLAYLIST_DIVIDER_STRONG,
  PLAYLIST_PANEL_BORDER,
  PLAYLIST_ROW_SEPARATOR,
  PLAYLIST_STICKY_HEADER_TOP,
  PLAYLIST_VISIBLE_PAGE,
} from "@/utils/playlistChrome.ts";
import { useVisibleResultWindow } from "@/hooks/useVisibleResultWindow.ts";
import {
  WORKSPACE_BTN_SECONDARY,
  WORKSPACE_FOCUS_VISIBLE,
} from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { MatchBar, MatchBarLegend } from "@/components/Playlist/MatchBar.tsx";
import { anchorLabel, isHot } from "@/components/Playlist/matchBarScale.ts";

/**
 * One icon size across the row's three glyphs — play/pause, feedback thumbs and Chain Discover —
 * so they read as a set. Change here and all three follow.
 */
const ROW_ICON = "h-[var(--px-18)] w-[var(--px-18)]";

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
    // Locked rows get the blur + floating unlock panel on EVERY plan, not just for guests. This
    // used to be `isGuest && showUnlockBand`, so a logged-in free user fell through to a second
    // branch that rendered their locked tracks merely dimmed — readable, selectable, and with an
    // inline band of its own. Two branches meant two unlock bands on screen and a tease that only
    // actually concealed anything for guests.
    const blurLock = showUnlockBand;
    const unlockedTracks = useMemo(
        () => windowedTracks.filter((t) => t.rank <= maxUnlocked),
        [windowedTracks, maxUnlocked],
    );
    const lockedTracks = useMemo(
        () => windowedTracks.filter((t) => t.rank > maxUnlocked),
        [windowedTracks, maxUnlocked],
    );
    // Every withheld track gets a blurred row. Slicing to five made a 10-track lock look like a
    // 5-track one — the teaser has to show the real size of what is being held back.
    const visibleLockedTracks = lockedTracks;
    const analysis = playlistId ? loadPlaylistAnalysis(playlistId) : null;
    const footerResultCount = analysis?.resultCount ?? tracks.length;
    // The playlist's best score. Drives the TIER GATE only (spec rule 05) — never the fill, which
    // is on a fixed global ruler.
    const topScore = analysis?.topMatchScore ?? (tracks.length > 0 ? tracks[0].score : null);
    // The footer echoes the anchor's word rather than a figure — the rows carry no number, so
    // quoting one here would be the only percentage left on the screen.
    const footerTopMatch = topScore != null ? anchorLabel(isHot(topScore)) : null;
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
        const isAlternate = rowIndex % 2 === 1;
        const playLabel = isTrackPlaying ? "Pause" : "Play";
        const isPaused = isSelected && !isTrackPlaying && !isUnavailable;

        return (
            <div
                className={[
                    PLAYLIST_ROW_SEPARATOR,
                    "pl-row first:border-t-0",
                    !isRestricted && isAlternate && !isTrackPlaying && !isSelected ? "bg-[rgba(255,255,255,.015)]" : "",
                    restrictedMode === "dim" ? "pointer-events-none select-none opacity-45" : "",
                    restrictedMode === "blur" ? "pointer-events-none select-none" : "",
                    restrictedMode === "none" ? "select-text" : "",
                ].join(" ")}
                aria-current={isTrackPlaying && !isRestricted ? "true" : undefined}
                data-hovered={!isRestricted && !isTrackPlaying && !isSelected ? "true" : undefined}
                data-selected={!isRestricted && isSelected && !isTrackPlaying && !isUnavailable ? "true" : undefined}
                data-playing={!isRestricted && isTrackPlaying ? "true" : undefined}
                data-paused={!isRestricted && isPaused ? "true" : undefined}
                data-unavailable={!isRestricted && isUnavailable ? "true" : undefined}
                onMouseEnter={!isRestricted ? () => prefetchAudio((track as { preview_url?: string | null }).preview_url) : undefined}
            >
                <div
                    className={`${PLAYLIST_ROW_GRID_CLASS} min-h-[var(--px-48)] px-[var(--px-16)] py-[var(--px-12)]`}
                    style={playlistRowGridStyle}
                    role="row"
                >
                    <div className={`pl-unavailable-dim text-center font-fira text-[length:var(--px-11)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--rx-color-text-muted)]"}`} role="cell">
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
                        {/* Cover fills the play box (it used to sit in its own smaller column), with
                            the white transport glyph over a scrim so it reads on any artwork. */}
                        <button
                            type="button"
                            aria-label={playLabel}
                            aria-hidden={restrictedMode === "blur" ? true : undefined}
                            tabIndex={restrictedMode === "blur" ? -1 : undefined}
                            disabled={restrictedMode === "blur"}
                            onClick={() => handlePlayButtonClick(track.id)}
                            className={[
                                "relative z-20 flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center overflow-hidden rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent transition-[background-color,border-color,color] playlist-play-button",
                                WORKSPACE_FOCUS_VISIBLE,
                                isTrackPlaying
                                  ? "border-[rgba(238,74,38,0.7)]"
                                  : "hover:cursor-pointer hover:border-[var(--rx-color-border-strong)]",
                            ].join(" ")}
                            id={`playlist-table-play-button-${track.id}`}
                            data-testid="table-play-button"
                            data-track-id={track.id}
                            data-track-artist={track.artist}
                            data-track-title={track.title}
                            data-track-name={track.title}
                        >
                            <TrackArtwork
                                artworkUrl={track.artwork_url}
                                className="pl-unavailable-dim absolute inset-0 h-full w-full rounded-[var(--rx-radius-control)] border-0"
                            />
                            <span className={`absolute inset-0 flex items-center justify-center rounded-[var(--rx-radius-control)] ${isTrackPlaying ? "bg-[rgba(238,74,38,0.28)]" : "bg-black/40"}`}>
                                <img
                                    src={isTrackPlaying ? PauseSvg : PlaySvg}
                                    alt=""
                                    aria-hidden="true"
                                    className={`${ROW_ICON} drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}
                                />
                            </span>
                        </button>
                    </div>
                    {/* select-none overrides the row's `select-text`: artist/title are not copyable
                        (both platforms), while the rest of the row stays selectable.
                        While playing, the two columns merge into one left-aligned cell stacking
                        title over artist — everything else keeps its normal column treatment. */}
                    {isTrackPlaying && !isRestricted ? (
                        <div
                            className="pl-unavailable-dim min-w-0 select-none text-left leading-[var(--px-18)]"
                            role="cell"
                            style={{ gridColumn: "span 2" }}
                        >
                            <div
                                className="truncate text-[length:var(--px-14)] font-helvetica font-light uppercase text-[var(--rx-color-text-primary)]"
                                title={displayOrNA(track.title)}
                            >
                                {displayOrNA(track.title)}
                            </div>
                            <div
                                className="truncate text-[length:var(--px-13)] font-helvetica font-light text-[var(--rx-color-text-secondary)]"
                                title={displayOrNA(track.artist)}
                            >
                                {displayOrNA(track.artist)}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                className="pl-unavailable-dim min-w-0 select-none truncate text-center text-[length:var(--px-13)] font-helvetica font-light text-[var(--rx-color-text-secondary)]"
                                role="cell"
                                title={displayOrNA(track.artist)}
                            >
                                {displayOrNA(track.artist)}
                            </div>
                            <div
                                className="pl-unavailable-dim min-w-0 select-none truncate text-center text-[length:var(--px-14)] font-helvetica font-light uppercase text-[var(--rx-color-text-primary)]"
                                role="cell"
                                title={displayOrNA(track.title)}
                            >
                                {displayOrNA(track.title)}
                            </div>
                        </>
                    )}
                    {/* Label/genre stay in their own cells while playing — the player row no longer
                        repeats them in its meta line. */}
                    <div className="pl-unavailable-dim min-w-0 text-center font-fira text-[length:var(--px-11)] leading-[var(--px-15)] text-[var(--rx-color-text-secondary)]" role="cell">
                        {resolveLabel(track.label) && (
                            <div className="truncate" title={resolveLabel(track.label) || undefined}>{resolveLabel(track.label)}</div>
                        )}
                        <div className="opacity-90">{track.year ?? "—"}</div>
                    </div>
                    <div className="pl-unavailable-dim min-w-0 text-center font-fira text-[length:var(--px-11)] leading-[var(--px-15)] text-[var(--rx-color-text-secondary)]" role="cell">
                        {firstGenre(track.genre) && (
                            <div className="truncate" title={firstGenre(track.genre) || undefined}>{firstGenre(track.genre)}</div>
                        )}
                        <div className="opacity-90">{formatDuration(track.duration)}</div>
                    </div>
                    <div className="pl-unavailable-dim flex min-w-0 items-center" role="cell">
                        {/* `track.rank` is 1-based; the spec's anchor is rank 0. */}
                        <MatchBar
                            score={track.score}
                            rank={track.rank - 1}
                            count={tracks.length}
                            topScore={topScore}
                        />
                    </div>
                    {!isRestricted && (
                        <div className="pl-unavailable-dim flex min-w-0 items-center justify-center gap-[var(--px-2)]" role="cell">
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
                                                className={`flex h-[var(--px-28)] w-[var(--px-28)] shrink-0 items-center justify-center ${WORKSPACE_FOCUS_VISIBLE}`}
                                                onClick={() => void handleTrackRating(track.id, 1)}
                                            >
                                                <ThumbIcon
                                                    className={`${ROW_ICON} ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} text-[var(--rx-color-text-primary)] opacity-80 hover:opacity-100 hover:cursor-pointer playlist-rating-thumb-up`}
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
                                                className={`flex h-[var(--px-28)] w-[var(--px-28)] shrink-0 items-center justify-center ${WORKSPACE_FOCUS_VISIBLE}`}
                                                onClick={() => void handleTrackRating(track.id, 0)}
                                            >
                                                <ThumbIcon
                                                    className={`${ROW_ICON} rotate-180 ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} text-[var(--rx-color-text-primary)] opacity-80 hover:opacity-100 hover:cursor-pointer playlist-rating-thumb-down`}
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
                        <div role="cell" className="pl-unavailable-dim flex min-h-[var(--px-44)] min-w-[var(--px-52)] items-center justify-center">
                            <button
                                type="button"
                                className={`flex h-[var(--px-35)] w-[var(--px-35)] items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent text-[var(--rx-color-text-secondary)] transition-[background-color,border-color,color] hover:cursor-pointer hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] playlist-sonic-discovery-button ${WORKSPACE_FOCUS_VISIBLE}`}
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
                                    <img src={SonicDiscoverySvg} draggable={false} alt="" aria-hidden="true" className={`${ROW_ICON} hover:scale-110 transition-transform duration-200`} />
                                </Tooltip>
                            </button>
                        </div>
                    )}
                    {isRestricted && <div role="cell" aria-hidden="true" />}
                    {isTrackPlaying && !isRestricted && (
                        <div
                            className="col-span-full pt-[var(--px-4)]"
                            style={{ gridColumn: "1 / -1" }}
                            role="cell"
                        >
                            {/* No label/genre — they stay in their own columns now, so the player's
                                meta line carries only the elapsed time. The Apple lockup closes the
                                control row (its column was removed from the collapsed row). */}
                            <SimilarityPlayer
                                trackId={track.id}
                                isPlaying={isTrackPlaying}
                                totalDuration={track.duration}
                                appleDeepLinkUrl={track.type === "internal" ? track.deep_link_url : null}
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
                className={`${PLAYLIST_ROW_GRID_CLASS} sticky z-[30] px-[var(--px-16)] py-[var(--px-10)] border ${PLAYLIST_DIVIDER_STRONG} border-b bg-[#0b0b0b] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]`}
                style={{ ...playlistRowGridStyle, top: PLAYLIST_STICKY_HEADER_TOP }}
                role="row"
            >
                {/* Every header sits centred over its cell, matching the values below. The stacked
                    pairs mirror the two-line values (label over year, genre over length) instead of
                    joining the two words with a separator dot. */}
                <div role="columnheader" className="text-center">#</div>
                <div role="columnheader" aria-label="Play" />
                <div role="columnheader" className="text-center">Artist</div>
                <div role="columnheader" className="text-center">Title</div>
                <div role="columnheader" className="text-center leading-[var(--px-12)]">
                    <div>Label</div>
                    <div>Year</div>
                </div>
                <div role="columnheader" className="text-center leading-[var(--px-12)]">
                    <div>Genre</div>
                    <div>Length</div>
                </div>
                <div role="columnheader" className="flex flex-col items-center gap-[var(--px-2)]">
                    <span>Match</span>
                    {/* Spec rule 03 — the ruler teaches itself. The 85 / 95 marks sit here, once,
                        rather than on every row where they would be noise. */}
                    <MatchBarLegend />
                </div>
                <div role="columnheader" className="text-center">Feedback</div>
                <div role="columnheader" className="text-center">Chain</div>
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
            {blurLock && lockedTracks.length > 0 && (
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
            </div>

            <div className="mt-[var(--px-14)] flex flex-col items-center gap-[var(--px-8)]">
                {canLoadMore ? (
                    <button type="button" onClick={loadMore} className={WORKSPACE_BTN_SECONDARY} id="playlist-load-more">
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
                <span>⇄ Chain Discover · use as new reference</span>
                <span>Ten dots · how close each track is to your reference</span>
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
