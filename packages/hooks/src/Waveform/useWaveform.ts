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

    /**
     * When true the audio will start playing automatically once it becomes
     * ready. Defaults to false so existing callers keep the current behaviour.
     */
    autoPlay?: boolean;
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
export function useWaveform({ containerRef, trackId, audioUrl, theme, autoPlay = false }: UseWaveformProps) {
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const isCreatingRef = useRef(false);
    const instanceIdRef = useRef(0);
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
                if (wavesurferRef.current.isPlaying && wavesurferRef.current.isPlaying()) {
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

        // Create WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
            responsive: true,
            // Choose backend automatically: use WebAudio for local blobs (better decoding),
            // otherwise use MediaElement for remote streaming which supports range requests.
            backend: audioUrl && audioUrl.startsWith('blob:') ? 'WebAudio' : 'MediaElement',
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

        // Store playing state before interactions for WebAudio backend
        let isPlayingBeforeInteraction = false;

        wavesurfer.on('interaction', () => {
            // Store playing state before user interaction (click/drag on waveform)
            isPlayingBeforeInteraction = wavesurfer.isPlaying && wavesurfer.isPlaying();
        });

        // Determine audio source – uploaded blobs (audioUrl) take precedence
        const audioSource = audioUrl ?? (trackId ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}` : undefined);

        // Handle errors
        wavesurfer.on('error', (error: any) => {
            setState(prev => ({ 
                ...prev, 
                error: 'Failed to load audio' 
            }));
        });

        // Add finish event to prevent overlapping playback
        wavesurfer.on('finish', () => {
            // Audio finished playing
        });

        // Resume immediately after seek for WebAudio backend when necessary
        wavesurfer.on('seek', (progress: number) => {
            if (
                isPlayingBeforeInteraction &&
                wavesurfer.backend &&
                wavesurfer.backend.constructor &&
                /WebAudio/i.test(wavesurfer.backend.constructor.name)
            ) {
                // Try to resume playback shortly after seek
                setTimeout(() => {
                    if (!wavesurfer.isPlaying()) {
                        try {
                            wavesurfer.play();
                        } catch (e) {
                            // ignore
                        }
                    }
                }, 30);
            }

            isPlayingBeforeInteraction = false; // reset regardless
        });

        // Add play/pause event logging
        wavesurfer.on('play', () => {
            // Play event fired
        });

        wavesurfer.on('pause', () => {
            // Pause event fired
        });

        // Add ready event – start playback automatically if requested
        wavesurfer.on('ready', () => {
            isCreatingRef.current = false;
            if (autoPlay) {
                try {
                    wavesurfer.play();
                } catch (e) {
                    // ignore
                }
            }
        });

        // Load audio with or without peaks
        if (audioSource) {
            try {
                if (state.peaks && trackId) {
                    // For MediaElement backend with peaks, pass peaks directly to load()
                    // This should display the waveform immediately using the peaks data
                    wavesurfer.load(audioSource, state.peaks as any);
                } else {
                    // For blob URLs (uploaded files), use direct URL loading with WebAudio backend
                    wavesurfer.load(audioSource);
                }
            } catch (loadError) {
                setState(prev => ({ 
                    ...prev, 
                    error: 'Failed to load audio source' 
                }));
                isCreatingRef.current = false;
            }
        } else {
            isCreatingRef.current = false;
        }

        return () => {
            resizeObserver.disconnect();
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            isCreatingRef.current = false;
        };
    }, [containerRef, sourceKey, state.peaks, state.error, theme.textSecondary, theme.primary, theme.cardBg, autoPlay]);

    return { wavesurferRef, state };
}
