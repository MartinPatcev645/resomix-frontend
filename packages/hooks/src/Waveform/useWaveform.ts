import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { SERVER_MEDIA } from "@resomix/config";
import { getTrackPeaks } from "@resomix/api-client";

export interface WaveformTheme {
    textSecondary: string;
    primary: string;
    cardBg?: string;
}

export interface UseWaveformProps {
    containerRef: React.RefObject<HTMLElement | null>;
    trackId?: string;
    audioUrl?: string;
    theme: WaveformTheme;
}

export interface WaveformState {
    isLoading: boolean;
    error: string | null;
    peaks: number[] | null;
    duration: number | null;
}

/**
 * React hook that fetches peaks data and instantiates/manages a WaveSurfer instance.
 *
 * @param containerRef - Ref pointing to the container element where the waveform will be rendered.
 * @param trackId - Track ID to fetch peaks data for.
 * @param audioUrl - Optional direct audio URL (if not using trackId).
 * @param theme - Colors used for styling the waveform.
 *
 * The hook returns the waveform state and a ref with the underlying WaveSurfer instance.
 */
export function useWaveform({ containerRef, trackId, audioUrl, theme }: UseWaveformProps) {
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [state, setState] = useState<WaveformState>({
        isLoading: false,
        error: null,
        peaks: null,
        duration: null,
    });

    // Fetch peaks data when trackId changes
    useEffect(() => {
        if (!trackId || !SERVER_MEDIA) return;

        const fetchPeaks = async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));
            
            try {
                const { peaks, duration } = await getTrackPeaks(trackId);
                setState(prev => ({ ...prev, peaks, duration, isLoading: false }));
            } catch (error) {
                setState(prev => ({ 
                    ...prev, 
                    error: error instanceof Error ? error.message : 'Failed to fetch peaks',
                    isLoading: false 
                }));
            }
        };

        fetchPeaks();
    }, [trackId]);

    // Initialize WaveSurfer when peaks are loaded or audioUrl is provided
    useEffect(() => {
        if (!containerRef.current) return;
        if (state.isLoading) return;
        if (!state.peaks && !audioUrl) return;

        // Destroy a previous instance if it exists before creating a new one
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            responsive: true,
            backend: "MediaElement", // Use MediaElement for streaming URLs
            waveColor: `${theme.textSecondary}60`,
            progressColor: theme.primary,
            cursorColor: theme.primary,
            backgroundColor: theme.cardBg || "#000000",
            barWidth: 1,
            barHeight: 1,
            barMinHeight: 1,
            barGap: 1,
            cursorWidth: 2,
            height: 100,
            pixelRatio: 10,
            hideScrollbar: true,
            interact: true,
            // dragToSeek: true,
            partialRender: true,
            skipLength: 5,
        });

        wavesurferRef.current = wavesurfer;

        // Load audio - either from audioUrl or construct from trackId
        const audioSource = audioUrl || `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}`;
        if (audioSource) {
            // Pass peaks and duration if available for instant rendering
            if (state.peaks && state.duration) {
                wavesurfer.load(audioSource, state.peaks, 'auto', state.duration);
            } else {
                wavesurfer.load(audioSource);
            }
        }

        // No need to call loadDecodedBuffer separately when passing peaks to load()

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    }, [containerRef, audioUrl, trackId, state.peaks, state.duration, state.isLoading, theme]);

    return { wavesurferRef, state };
}
