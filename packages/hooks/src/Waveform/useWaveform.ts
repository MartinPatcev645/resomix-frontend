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

    // Debug: log state changes so we can trace what the hook is doing
    useEffect(() => {
        /* eslint-disable no-console */
        console.log('[useWaveform] state changed', state);
        /* eslint-enable no-console */
    }, [state]);

    // Fetch peaks data only when we have a trackId and are not loading a direct url
    useEffect(() => {
        if (!trackId || audioUrl || !SERVER_MEDIA) return;

        const fetchPeaks = async () => {
            /* eslint-disable no-console */
            console.log('[useWaveform] Fetching peaks for', trackId);
            /* eslint-enable no-console */

            setState(prev => ({ ...prev, isLoading: true, error: null }));
            
            try {
                const resp = await getTrackPeaks(trackId);
                /* eslint-disable no-console */
                console.log('[useWaveform] Raw peaks response', resp);
                /* eslint-enable no-console */

                // Back-end can return:
                // 1) Raw array: [0.1, …]
                // 2) { peaks, duration }
                // 3) { data: { peaks, duration } }
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

                /* eslint-disable no-console */
                console.log('[useWaveform] Peaks parsed', { count: peaks.length, duration });
                /* eslint-enable no-console */

                setState(prev => ({ ...prev, peaks, duration: duration ?? null, isLoading: false }));
            } catch (error) {
                /* eslint-disable no-console */
                console.error('[useWaveform] Peaks fetch error', error);
                /* eslint-enable no-console */

                setState(prev => ({ 
                    ...prev, 
                    error: error instanceof Error ? error.message : 'Failed to fetch peaks',
                    isLoading: false 
                }));
            }
        };

        fetchPeaks();
    }, [trackId]);

    // Initialize WaveSurfer when peaks are loaded
    useEffect(() => {
        /* eslint-disable no-console */
        console.log('[useWaveform] Init effect triggered', {
            hasContainer: !!containerRef.current,
            isLoading: state.isLoading,
            peaksLoaded: !!state.peaks,
        });
        /* eslint-enable no-console */

        if (!containerRef.current) return;
        if (state.isLoading) return;

        // For API tracks we wait until peaks have been fetched before building
        // the instance to avoid an unnecessary re-render. When loading a direct
        // URL we have no peak data so we can proceed immediately.
        if (trackId && !state.peaks) return;

        // Destroy a previous instance if it exists before creating a new one
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const wavesurfer = WaveSurfer.create({
            responsive: true,
            backend: audioUrl ? "WebAudio" : "MediaElement",
            waveColor: `${theme.textSecondary}`,
            progressColor: theme.primary,
            cursorColor: theme.primary,
            backgroundColor: theme.cardBg || "#000000",
            barWidth: 1,
            barHeight: 1,
            barMinHeight: 4,
            barGap: 1,
            cursorWidth: 1,
            height: 100,
            pixelRatio: 1,
            hideScrollbar: true,
            interact: true,
            container: containerRef.current,
            partialRender: false,
            skipLength: 5,
            normalize: true
        });

        wavesurferRef.current = wavesurfer;

        /* eslint-disable no-console */
        console.log('[useWaveform] WaveSurfer instance created');
        /* eslint-enable no-console */

        // Resolve the audio source depending on the props provided
        const audioSource = trackId
            ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}`
            : audioUrl;

        // When using the MediaElement backend the waveform will actually be
        // rendered after the `waveform-ready` event rather than `ready`. We
        // attach the listener mainly for debugging but also to trigger a
        // re-render if we ever want to expose that state.
        wavesurfer.on('ready', () => {
            /* eslint-disable no-console */
            console.log('[useWaveform] wavesurfer "ready" event');
            /* eslint-enable no-console */
            
            // If we have peaks but they weren't passed to load(), apply them now
            if (state.peaks && audioSource && !audioSource.includes('signed-audio')) {
                console.log('[useWaveform] Applying peaks after ready event');
                wavesurfer.loadDecodedBuffer(state.peaks);
            }
        });

        wavesurfer.on('waveform-ready', () => {
            /* eslint-disable no-console */
            console.log('[useWaveform] wavesurfer "waveform-ready" event');
            /* eslint-enable no-console */
        });

        wavesurfer.on('loading', (p: number) => {
            /* eslint-disable no-console */
            console.log('[useWaveform] wavesurfer loading', p);
            /* eslint-enable no-console */
            
            // Show waveform as soon as we have any audio data
            if (p > 0 && state.peaks) {
                console.log('[useWaveform] Audio loading progress, ensuring waveform visibility');
                wavesurfer.zoom(1);
            }
        });

        wavesurfer.on('error', (error: any) => {
            /* eslint-disable no-console */
            console.error('[useWaveform] wavesurfer error', error);
            /* eslint-enable no-console */
        });

        wavesurfer.on('decode', () => {
            /* eslint-disable no-console */
            console.log('[useWaveform] wavesurfer decode event');
            /* eslint-enable no-console */
        });

        if (audioSource) {
            if (state.peaks) {
                /* eslint-disable no-console */
                console.log('[useWaveform] Loading audio with peaks', audioSource);
                /* eslint-enable no-console */
                wavesurfer.load(audioSource, state.peaks, 'auto');
            } else {
                /* eslint-disable no-console */
                console.log('[useWaveform] Loading audio without peaks', audioSource);
                /* eslint-enable no-console */
                wavesurfer.load(audioSource);
            }
        }

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    // We purposely omit `theme` from the dependency list because passing a new
    // (but structurally equal) object would otherwise destroy and recreate the
    // WaveSurfer instance on every parent render, wiping the canvas. If you
    // really need to recreate WaveSurfer when colours change, expose a
    // separate setter instead of mutating the object.
    }, [containerRef, trackId, audioUrl, state.peaks, state.duration, state.isLoading]);

    return { wavesurferRef, state };
}
