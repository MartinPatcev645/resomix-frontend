import React, { useState, useEffect, useCallback, useRef } from "react";
import WaveformPlayer, { type WaveformPlayerRef } from "./WaveformPlayer.tsx";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { usePlayerStore } from "@resomix/stores";
import { usePlaylistStore } from "@resomix/stores";

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
    const { playlistData } = usePlaylistStore();
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
            if (!ws) return;

            const updateTime = () => setCurrentTime(ws.getCurrentTime());
            const onReady = () => {
                const dur = ws.getDuration();
                setDuration(dur);
            };

            // When track finishes, move to next track if autoplay is enabled
            const onFinish = () => {
                if (!usePlayerStore.getState().autoplay) return;

                // Build ordered list of track IDs (input + similar)
                const order: string[] = [];
                if (playlistData?.queried_track?.id) {
                    order.push(playlistData.queried_track.id);
                }
                if (playlistData?.similar_tracks?.length) {
                    order.push(...playlistData.similar_tracks.map(t => t.id));
                }

                const currentIdx = order.indexOf(effectiveId);
                if (currentIdx !== -1 && currentIdx + 1 < order.length) {
                    const nextId = order[currentIdx + 1];
                    setCurrentTrack(nextId);
                } else {
                    // No next track – stop playback
                    setCurrentTrack(null);
                }
            };

            ws.on('audioprocess', updateTime);
            ws.on('seek', updateTime);

            ws.on('finish', onFinish);
            // Check if already ready
            if ((ws as any).isReady) {
                onReady();
            } else {
                ws.on('ready', onReady);
            }

            // Store cleanup function on the component instance
            const cleanup = () => {
                ws.un && ws.un('audioprocess', updateTime);
                ws.un && ws.un('seek', updateTime);
                ws.un && ws.un('ready', onReady);
                ws.un && ws.un('finish', onFinish);
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

        if (ws) {
            // Store playing state before skip
            const isPlayingTemp = ws.isPlaying && ws.isPlaying();

            if (typeof ws.skipBackward === 'function') {
                ws.skipBackward();
            } else if (typeof ws.skip === 'function') {
                ws.skip(-10);
            }

            // Check if playing state changed and restore if needed
            setTimeout(() => {
                const isPlayingAfter = ws.isPlaying && ws.isPlaying();

                if (isPlayingTemp && !isPlayingAfter) {
                    try {
                        ws.play();
                    } catch (e) {
                    }
                }
            }, 50);
        } else {
        }
    }, [currentWs]);

    const skipForward = useCallback(() => {
        // Try to get wavesurfer from direct ref first, then fall back to store
        const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;

        if (ws) {
            // Store playing state before skip
            const isPlayingTemp = ws.isPlaying && ws.isPlaying();

            if (typeof ws.skipForward === 'function') {
                ws.skipForward();
            } else if (typeof ws.skip === 'function') {
                ws.skip(10);
            }

            // Check if playing state changed and restore if needed
            setTimeout(() => {
                const isPlayingAfter = ws.isPlaying && ws.isPlaying();

                if (isPlayingTemp && !isPlayingAfter) {
                    try {
                        ws.play();
                    } catch (e) {
                    }
                }
            }, 50);
        } else {
        }
    }, [currentWs]);

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

                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-[var(--px-10)]">
                        {/* Skip Backward */}
                        <button type="button" onClick={skipBackward} title="Skip back 10s" className="font-fira text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
                            <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                            <span className="mt-[var(--px-3)]">10s</span>
                        </button>
                        {/* Skip Forward */}
                        <button type="button" onClick={skipForward} title="Skip forward 10s" className="font-fira text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]">
                            <span className="mt-[var(--px-3)]">10s</span>
                            <img src={NextTrackSvg} alt="Next Track" className="w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]" />
                        </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-[var(--px-8)]">
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
                    <span className="text-[length:var(--px-8)] text-right font-fira font-light">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default InputPlayer;
