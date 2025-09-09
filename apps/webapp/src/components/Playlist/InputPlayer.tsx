import React, { useEffect, useCallback, useRef, useState } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import {useHowlerController, usePlayerManager, useCustomPeaks} from "@resomix/hooks";
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
    autoPlay?: boolean;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, totalDuration, autoPlay = false }) => {
    const effectiveId = trackId ?? 'uploaded-local';

    const {
        currentTrackId,
        startPlaying,
        volume,
        setVolume,
    } = usePlayerManager();

    const [isPlaying, setIsPlaying] = useState<boolean>(currentTrackId === effectiveId);

    const waveformContainerRef = useRef<HTMLDivElement>(null);

    const { loading: wfLoading, error: wfError, setTime, attachMediaElement, attachOverviewElement } = useCustomPeaks(trackId || '');

    // Get the GLOBAL controller from store (don't create new instance)
    function useHowlerControllerWithFallback() {
        const storeController = usePlayerStore((s) => s.howlerController);
        const defaultController = useHowlerController();

        return storeController || defaultController;
    }

    const howlerController = useHowlerControllerWithFallback();
    const {
        isLoaded,
        seek,
        currentTime,
    } = howlerController;

    // Build audioUrl here
    const audioUrl = trackId
        ? `https://media.resomix.com/signed-audio/?uuid=${trackId}`
        : '';

    const setInputProviderReady = usePlayerStore((s) => s.setInputProviderReady) || (() => { });

    useEffect(() => {
        if (!isLoaded) return;
        setTime(currentTime);
    }, [isLoaded, currentTime, setTime]);

    // Autoplay: register this track on mount if requested
    useEffect(() => {
        howlerController.load(audioUrl, effectiveId);
        if (autoPlay && currentTrackId == null) {
            startPlaying(effectiveId);
        }
    }, []);

    const audioNode = howlerController.getHtmlAudioNode();
    useEffect(() => {
        if (audioNode) attachMediaElement(audioNode);
    }, [audioNode, attachMediaElement]);

    // Load saved position from localStorage on mount
    useEffect(() => {
        if (isLoaded) {
            const savedPosition = localStorage.getItem(`track-position-${trackId}`);
            if (savedPosition) {
                const position = parseFloat(savedPosition);
                if (position < totalDuration) {
                    seek(position);
                    setTime(position,  true);
                }
            }
        }
    }, [isLoaded, totalDuration, trackId, seek]);

    useEffect(()=>{
        const tmp: boolean = currentTrackId === effectiveId;
        if (tmp !== isPlaying) {
            setIsPlaying(tmp);
            if (!tmp) {
                howlerController.pause();
            }
        }
    }, [currentTrackId]);


    // Save position to localStorage when it changes
    useEffect(() => {
        const el = waveformContainerRef.current;
        if (!el || !isLoaded) return;
        const onClick = (ev: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
            if (totalDuration > 0) {
                const newPosition = x * totalDuration;
                seek(newPosition);
                setTime(newPosition,  true);
                localStorage.setItem(`track-position-${trackId}`, newPosition.toString());
            }
        };
        el.addEventListener('click', onClick);
        return () => el.removeEventListener('click', onClick);
    }, [isLoaded, totalDuration, seek, trackId, waveformContainerRef.current]);

    useEffect(() => {
        if (waveformContainerRef.current) {
            attachOverviewElement(waveformContainerRef.current);
        }
    }, [waveformContainerRef.current]);

    // Reset readiness when the effective track identity changes
    const prevIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (effectiveId !== prevIdRef.current) {
            setInputProviderReady(false);
            prevIdRef.current = effectiveId;
        }
    }, [effectiveId, setInputProviderReady]);

    const togglePlay = () => {
        if (!howlerController) return;

        if (isPlaying) {
            howlerController.pause();
        } else {
            if (audioUrl) {
                // Load and play through the global controller
                // howlerController.load(audioUrl, effectiveId);
                howlerController.play();
                setInputProviderReady(true);
            }
            // Set this as the current track
            startPlaying(effectiveId);
        }
    };

    // skip +/- 10s (only works if this is the current track)
    const skipBackward = useCallback(() => {
        if (!howlerController) return;
        seek(Math.max(0, currentTime - 10));
    }, [howlerController]);

    const skipForward = useCallback(() => {
        if (!howlerController) return;
        const d = howlerController.getDuration();
        seek(Math.min(d, currentTime + 10));
    }, [howlerController]);

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
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InputPlayer;
