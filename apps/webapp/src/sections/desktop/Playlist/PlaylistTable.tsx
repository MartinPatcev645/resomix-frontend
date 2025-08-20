import React from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { IconComp, Tooltip } from "@resomix/ui";
import { formatDuration, formatPercentage } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { rateTrack } from "@resomix/api-client";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import SonicDiscoverySvg from "@/assets/icons/sonic_discovery.svg";
import { usePlayerManager } from "@resomix/hooks";
import { BASE_BETA_URL } from "@resomix/config";

// Remove local dummy data; use global store

const PlaylistTable: React.FC = () => {
    const { playlistData, trackRatings = {}, setTrackRating } = usePlaylistStore();
    const { currentTrackId, startPlaying, stopPlaying } = usePlayerManager();

    const handlePlayPause = (trackId: string) => {
        if (currentTrackId === trackId) {
            stopPlaying(); // Pause
        } else {
            startPlaying(trackId); // Play this track, pause others
        }
    };

    const tracks = playlistData?.similar_tracks ?? [];

    const handleTrackRating = async (trackId: string, rating: number) => {
        try {
            const playlistId = playlistData?.playlist.id || null;
            await rateTrack(trackId, rating, playlistId);
            setTrackRating(trackId, rating);
            // You could add a success notification here if needed
        } catch (error) {
            console.error('Failed to rate track:', error);
            // You could add an error notification here if needed
        }
    };

    return (
        <div className="flex flex-col items-center justify-center -mt-[var(--px-30)] w-[var(--px-763)] ml-[var(--px-230)] gap-[var(--px-10)]">
            {/* Header */}
            <div className="flex tracking-[var(--px-0-1)] text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] items-center w-full uppercase px-[var(--px-12)] mb-[var(--px-10)]">
                <div className="">#</div>
                <div className="mx-[var(--px-85)]">Artist</div>
                <div className="mx-[var(--px-30)]">Title</div>
                <div className="ml-[var(--px-85)] flex flex-col items-center">
                    <span className="text-[var(--color-primary-hover)]">Label</span>
                    Year
                </div>
                <div className="ml-[var(--px-60)]">Duration</div>
                <div className="ml-[var(--px-20)]">Score</div>
                <div className="ml-[var(--px-50)]">Similar?</div>
                <div className="ml-[var(--px-30)]">Get Sonic<br />Discovery</div>
            </div>
            {/* Table */}
            {tracks.map((track) => (
                <div key={track.id} className="w-full bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between px-[var(--px-10)] py-[var(--px-14)]">
                    <div className="flex flex-col w-full">
                        <div key={track.id} className="flex items-center">
                            <div className="text-[length:var(--px-10)] font-fira font-light mr-[var(--px-5)]">
                                {track.rank}
                            </div>
                            <IconComp
                                className="mx-[var(--px-10)] w-[var(--px-16)] h-[var(--px-16)] px-[var(--px-1)]"
                                svg={<img
                                    src={currentTrackId === track.id ? PauseSvg : PlaySvg}
                                    alt={currentTrackId === track.id ? "Pause" : "Play"}
                                    className='w-[var(--px-10)] h-[var(--px-10)]'
                                />}
                                padding='py-[var(--px-3)] px-[var(--px-4)]'
                                onClick={() => handlePlayPause(track.id)}
                            />
                            <div className="text-[length:var(--px-10)] font-helvetica text-[var(--color-primary-hover)] font-light tracking-[var(--px-0-1)] uppercase text-center mx-[var(--px-5)] w-[var(--px-120)]">
                                {track.artist}
                            </div>
                            <div className="text-[length:var(--px-10)] font-helvetica font-light tracking-[var(--px-0-1)] uppercase text-center mx-[var(--px-5)] w-[var(--px-140)]">
                                {track.title}
                            </div>
                            <div className="text-[length:var(--px-7)] font-fira font-light tracking-[var(--px-0-1)] text-center mx-[var(--px-5)] w-[var(--px-130)] flex flex-col items-center gap-[var(--px-3)]">
                                <span className="text-[var(--color-primary-hover)] text-[length:var(--px-9)]">
                                    {track.label}
                                </span>
                                {track.year}
                            </div>
                            <div className="text-[length:var(--px-9)] font-fira font-light tracking-[var(--px-0-1)] text-center ml-[var(--px-5)] mr-[var(--px-5)] w-[var(--px-40)]">
                                {formatDuration(track.duration)}
                            </div>
                            <div className="text-[length:var(--px-9)] font-fira font-light tracking-[var(--px-0-1)] text-center text-[var(--color-primary-hover)] mx-[var(--px-10)] w-[var(--px-40)]">
                                {formatPercentage(track.score)}
                            </div>
                            <div className="flex items-center justify-end w-[var(--px-80)] gap-[var(--px-20)]">
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
                                                    className={`w-[var(--px-16)] h-[var(--px-16)] ${upSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary-hover)]'} hover:text-[var(--color-primary)] hover:cursor-pointer`}
                                                />
                                            </Tooltip>
                                            <Tooltip message="No, Not Similar to Input Track!">
                                                <ThumbIcon
                                                    onClick={() => {
                                                        if (downSelected) return;
                                                        handleTrackRating(track.id, 0);
                                                    }}
                                                    className={`w-[var(--px-16)] h-[var(--px-16)] transform rotate-180 ${downSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary-hover)]'} hover:text-[var(--color-primary)] hover:cursor-pointer`}
                                                />
                                            </Tooltip>
                                        </>
                                    );
                                })()}
                            </div>
                            <div className="ml-[var(--px-30)] w-[var(--px-40)] flex items-center justify-center hover:cursor-pointer" onClick={() => {
                                window.location.href = `${BASE_BETA_URL}/?id=${track.id}`;
                            }}>
                                <Tooltip message="Find Similarity For this Track!">
                                    <img src={SonicDiscoverySvg} alt="Sonic Discovery" className="w-[var(--px-16)] h-[var(--px-16)]" />
                                </Tooltip>
                            </div>
                        </div>
                        {currentTrackId === track.id && (
                            <SimilarityPlayer
                                trackId={track.id}
                                isPlaying={currentTrackId === track.id}
                                totalDuration={track.duration}
                            />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PlaylistTable;
