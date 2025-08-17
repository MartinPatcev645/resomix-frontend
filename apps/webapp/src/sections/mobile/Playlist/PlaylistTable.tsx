import React from "react";
import { WaveformPlayer } from "@/components/index.ts";
import { formatDuration, formatPercentage } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import PauseSvg from "@/assets/icons/pause.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import MoreSvg from "@/assets/icons/more.svg";

interface PlaylistTableProps {
  onMoreClick?: (trackId: string) => void;
}

const PlaylistTable: React.FC<PlaylistTableProps> = ({ onMoreClick }) => {
    const { playlistData } = usePlaylistStore();
    const { currentTrackId, setCurrentTrack } = usePlayerStore();
    const tracks = playlistData?.similar_tracks ?? [];

    const handleTrackClick = (trackId: string) => {
        if (currentTrackId === trackId) {
            setCurrentTrack(null);
        } else {
            setCurrentTrack(trackId);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start w-full gap-[var(--px-10)] mt-[var(--px-25)]">
            {tracks.map((track) => (
                <div key={track.id} className="w-full bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between p-[var(--px-5)] relative">
                    <div className="flex flex-col w-full">
                        <div onClick={() => handleTrackClick(track.id)} className="flex items-center gap-[var(--px-7)]">
                            <div className="min-w-[var(--px-40)] h-[var(--px-40)] relative">
                                <img src={TrackSvg} alt="Track" className="w-[var(--px-40)] h-[var(--px-40)]" />
                                {currentTrackId === track.id && (
                                    <>
                                        <div className="absolute inset-0 backdrop-blur-[3px] rounded-sm"></div>
                                        <img
                                            src={PauseSvg}
                                            alt="Play"
                                            className="absolute inset-0 w-[var(--px-16)] h-[var(--px-16)] m-auto z-10"
                                        />
                                    </>
                                )}
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
                        {currentTrackId === track.id && (
                            <div>
                                <WaveformPlayer trackId={track.id} isPlaying={currentTrackId===track.id} autoPlay={true} />
                            </div>
                        )}
                    </div>
                    <div onClick={() => onMoreClick?.(track.id)} className="absolute right-[var(--px-8)] top-[var(--px-8)] select-none text-[#5C5C5C]">
                        <img src={MoreSvg} alt="More" className="w-[var(--px-14)] h-[var(--px-10)]" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PlaylistTable;
