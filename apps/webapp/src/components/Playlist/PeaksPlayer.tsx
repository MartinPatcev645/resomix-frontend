import { useRef, useEffect } from "react";
import { usePeaks } from "@resomix/hooks";

interface PeaksPlayerProps {
    /** Direct audio URL (takes precedence over trackId) */
    audioUrl?: string;
    /** Backend track UUID to resolve signed audio + peaks */
    trackId?: string;
    /** Height of the waveform */
    height?: number;
    /** Whether currently playing */
    isPlaying?: boolean;
}

const PeaksPlayer = ({ audioUrl, trackId, height = 150, isPlaying }: PeaksPlayerProps) => {
    const overviewRef = useRef<HTMLDivElement>(null);
    const { audioRef, isReady } = usePeaks({ audioUrl, trackId, overviewRef, height });

    // Control playback via isPlaying prop
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.play().catch(() => {/* ignore */});
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    return (
        <div className="w-full flex flex-col items-stretch">
            {/* Hidden media element controlled by Peaks */}
            <audio ref={audioRef} className="hidden" />
            <div
                ref={overviewRef}
                className="w-full" 
                style={{ height }}
            />
            {!isReady && (
                <div className="text-center text-sm text-gray-400 mt-2">Loading waveform…</div>
            )}
        </div>
    );
};

export default PeaksPlayer;
