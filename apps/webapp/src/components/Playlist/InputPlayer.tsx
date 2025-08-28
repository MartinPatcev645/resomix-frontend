import React, { useEffect, useCallback, useRef, useState } from "react";
import WaveformPlayer, { type WaveformPlayerRef } from "./WaveformPlayer.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { usePlayerManager, AudioProvider, useAudioProviderRef } from "@resomix/hooks";
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
    totalDuration: number;
    autoPlay?: boolean;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, audioUrl, totalDuration, autoPlay = false }) => {
    // Use a fallback id for local uploads so we always have a string
    const effectiveId = trackId ?? 'uploaded-local';

    const { 
        currentTrackId, 
        startPlaying, 
        stopPlaying, 
        playNext, 
        setInputWs,
        volume,
        setVolume,
        isAutoplayEnabled
    } = usePlayerManager();
    const isPlaying = currentTrackId === effectiveId;
    const [isSeeking, setIsSeeking] = useState(false);

    // Direct reference to the waveform player's wavesurfer instance
    const waveformPlayerRef = useRef<WaveformPlayerRef>(null);
    
    // BeMusic pattern: AudioProvider reference for persistent audio element
    const { audioProviderRef, getAudioElement } = useAudioProviderRef();

    // Global volume via player manager
    const currentTime = usePlayerStore((s) => s.inputCurrentTime);
    const setInputCurrentTime = usePlayerStore((s) => s.setInputCurrentTime);
    
    // Provider readiness state (BeMusic pattern) - with fallback for safety
    const inputProviderReady = usePlayerStore((s) => s.inputProviderReady ?? false);
    const setInputProviderReady = usePlayerStore((s) => s.setInputProviderReady) || (() => {});

    // When autoPlay requested, register this track on mount
    useEffect(() => {
        if (autoPlay && currentTrackId == null) {
            startPlaying(effectiveId);
        }
    }, []);

    // Reset provider readiness when track changes (BeMusic pattern)
    const previousTrackRef = useRef<string | null>(null);
    useEffect(() => {
        const currentEffectiveId = trackId || audioUrl || null;
        if (currentEffectiveId && currentEffectiveId !== previousTrackRef.current) {
            setInputProviderReady(false);
            console.log('[InputPlayer] Track changed, resetting provider readiness:', currentEffectiveId);
            previousTrackRef.current = currentEffectiveId;
        }
    }, [trackId, audioUrl, setInputProviderReady]);

    // Re-register finish handler when autoplay changes to ensure correct closure
    useEffect(() => {
        const ws = waveformPlayerRef.current?.getWaveSurfer();
        if (!ws) return;

        const handleFinish = () => {
            // Only advance to next track if not currently seeking
            if (!isSeeking) {
                playNext();
            } else {
                console.log('[InputPlayer] Ignoring finish event during seek operation');
            }
        };

        // Remove any existing finish handlers
        ws.un && ws.un('finish');
        ws.on('finish', handleFinish);
        
        // Track seeking state to prevent accidental track advancement
        ws.un && ws.un('seeking');
        ws.on('seeking', () => {
            setIsSeeking(true);
            // Reset seeking state after a delay
            setTimeout(() => setIsSeeking(false), 200);
        });

        return () => {
            ws.un && ws.un('finish', handleFinish);
            ws.un && ws.un('seeking');
        };
    }, [isAutoplayEnabled, playNext, isSeeking]);

    // Separate effect for syncing volume with input WaveSurfer instance
    useEffect(() => {
        const ws = waveformPlayerRef.current?.getWaveSurfer();
        if (ws && typeof ws.setVolume === 'function') {
            try {
                ws.setVolume(volume);
            } catch { /* ignore */ }
        }
    }, [volume]);

    const togglePlay = () => {
        if (isPlaying) {
            stopPlaying();
        } else {
            // BeMusic pattern: Synchronous track cueing
            // AudioProvider handles async loading, we just cue the track immediately
            const success = startPlaying(effectiveId);
            if (success) {
                console.log('[InputPlayer] Track cued, waiting for provider ready. Current ready state:', inputProviderReady);
            }
        }
    };



    const skipBackward = useCallback(() => {
        const audioProvider = audioProviderRef.current;
        const ws = waveformPlayerRef.current?.getWaveSurfer();

        if (audioProvider && ws) {
            const currentTime = audioProvider.getCurrentTime();
            const newTime = Math.max(0, currentTime - 10);
            
            console.log('[InputPlayer] Skipping backward from', currentTime, 'to', newTime);
            audioProvider.setCurrentTime(newTime);
            
            // Don't try to restore playback - let the AudioProvider handle it
        }
    }, []);

    const skipForward = useCallback(() => {
        const audioProvider = audioProviderRef.current;
        const ws = waveformPlayerRef.current?.getWaveSurfer();

        if (audioProvider && ws) {
            const currentTime = audioProvider.getCurrentTime();
            const duration = audioProvider.getDuration();
            const newTime = Math.min(duration, currentTime + 10);
            
            console.log('[InputPlayer] Skipping forward from', currentTime, 'to', newTime);
            audioProvider.setCurrentTime(newTime);
            
            // Don't try to restore playback - let the AudioProvider handle it
        }
    }, []);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
    };

    const handleVolumeIconClick = () => {
        if (volume === 0) {
            setVolume(0.7); // Unmute to 70%
        } else {
            setVolume(0); // Mute
        }
    };

    return (
        <>
            {/* BeMusic pattern: Persistent AudioProvider */}
            <AudioProvider
                ref={audioProviderRef}
                src={audioUrl || (trackId ? `https://media.resomix.com/signed-audio/?uuid=${trackId}` : undefined)}
                volume={volume}
                onPlay={() => console.log('[InputPlayer] Audio started playing')}
                onPause={() => console.log('[InputPlayer] Audio paused')}
                onTimeUpdate={setInputCurrentTime}
                onLoadedMetadata={() => {
                    console.log('[InputPlayer] Audio metadata loaded - provider ready');
                    setInputProviderReady(true);
                }}
                onError={(error) => {
                    console.error('[InputPlayer] Audio error:', error);
                    setInputProviderReady(false);
                }}
                onEnded={() => {
                    console.log('[InputPlayer] Audio ended');
                    playNext();
                }}
            />

            <div className="flex items-center gap-2 w-full">
                {/* Play / Pause */}
            <button
                type="button"
                className="w-[var(--px-35)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors mb-[var(--px-17)] cursor-pointer"
                onClick={togglePlay}
            >
                <img
                    src={isPlaying ? PauseSvg : PlaySvg}
                    alt={isPlaying ? 'Pause' : 'Play'}
                    className='w-[var(--px-16)] h-[var(--px-16)]'
                />
            </button>

            <div className="flex flex-col w-full gap-[var(--px-5)]">
                {/* Waveform */}
                <div className="h-[var(--px-50)] overflow-y-hidden">
                    <WaveformPlayer
                        ref={waveformPlayerRef}
                        trackId={trackId}
                        audioUrl={audioUrl}
                        isPlaying={isPlaying}
                        volume={volume}
                        duration={totalDuration}
                        persistentAudioElement={getAudioElement() || undefined}
                        onReadyWs={(ws) => {
                            try {
                                setInputWs(ws);
                                // Finish handler is now managed by useEffect above
                            } catch (error) {
                                console.error('[InputPlayer] Failed to setup WaveSurfer:', error);
                            }
                        }}
                    />
                </div>

                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-[var(--px-10)]">
                        {/* Skip Backward */}
                        <button type="button" onClick={skipBackward} title="Skip back 10s" className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
                            <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                            <span className="mt-[var(--px-3)]">10s</span>
                        </button>
                        {/* Skip Forward */}
                        <button type="button" onClick={skipForward} title="Skip forward 10s" className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
                            <span className="mt-[var(--px-3)]">10s</span>
                            <img src={NextTrackSvg} alt="Next Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]" />
                        </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="hidden lg:flex items-center gap-[var(--px-8)]">
                        {/* Volume Icon */}
                        <button
                            type="button"
                            onClick={handleVolumeIconClick}
                            className="flex items-center justify-center w-[var(--px-16)] h-[var(--px-16)]"
                        >
                            {volume === 0 ? (
                                <img src={SoundMuteSvg} alt="Muted" className="w-full h-full" />
                            ) : volume < 0.5 ? (
                                <img src={SoundLowSvg} alt="Low Volume" className="w-full h-full" />
                            ) : (
                                <img src={SoundLoudSvg} alt="High Volume" className="w-full h-full" />
                            )}
                        </button>

                        {/* Volume Slider */}
                        <div className="relative flex items-center w-[var(--px-80)]">
                            {/* White base line track */}
                            <div className="absolute w-[var(--px-80)] h-[var(--px-1)] bg-white"></div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="relative w-full h-[var(--px-2)] appearance-none cursor-pointer bg-transparent z-10 [&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                                style={{
                                    background: 'transparent',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Time Display */}
                    <div className="flex items-center gap-2">
                        <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
                            {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </span>
                        {/* Debug info - remove in production */}
                        <div className="hidden lg:flex items-center gap-1 text-xs opacity-50">
                            <span className={`w-2 h-2 rounded-full ${inputProviderReady ? 'bg-green-500' : 'bg-red-500'}`} title="Provider Ready"></span>
                            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-blue-500' : 'bg-gray-500'}`} title="Playing"></span>
                            <button 
                                onClick={async () => {
                                    const provider = audioProviderRef.current;
                                    if (provider) {
                                        try {
                                            const success = await provider.testGesturePreservation();
                                            console.log('[Debug] Gesture test:', success ? 'PASS' : 'FAIL');
                                        } catch (e) {
                                            console.log('[Debug] Gesture test: ERROR', e);
                                        }
                                    }
                                }}
                                className="text-xs px-1 py-0.5 bg-gray-700 text-white rounded"
                                title="Test Gesture"
                            >
                                🎯
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default InputPlayer;
