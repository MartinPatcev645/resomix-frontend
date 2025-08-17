import React from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause_black.svg";
import { usePlayerStore } from "@resomix/stores";

interface InputPlayerProps {
    trackId?: string;
    audioUrl?: string;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, audioUrl }) => {
    // Use a fallback id for local uploads so we always have a string
    const effectiveId = trackId ?? 'uploaded-local';

    const { currentTrackId, setCurrentTrack } = usePlayerStore();
    const isPlaying = currentTrackId === effectiveId;

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
            <WaveformPlayer trackId={trackId} audioUrl={audioUrl} isPlaying={isPlaying} />
        </div>
    );
};

export default InputPlayer;
