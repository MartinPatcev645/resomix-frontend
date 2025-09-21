import { useState } from "react";

export default function TestTwo() {
    const [isPlaying, setIsPlaying] = useState(false);

    // Using backend track id to demo fast peaks load

    return (
        <div className="w-screen h-screen bg-[var(--color-primary-background)] text-[var(--color-primary)] flex flex-col gap-[var(--px-20)] p-[var(--px-40)]">

            <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] rounded" onClick={() => setIsPlaying(p => !p)}>
                {isPlaying ? "Pause" : "Play"}
            </button>
        </div>
    );
}

