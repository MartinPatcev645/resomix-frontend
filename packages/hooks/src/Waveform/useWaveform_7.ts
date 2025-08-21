import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { SERVER_MEDIA } from "@resomix/config";
import { getTrackPeaks } from "@resomix/api-client";

export interface WaveformTheme {
    textSecondary: string;
    primary: string;
    cardBg?: string;
}

export interface UseWaveform7Props {
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

    /**
     * Initial volume (0..1) to apply to the WaveSurfer instance once it is
     * created. When omitted WaveSurfer defaults to full volume.
     */
    initialVolume?: number;
    /**
     * Optional callback that will be invoked on every timeupdate/seek event
     * with the current playback time (seconds). Use this to sync external state
     * like a global store.
     */
    onProgress?: (currentTime: number) => void;
}

export interface WaveformState {
    isLoading: boolean;
    error: string | null;
    peaks: number[] | null;
    duration: number | null;
}

/**
 * React hook that fetches peaks data and instantiates/manages a WaveSurfer 7 instance.
 */
export function useWaveform7({ 
    containerRef, 
    trackId, 
    audioUrl, 
    theme, 
    initialVolume, 
    onProgress 
}: UseWaveform7Props) {
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const isCreatingRef = useRef(false);
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
            return;
        }

        const fetchPeaks = async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));
            
            try {
                const resp = await getTrackPeaks(trackId);

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

                setState(prev => ({ ...prev, peaks, duration: duration ?? null, isLoading: false }));
            } catch (error) {
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

        // Prevent multiple instances from being created simultaneously
        if (isCreatingRef.current) {
            return;
        }

        // If we're using a backend trackId (no direct audioUrl) wait until peaks are fetched
        if (trackId && !audioUrl && !state.peaks && !state.error) {
            return;
        }

        isCreatingRef.current = true;

        // Destroy previous instance
        if (wavesurferRef.current) {
            try {
                // Pause before destroying to prevent audio overlap
                if (wavesurferRef.current.isPlaying()) {
                    wavesurferRef.current.pause();
                }
            } catch (e) {
                // ignore
            }
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const containerHeight = containerRef.current?.clientHeight ?? 100;

        // Skip creation if container has no height (likely not visible)
        if (containerHeight === 0) {
            isCreatingRef.current = false;
            return;
        }

        // Determine audio source – uploaded blobs (audioUrl) take precedence
        const audioSource = audioUrl ?? (trackId ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}` : undefined);

        if (!audioSource) {
            isCreatingRef.current = false;
            return;
        }

        // Create WaveSurfer 7 instance
        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#999999',
            progressColor: '#EE4A26', 
            cursorColor: '#fff',
            barWidth: 1,
            barHeight: 1,
            barGap: 1,
            cursorWidth: 1,
            fillParent: true,
            height: containerHeight,
            normalize: true,
            autoCenter: true,
            hideScrollbar: true,
            // Use peaks if available for faster rendering
            peaks: state.peaks ? [state.peaks] : undefined,
            duration: state.duration ?? undefined,
            // Load the audio URL
            url: audioSource,
        });

        wavesurferRef.current = wavesurfer;

        // Apply initial volume immediately if provided
        if (typeof initialVolume === 'number') {
            try {
                wavesurfer.setVolume(initialVolume);
            } catch { /* ignore */ }
        }

        // Handle errors
        wavesurfer.on('error', (error: any) => {
            setState(prev => ({ 
                ...prev, 
                error: 'Failed to load audio' 
            }));
        });

        // Handle ready event
        wavesurfer.on('ready', () => {
            isCreatingRef.current = false;
            // Ensure desired initial volume is applied
            if (typeof initialVolume === 'number') {
                try {
                    wavesurfer.setVolume(initialVolume);
                } catch { /* ignore */ }
            }
        });

        // Progress reporting to external callback (if provided)
        if (typeof onProgress === 'function') {
            const progressHandler = () => {
                const currentTime = wavesurfer.getCurrentTime();
                onProgress(currentTime);
            };

            // Listen to timeupdate events for progress
            wavesurfer.on('timeupdate', progressHandler);
            wavesurfer.on('seeking', progressHandler);
            wavesurfer.on('ready', progressHandler);
        }

        // Handle container resize
        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            if (wavesurfer && entry) {
                const newHeight = entry.contentRect.height;
                if (newHeight && newHeight !== containerHeight) {
                    // WaveSurfer 7 automatically handles resize, but we can trigger a redraw
                    try {
                        wavesurfer.empty();
                        wavesurfer.load(audioSource, state.peaks ? [state.peaks] : undefined);
                    } catch (e) {
                        // ignore resize errors
                    }
                }
            }
        });
        
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current as Element);
        }

        return () => {
            resizeObserver.disconnect();
            if (wavesurferRef.current) {
                try {
                    if (wavesurferRef.current.isPlaying()) {
                        wavesurferRef.current.pause();
                    }
                } catch (e) {
                    // ignore
                }
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            isCreatingRef.current = false;
        };
    }, [containerRef, sourceKey, state.peaks, state.error, theme.textSecondary, theme.primary, theme.cardBg, initialVolume, onProgress]);

    return { wavesurferRef, state };
}
