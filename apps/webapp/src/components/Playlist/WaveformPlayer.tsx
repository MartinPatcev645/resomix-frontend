import React, { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useWaveform } from "@resomix/hooks";
import type { WaveformTheme } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";

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
     * When true the audio will start playing automatically once it becomes
     * ready. Defaults to false to keep existing behaviour.
     */
    autoPlay?: boolean;
}

export interface WaveformPlayerRef {
    getWaveSurfer: () => any;
}

const WaveformPlayer = forwardRef<WaveformPlayerRef, WaveformPlayerProps>(({ 
    trackId,
    audioUrl,
    theme = {
        textSecondary: '#ffffff',
        primary: '#ffffff',
        cardBg: '#000000'
    },
    volume = 1,
    isPlaying,
    autoPlay = false
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

    // Initialize wavesurfer via the shared hook. We also keep a ref to the
    // underlying WaveSurfer instance so that we can imperatively control
    // playback from the parent component via the `isPlaying` prop.
    const { state, wavesurferRef } = useWaveform({ 
        containerRef: waveformRef, 
        trackId, 
        audioUrl,
        theme: memoTheme,
        autoPlay
    });

    const { setCurrentWs } = usePlayerStore();

    // Synchronise playback state whenever the `isPlaying` prop changes. If the
    // WaveSurfer instance isn't ready yet we defer `play()` until the `ready`
    // event to avoid the "NotSupportedError: The element has no supported
    // sources." browser exception.
     useEffect(() => {
         const ws = wavesurferRef.current;
         console.log('[WaveformPlayer] Playback sync effect - isPlaying:', isPlaying, 'ws:', !!ws, 'ws.isPlaying:', ws?.isPlaying?.());
         if (!ws) return;

         if (isPlaying) {
             // Already playing? nothing to do.
            if (ws.isPlaying && ws.isPlaying()) {
                console.log('[WaveformPlayer] Already playing, skipping play()');
                return;
            }

             const tryPlay = () => {
                 try {
                     if (typeof setCurrentWs === 'function') {
                         console.log('[WaveformPlayer] Setting current WS in store');
                         setCurrentWs(ws);
                     }
                     console.log('[WaveformPlayer] Calling ws.play()');
                     ws.play();
                 } catch (e) {
                     /* eslint-disable no-console */
                     console.error('[WaveformPlayer] play() error', e);
                     /* eslint-enable no-console */
                 }
             };

             // WaveSurfer >=7 exposes `isReady` flag once media is attached.
             // If ready, play immediately, otherwise wait for the ready event.
             if ((ws as any).isReady) {
                 console.log('[WaveformPlayer] WS is ready, playing immediately');
                 tryPlay();
             } else {
                 console.log('[WaveformPlayer] WS not ready, waiting for ready event');
                 const onReady = () => {
                     console.log('[WaveformPlayer] Ready event fired, now playing');
                     tryPlay();
                     ws.un && ws.un('ready', onReady);
                 };
                 // Prefer `once` but fall back to `on` + manual unbind
                 if ((ws as any).once) {
                     (ws as any).once('ready', onReady);
                 } else {
                     ws.on('ready', onReady);
                 }
                 return () => {
                     (ws as any).un && (ws as any).un('ready', onReady);
                 };
             }
         } else {
             console.log('[WaveformPlayer] Pausing wavesurfer');
             ws.pause();
         }
     }, [isPlaying, wavesurferRef]);

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
            <div className="w-full h-[var(--px-50)] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">
                    Fetching the track for you...
                </div>
            </div>
        );
    }

    // Show error state if peaks fetch failed
    if (state.error) {
        return (
            <div className="w-full h-[var(--px-50)] flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded">
                <div className="text-red-600 dark:text-red-400 text-sm">
                    {state.error}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full relative z-30 h-[var(--px-50)]">
            <div ref={waveformRef} className="w-full h-full" />
        </div>
    );
});

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;
