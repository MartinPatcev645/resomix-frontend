import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { SERVER_MEDIA } from "@resomix/config";
import { getTrackPeaks } from "@resomix/api-client";

// -------------------------------------------------------------
// Platform helpers
// -------------------------------------------------------------
// Very small helper to detect iOS devices. We purposefully keep the
// regex narrow to only match iPhone/iPad/iPod browsers. This avoids
// erroneously matching desktop Safari where the glitch does not occur.
// We do the check once at module load so the result is memoised.
const IS_IOS = typeof navigator !== 'undefined' && /iP(ad|hone|od)/.test(navigator.userAgent);

// -------------------------------------------------------------
// Shared AudioContext (prevents exhausting the 6-context limit on iOS)
// -------------------------------------------------------------
let _sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!_sharedAudioContext) {
        try {
            _sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch {
            // Creation failed – likely unsupported. Leave as null so Wavesurfer falls back.
            _sharedAudioContext = null;
        }
    }

    return _sharedAudioContext;
}

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

    /**
     * Pre-unlocked audio element from gesture preservation (BeMusic strategy)
     * When provided, WaveSurfer will use this element instead of creating its own
     */
    preUnlockedAudio?: HTMLAudioElement;

    /**
     * Persistent audio element from AudioProvider (BeMusic pattern)
     * When provided, WaveSurfer will use this element and we skip our own audio creation
     */
    persistentAudioElement?: HTMLAudioElement;
}

export interface WaveformState {
    isLoading: boolean;
    error: string | null;
    peaks: number[] | null;
    duration: number | null;
}

/**
 * Generate peaks data from an audio file when no pre-computed peaks are available
 */
