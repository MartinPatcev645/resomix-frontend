import React, { useCallback, useRef, useEffect } from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { usePlayerManager } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { AudioProvider, useAudioProviderRef } from "@resomix/hooks";

// Simple time formatter mm:ss
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SimilarityPlayerProps {
    trackId: string;
    totalDuration: number;
    isPlaying?: boolean;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration, isPlaying = false }) => {
    const { setSimilarityWs, playNext, volume, setVolume } = usePlayerManager();

    // Direct reference to the waveform player's wavesurfer instance
    const waveformPlayerRef = useRef<{ getWaveSurfer: () => any } | null>(null);
    
    // AudioProvider pattern for gesture preservation
    const { audioProviderRef, getAudioElement } = useAudioProviderRef();

    // Playbook time & duration sourced from the shared player store
    const currentTime = usePlayerStore((s) => s.similarityCurrentTime);
    const setSimilarityCurrentTime = usePlayerStore((s) => s.setSimilarityCurrentTime);
    
    // Provider readiness state
    const setSimilarityProviderReady = usePlayerStore((s) => s.setSimilarityProviderReady) || (() => {});
    
    // Reset provider readiness when track changes
    const previousTrackRef = useRef<string | null>(null);
    useEffect(() => {
        if (trackId && trackId !== previousTrackRef.current) {
            setSimilarityProviderReady(false);
            console.log('[SimilarityPlayer] Track changed, resetting provider readiness:', trackId);
            previousTrackRef.current = trackId;
        }
    }, [trackId, setSimilarityProviderReady]);

    const skipBackward = useCallback(() => {
        const audioProvider = audioProviderRef.current;
        if (audioProvider) {
            const currentTime = audioProvider.getCurrentTime();
            const newTime = Math.max(0, currentTime - 10);
            console.log('[SimilarityPlayer] Skipping backward from', currentTime, 'to', newTime);
            audioProvider.setCurrentTime(newTime);
        }
    }, []);

    const skipForward = useCallback(() => {
        const audioProvider = audioProviderRef.current;
        if (audioProvider) {
            const currentTime = audioProvider.getCurrentTime();
            const duration = audioProvider.getDuration();
            const newTime = Math.min(duration, currentTime + 10);
            console.log('[SimilarityPlayer] Skipping forward from', currentTime, 'to', newTime);
            audioProvider.setCurrentTime(newTime);
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
                src={trackId ? `https://media.resomix.com/signed-audio/?uuid=${trackId}` : undefined}
                volume={volume}
                onPlay={() => console.log('[SimilarityPlayer] Audio started playing')}
                onPause={() => console.log('[SimilarityPlayer] Audio paused')}
                onTimeUpdate={setSimilarityCurrentTime}
                onLoadedMetadata={() => {
                    console.log('[SimilarityPlayer] Audio metadata loaded - provider ready');
                    setSimilarityProviderReady(true);
                }}
                onError={(error) => {
                    console.error('[SimilarityPlayer] Audio error:', error);
                    setSimilarityProviderReady(false);
                }}
                onEnded={() => {
                    console.log('[SimilarityPlayer] Audio ended');
                    playNext();
                }}
            />
            <div className="flex flex-col w-full gap-[var(--px-5)]">
                <div className="h-[var(--px-50)] overflow-y-hidden">
                    <WaveformPlayer
                        ref={waveformPlayerRef}
                        trackId={trackId}
                        isPlaying={isPlaying}
                        volume={volume}
                        duration={totalDuration}
                        persistentAudioElement={getAudioElement() || undefined}

                    onReadyWs={(ws) => {
                        try {
                            setSimilarityWs(ws);

                            // If this track is meant to be playing, start immediately now that ws is ready
                            if (isPlaying) {
                                try {
                                    ws.play();
                                } catch (e) {
                                    console.error('[SimilarityPlayer] play() error after ready', e);
                                }
                            }

                            // attach finish listener
                            ws.un && ws.un('finish');
                            ws.on('finish', () => {
                                playNext();
                            });
                        } catch (error) {
                            console.error('[SimilarityPlayer] Failed to setup WaveSurfer:', error);
                        }
                    }}
                />
            </div>

            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-[var(--px-10)] justify-between lg:justify-start">
                    {/* Skip Backward */}
                    <button type="button" onClick={skipBackward} title="Skip back 10s" className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
                        <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                        <span className="mt-[var(--px-3)]">10s</span>
                    </button>
                    {/* Skip Forward */}
                    <button type="button" onClick={skipForward} title="Skip forward 10s" className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
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
                <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
            </div>
        </div>
        </>
    );
};

export default SimilarityPlayer;
