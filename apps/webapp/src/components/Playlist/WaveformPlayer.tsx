import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle, useState } from "react";
import { useWaveform } from "@resomix/hooks";
import type { WaveformTheme } from "@resomix/hooks";
// Removed direct player store dependency; registration handled by parent

interface WaveformPlayerProps {
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
     * Callback invoked on every audioprocess/seek with current playback time.
     * This is forwarded to useWaveform and is primarily used to sync the
     * player store with the real-time cursor position.
     */
    onProgress?: (currentTime: number) => void;

    duration?: number;

    /** Callback fired when the internal WaveSurfer instance is ready */
    onReadyWs?: (ws: any) => void;
}

export interface WaveformPlayerRef {
    getWaveSurfer: () => any;
}

const WaveformPlayer = forwardRef<WaveformPlayerRef, WaveformPlayerProps>(({ 
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
    duration,
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
    const { state, wavesurferRef } = useWaveform({ 
        containerRef: waveformRef, 
        trackId, 
        audioUrl,
        theme: memoTheme,
        initialVolume: initialVolumeRef.current,
        onProgress,
        trackDuration: duration,
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

    // Parent component handles WaveSurfer registration in store

    // Synchronise playback state whenever the `isPlaying` prop changes. If the
    // WaveSurfer instance isn't ready yet we defer `play()` until the `ready`
    // event to avoid the "NotSupportedError: The element has no supported
    // sources." browser exception.
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
                     // registration handled by parent
                     ws.play();
                 } catch (e) {
                     /* eslint-disable no-console */
                     console.error('[WaveformPlayer] play() error', e);
                     /* eslint-enable no-console */
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
                    {audioUrl ? 'Generating waveform...' : 'Fetching the track for you...'}
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
        <div className="w-full relative z-30 h-[var(--px-100)]">
            <div ref={waveformRef} className="w-full h-full" />
        </div>
    );
});

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;
