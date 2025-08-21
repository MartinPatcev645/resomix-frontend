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
     * Initial volume (0..1) to apply to the WaveSurfer instance once it is
     * created. When omitted WaveSurfer defaults to full volume.
     */
    initialVolume?: number;

    /**
     * Duration of the track in seconds. If provided, we use this value instead of
     * the duration returned by the API.
     */
    trackDuration?: number;

    /**
     * Optional callback that will be invoked on every timeupdate/seeking event
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
 * React hook that fetches peaks data and instantiates/manages a WaveSurfer instance.
 *
 * @param containerRef - Ref pointing to the container element where the waveform will be rendered.
 * @param trackId - Track ID to fetch peaks data for.
 * @param audioUrl - Optional direct audio URL (if not using trackId).
 * @param theme - Colors used for styling the waveform.
 *
 * The hook returns the waveform state and a ref with the underlying WaveSurfer instance.
 */
export function useWaveform({ containerRef, trackId, audioUrl, theme, initialVolume, onProgress, trackDuration }: UseWaveformProps) {
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
        // List of event unbind callbacks to run during cleanup
        const cleanupFns: Array<() => void> = [];

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

        // Determine audio source – uploaded blobs (audioUrl) take precedence
        const audioSource = audioUrl ?? (trackId ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}` : undefined);



        // Create WaveSurfer 7 instance
        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: theme.textSecondary,
            progressColor: '#EE4A26', // neon orange for played portion
            cursorColor: theme.primary,
            barWidth: 0,
            barGap: 0,
            cursorWidth: 1,
            normalize: true,
            interact: true,
            dragToSeek: true,
            fillParent: true,
            height: containerHeight,
            hideScrollbar: true,
            peaks: state.peaks ? [state.peaks] : undefined,
            duration: trackDuration || state.duration || undefined,
            url: audioSource,
        });

        wavesurferRef.current = wavesurfer;

        // Apply initial volume immediately if provided
        if (typeof initialVolume === 'number') {
            try {
                wavesurfer.setVolume(initialVolume);
            } catch { /* ignore */ }
        }

        // Handle container resize (fit full track to width; no reload)
        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!wavesurfer || !entry) return

            const el = containerRef.current as HTMLElement | null
            const width = el?.clientWidth ?? entry.contentRect.width ?? 0
            const height = Math.max(1, Math.floor(entry.contentRect.height))

            try {
                // Update canvas height without reloading audio
                wavesurfer.setOptions({ height })

                // Recompute px/sec so the entire duration fits container width
                const duration = wavesurfer.getDuration() || state.duration || 0
                if (duration > 0 && width > 0) {
                    wavesurfer.zoom(width / duration)
                }
            } catch {
                // ignore resize errors
            }
        })

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current as Element)
        }

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
            // Ensure desired initial volume before any playback starts
            if (typeof initialVolume === 'number') {
                try {
                    wavesurfer.setVolume(initialVolume);
                } catch { /* ignore */ }
            }
        });

        // -----------------------------------------------------------------
        // Progress reporting to external callback (if provided)
        // -----------------------------------------------------------------

        if (typeof onProgress === 'function') {
            const progressHandler = () => {
                const t = wavesurfer.getCurrentTime();
                // DEBUG: track time progression (at most once every ~second due to throttling below)
                if (Math.floor(t) % 5 === 0) {
                    console.debug('[Waveform] progress', t.toFixed(2));
                }
                onProgress(t);
            };

            // Listen to timeupdate events for progress
            wavesurfer.on('timeupdate', progressHandler);
            wavesurfer.on('seeking', progressHandler);
            wavesurfer.on('ready', progressHandler);

            // Cleanup listeners on destroy
            cleanupFns.push(() => {
                wavesurfer.un('timeupdate', progressHandler);
                wavesurfer.un('seeking', progressHandler);
                wavesurfer.un('ready', progressHandler);
            });
        }

        // WaveSurfer 7 automatically loads audio when url is provided in constructor
        // No manual load() call needed

        return () => {
            resizeObserver.disconnect();
            cleanupFns.forEach((fn) => fn());
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            isCreatingRef.current = false;
        };
    }, [containerRef, sourceKey, state.peaks, state.error, theme.textSecondary, theme.primary, theme.cardBg, initialVolume, onProgress]);

    return { wavesurferRef, state };
}
