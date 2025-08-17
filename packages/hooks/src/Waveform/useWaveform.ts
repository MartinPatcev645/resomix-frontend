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
        const currentInstanceId = ++instanceIdRef.current;
        console.log('[useWaveform] Effect triggered #' + currentInstanceId + ' - containerRef:', !!containerRef.current, 'trackId:', trackId, 'audioUrl:', audioUrl?.substring(0, 50));
        if (!containerRef.current) return;

        // Prevent multiple instances from being created simultaneously
        if (isCreatingRef.current) {
            console.log('[useWaveform] #' + currentInstanceId + ' - Already creating instance, skipping');
            return;
        }

        // If we're using a backend trackId (no direct audioUrl) wait until peaks are fetched
        if (trackId && !audioUrl && !state.peaks && !state.error) {
            console.log('[useWaveform] #' + currentInstanceId + ' - Waiting for peaks before creating WaveSurfer');
            return;
        }

        isCreatingRef.current = true;

        // Destroy previous instance
        if (wavesurferRef.current) {
            console.log('[useWaveform] #' + currentInstanceId + ' - Destroying previous WaveSurfer instance');
            try {
                // Pause before destroying to prevent audio overlap
                if (wavesurferRef.current.isPlaying && wavesurferRef.current.isPlaying()) {
                    console.log('[useWaveform] #' + currentInstanceId + ' - Pausing before destroy');
                    wavesurferRef.current.pause();
                }
            } catch (e) {
                console.warn('[useWaveform] #' + currentInstanceId + ' - Error pausing before destroy:', e);
            }
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const containerHeight = containerRef.current?.clientHeight ?? 100;
        console.log('[useWaveform] #' + currentInstanceId + ' - Creating new WaveSurfer instance, container height:', containerHeight);

        // Skip creation if container has no height (likely not visible)
        if (containerHeight === 0) {
            console.log('[useWaveform] #' + currentInstanceId + ' - Container height is 0, skipping creation');
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

        // Determine audio source – uploaded blobs (audioUrl) take precedence
        const audioSource = audioUrl ?? (trackId ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}` : undefined);

        console.log('[useWaveform] #' + currentInstanceId + ' - Loading audio:', { trackId, audioUrl, audioSource, hasPeaks: !!state.peaks });

        // Handle errors
        wavesurfer.on('error', (error: any) => {
            console.error('[useWaveform] WaveSurfer error:', error);
            setState(prev => ({ 
                ...prev, 
                error: 'Failed to load audio' 
            }));
        });

        // Add finish event to prevent overlapping playback
        wavesurfer.on('finish', () => {
            console.log('[useWaveform] Audio finished playing');
        });

        // Add seek event logging to diagnose splitting issues
        wavesurfer.on('seek', (progress: number) => {
            console.log('[useWaveform] Seek event - progress:', progress, 'time:', wavesurfer.getCurrentTime());
        });

        // Add play/pause event logging
        wavesurfer.on('play', () => {
            console.log('[useWaveform] Play event fired - currentTime:', wavesurfer.getCurrentTime());
        });

        wavesurfer.on('pause', () => {
            console.log('[useWaveform] Pause event fired - currentTime:', wavesurfer.getCurrentTime());
        });

        // Add ready event – start playback automatically if requested
        wavesurfer.on('ready', () => {
            console.log('[useWaveform] #' + currentInstanceId + ' - WaveSurfer ready');
            console.log('[useWaveform] #' + currentInstanceId + ' - Duration:', wavesurfer.getDuration(), 'Backend:', wavesurfer.backend);
            isCreatingRef.current = false;
            if (autoPlay) {
                try {
                    console.log('[useWaveform] #' + currentInstanceId + ' - AutoPlay enabled - starting playback');
                    wavesurfer.play();
                } catch (e) {
                    console.error('[useWaveform] #' + currentInstanceId + ' - autoPlay play() error', e);
                }
            }
        });

        // Load audio with or without peaks
        if (audioSource) {
            try {
                console.log('[useWaveform] #' + currentInstanceId + ' - Loading audio URL:', audioSource);
                
                if (state.peaks && trackId) {
                    console.log('[useWaveform] #' + currentInstanceId + ' - Has peaks - loading with MediaElement backend, peaks length:', state.peaks.length);
                    
                    // For MediaElement backend with peaks, pass peaks directly to load()
                    // This should display the waveform immediately using the peaks data
                    wavesurfer.load(audioSource, state.peaks as any);
                } else {
                    console.log('[useWaveform] #' + currentInstanceId + ' - Loading without peaks - will decode audio');
                    wavesurfer.load(audioSource);
                }
            } catch (loadError) {
                console.error('[useWaveform] #' + currentInstanceId + ' - Load error:', loadError);
                setState(prev => ({ 
                    ...prev, 
                    error: 'Failed to load audio source' 
                }));
                isCreatingRef.current = false;
            }
        } else {
            console.warn('[useWaveform] #' + currentInstanceId + ' - No audio source provided');
            isCreatingRef.current = false;
        }

        return () => {
            console.log('[useWaveform] #' + currentInstanceId + ' - Cleanup function called');
            resizeObserver.disconnect();
            if (wavesurferRef.current) {
                console.log('[useWaveform] #' + currentInstanceId + ' - Destroying wavesurfer instance in cleanup');
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            isCreatingRef.current = false;
        };
    }, [containerRef, sourceKey, state.peaks, state.error, theme.textSecondary, theme.primary, theme.cardBg, autoPlay]);

    return { wavesurferRef, state };
}
