import { useState } from "react";
import PeaksPlayer from "@/components/Playlist/PeaksPlayer.tsx";

export default function TestTwo() {
    const [isPlaying, setIsPlaying] = useState(false);

    // Using backend track id to demo fast peaks load
    const trackId = "67ad9cec799206f8d64acdf1";

    return (
        <div className="w-screen h-screen bg-[var(--color-primary-background)] text-[var(--color-primary)] flex flex-col gap-[var(--px-20)] p-[var(--px-40)]">
            <div className="max-w-[var(--px-500)] h-[var(--px-100)] bg-[var(--color-secondary)] overflow-hidden">
                <PeaksPlayer trackId={trackId} isPlaying={isPlaying} height={80} />
            </div>

            <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] rounded" onClick={() => setIsPlaying(p => !p)}>
                {isPlaying ? "Pause" : "Play"}
            </button>
        </div>
    );
}

