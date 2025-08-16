import React from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { IconComp } from "@resomix/ui";
import { formatDuration, formatPercentage } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { rateTrack } from "@resomix/api-client";
import PlaySvg from "@/assets/icons/play.svg";

// Remove local dummy data; use global store

const PlaylistTable: React.FC = () => {
    const { playlistData } = usePlaylistStore();

    const tracks = playlistData?.similar_tracks ?? [];

    const handleTrackRating = async (trackId: string, rating: number) => {
        try {
            const playlistId = playlistData?.playlist.id || null;
            await rateTrack(trackId, rating, playlistId);
            // You could add a success notification here if needed
        } catch (error) {
            console.error('Failed to rate track:', error);
            // You could add an error notification here if needed
        }
    };

    return (
        <div className="flex flex-col items-center justify-center -mt-[var(--px-30)] w-[var(--px-700)] mx-auto gap-[var(--px-10)]">
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
            </div>
            {/* Table */}
            {tracks.map((track) => (
                <div className="w-full bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between px-[var(--px-10)] py-[var(--px-14)]">
                    <div className="flex flex-col w-full">
                        <div key={track.id} className="flex items-center">
                            <div className="text-[length:var(--px-10)] font-fira font-light mr-[var(--px-5)]">
                                {track.rank}
                            </div>
                            <IconComp
                                className="mx-[var(--px-10)] w-[var(--px-16)] h-[var(--px-16)] px-[var(--px-1)]"
                                svg={<img src={PlaySvg} alt="Play" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                                padding="pt-[var(--px-1)]"
                                onClick={() => { }}
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
                                <ThumbIcon
                                    onClick={() => handleTrackRating(track.id, 1)}
                                    className="w-[var(--px-16)] h-[var(--px-16)] text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] hover:cursor-pointer"
                                />
                                <ThumbIcon
                                    onClick={() => handleTrackRating(track.id, 0)}
                                    className="w-[var(--px-16)] h-[var(--px-16)] text-[var(--color-primary-hover)] transform rotate-180 hover:text-[var(--color-primary)] hover:cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="hidden"><SimilarityPlayer /></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PlaylistTable;