async function generatePeaksFromAudio(audioUrl: string): Promise<{ peaks: number[]; duration: number }> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";

        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaElementSource(audio);

            source.connect(analyser);
            analyser.connect(audioContext.destination);

            // Set analyser properties for good peak resolution
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Generate peaks by analyzing frequency data
            const peaks: number[] = [];
            const numPeaks = 1000; // Number of peaks to generate

            const analyzeFrame = () => {
                analyser.getByteFrequencyData(dataArray);

                // Calculate average frequency magnitude for this frame
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;

                // Normalize to 0-1 range
                peaks.push(average / 255);

                if (peaks.length < numPeaks) {
                    requestAnimationFrame(analyzeFrame);
                } else {
                    audioContext.close();
                    resolve({ peaks, duration });
                }
            };

            // Start analysis
            audio.currentTime = 0;
            audio.play();
            analyzeFrame();
        };

        audio.onerror = () => reject(new Error('Failed to load audio for peak generation'));
        audio.src = audioUrl;
    });
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
export function useWaveform({ containerRef, trackId, audioUrl, theme, initialVolume, onProgress, trackDuration, preUnlockedAudio, persistentAudioElement }: UseWaveformProps) {
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const isCreatingRef = useRef(false);
    const instanceIdRef = useRef(0);
    const requestIdRef = useRef(0);
    // Store the current AbortController for peaks HTTP fetch so we can cancel
    // when the user switches tracks before completion.
    const peaksAbortRef = useRef<AbortController | null>(null);
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

            const currentRequestId = ++requestIdRef.current;

            // Abort any in-flight fetch tied to a previous trackId
            if (peaksAbortRef.current) {
                try {
                    peaksAbortRef.current.abort();
                } catch { /* ignore */ }
            }

            const abortController = new AbortController();
            peaksAbortRef.current = abortController;

            try {
                const url = `${SERVER_MEDIA}/peaks/?uuid=${trackId}`;
                const resp = await fetch(url, { signal: abortController.signal });
                if (!resp.ok) throw new Error(`Failed to fetch peaks (${resp.status})`);
                const data = await resp.json();

                // Handle different response formats from the backend
                let peaks: number[] | undefined;
                let duration: number | undefined | null;

                if (Array.isArray(data)) {
                    peaks = data as unknown as number[];
                } else {
                    peaks = (data as any).peaks ?? (data as any).data?.peaks;
                    duration = (data as any).duration ?? (data as any).data?.duration;
                }

                if (!Array.isArray(peaks)) {
                    throw new Error('`peaks` array missing in API response');
                }

                setState(prev => ({ ...prev, peaks, duration: duration ?? null, isLoading: false }));
            } catch (error) {
                if (currentRequestId === requestIdRef.current) { // Only update state if this request is still active
                    setState(prev => ({
                        ...prev,
                        error: error instanceof Error ? error.message : 'Failed to fetch peaks',
                        isLoading: false
                    }));
                }
            }
        };

        fetchPeaks();
    }, [trackId, audioUrl]);

    // Generate peaks for uploaded audio when no pre-computed peaks exist
    useEffect(() => {
        if (!audioUrl || state.peaks || state.error) {
            return;
        }

        const generatePeaks = async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const currentRequestId = ++requestIdRef.current;

            try {
                const { peaks, duration } = await generatePeaksFromAudio(audioUrl);
                setState(prev => ({ ...prev, peaks, duration, isLoading: false }));
            } catch (error) {
                if (currentRequestId === requestIdRef.current) { // Only update state if this request is still active
                    setState(prev => ({
                        ...prev,
                        error: error instanceof Error ? error.message : 'Failed to generate peaks',
                        isLoading: false
                    }));
                }
            }
        };

        generatePeaks();
    }, [audioUrl, state.peaks, state.error]);

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

        // If we're using audioUrl, wait until peaks are generated or we have an error
        if (audioUrl && !state.peaks && !state.error && !state.isLoading) {
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

                // BeMusic strategy: Use persistent audio element from AudioProvider
        const wavesurferConfig: any = {
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
            ...(IS_IOS ? { backend: 'MediaElement' as const } : {}),
            // @ts-ignore – audioContext is supported in WaveSurfer 7.x but missing in the DefinitelyTyped types shipped with the package
            audioContext: getSharedAudioContext() ?? undefined,
        };

        // Priority order: persistentAudioElement > preUnlockedAudio > create new
        if (persistentAudioElement) {
            // BeMusic pattern: Use persistent audio element from AudioProvider
            // AudioProvider already handles src changes, we just connect to it
            wavesurferConfig.media = persistentAudioElement;
            console.log('[useWaveform] Using persistent audio element from AudioProvider');
        } else if (preUnlockedAudio && audioSource) {
            // Legacy gesture preservation: Use pre-unlocked audio element
            preUnlockedAudio.src = audioSource;
            preUnlockedAudio.load(); // Start loading metadata
            wavesurferConfig.media = preUnlockedAudio;
            console.log('[useWaveform] Using pre-unlocked audio element for gesture preservation');
        } else if (audioSource) {
            // Fallback: Let WaveSurfer create its own audio element
            // This should be avoided when using AudioProvider pattern
            wavesurferConfig.url = audioSource;
            console.log('[useWaveform] Using WaveSurfer-managed audio element (fallback - AudioProvider may not be ready)');
        } else {
            // No audio source available
            console.warn('[useWaveform] No audio source or persistent element provided');
        }

        // Create WaveSurfer 7 instance
        const wavesurfer = WaveSurfer.create(wavesurferConfig);

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

            // On iOS an AudioContext may start in the "suspended" state until the
            // user performs a gesture. Ensure it is resumed so audio actually
            // plays after a ready->play sequence initiated programmatically.
            const ctx = getSharedAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {/* ignore resume errors */ });
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
                    // console.debug('[Waveform] progress', t.toFixed(2));
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

        // -----------------------------------------------------------------
        // iOS specific: quick pause / play after the user seeks
        // -----------------------------------------------------------------

        if (IS_IOS) {
            const iosSeekWorkaround = () => {
                try {
                    // Only apply when currently playing – avoids unnecessary
                    // toggling when the user seeks whilst paused.
                    if (wavesurfer.isPlaying && wavesurfer.isPlaying()) {
                        wavesurfer.pause();
                        // Resume as soon as possible – 0-delay timeout places
                        // the callback at the end of the current event loop tick.
                        setTimeout(() => {
                            try {
                                wavesurfer.play();
                            } catch {/* ignore play errors */ }
                        }, 0);
                    }
                } catch {/* ignore errors */ }
            };

            wavesurfer.on('seeking', iosSeekWorkaround);
            cleanupFns.push(() => wavesurfer.un('seeking', iosSeekWorkaround));
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
            }, [containerRef, sourceKey, state.peaks, state.error, state.isLoading, theme.textSecondary, theme.primary, theme.cardBg, initialVolume, onProgress, trackId, audioUrl, preUnlockedAudio, persistentAudioElement]);

    return { wavesurferRef, state };
}
