import React from "react";
import { WaveformPlayer } from "@/components/index.ts";
import { formatDuration, formatPercentage } from "@resomix/hooks";
import PlaySvg from "@/assets/icons/play.svg";
import TrackSvg from "@/assets/icons/track_2.svg";

// const SimilarityTrackStatus = "Loading..."
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
        <div className="flex flex-col items-center justify-start w-full gap-[var(--px-10)] mt-[var(--px-25)]">
            {PlaylistResult.data.similar_tracks.map((track) => (
                <div className="w-full bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between p-[var(--px-5)]">
                    <div className="flex flex-col w-full">
                        <div key={track.id} className="flex items-center gap-[var(--px-7)]">
                            <div className="min-w-[var(--px-40)] h-[var(--px-40)]">
                                <img src={TrackSvg} alt="Track" className="w-[var(--px-40)] h-[var(--px-40)]" />
                                <img src={PlaySvg} alt="Play" className="w-[var(--px-16)] h-[var(--px-16)] hidden" />
                            </div>
                            <div className="flex flex-col w-[var(--px-290)] gap-[var(--px-2)]">
                                <div className="w-full">
                                    <div className="text-[length:var(--px-11)] font-helvetica font-light tracking-[var(--px-0-1)] leading-[var(--px-11)] uppercase text-left truncate max-w-[var(--px-250)]">
                                        {track.title}
                                    </div>
                                </div>
                                <div className="w-full">
                                    <div className="text-[length:var(--px-8)] font-helvetica text-[var(--color-primary-hover)] font-light tracking-[var(--px-0-1)] uppercase text-left leading-[var(--px-8)] truncate max-w-[var(--px-250)]">
                                        {track.artist}
                                    </div>
                                </div>
                                <div className="w-full flex items-center justify-between">
                                    <div className="text-[length:var(--px-5-5)] text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-7)] flex items-center gap-[var(--px-3)]">
                                        {track.label} {track.year ? `- ${track.year}` : ''}
                                    </div>
                                    <div className="text-[length:var(--px-5-5)] text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-7)] flex items-center gap-[var(--px-3)]">
                                        {formatPercentage(track.score, 0)}
                                    </div>
                                    <div className="text-[length:var(--px-5-5)] text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-7)] flex items-center gap-[var(--px-3)]">
                                        {formatDuration(track.duration)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="hidden"><WaveformPlayer /></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PlaylistTable;
