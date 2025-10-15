import { SimilarityPlayer } from "@/components/index.ts";
import { formatDuration, formatPercentage, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { HoverFlow } from "@resomix/ui";
import PauseSvg from "@/assets/icons/pause_white.svg";
import MoreSvg from "@/assets/icons/more.svg";

interface PlaylistTableProps {
    onMoreClick?: (trackId: string, name: string, label: string, duration: number, score: number, isInput?: boolean) => void;
}

const PlaylistTable: React.FC<PlaylistTableProps> = ({ onMoreClick }) => {
    const { playlistData } = usePlaylistStore();
    const tracks = playlistData?.similar_tracks ?? [];
    const hlsController = useGlobalAudioController();
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isPlaying: boolean = usePlayerStore(s => s.isPlaying);

    const handlePlayPause = (trackId: string) => {
        if (currentTrackId === trackId && isPlaying) {
            hlsController.stop();
        } else {
            hlsController.load(trackId, true);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start w-full gap-[var(--px-10)] mt-[var(--px-25)]">
            {tracks.map((track) => (
                <div key={track.id} className="w-full bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between p-[var(--px-5)] relative">
                    <div className="flex flex-col w-full">
                        <div onClick={() => handlePlayPause(track.id)} className="flex items-center gap-[var(--px-7)] playlist-play-button" id={`playlist-table-play-button-${track.id}`}>
                            <div className="min-w-[var(--px-40)] h-[var(--px-40)] relative">
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
                            <div className="flex flex-col w-[var(--px-290)] gap-[var(--px-2)]">
                                <div className="w-full">
                                    <div className="text-[length:var(--px-13)] lg:text-[length:var(--px-11)] font-helvetica font-light tracking-[var(--px-0-1)] leading-[var(--px-14)] uppercase text-left truncate max-w-[var(--px-250)]">
                                        {currentTrackId === track.id && isPlaying ? (
                                            <HoverFlow
                                                text={track.title}
                                                maxChars={32}
                                                delay={800}
                                                speed={40}
                                                endPause={1000}
                                                maxWidth="250px"
                                                flowAlways={true}
                                            />
                                        ) : (
                                            track.title
                                        )}
                                    </div>
                                </div>
                                <div className="w-full">
                                    <div className="text-[length:var(--px-8)] font-helvetica font-light tracking-[var(--px-0-1)] text-left leading-[var(--px-9)] truncate max-w-[var(--px-250)]">
                                        {track.artist}
                                    </div>
                                </div>
                                <div className="w-full flex items-center justify-between">
                                    <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-9)] flex items-center gap-[var(--px-3)]">
                                        {track.label} {track.year ? `- ${track.year}` : ''}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-7)] flex items-center gap-[var(--px-3)]">
                                                {formatPercentage(track.score, 0)}
                                            </div>
                                            {/* Display the bar here */}
                                            <div className="w-[var(--px-30)] h-[var(--px-3)] bg-transparent rounded-full overflow-hidden ml-[var(--px-5)] outline outline-white outline-dotted">
                                                <div
                                                    className="h-full bg-white rounded-full transition-all duration-300"
                                                    style={{ width: `${track.score * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] text-[var(--color-primary)] lg:text-[var(--color-primary-hover)] font-fira font-light tracking-[var(--px-0-5)] text-left leading-[var(--px-7)] flex items-center gap-[var(--px-3)] ml-[var(--px-60)]">
                                            {formatDuration(track.duration)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {currentTrackId === track.id && isPlaying && (
                            <div>
                                <SimilarityPlayer trackId={track.id} isPlaying={currentTrackId === track.id} totalDuration={track.duration} />
                            </div>
                        )}
                    </div>
                    <div onClick={() => onMoreClick?.(
                        track.id,
                        `${track.artist} - ${track.title}`,
                        track.label,
                        track.duration,
                        track.score,
                        false)} className="absolute right-[var(--px-8)] top-[var(--px-8)] pb-[25px] select-none text-[#5C5C5C] playlist-more-button" id={`playlist-table-more-${track.id}`}>
                        <img src={MoreSvg} draggable={false} aria-label="More" alt="More" className="w-[var(--px-19)] h-[var(--px-14)]" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PlaylistTable;
