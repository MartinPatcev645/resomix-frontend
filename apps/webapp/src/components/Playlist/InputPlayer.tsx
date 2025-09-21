import React, { useEffect, useCallback, useRef, useState } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { useCustomPeaks, useGlobalAudioController } from "@resomix/hooks";
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
    totalDuration: number;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, totalDuration }) => {
    const effectiveId = trackId ?? 'uploaded-local';

    const currentTime = usePlayerStore(s => s.trackTimes?.[effectiveId] ?? 0);
    const setTrackTime = usePlayerStore(s => s.setTrackTime);
    const currentTrackId = usePlayerStore(s => s.currentTrackId);
    const isCommonPlay: boolean = usePlayerStore(s => s.isPlaying);
    const volume: number = usePlayerStore(s => s.volume);
    const setVolume = usePlayerStore(s => s.setVolume);

    const [isPlaying, setIsPlaying] = useState<boolean>(isCommonPlay && currentTrackId === effectiveId);

    const [isDragging, setIsDragging] = useState(false);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const pendingSeekPosition = useRef<number | null>(null);

    const { loading: wfLoading, error: wfError, setTime, attachOverviewElement } = useCustomPeaks(trackId || '');

    const hlsController = useGlobalAudioController();

    const seekRef = useRef<number | null>(null);
    const requestSeek = useCallback((time: number) => {
        if (seekRef.current) {
            cancelAnimationFrame(seekRef.current);
        }
        seekRef.current = requestAnimationFrame(() => {
            console.log('seek', currentTrackId, effectiveId);
            if (currentTrackId === effectiveId) {
                hlsController.seek(time, effectiveId);
            }
            setTime(time, true);
            setTrackTime(effectiveId, time);
        });
    }, [hlsController, effectiveId, setTime, setTrackTime, currentTrackId]);

    const handleSeek = useCallback((clientX: number) => {
        const el = waveformContainerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        if (totalDuration > 0) {
            const newPosition = x * totalDuration;
            setTime(newPosition, true);
            pendingSeekPosition.current = newPosition;
        }
    }, [totalDuration, setTime]);

    const applyPendingSeek = useCallback(() => {
        if (pendingSeekPosition.current !== null) {
            requestSeek(pendingSeekPosition.current);
            pendingSeekPosition.current = null;
        }
    }, [requestSeek]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        handleSeek(e.clientX);
    }, [handleSeek]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            handleSeek(e.clientX);
        }
    }, [isDragging, handleSeek]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        applyPendingSeek();
    }, [applyPendingSeek]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        setIsDragging(true);
        handleSeek(e.touches[0].clientX);
    }, [handleSeek]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (isDragging) {
            handleSeek(e.touches[0].clientX);
        }
    }, [isDragging, handleSeek]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        applyPendingSeek();
    }, [applyPendingSeek]);

    useEffect(() => {
        if (!isDragging) {
            setTime(currentTime);
        }
    }, [currentTime, setTime, isDragging]);

    useEffect(() => {
        hlsController.load(effectiveId);
    }, [hlsController, effectiveId]);

    useEffect(() => {
        const isPlay: boolean = isCommonPlay && currentTrackId === effectiveId;
        if (isPlay !== isPlaying) {
            setIsPlaying(isPlay);
        }
    }, [currentTrackId, effectiveId, isPlaying, isCommonPlay]);

    useEffect(() => {
        const el = waveformContainerRef.current;
        if (!el) return;

        el.addEventListener('mousedown', handleMouseDown as never);
        el.addEventListener('mousemove', handleMouseMove as never);
        el.addEventListener('touchstart', handleTouchStart as never);
        el.addEventListener('touchmove', handleTouchMove as never);

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            el.removeEventListener('mousedown', handleMouseDown as never);
            el.removeEventListener('mousemove', handleMouseMove as never);
            el.removeEventListener('touchstart', handleTouchStart as never);
            el.removeEventListener('touchmove', handleTouchMove as never);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

    useEffect(() => {
        if (waveformContainerRef.current) {
            attachOverviewElement(waveformContainerRef.current);
        }
    }, [waveformContainerRef.current, attachOverviewElement]);

    const togglePlay = () => {
        if (!hlsController) return;

        if (isPlaying) {
            hlsController.pause();
        } else {
            if (currentTrackId !== effectiveId) {
                hlsController.load(effectiveId, true);
            } else {
                hlsController.play();
            }
        }
    };

    // skip +/- 10s (only works if this is the current track)
    const skipBackward = useCallback(() => {
        if (!hlsController) return;
        requestSeek(Math.max(0, currentTime - 10));
    }, [hlsController, requestSeek, currentTime]);

    const skipForward = useCallback(() => {
        if (!hlsController) return;
        const d = hlsController.getDuration();
        requestSeek(Math.min(d, currentTime + 10));
    }, [hlsController, requestSeek, currentTime]);

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
            <div className="flex items-center gap-2 w-full">
                {/* Play / Pause */}
                <button
                    type="button"
                    className="w-[var(--px-35)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer flex-shrink-0"
                    onClick={togglePlay}
                >
                    <img
                        src={isPlaying ? PauseSvg : PlaySvg}
                        alt={isPlaying ? 'Pause' : 'Play'}
                        className='w-[var(--px-16)] h-[var(--px-16)]'
                    />
                </button>

                <div className="flex flex-col w-full gap-[var(--px-5)]">
                    <div
                        ref={waveformContainerRef}
                        className="h-[var(--px-50)] overflow-y-hidden w-[var(--px-280)] max-w-[var(--px-280)] lg:w-[var(--px-444)] lg:max-w-[var(--px-444)]"
                        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                    >
                        {wfLoading && <div className="text-center text-sm text-gray-500">Loading waveform...</div>}
                        {wfError && <div className="text-center text-sm text-red-500">Error: {wfError}</div>}
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
                                <img src={NextTrackSvg} alt="Next Track" className="w-[var(--px-10)] lg:w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]" />
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
                                {/* White baseline track */}
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
                                {formatTime(isDragging ? pendingSeekPosition.current || currentTime : currentTime)} / {formatTime(totalDuration)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-sm text-gray-500 text-right -my-2">
                Version: alpha-0.6.2
            </div>
        </>
    );
};

export default InputPlayer;
