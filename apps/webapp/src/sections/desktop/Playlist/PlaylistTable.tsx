import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimilarityPlayer, ThumbIcon, CCLicenseGroup } from "@/components/index.ts";
import { IconComp, Tooltip } from "@resomix/ui";
import { formatDuration, formatPercentage, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { rateTrack } from "@resomix/api-client";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import TrackSelectSeparatorLine from "@/assets/icons/track_select_separator_line.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { loadAllTrackRatings, saveTrackRating } from "@/utils/trackRatingsStorage.js";
import { resolveLabel } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";

const PlaylistTable: React.FC = () => {
    const { playlistData, trackRatings = {}, setTrackRating } = usePlaylistStore();
    const hlsController = useGlobalAudioController();
    const [hintFor, setHintFor] = useState<string | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isPlaying: boolean = usePlayerStore(s => s.isPlaying);

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
    const demoTracksRestricted = DEMO_MODE && tracks.length > 20;

    // --- Analysis footer stats ---
    const playlistId = playlistData?.playlist.id;
    const analysis = playlistId ? loadPlaylistAnalysis(playlistId) : null;
    const footerResultCount = analysis?.resultCount ?? tracks.length;
    const footerTopMatch = analysis?.topMatchScore != null
        ? `${(analysis.topMatchScore * 100).toFixed(2)}%`
        : tracks.length > 0 ? `${(tracks[0].score * 100).toFixed(2)}%` : null;
    const footerAnalysisTime = analysis?.analysisSeconds != null
        ? `${analysis.analysisSeconds.toFixed(1)}s`
        : null;

    const trackIdsKey = useMemo(() => tracks.map(t => t.id).join(","), [tracks]);

    // Load ratings from localStorage and hydrate store if missing
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
        try {
            const playlistId = playlistData?.playlist.id || null;
            setTrackRating(trackId, rating);
            saveTrackRating(trackId, rating);
            await rateTrack(trackId, rating, playlistId);
        } catch (error) {
            console.error('Failed to rate track:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center -mt-[var(--px-30)] w-[var(--px-763)] ml-[var(--px-230)]" role="table" aria-label="Similar tracks">
            <h2 className="sr-only">Similar Tracks</h2>
            <div className="flex tracking-[var(--px-0-1)] text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] items-center w-full uppercase px-[var(--px-12)] mb-[var(--px-20)]" role="row">
                <div className="" role="columnheader">#</div>
                <div className="mx-[var(--px-85)]" role="columnheader">Artist</div>
                <div className="mx-[var(--px-30)]" role="columnheader">Title</div>
                <div className="ml-[var(--px-85)] flex flex-col items-center" role="columnheader">
                    <span className="text-[var(--color-primary-hover)]">Label</span>
                    Year
                </div>
                <div className="ml-[var(--px-60)]" role="columnheader">Duration</div>
                <div className="ml-[var(--px-20)]" role="columnheader">Score</div>
                <div className="ml-[var(--px-50)]" role="columnheader">Feedback</div>
                <div className="ml-[var(--px-30)]" role="columnheader">Chain Discover</div>
            </div>
            {tracks.map((track) => {
                const isRestricted = demoTracksRestricted && track.rank > 20;

                return (
                    <div key={track.id} className={`relative w-full py-[var(--px-5)] ${isRestricted ? "pointer-events-none select-none" : "select-text"}`}>
                        {/* Check if the rank is 21 and isRestricted is true, display a text here on top of the usual track details */}
                        {track.rank === 22 && isRestricted && (
                            <div className="absolute z-50 top-0 left-0 w-full h-full flex items-center justify-center text-white text-[length:var(--px-12)] font-fira font-semibold uppercase tracking-[var(--px-0-5)] text-center px-[var(--px-20)] rounded-sm">
                                Only 20 tracks accessible in Demo Mode.
                            </div>
                        )}
                        <div className={isRestricted ? "blur-xs" : ""}>
                            <div className="w-full border border-dotted border-slate-200 flex justify-between px-[var(--px-10)] py-[var(--px-14)]">
                                <div className="flex flex-col w-full">
                                    <div className="flex items-center" role="row">
                                        <div className="text-[length:var(--px-10)] font-fira font-light mr-[var(--px-5)]" role="cell">
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
                                            {DEMO_MODE && hintFor === track.id && (
                                                <span
                                                    aria-hidden="true"
                                                    className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-[#FFCC00] animate-pulse z-10"
                                                />
                                            )}
                                            <IconComp
                                                className="relative z-20 mx-[var(--px-10)] w-[var(--px-16)] h-[var(--px-16)] px-[var(--px-1)] playlist-play-button"
                                                svg={<img
                                                    src={currentTrackId === track.id && isPlaying ? PauseSvg : PlaySvg}
                                                    alt={currentTrackId === track.id && isPlaying ? "Pause" : "Play"}
                                                    className='w-[var(--px-10)] h-[var(--px-10)]'
                                                />}
                                                padding='py-[var(--px-3)] px-[var(--px-4)]'
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
                                        <div className="text-[length:var(--px-10)] font-helvetica text-[var(--color-primary-hover)] font-light tracking-[var(--px-0-1)] text-center mx-[var(--px-5)] w-[var(--px-120)]" role="cell">
                                            {track.artist}
                                        </div>
                                        <div className="text-[length:var(--px-10)] font-helvetica font-light tracking-[var(--px-0-1)] uppercase text-center mx-[var(--px-5)] w-[var(--px-140)]" role="cell">
                                            {track.title}
                                        </div>
                                        <div className="text-[length:var(--px-7)] font-fira font-light tracking-[var(--px-0-1)] text-center mx-[var(--px-5)] w-[var(--px-130)] flex flex-col items-center gap-[var(--px-3)]" role="cell">
                                            <span className="text-[var(--color-primary-hover)] text-[length:var(--px-9)]">
                                                {resolveLabel(track.label) || null}
                                            </span>
                                            {track.year}
                                        </div>
                                        <div className="text-[length:var(--px-9)] font-fira font-light tracking-[var(--px-0-1)] text-center ml-[var(--px-5)] mr-[var(--px-5)] w-[var(--px-40)]" role="cell">
                                            {formatDuration(track.duration)}
                                        </div>
                                        <div className="flex flex-col items-center" role="cell">
                                            <div className="text-[length:var(--px-9)] font-fira font-light tracking-[var(--px-0-1)] text-center text-[var(--color-primary-hover)] mx-[var(--px-10)] w-[var(--px-40)]">
                                                {formatPercentage(track.score)}
                                            </div>
                                            <div className="w-[var(--px-40)] h-[var(--px-4)] bg-transparent rounded-full overflow-hidden mt-[var(--px-3)] outline outline-white outline-dotted">
                                                <div
                                                    className="h-full bg-white rounded-full transition-all duration-300"
                                                    style={{ width: `${track.score * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end w-[var(--px-80)] gap-[var(--px-20)]" role="cell">
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
                                        <div
                                            className="ml-[var(--px-30)] w-[var(--px-40)] flex items-center justify-center hover:cursor-pointer playlist-sonic-discovery-button"
                                            role="cell"
                                            onClick={() => {
                                                window.open(`${BASE_BETA_URL}/?id=${track.id}`, '_blank');
                                            }}
                                            id={`playlist-table-sonic-discovery-${track.id}`}
                                            data-track-id={track.id}
                                            data-track-artist={track.artist}
                                            data-track-title={track.title}
                                            data-track-name={track.title}
                                        >
                                            <Tooltip message="Use this track as a new reference to find more matches">
                                                <img src={SonicDiscoverySvg} draggable={false} alt="Sonic Discovery" aria-label="Sonic Discovery" className="w-[var(--px-16)] h-[var(--px-16)] hover:scale-110 transition-transform duration-200" />
                                            </Tooltip>
                                        </div>
                                    </div>
                                    {currentTrackId === track.id && isPlaying && (
                                        <SimilarityPlayer
                                            trackId={track.id}
                                            isPlaying={currentTrackId === track.id && isPlaying}
                                            totalDuration={track.duration}
                                        />
                                    )}
                                </div>
                            </div>
                            {/* Creative Commons License Icons - Bottom Right */}
                            <div className="absolute right-[var(--px-5)] bottom-[var(--px-3)]">
                                <CCLicenseGroup size={7} />
                            </div>
                        </div>
                    </div>
                );
            })}
            <div className="flex flex-col w-[var(--px-880)] h-auto justify-between mt-[var(--px-40)] w-full items-center justify-center gap-[var(--px-20)]">
                <img src={TrackSelectSeparatorLine} aria-hidden="true" loading="lazy" draggable={false} alt="track_select_separator_line" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center leading-[var(--px-30)]">
                    Matched by PYXIS-1<br />
                    {footerResultCount} results{footerTopMatch ? ` | Top match: ${footerTopMatch}` : ''}{footerAnalysisTime ? ` | Analysis: ${footerAnalysisTime}` : ''}
                </div>
                <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves" className="w-[var(--px-40)] h-[var(--px-40)] my-[var(--px-10)]" />
            </div>
        </div>
    );
};

export default PlaylistTable;
