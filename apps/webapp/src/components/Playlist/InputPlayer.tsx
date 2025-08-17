import React, { useState, useEffect, useCallback, useRef } from "react";
import WaveformPlayer, { type WaveformPlayerRef } from "./WaveformPlayer.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause_black.svg";
import { usePlayerStore } from "@resomix/stores";

// Simple time formatter mm:ss
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface InputPlayerProps {
    trackId?: string;
    audioUrl?: string;
    /** Auto-start playback once ready */
    autoPlay?: boolean;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, audioUrl, autoPlay = false }) => {
    // Use a fallback id for local uploads so we always have a string
    const effectiveId = trackId ?? 'uploaded-local';

    const { currentTrackId, setCurrentTrack, currentWs } = usePlayerStore();
    const isPlaying = currentTrackId === effectiveId;

    // Direct reference to the waveform player's wavesurfer instance
    const waveformPlayerRef = useRef<WaveformPlayerRef>(null);

    const [volume, setVolume] = useState<number>(0.7);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);

    // When autoPlay requested, register this track on mount
    useEffect(() => {
        if (autoPlay && currentTrackId == null) {
            setCurrentTrack(effectiveId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Attach event listeners for time / duration when wavesurfer instance changes
    useEffect(() => {
        // Use a timeout to ensure wavesurfer is ready after WaveformPlayer mounts
        const timeoutId = setTimeout(() => {
            const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
            console.log('[InputPlayer] Time tracking setup - ws available:', !!ws);
            if (!ws) return;

            const updateTime = () => setCurrentTime(ws.getCurrentTime());
            const onReady = () => {
                const dur = ws.getDuration();
                console.log('[InputPlayer] Got duration:', dur);
                setDuration(dur);
            };

            console.log('[InputPlayer] Attaching time tracking events');
            ws.on('audioprocess', updateTime);
            ws.on('seek', updateTime);

            // Check if already ready
            if ((ws as any).isReady) {
                console.log('[InputPlayer] WS already ready, getting duration');
                onReady();
            } else {
                ws.on('ready', onReady);
            }

            // Store cleanup function on the component instance
            const cleanup = () => {
                console.log('[InputPlayer] Cleaning up time tracking events');
                ws.un && ws.un('audioprocess', updateTime);
                ws.un && ws.un('seek', updateTime); 
                ws.un && ws.un('ready', onReady);
            };
            
            // Store cleanup for the effect cleanup
            return cleanup;
        }, 100);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [effectiveId]); // Only depend on track ID, not duration or currentWs

    // Separate effect for syncing volume with currentWs from store (fallback)
    useEffect(() => {
        if (currentWs && typeof currentWs.setVolume === 'function') {
            try {
                currentWs.setVolume(volume);
            } catch { /* ignore */ }
        }
    }, [volume, currentWs]);

    const togglePlay = () => {
        if (isPlaying) {
            setCurrentTrack(null);
        } else {
            setCurrentTrack(effectiveId);
        }
    };

    const skipBackward = useCallback(() => {
        // Try to get wavesurfer from direct ref first, then fall back to store
        const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
        console.log('[InputPlayer] Skip backward clicked, currentWs:', currentWs, 'directWs:', !!waveformPlayerRef.current?.getWaveSurfer());
        if (ws && typeof ws.skipBackward === 'function') {
            console.log('[InputPlayer] Calling skip(-10)');
            ws.skipBackward();
        } else if (ws && typeof ws.skip === 'function') {
            console.log('[InputPlayer] Calling skip(-10) fallback');
            ws.skip(-10);
        } else {
            console.log('[InputPlayer] No wavesurfer instance available for skip backward');
        }
    }, [currentWs]);

    const skipForward = useCallback(() => {
        // Try to get wavesurfer from direct ref first, then fall back to store
        const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
        console.log('[InputPlayer] Skip forward clicked, currentWs:', currentWs, 'directWs:', !!waveformPlayerRef.current?.getWaveSurfer());
        if (ws && typeof ws.skipForward === 'function') {
            console.log('[InputPlayer] Calling skip(10)');
            ws.skipForward();
        } else if (ws && typeof ws.skip === 'function') {
            console.log('[InputPlayer] Calling skip(10) fallback');
            ws.skip(10);
        } else {
            console.log('[InputPlayer] No wavesurfer instance available for skip forward');
        }
    }, [currentWs]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        console.log('[InputPlayer] Volume change:', newVolume);
        setVolume(newVolume);
    };

    return (
        <div className="flex items-center gap-2 w-full">
            {/* Play / Pause */}
            <button
                type="button"
                className="w-[var(--px-35)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors"
                onClick={togglePlay}
            >
                <img
                    src={isPlaying ? PauseSvg : PlaySvg}
                    alt={isPlaying ? 'Pause' : 'Play'}
                    className={isPlaying ? 'w-[var(--px-16)] h-[var(--px-16)]' : 'w-[var(--px-24)] h-[var(--px-24)]'}
                />
            </button>

            {/* Skip Backward */}
            <button type="button" onClick={skipBackward} title="Skip back 10s" className="text-white px-1">«10s</button>

            {/* Waveform */}
            <div className="flex-1">
                <WaveformPlayer
                    ref={waveformPlayerRef}
                    trackId={trackId}
                    audioUrl={audioUrl}
                    isPlaying={isPlaying}
                    autoPlay={autoPlay}
                    volume={volume}
                />
            </div>

            {/* Skip Forward */}
            <button type="button" onClick={skipForward} title="Skip forward 10s" className="text-white px-1">10s»</button>

            {/* Volume Slider */}
            <div className="flex items-center gap-1">
                <span className="text-xs text-white">🔊</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-[var(--px-60)] h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
                    }}
                />
                <span className="text-xs text-white min-w-[30px]">{Math.round(volume * 100)}%</span>
            </div>

            {/* Time Display */}
            <span className="text-xs text-white whitespace-nowrap min-w-[60px] text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    );
};

export default InputPlayer;
