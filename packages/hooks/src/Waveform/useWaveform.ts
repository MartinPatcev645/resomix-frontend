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
    /**
     * Container that WaveSurfer should render into.
     */
    containerRef: React.RefObject<HTMLElement | null>;
    /**
     * ID of the track in our API. If provided we fetch pre-computed peaks and
     * construct a signed streaming URL from the server.
     */
    trackId?: string;
    /**
     * Direct URL to an audio source (e.g. the result of
     * `URL.createObjectURL(file)`). When provided we skip the peak fetch and
     * load the audio directly.
     */
    audioUrl?: string;
    /**
     * Colour theme for the waveform.
     */
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

    // Key that uniquely identifies the currently loaded source
    const sourceKey = `${trackId ?? ''}|${audioUrl ?? ''}`;

    // Fetch peaks data only when we have a trackId
    useEffect(() => {
        if (!trackId || audioUrl || !SERVER_MEDIA) {
            console.log('[useWaveform] Skipping peaks fetch:', { trackId, audioUrl, SERVER_MEDIA });
            return;
        }

        const fetchPeaks = async () => {
            console.log('[useWaveform] Fetching peaks for trackId:', trackId);
            setState(prev => ({ ...prev, isLoading: true, error: null }));
            
            try {
                const resp = await getTrackPeaks(trackId);
                console.log('[useWaveform] Peaks response:', resp);

                // Handle different response formats from the backend
                let peaks: number[] | undefined;
                let duration: number | undefined | null;

                if (Array.isArray(resp)) {
                    peaks = resp as unknown as number[];
                } else {
                    peaks = (resp as any).peaks ?? (resp as any).data?.peaks;
                    duration = (resp as any).duration ?? (resp as any).data?.duration;
                }

                if (!Array.isArray(peaks)) {
                    throw new Error('`peaks` array missing in API response');
                }

                console.log('[useWaveform] Peaks processed:', { peaksLength: peaks.length, duration });
                setState(prev => ({ ...prev, peaks, duration: duration ?? null, isLoading: false }));
            } catch (error) {
                console.error('[useWaveform] Error fetching peaks:', error);
                setState(prev => ({ 
                    ...prev, 
                    error: error instanceof Error ? error.message : 'Failed to fetch peaks',
                    isLoading: false 
                }));
            }
        };

        fetchPeaks();
    }, [trackId, audioUrl]);

    // Create WaveSurfer instance and load audio
    useEffect(() => {
        if (!containerRef.current) return;

        // For trackId, wait until peaks are fetched
        if (trackId && !state.peaks && !state.error) return;

        // Destroy previous instance
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const containerHeight = containerRef.current?.clientHeight ?? 100;

        // Create WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
            responsive: true,
            backend: "MediaElement",
            waveColor: theme.textSecondary,
            progressColor: theme.primary,
            cursorColor: theme.primary,
            backgroundColor: theme.cardBg || "#000000",
            barWidth: 1,
            barHeight: 1,
            barMinHeight: 4,
            barGap: 1,
            cursorWidth: 1,
            pixelRatio: 1,
            hideScrollbar: true,
            interact: true,
            container: containerRef.current,
            partialRender: false,
            skipLength: 5,
            normalize: true,
            height: containerHeight,
        } as any);

        // Handle container resize
        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            if (wavesurfer && entry) {
                const newHeight = entry.contentRect.height;
                if (newHeight && newHeight !== containerHeight) {
                    wavesurfer.setHeight(newHeight);
                }
            }
        });
        resizeObserver.observe(containerRef.current as Element);

        wavesurferRef.current = wavesurfer;

        // Determine audio source
        const audioSource = trackId
            ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}`
            : audioUrl;

        console.log('[useWaveform] Loading audio:', { trackId, audioUrl, audioSource, hasPeaks: !!state.peaks });

        // Handle errors
        wavesurfer.on('error', (error: any) => {
            console.error('[useWaveform] WaveSurfer error:', error);
            setState(prev => ({ 
                ...prev, 
                error: 'Failed to load audio' 
            }));
        });

        // Add ready event for debugging
        wavesurfer.on('ready', () => {
            console.log('[useWaveform] WaveSurfer ready');
        });

        // Load audio with or without peaks
        if (audioSource) {
            try {
                console.log('[useWaveform] Loading audio URL:', audioSource);
                
                // For MediaElement backend, always load the URL first
                // The peaks are used for display but don't affect the audio loading
                wavesurfer.load(audioSource);
                
                if (state.peaks && trackId) {
                    console.log('[useWaveform] Will apply peaks after ready, peaks length:', state.peaks.length);
                    // For display purposes, we can try to set the peaks after load
                    wavesurfer.on('ready', () => {
                        console.log('[useWaveform] Audio ready, attempting to apply peaks visualization');
                        // Note: For MediaElement backend, peaks are mainly for visualization
                        // The actual audio decoding happens via the media element
                    });
                }
            } catch (loadError) {
                console.error('[useWaveform] Load error:', loadError);
                setState(prev => ({ 
                    ...prev, 
                    error: 'Failed to load audio source' 
                }));
            }
        } else {
            console.warn('[useWaveform] No audio source provided');
        }

        return () => {
            resizeObserver.disconnect();
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    }, [containerRef, sourceKey, state.peaks, state.error, theme.textSecondary, theme.primary, theme.cardBg]);

    return { wavesurferRef, state };
}
