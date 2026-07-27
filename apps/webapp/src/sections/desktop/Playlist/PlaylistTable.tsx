import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import { IconComp, Tooltip } from "@resomix/ui";
import { formatDuration, useGlobalAudioController, useAccess } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { rateTrack } from "@resomix/api-client";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { loadAllTrackRatings, saveTrackRating } from "@/utils/trackRatingsStorage.js";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import { scoreBandWidthPct, shortlistScoreRange } from "@/utils/scoreBand.ts";
import { PlaylistUnlockBand } from "@/components/Playlist/PlaylistUnlockBand.tsx";
import { PLAYLIST_ROW_GRID_CLASS, playlistRowGridStyle } from "@/utils/playlistGrid.ts";

const PlaylistTable: React.FC = () => {
    const { playlistData, trackRatings = {}, setTrackRating } = usePlaylistStore();
    const hlsController = useGlobalAudioController();
    const [hintFor, setHintFor] = useState<string | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isPlaying: boolean = usePlayerStore(s => s.isPlaying);

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

    const tracks = playlistData?.similar_tracks ?? [];
    const hasLockedRows = tracks.some((t) => t.rank > maxUnlocked);
    const showUnlockBand = access.teaseReady && hasLockedRows;
    const scoreRange = useMemo(
        () => shortlistScoreRange(tracks.map((t) => t.score)),
        [tracks],
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

    const trackIdsKey = useMemo(() => tracks.map(t => t.id).join(","), [tracks]);

    useEffect(() => {
        if (tracks.length === 0) return;
        const saved = loadAllTrackRatings();
        tracks.forEach(t => {
            const localRating = saved[t.id];
            if (localRating !== undefined && trackRatings[t.id] === undefined) {
                setTrackRating(t.id, localRating);
            }
        });
    }, [trackIdsKey, setTrackRating, trackRatings, tracks]);

    const handleTrackRating = async (trackId: string, rating: number) => {
        const v = access.verdict("rateTrack");
        if (v === "pending") return;
        if (v !== "allowed") {
            setRateGate(v === "login" ? "login_required" : "upgrade_required");
            return;
        }
        try {
            const pid = playlistData?.playlist?.id || null;
            setTrackRating(trackId, rating);
            saveTrackRating(trackId, rating);
            await rateTrack(trackId, rating, pid);
        } catch (error) {
            console.error('Failed to rate track:', error);
        }
    };

    return (
        <div className="flex flex-col w-full mt-[var(--px-16)]" role="table" aria-label="Similar tracks">
            <h2 className="sr-only">Similar Tracks</h2>

            <div
                className={`${PLAYLIST_ROW_GRID_CLASS} px-[var(--px-16)] py-[var(--px-8)] border border-dotted border-slate-200 border-b-0 bg-[rgba(255,255,255,.03)] font-fira text-[length:var(--px-8)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60`}
                style={playlistRowGridStyle}
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
                <div role="columnheader">Score</div>
                <div role="columnheader">Feedback</div>
                <div role="columnheader">Chain</div>
            </div>

            <div className="border border-dotted border-slate-200 bg-[rgba(255,255,255,.02)]">
            {tracks.map((track) => {
                const isRestricted = track.rank > maxUnlocked;
                const isFirstLockedRow = track.rank === maxUnlocked + 1;
                const isTrackPlaying = currentTrackId === track.id && isPlaying;
                const isTopRank = track.rank === 1;
                const bandPct = scoreBandWidthPct(track.score, scoreRange.min, scoreRange.max);
                const scorePctLabel = `${(track.score * 100).toFixed(2)}%`;

                return (
                    <React.Fragment key={track.id}>
                        {showUnlockBand && isFirstLockedRow && (
                            <PlaylistUnlockBand
                                isGuest={isGuest}
                                maxTracksPerPlaylist={maxTracksPerPlaylist}
                            />
                        )}
                        <div
                            className={[
                                "border-t border-dotted border-slate-200 first:border-t-0",
                                isTrackPlaying && !isRestricted ? "bg-[rgba(255,255,255,.04)]" : "",
                                !isRestricted && !isTrackPlaying ? "hover:bg-[rgba(255,255,255,.03)]" : "",
                                isRestricted ? "pointer-events-none select-none opacity-45" : "select-text",
                            ].join(" ")}
                        >
                            <div
                                className={`${PLAYLIST_ROW_GRID_CLASS} px-[var(--px-16)] py-[var(--px-10)]`}
                                style={playlistRowGridStyle}
                                role="row"
                            >
                                <div className={`font-fira text-[length:var(--px-11)] ${isTopRank && !isRestricted ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)] opacity-60"}`} role="cell">
                                    {isRestricted && (
                                        <span aria-hidden="true" className="mr-[var(--px-2)] text-[length:var(--px-10)]">
                                            ⌾
                                        </span>
                                    )}
                                    {track.rank}
                                </div>
                                <div role="cell" className="relative inline-block">
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
                                        className="relative z-20 w-[var(--px-32)] h-[var(--px-32)] playlist-play-button rounded-full border border-dotted border-slate-200 flex items-center justify-center"
                                        svg={<img
                                            src={currentTrackId === track.id && isPlaying ? PauseSvg : PlaySvg}
                                            alt={currentTrackId === track.id && isPlaying ? "Pause" : "Play"}
                                            className='w-[var(--px-10)] h-[var(--px-10)]'
                                        />}
                                        padding='p-[var(--px-6)]'
                                        onClick={() => handlePlayButtonClick(track.id)}
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
                                <div className="min-w-0 truncate text-[length:var(--px-13)] font-helvetica font-light text-[var(--color-primary-hover)] opacity-80" role="cell" title={displayOrNA(track.artist)}>
                                    {displayOrNA(track.artist)}
                                </div>
                                <div className="min-w-0 truncate text-[length:var(--px-13)] font-helvetica font-light uppercase" role="cell" title={displayOrNA(track.title)}>
                                    {displayOrNA(track.title)}
                                </div>
                                <div className="font-fira text-[length:var(--px-10)] leading-[var(--px-14)] text-[var(--color-primary)] opacity-75" role="cell">
                                    {!isTrackPlaying && resolveLabel(track.label) && (
                                        <div className="truncate text-[var(--color-primary-hover)]" title={resolveLabel(track.label) || undefined}>{resolveLabel(track.label)}</div>
                                    )}
                                    <div>{track.year ?? "—"}</div>
                                </div>
                                <div className="font-fira text-[length:var(--px-10)] leading-[var(--px-14)] text-[var(--color-primary)] opacity-75" role="cell">
                                    {!isTrackPlaying && firstGenre(track.genre) && (
                                        <div className="truncate text-[var(--color-primary-hover)]" title={firstGenre(track.genre) || undefined}>{firstGenre(track.genre)}</div>
                                    )}
                                    <div>{formatDuration(track.duration)}</div>
                                </div>
                                <div className="flex flex-col gap-[var(--px-4)] min-w-0" role="cell">
                                    <div className={`font-fira text-[length:var(--px-11)] ${isTopRank ? "text-[var(--color-accent,#EE4A26)]" : ""}`}>
                                        {scorePctLabel}
                                        {isTopRank && (
                                            <span className="ml-[var(--px-6)] text-[length:var(--px-8)] uppercase tracking-[var(--px-1)] text-[var(--color-accent,#EE4A26)]">TOP</span>
                                        )}
                                    </div>
                                    <div className="h-[var(--px-3)] bg-[rgba(255,255,255,.08)] relative overflow-hidden" aria-hidden="true">
                                        <div
                                            className={`absolute left-0 top-0 bottom-0 ${isTopRank ? "bg-[var(--color-accent,#EE4A26)]" : "bg-[var(--color-primary-hover)]"}`}
                                            style={{ width: `${bandPct}%` }}
                                        />
                                    </div>
                                </div>
                                {!isRestricted && (
                                    <div className="flex items-center gap-[var(--px-8)]" role="cell">
                                        {(() => {
                                            const currentRating = trackRatings[track.id];
                                            const upSelected = currentRating === 1;
                                            const downSelected = currentRating === 0;
                                            return (
                                                <>
                                                    <Tooltip message="Yes Similar to Input Track!">
                                                        <ThumbIcon
                                                            onClick={() => {
                                                                if (upSelected) return;
                                                                handleTrackRating(track.id, 1);
                                                            }}
                                                            className={`w-[var(--px-16)] h-[var(--px-16)] ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:text-[var(--color-primary)] hover:cursor-pointer playlist-rating-thumb-up`}
                                                            id={`playlist-table-thumb-up-${track.id}`}
                                                            data-track-id={track.id}
                                                            data-track-artist={track.artist}
                                                            data-track-title={track.title}
                                                            data-track-name={track.title}
                                                        />
                                                    </Tooltip>
                                                    <Tooltip message="No, Not Similar to Input Track!">
                                                        <ThumbIcon
                                                            onClick={() => {
                                                                if (downSelected) return;
                                                                handleTrackRating(track.id, 0);
                                                            }}
                                                            className={`w-[var(--px-16)] h-[var(--px-16)] transform rotate-180 ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:text-[var(--color-primary)] hover:cursor-pointer playlist-rating-thumb-down`}
                                                            id={`playlist-table-thumb-down-${track.id}`}
                                                            data-track-id={track.id}
                                                            data-track-artist={track.artist}
                                                            data-track-title={track.title}
                                                            data-track-name={track.title}
                                                        />
                                                    </Tooltip>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                                {isRestricted && <div role="cell" aria-hidden="true" />}
                                {!isRestricted && (
                                    <button
                                        type="button"
                                        className="flex items-center justify-center hover:cursor-pointer playlist-sonic-discovery-button bg-transparent border-0 p-0"
                                        role="cell"
                                        onClick={() => {
                                            window.open(`${BASE_BETA_URL}/?id=${track.id}`, '_blank');
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
                                )}
                                {isRestricted && <div role="cell" aria-hidden="true" />}
                                {isTrackPlaying && !isRestricted && (
                                    <div
                                        className="col-span-full border-t border-dotted border-slate-200 pt-[var(--px-8)]"
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
                    </React.Fragment>
                );
            })}
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
