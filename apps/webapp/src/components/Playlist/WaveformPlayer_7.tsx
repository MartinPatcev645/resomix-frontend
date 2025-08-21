import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle, useState } from "react";
import { useWaveform7 } from "@resomix/hooks";
import type { WaveformTheme } from "@resomix/hooks";

interface WaveformPlayer7Props {
    /** Track ID used to pull peaks & stream from the API. */
    trackId?: string;
    /** Direct audio URL (e.g. result of URL.createObjectURL) to load instead
     * of an API track. When provided, `trackId` is ignored.
     */
    audioUrl?: string;
    theme?: WaveformTheme;
    /** Volume between 0 and 1. Defaults to 1 (100%). */
    volume?: number;
    /**
     * Whether the player should currently be playing. When this value changes
     * we synchronise the underlying WaveSurfer instance so that it either
     * begins playback or pauses.
     */
    isPlaying?: boolean;

    /**
     * Callback invoked on every timeupdate/seek with current playback time.
     * This is forwarded to useWaveform7 and is primarily used to sync the
     * player store with the real-time cursor position.
     */
    onProgress?: (currentTime: number) => void;

    /** Callback fired when the internal WaveSurfer instance is ready */
    onReadyWs?: (ws: any) => void;
}

export interface WaveformPlayer7Ref {
    getWaveSurfer: () => any;
}

const WaveformPlayer7 = forwardRef<WaveformPlayer7Ref, WaveformPlayer7Props>(({ 
    trackId,
    audioUrl,
    theme = {
        textSecondary: '#ffffff', // unplayed waveform color
        primary: '#ffffff', // cursor color
        cardBg: '#000000'
    },
    volume = 1,
    isPlaying,
    onReadyWs,
    onProgress
}, ref) => {
    const waveformRef = useRef<HTMLDivElement>(null);

    // Expose wavesurfer instance to parent via ref
    useImperativeHandle(ref, () => ({
        getWaveSurfer: () => wavesurferRef.current
    }), []);

    // Keep a stable theme reference across renders to avoid re-creating
    // WaveSurfer unnecessarily (which would wipe the canvas).
    const memoTheme = useMemo<WaveformTheme>(() => theme as WaveformTheme, [
        theme.textSecondary,
        theme.primary,
        theme.cardBg,
    ]);

    // Capture initial volume only once to avoid re-creating WaveSurfer when the
    // global volume slider changes later. Subsequent volume updates are
    // applied imperatively via the separate effect further below.
    const initialVolumeRef = useRef(volume);

    // Initialize wavesurfer via the shared hook. We also keep a ref to the
    // underlying WaveSurfer instance so that we can imperatively control
    // playback from the parent component via the `isPlaying` prop.
    const { state, wavesurferRef } = useWaveform7({ 
        containerRef: waveformRef, 
        trackId, 
        audioUrl,
        theme: memoTheme,
        initialVolume: initialVolumeRef.current,
        onProgress,
    });

    // Expose wavesurfer instance once available
    const [hasCalledReady, setHasCalledReady] = useState(false);
    
    useEffect(() => {
        if (!onReadyWs || hasCalledReady) return;
        
        // Wait for wavesurfer to be ready
        const checkInterval = setInterval(() => {
            if (wavesurferRef.current && !hasCalledReady) {
                setHasCalledReady(true);
                onReadyWs(wavesurferRef.current);
                clearInterval(checkInterval);
            }
        }, 100);
        
        return () => clearInterval(checkInterval);
    }, [onReadyWs, hasCalledReady]);

    // Synchronise playback state whenever the `isPlaying` prop changes.
    useEffect(() => {
        const ws = wavesurferRef.current;
        if (!ws) return;

        if (isPlaying) {
            // Already playing? nothing to do.
            if (ws.isPlaying()) {
                return;
            }

            const tryPlay = () => {
                try {
                    ws.play();
                } catch (e) {
                    console.error('[WaveformPlayer7] play() error', e);
                }
            };

            // WaveSurfer 7 has better readiness detection
            if (ws.getDuration() > 0) {
                tryPlay();
            } else {
                const onReady = () => {
                    tryPlay();
                    ws.un('ready', onReady);
                };
                ws.on('ready', onReady);
                return () => {
                    ws.un('ready', onReady);
                };
            }
        } else {
            ws.pause();
        }
    }, [isPlaying, trackId, wavesurferRef]);

    // Set volume whenever it changes (and wavesurfer is ready)
    useEffect(() => {
        const ws = wavesurferRef.current;
        if (ws && typeof ws.setVolume === 'function') {
            try {
                ws.setVolume(volume);
            } catch {/* ignore */}
        }
    }, [volume, wavesurferRef]);

    // Show loading state while fetching peaks
    if (state.isLoading) {
        return (
            <div className="w-full h-[var(--px-50)] flex items-center justify-center bg-[var(--color-primary-background)] rounded">
                <div className="text-[var(--color-primary-hover)] font-fira text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light">
                    Fetching the track for you...
                </div>
            </div>
        );
    }

    // Show error state if peaks fetch failed
    if (state.error) {
        return (
            <div className="w-full h-[var(--px-50)] flex items-center justify-center bg-[var(--color-primary-background)] rounded">
                <div className="text-[var(--color-primary-hover)] font-fira text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light">
                    {state.error}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full relative z-30 h-[var(--px-50)]">
            <div ref={waveformRef} className="w-full h-full bg-black" />
        </div>
    );
});

WaveformPlayer7.displayName = 'WaveformPlayer7';

export default WaveformPlayer7;
