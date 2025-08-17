import React from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause_black.svg";
import { usePlayerStore } from "@resomix/stores";

interface InputPlayerProps {
    trackId?: string;
    audioUrl?: string;
    /** Auto-start playback once ready */
    autoPlay?: boolean;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, audioUrl, autoPlay = false }) => {
    // Use a fallback id for local uploads so we always have a string
    const effectiveId = trackId ?? 'uploaded-local';

    const { currentTrackId, setCurrentTrack } = usePlayerStore();
    const isPlaying = currentTrackId === effectiveId;

    // When autoPlay requested, register this track on mount
    React.useEffect(() => {
        if (autoPlay && currentTrackId == null) {
            setCurrentTrack(effectiveId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const togglePlay = () => {
        if (isPlaying) {
            setCurrentTrack(null);
        } else {
            setCurrentTrack(effectiveId);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className="w-[var(--px-35)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors"
                onClick={togglePlay}
            >
                <img
                    src={isPlaying ? PauseSvg : PlaySvg}
                    alt={isPlaying ? 'Pause' : 'Play'}
                    className={isPlaying ? 'w-[var(--px-16)] h-[var(--px-16)]' : 'w-[var(--px-24)] h-[var(--px-24)]'}
                />
            </button>
            <WaveformPlayer trackId={trackId} audioUrl={audioUrl} isPlaying={isPlaying} autoPlay={autoPlay} />
        </div>
    );
};

export default InputPlayer;
