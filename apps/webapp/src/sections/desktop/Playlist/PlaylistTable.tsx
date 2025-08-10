import React from "react";
import { SimilarityPlayer, ThumbIcon } from "@/components/index.ts";
import { IconComp } from "@resomix/ui";
import { formatDuration, formatPercentage } from "@resomix/hooks";
import PlaySvg from "@/assets/icons/play.svg";

const SimilarityTrackStatus = "Loading..."
const PlaylistResult = {
    "success": true,
    "data": {
        "queried_track": {
            "rank": 0,
            "score": 1.0,
            "id": "1a9983daf38caac5a8e8adaf",
            "title": "Ursa Minor (Marcel Dettmann Remix)",
            "year": 2025,
            "duration": 271,
            "label": "Break New Soil Recordings",
            "artist": "Gregor Tresher, Petar Dundov"
        },
        "similar_tracks": [
            {
                "rank": 1,
                "score": 0.95250189,
                "id": "67adb0d5799206f8d65102a8",
                "title": "Chapter 1",
                "year": 2023,
                "duration": 301,
                "label": "Abstract Mechanisms",
                "artist": "Møntero"
            },
            {
                "rank": 2,
                "score": 0.94865525,
                "id": "67add9769387d00fbdc2dc3d",
                "title": "Opto",
                "year": null,
                "duration": 335,
                "label": "Balance Music",
                "artist": "Etapp Kyle"
            }
        ],
        "playlist": {
            "id": "7b821bef-e168-4511-8525-5e1664b7e483",
            "name": "Gregor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
        }
    }
}

const PlaylistTable: React.FC = () => {
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
            {PlaylistResult.data.similar_tracks.map((track) => (
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
                                <ThumbIcon onClick={() => { }} className="w-[var(--px-16)] h-[var(--px-16)] text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] hover:cursor-pointer" />
                                <ThumbIcon onClick={() => { }} className="w-[var(--px-16)] h-[var(--px-16)] text-[var(--color-primary-hover)] transform rotate-180 hover:text-[var(--color-primary)] hover:cursor-pointer" />
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
