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

    // Key that uniquely identifies the currently loaded source. We only want to
    // destroy/re-create WaveSurfer when this actually changes – *not* when the
    // parent merely re-renders or when play/pause toggles.
    const sourceKey = `${trackId ?? ''}|${audioUrl ?? ''}`;

    // Debug: log state changes so we can trace what the hook is doing
    useEffect(() => {
        // (debug log removed)
    }, [state]);

    // Fetch peaks data only when we have a trackId and are not loading a direct url
    useEffect(() => {
        if (!trackId || audioUrl || !SERVER_MEDIA) return;

        const fetchPeaks = async () => {
            // (debug log removed)

            setState(prev => ({ ...prev, isLoading: true, error: null }));
            
            try {
                const resp = await getTrackPeaks(trackId);
                // (debug log removed)

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

                // (debug log removed)

                setState(prev => ({ ...prev, peaks, duration: duration ?? null, isLoading: false }));
            } catch (error) {
                // (debug log removed)

                setState(prev => ({ 
                    ...prev, 
                    error: error instanceof Error ? error.message : 'Failed to fetch peaks',
                    isLoading: false 
                }));
            }
        };

        fetchPeaks();
    }, [trackId]);

    // (Re)create WaveSurfer when the audio source changes or when peaks for an
    // API track have been fetched.
    useEffect(() => {
        // (debug log removed)

        if (!containerRef.current) return;

        // Wait until peaks are fetched for API tracks before creating
        if (trackId && !state.peaks) return;

        // Destroy a previous instance if it exists before creating a new one
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const containerHeight = containerRef.current?.clientHeight ?? 100;

        const wavesurfer = WaveSurfer.create({
            responsive: true,
            backend: "MediaElement",
            waveColor: `${theme.textSecondary}`,
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

        // Make the waveform adapt if the container height changes (e.g. when
        // CSS variables scale with the viewport).
        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            if (wavesurfer && entry) {
                const newHeight = entry.contentRect.height;
                if (newHeight && newHeight !== containerHeight) {
                    // (debug log removed)
                    wavesurfer.setHeight(newHeight);
                }
            }
        });
        resizeObserver.observe(containerRef.current as Element);

        // Ensure consistent preload behaviour for MediaElement backend
        try {
            const media = (wavesurfer as any).backend?.mediaElement ?? (wavesurfer as any).media;
            if (media) {
                media.preload = 'auto';
                // Do NOT set crossOrigin initially. Most servers will stream
                // fine without CORS; enabling it when not supported can cause
                // the media element to error out immediately. We'll retry with
                // CORS enabled only if the first load fails.
            }
        } catch {/* no-op */}

        wavesurferRef.current = wavesurfer;

        // (debug log removed)

        // Resolve the audio source depending on the props provided
        const audioSource = trackId
            ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}`
            : audioUrl;

        // When using the MediaElement backend the waveform will actually be
        // rendered after the `waveform-ready` event rather than `ready`. We
        // attach the listener mainly for debugging but also to trigger a
        // re-render if we ever want to expose that state.
        wavesurfer.on('ready', () => {
            // (debug log removed)
            
            // If we have peaks but they weren't passed to load(), apply them now
            if (state.peaks && audioSource && !audioSource.includes('signed-audio')) {
                // (debug log removed)
                wavesurfer.loadDecodedBuffer(state.peaks);
            }
        });

        wavesurfer.on('waveform-ready', () => {
            // (debug log removed)
        });

        wavesurfer.on('loading', (p: number) => {
            // (debug log removed)
            
            // Show waveform as soon as we have any audio data
            if (p > 0 && state.peaks) {
                // (debug log removed)
                wavesurfer.zoom(1);
            }
        });

        let retriedWithCORS = false;

        const loadAudio = (useCORS: boolean) => {
            try {
                const media = (wavesurfer as any).backend?.mediaElement ?? (wavesurfer as any).media;
                if (media) {
                    // Explicitly set or clear crossOrigin before (re)load
                    if (useCORS) {
                        media.setAttribute('crossorigin', 'anonymous');
                    } else {
                        media.removeAttribute('crossorigin');
                    }
                    // Attach a one-time error listener for richer diagnostics
                    const onMediaError = () => {
                        // eslint-disable-next-line no-console
                        console.error('[useWaveform] HTMLMediaElement error', {
                            code: media.error?.code,
                            networkState: media.networkState,
                            readyState: media.readyState,
                            src: media.currentSrc,
                            crossorigin: media.getAttribute('crossorigin'),
                        });
                        media.removeEventListener('error', onMediaError);
                    };
                    media.addEventListener('error', onMediaError, { once: true });
                }
            } catch {/* no-op */}

            if (audioSource) {
                if (state.peaks) {
                    wavesurfer.load(audioSource, state.peaks as any);
                } else {
                    wavesurfer.load(audioSource);
                }
            }
        };

        if (audioSource) {
            // Initial load without CORS
            loadAudio(false);
        }

        wavesurfer.on('error', (error: any) => {
            // Keep explicit error visibility and include media error code/state if available
            try {
                const media = (wavesurfer as any).backend?.mediaElement ?? (wavesurfer as any).media;
                const details = media ? { code: media.error?.code, networkState: media.networkState, readyState: media.readyState, src: media.currentSrc } : {};
                // eslint-disable-next-line no-console
                console.error('[useWaveform] wavesurfer error', error, details);
                // Retry once with CORS enabled if not already retried
                if (!retriedWithCORS) {
                    retriedWithCORS = true;
                    loadAudio(true);
                }
            } catch {
                // eslint-disable-next-line no-console
                console.error('[useWaveform] wavesurfer error', error);
            }
        });

        wavesurfer.on('decode', () => {
            // (debug log removed)
        });

        return () => {
            resizeObserver.disconnect();
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
    }, [containerRef, sourceKey, state.peaks]);

    return { wavesurferRef, state };
}
