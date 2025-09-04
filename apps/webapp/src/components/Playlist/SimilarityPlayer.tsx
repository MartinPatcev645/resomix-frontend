import React, { useCallback, useRef } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { usePlayerManager, usePeaksWaveform } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";

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

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration }) => {
    const { volume, setVolume, startPlaying, currentTrackId } = usePlayerManager();
    const howlerController = usePlayerStore((s) => s.howlerController);
    
    // Waveform container ref for Peaks
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    
    // Always show waveform for this track (static display when not playing)
    const { isLoading, error } = usePeaksWaveform({
        containerRef: waveformContainerRef,
        trackId: trackId,
        height: 50,
        onReady: () => console.log('[SimilarityPlayer] Peaks ready')
    });

    // Check if this track is currently active
    const isCurrentTrack = currentTrackId === trackId;

    // Use current time only if this is the active track
    const currentTime = usePlayerStore((s) => 
        isCurrentTrack ? s.inputCurrentTime : 0
    );

    // Play this track using the global controller
    const handlePlayTrack = useCallback(() => {
        if (!howlerController) return;
        
        const audioUrl = `https://media.resomix.com/signed-audio/?uuid=${trackId}`;
        
        // Load and play this track
        howlerController.load(audioUrl, trackId);
        howlerController.play();
        
        // Update global state
        startPlaying(trackId);
    }, [trackId, howlerController, startPlaying]);

    // Skip functions only work if this is the current track
    const skipBackward = useCallback(() => {
        if (!isCurrentTrack) {
            handlePlayTrack(); // Switch to this track first
            return;
        }
        if (!howlerController) return;
        
        const t = howlerController.getCurrentTime();
        howlerController.seek(Math.max(0, t - 10));
    }, [isCurrentTrack, handlePlayTrack, howlerController]);

    const skipForward = useCallback(() => {
        if (!isCurrentTrack) {
            handlePlayTrack(); // Switch to this track first
            return;
        }
        if (!howlerController) return;
        
        const t = howlerController.getCurrentTime();
        const d = howlerController.getDuration();
        howlerController.seek(Math.min(d, t + 10));
    }, [isCurrentTrack, handlePlayTrack, howlerController]);

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
            <div className="flex flex-col w-full gap-[var(--px-5)]">
                <div className="h-[var(--px-50)] overflow-y-hidden">
                    <div 
                        ref={waveformContainerRef}
                        className="w-full h-full"
                    >
                        {isLoading && <div className="text-center text-sm text-gray-500">Loading waveform...</div>}
                        {error && <div className="text-center text-sm text-red-500">Error: {error}</div>}
                    </div>
                </div>

                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-[var(--px-10)] justify-between lg:justify-start">
                        {/* Play Button - activates this track */}
                        <button 
                            type="button" 
                            onClick={handlePlayTrack} 
                            title="Play this track"
                            className="w-[var(--px-25)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer flex-shrink-0"
                        >
                            <img
                                src={PlaySvg}
                                alt="Play"
                                className='w-[var(--px-12)] h-[var(--px-12)]'
                            />
                        </button>
                        
                        {/* Skip Backward - only active if this is current track */}
                        <button 
                            type="button" 
                            onClick={skipBackward} 
                            title={isCurrentTrack ? "Skip back 10s" : "Switch to this track"}
                            className={`font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)] ${!isCurrentTrack ? 'opacity-50' : ''}`}
                        >
                            <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                            <span className="mt-[var(--px-3)]">10s</span>
                        </button>
                        
                        {/* Skip Forward - only active if this is current track */}
                        <button 
                            type="button" 
                            onClick={skipForward} 
                            title={isCurrentTrack ? "Skip forward 10s" : "Switch to this track"}
                            className={`font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)] ${!isCurrentTrack ? 'opacity-50' : ''}`}
                        >
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
                    <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
                        {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </span>
                </div>
            </div>
        </>
    );
};

export default SimilarityPlayer;
