import React, { useRef } from "react";
import { useWaveform } from "@resomix/hooks";
import type { WaveformTheme } from "@resomix/hooks";

interface WaveformPlayerProps {
    trackId?: string;
    audioUrl?: string;
    theme?: WaveformTheme;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ 
    trackId,
    audioUrl, 
    theme = {
        textSecondary: '#666666',
        primary: '#007bff',
        cardBg: '#000000'
    }
}) => {
    const waveformRef = useRef<HTMLDivElement>(null);

    // Initialize wavesurfer via the shared hook
    const { state } = useWaveform({ 
        containerRef: waveformRef, 
        trackId, 
        audioUrl, 
        theme: theme as WaveformTheme
    });

    // Show loading state while fetching peaks
    if (state.isLoading) {
        return (
            <div className="w-full h-[100px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">
                    Fetching the track for you...
                </div>
            </div>
        );
    }

    // Show error state if peaks fetch failed
    if (state.error) {
        return (
            <div className="w-full h-[100px] flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded">
                <div className="text-red-600 dark:text-red-400 text-sm">
                    {state.error}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div ref={waveformRef} className="w-full" />
        </div>
    );
};

export default WaveformPlayer;
