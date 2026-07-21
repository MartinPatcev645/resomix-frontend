import React, { useCallback, useEffect, useRef, useState } from "react";
import { SimilarityPlayer } from "@/components/index.ts";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import { formatDuration, formatPercentage, useGlobalAudioController, useAccess } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { HoverFlow, ButtonSleek } from "@resomix/ui";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";
import PauseSvg from "@/assets/icons/pause_white.svg";
import MoreSvg from "@/assets/icons/more.svg";
import { DEMO_MODE } from "@resomix/config";
import { resolveLabel, firstGenre, displayOrNA } from "@/utils/trackUtils.ts";
import { loadPlaylistAnalysis } from "@/utils/playlistAnalysis.ts";

interface PlaylistTableProps {
    onMoreClick?: (trackId: string, name: string, label: string, duration: number, score: number, isInput?: boolean) => void;
}

const PlaylistTable: React.FC<PlaylistTableProps> = ({ onMoreClick }) => {
    const { playlistData } = usePlaylistStore();
    const tracks = playlistData?.similar_tracks ?? [];

    // Result-unlock teasing through the single source of truth (same contract as desktop).
    // While unsettled: fail-CLOSED (guest default stays blurred) and the upsell card is withheld.
    const access = useAccess();
    const { trigger: triggerCta } = useEntitlementCta();
    const maxUnlocked = access.unlockedTracks;
    const ctaCardRank = access.teaseReady ? access.unlockedTracks + 2 : -1;
    const isGuest = access.isGuestForCopy;
    const maxTracksPerPlaylist = access.unlockedTracks;

    // --- Analysis footer stats ---
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

    return (
        <div className="flex flex-col items-center justify-start w-full gap-[var(--px-10)] mt-[var(--px-25)]" role="table" aria-label="Similar tracks">
            <h2 className="sr-only">Similar Tracks</h2>
            {tracks.map((track) => {
                const isRestricted = track.rank > maxUnlocked;
                return (
                    <div key={track.id} className="relative w-full">
                        {track.rank === ctaCardRank && isRestricted && (
                            <div className="absolute z-50 left-0 w-full flex flex-col items-center justify-center px-[var(--px-20)] pt-[var(--px-20)] pointer-events-auto">
                                <div className="bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-30)] pb-[var(--px-30)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center max-w-[var(--px-350)] w-full">
                                    <h3 className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)] text-center">
                                        Unlock all matching tracks
                                    </h3>
                                    <p className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] text-center text-white mb-[var(--px-20)]">
                                        {isGuest
                                            ? `Guest access includes the first ${maxTracksPerPlaylist} results. Create a free account or log in to view the complete similarity list and save your playlist.`
                                            : `Your plan includes the first ${maxTracksPerPlaylist} results. Subscribe to unlock the complete similarity list.`}
                                    </p>
                                    <div className="flex flex-col gap-[var(--px-10)] items-center w-full">
                                        {isGuest ? (
                                            <>
                                                <ButtonSleek text="Create Free Account" href="/auth/register" onClick={() => {}} />
                                                <ButtonSleek text="Log In" href="/auth/login" onClick={() => {}} transparent />
                                            </>
                                        ) : (
                                            <ButtonSleek text="Subscribe" onClick={() => triggerCta("subscribe")} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {isRestricted && <div className="absolute inset-0 backdrop-blur-md bg-black/20 z-0 transform-gpu" style={{ WebkitBackdropFilter: 'blur(12px)' }} />}
                        <div className={isRestricted ? "pointer-events-none select-none blur-xs relative z-10" : ""}>
                            <div
                                className={`w-full border border-dotted border-slate-200 flex justify-between p-[var(--px-5)] pb-[var(--px-18)] relative`}
                                role="row"
                            >
                                <div className="flex flex-col w-full">
                                    <button
                                        type="button"
                                        aria-label="PlayPause"
                                        name="PlayPause"
                                        onClick={() => handlePlayButtonClick(track.id)}
                                        className="flex items-center gap-[var(--px-7)] playlist-play-button"
                                        id={`playlist-table-play-button-${track.id}`}
                                        role="cell"
                                        data-track-id={track.id}
                                        data-track-artist={track.artist}
                                        data-track-title={track.title}
                                    >
                                        {DEMO_MODE && hintFor === track.id && (
                                            <div
                                                role="status"
                                                aria-live="polite"
                                                className="pointer-events-none absolute -top-6 left-2 whitespace-nowrap bg-[#FFCC00] text-black text-[length:var(--px-10)] font-semibold px-2 py-1 rounded shadow-md ring-2 ring-black/10 z-20"
                                            >
                                                Demo mode - Audio playback limited while we complete licensing
                                            </div>
                                        )}
                                        <div className="min-w-[var(--px-40)] h-[var(--px-40)] relative">
                                            {DEMO_MODE && hintFor === track.id && (
                                                <span
                                                    aria-hidden="true"
                                                    className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-[#FFCC00] animate-pulse z-10"
                                                />
                                            )}
                                            <div className="w-[var(--px-36)] h-[var(--px-36)] m-[var(--px-2)] flex items-center justify-center border-3 rounded-md border-[var(--color-light-theme)] relative z-20">
                                                <span className="text-[length:var(--px-15)] font-fira font-light text-[var(--color-primary)] relative z-0">
                                                    {track.rank}
                                                </span>
                                                {currentTrackId === track.id && isPlaying && (
                                                    <div className="absolute inset-1 bg-black/80 rounded-sm z-10"></div>
                                                )}
                                            </div>
                                            {currentTrackId === track.id && isPlaying && (
                                                <img
                                                    src={PauseSvg}
                                                    alt="Play"
                                                    className="absolute inset-0 w-[var(--px-16)] h-[var(--px-16)] m-auto z-30"
                                                />
                                            )}
                                        </div>
                                        <TrackArtwork artworkUrl={track.artwork_url} className="w-[var(--px-40)] h-[var(--px-40)] rounded-md mr-[var(--px-6)]" />
                                        {/* flex-1 + min-w-0 (not a fixed width): the column takes the space
                                            left after the rank/artwork and can SHRINK, so `truncate` on the
                                            rows below actually clips instead of overflowing the card. pr keeps
                                            every row clear of the absolute More button pinned top-right. */}
                                        <div className="flex flex-col flex-1 min-w-0 pr-[var(--px-24)] gap-[var(--px-2)]" role="cell">
                                            <div className="w-full min-w-0 overflow-hidden">
                                                <div className="select-none text-[length:var(--px-13)] lg:text-[length:var(--px-11)] font-helvetica font-light tracking-[var(--px-0-1)] leading-[var(--px-14)] uppercase text-left truncate w-full">
                                                    {currentTrackId === track.id && isPlaying ? (
                                                        <HoverFlow
                                                            text={displayOrNA(track.title)}
                                                            maxChars={32}
                                                            delay={800}
                                                            speed={40}
                                                            endPause={1000}
                                                            maxWidth="100%"
                                                            flowAlways={true}
                                                        />
                                                    ) : (
                                                        displayOrNA(track.title)
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full min-w-0 overflow-hidden" role="cell">
                                                <div className="select-none text-[length:var(--px-8)] font-helvetica font-light tracking-[var(--px-0-1)] text-left leading-[var(--px-9)] truncate w-full">
                                                    {displayOrNA(track.artist)}
                                                </div>
                                            </div>
                                            {/* year | score+bar | duration — clean 3-zone justify-between (no
                                                nested wrapper, no ml-60), so the score bar sits centered and
                                                becomes the anchor the label lines up under below. */}
                                            <div className="w-full flex items-center justify-between gap-[var(--px-6)]">
                                                <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-9)] flex items-center shrink-0" role="cell">
                                                    {track.year ?? ''}
                                                </div>
                                                <div className="flex items-center shrink-0" role="cell">
                                                    <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] leading-[var(--px-7)]">
                                                        {formatPercentage(track.score, 0)}
                                                    </div>
                                                    <div className="w-[var(--px-30)] h-[var(--px-3)] bg-transparent rounded-full overflow-hidden ml-[var(--px-5)] outline outline-white outline-dotted">
                                                        <div
                                                            className="h-full bg-white rounded-full transition-all duration-300"
                                                            style={{ width: `${track.score * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-right leading-[var(--px-7)] flex items-center shrink-0" role="cell">
                                                    {formatDuration(track.duration)}
                                                </div>
                                            </div>
                                            {/* Genre (left) · Label (centered under the score bar) · spacer.
                                                A 3-column grid of equal thirds: the label lives in the MIDDLE
                                                cell so it's pinned dead-center of the column no matter how long
                                                the genre or label is — the empty right third balances the left
                                                genre third. Each value truncates inside its own third (fixed
                                                length). Captions render only with a value; the whole row is
                                                skipped when both are absent. */}
                                            {(firstGenre(track.genre) || resolveLabel(track.label)) && (
                                                <div className="w-full grid grid-cols-3 items-center gap-[var(--px-6)] text-[length:var(--px-7)] font-fira font-light tracking-[var(--px-0-5)] leading-[var(--px-9)]">
                                                    <div className="flex items-center gap-[var(--px-3)] min-w-0 justify-self-start" role="cell">
                                                        {firstGenre(track.genre) && (
                                                            <>
                                                                <span className="text-[var(--color-primary-hover)] opacity-70 shrink-0">GENRE</span>
                                                                <span className="text-[var(--color-primary)] truncate min-w-0" title={firstGenre(track.genre)}>
                                                                    {firstGenre(track.genre)}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-center gap-[var(--px-3)] min-w-0" role="cell">
                                                        {resolveLabel(track.label) && (
                                                            <>
                                                                <span className="text-[var(--color-primary-hover)] opacity-70 shrink-0">LABEL</span>
                                                                <span className="text-[var(--color-primary)] truncate min-w-0" title={resolveLabel(track.label)}>
                                                                    {resolveLabel(track.label)}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div aria-hidden="true" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    {currentTrackId === track.id && isPlaying && (
                                        <div>
                                            <SimilarityPlayer trackId={track.id} isPlaying={currentTrackId === track.id} totalDuration={track.duration} appleDeepLinkUrl={track.deep_link_url} />
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    aria-label="More"
                                    name="More"
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
                                    className="absolute right-[var(--px-8)] top-[var(--px-8)] pb-[25px] select-none text-[#5C5C5C] playlist-more-button"
                                    id={`playlist-table-more-${track.id}`}
                                    data-track-id={track.id}
                                    data-track-artist={track.artist}
                                    data-track-title={track.title}
                                >
                                    <img src={MoreSvg} draggable={false} aria-label="More" alt="More" className="w-[var(--px-19)] h-[var(--px-14)]" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
            <div className="flex flex-col w-[var(--px-880)] h-auto justify-between w-full items-end justify-end">
                <div className="text-[length:var(--px-8)] font-helvetica opacity-80 font-light tracking-[var(--px-1)] text-end leading-[var(--px-30)] border-b border-dotted border-slate-200">
                    Matched by PYXIS-1 : {footerResultCount} results{footerTopMatch ? ` | Top match: ${footerTopMatch}` : ''}{footerAnalysisTime ? ` | Analysis: ${footerAnalysisTime}` : ''}
                </div>
            </div>
        </div>
    );
};

export default PlaylistTable;
