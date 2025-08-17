import React, { useRef, useEffect, useMemo } from "react";
import { useWaveform } from "@resomix/hooks";
import type { WaveformTheme } from "@resomix/hooks";

interface WaveformPlayerProps {
    /** Track ID used to pull peaks & stream from the API. */
    trackId?: string;
    /** Direct audio URL (e.g. result of URL.createObjectURL) to load instead
     * of an API track. When provided, `trackId` is ignored.
     */
    audioUrl?: string;
    theme?: WaveformTheme;
    /**
     * Whether the player should currently be playing. When this value changes
     * we synchronise the underlying WaveSurfer instance so that it either
     * begins playback or pauses.
     */
    isPlaying?: boolean;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ 
    trackId,
    audioUrl,
    theme = {
        textSecondary: '#ffffff',
        primary: '#ffffff',
        cardBg: '#000000'
    },
    isPlaying
}) => {
    const waveformRef = useRef<HTMLDivElement>(null);

    // Keep a stable theme reference across renders to avoid re-creating
    // WaveSurfer unnecessarily (which would wipe the canvas).
    const memoTheme = useMemo<WaveformTheme>(() => theme as WaveformTheme, [
        theme.textSecondary,
        theme.primary,
        theme.cardBg,
    ]);

    /* eslint-disable no-console */
    console.log('[WaveformPlayer] render', { trackId, audioUrl, isPlaying });
    /* eslint-enable no-console */

    // Initialize wavesurfer via the shared hook. We also keep a ref to the
    // underlying WaveSurfer instance so that we can imperatively control
    // playback from the parent component via the `isPlaying` prop.
    const { state, wavesurferRef } = useWaveform({ 
        containerRef: waveformRef, 
        trackId, 
        audioUrl,
        theme: memoTheme
    });

    // Log state updates for this particular player
    useEffect(() => {
        /* eslint-disable no-console */
        console.log('[WaveformPlayer] state update', state);
        /* eslint-enable no-console */
    }, [state]);

    // Synchronise playback state whenever the `isPlaying` prop changes.
    useEffect(() => {
        if (!wavesurferRef.current) return;

        if (isPlaying) {
            // Only call play if not already playing to prevent resetting
            if (!wavesurferRef.current.isPlaying()) {
                wavesurferRef.current.play();
            }
        } else {
            wavesurferRef.current.pause();
        }
    }, [isPlaying]);

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
        <div className="w-full relative z-30" style={{ height: 100 }}>
            <div ref={waveformRef} className="w-full h-full" />
        </div>
    );
};

export default WaveformPlayer;
