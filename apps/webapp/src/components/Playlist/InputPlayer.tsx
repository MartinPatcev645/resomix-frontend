import React, { useState } from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";

// inline SVG components for play/pause
const PlayIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-[var(--px-16)] h-[var(--px-16)]"
    >
        <path d="M5 3.87v16.26c0 .7.76 1.14 1.36.78l14.06-8.13a.9.9 0 0 0 0-1.56L6.36 3.09A.9.9 0 0 0 5 3.87Z" />
    </svg>
);

const PauseIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-[var(--px-16)] h-[var(--px-16)]"
    >
        <path d="M6 4.5h4v15H6zm8 0h4v15h-4z" />
    </svg>
);

interface InputPlayerProps {
    trackId: string;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <button
                className="py-[var(--px-8)] px-[var(--px-10)] w-[var(--px-35)] h-[var(--px-35)] bg-white text-black rounded-full hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                onClick={() => setIsPlaying(prev => !prev)}
            >
                {isPlaying ? PauseIcon : PlayIcon}
            </button>
            <WaveformPlayer
                trackId={trackId}
                isPlaying={isPlaying}
            />
        </div>
    );
};

export default InputPlayer;
