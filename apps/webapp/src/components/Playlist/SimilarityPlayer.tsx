import React, { useState, useCallback, useRef, useEffect } from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";
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

interface SimilarityPlayerProps {
    trackId: string;
    isPlaying?: boolean;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, isPlaying = false }) => {
    const { currentWs, setCurrentTrack } = usePlayerStore();
    const { playlistData } = usePlaylistStore();
    
    // Direct reference to the waveform player's wavesurfer instance
    const waveformPlayerRef = useRef<{ getWaveSurfer: () => any } | null>(null);

    const [volume, setVolume] = useState<number>(0.7);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);

    // Sync volume with wavesurfer instance whenever it changes
    useEffect(() => {
        if (currentWs && typeof currentWs.setVolume === 'function') {
            try {
                currentWs.setVolume(volume);
            } catch { /* ignore */ }
        }
    }, [volume, currentWs]);

    // Effect to set up time tracking when component mounts or track changes
    useEffect(() => {
        
        // Use a small delay to ensure WaveformPlayer has initialized
        const timeoutId = setTimeout(() => {
            const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
            
            if (!ws) return;

            const updateTime = () => {
                const newTime = ws.getCurrentTime();
                setCurrentTime(newTime);
            };
            
            const onReady = () => {
                const newDuration = ws.getDuration();
                setDuration(newDuration);
            };

            // Autoplay: advance to next track on finish when enabled
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

                const idx = order.indexOf(trackId);
                if (idx !== -1 && idx + 1 < order.length) {
                    const nextId = order[idx + 1];
                    setCurrentTrack(nextId);
                } else {
                    setCurrentTrack(null);
                }
            };

            // Check if already ready
            if ((ws as any).isReady) {
                onReady();
            }

            ws.on('audioprocess', updateTime);
            ws.on('seek', updateTime);
            ws.on('ready', onReady);
            ws.on('finish', onFinish);
            
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
    }, [trackId]);

    const skipBackward = useCallback(() => {
        // Try to get wavesurfer from direct ref first, then fall back to store
        const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
        if (ws && typeof ws.skipBackward === 'function') {
            ws.skipBackward();
        } else if (ws && typeof ws.skip === 'function') {
            ws.skip(-10);
        } else {
        }
    }, [currentWs]);

    const skipForward = useCallback(() => {
        // Try to get wavesurfer from direct ref first, then fall back to store
        const ws = waveformPlayerRef.current?.getWaveSurfer() || currentWs;
        if (ws && typeof ws.skipForward === 'function') {
            ws.skipForward();
        } else if (ws && typeof ws.skip === 'function') {
            ws.skip(10);
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
        <div className="flex flex-col w-full gap-[var(--px-5)]">
            <WaveformPlayer 
                ref={waveformPlayerRef}
                trackId={trackId}
                isPlaying={isPlaying}
                autoPlay={true}
                volume={volume}
            />

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

                    {/* Time Display */}
                    <span className="text-xs text-white whitespace-nowrap min-w-[60px] text-right">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SimilarityPlayer;
