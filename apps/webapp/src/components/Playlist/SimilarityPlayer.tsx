import React, { useEffect, useCallback, useRef, useState } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { usePlayerManager, useCustomPeaks, useGlobalHowlerController } from "@resomix/hooks";

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
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration }) => {
    const {
        currentTrackId,
        startPlaying,
        volume,
        setVolume,
    } = usePlayerManager();

    // const [isPlaying, setIsPlaying] = useState<boolean>(currentTrackId === trackId);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const waveformContainerRef = useRef<HTMLDivElement>(null);

    const { loading: wfLoading, error: wfError, setTime, attachMediaElement, attachOverviewElement } = useCustomPeaks(trackId);

    // Get the GLOBAL controller from store
    /*
    function useHowlerControllerWithFallback() {
        const storeController = usePlayerStore((s) => s.howlerController);
        const defaultController = useHowlerController();
        return storeController || defaultController;
    }
     */

    const howlerController = useRef(useGlobalHowlerController());
    const {
        isLoaded,
        seek,
        currentTime,
        getHtmlAudioNode,
    } = howlerController.current;

    const audioUrl = `https://media.resomix.com/signed-audio/?uuid=${trackId}`;

    useEffect(() => {
        if (!isLoaded) return;
        setTime(currentTime);
    }, [isLoaded, currentTime, setTime]);

    const audioNode = getHtmlAudioNode();
    useEffect(() => {
        if (audioNode) attachMediaElement(audioNode);
    }, [audioNode, attachMediaElement]);

    useEffect(() => {
        if (waveformContainerRef.current) {
            attachOverviewElement(waveformContainerRef.current);
        }
    }, [waveformContainerRef.current]);

    useEffect(()=>{
        const tmp: boolean = currentTrackId === trackId;
        if (tmp !== isPlaying) {
            setIsPlaying(tmp);
            if (tmp) {
                howlerController.current.pause();
            }
        }
    }, [currentTrackId]);

    useEffect(() => {
        play();
        return ()=>pause();
    }, []);

    const play = () => {
        if (!howlerController) return;
        if (audioUrl) {
            howlerController.current.load(audioUrl, trackId);
            howlerController.current.play();
        }
        startPlaying(trackId);
    }

    const pause = ()=>{
        howlerController.current?.pause();
        // stopPlaying();
    }

    const togglePlay = () => {
        if (!howlerController) return;

        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    const skipBackward = useCallback(() => {
        if (!howlerController.current) return;
        seek(Math.max(0, currentTime - 10));
    }, [howlerController, currentTime, seek]);

    const skipForward = useCallback(() => {
        if (!howlerController.current) return;
        const d = howlerController.current.getDuration();
        seek(Math.min(d, currentTime + 10));
    }, [howlerController.current, currentTime, seek]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
    };

    const handleVolumeIconClick = () => {
        if (volume === 0) {
            setVolume(0.7);
        } else {
            setVolume(0);
        }
    };

    return (
      <div className="flex flex-col w-full gap-[var(--px-5)]">
          <div className="h-[var(--px-50)] overflow-y-hidden">
              <div
                ref={waveformContainerRef}
                className="w-full h-full"
              >
                  {wfLoading && <div className="text-center text-sm text-gray-500">Loading waveform...</div>}
                  {wfError && <div className="text-center text-sm text-red-500">Error: {wfError}</div>}
              </div>
          </div>

          <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-[var(--px-10)] justify-between lg:justify-start">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-[var(--px-25)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer flex-shrink-0"
                  >
                      <img
                        src={isPlaying ? PauseSvg : PlaySvg}
                        alt={isPlaying ? 'Pause' : 'Play'}
                        className='w-[var(--px-12)] h-[var(--px-12)]'
                      />
                  </button>

                  <button
                    type="button"
                    onClick={skipBackward}
                    className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                  >
                      <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                      <span className="mt-[var(--px-3)]">10s</span>
                  </button>

                  <button
                    type="button"
                    onClick={skipForward}
                    className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                  >
                      <span className="mt-[var(--px-3)]">10s</span>
                      <img src={NextTrackSvg} alt="Next Track" className="w-[var(--px-10)] lg:w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]" />
                  </button>
              </div>

              <div className="hidden lg:flex items-center gap-[var(--px-8)]">
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

                  <div className="relative flex items-center w-[var(--px-80)]">
                      <div className="absolute w-[var(--px-80)] h-[var(--px-1)] bg-white"></div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="relative w-full h-[var(--px-2)] appearance-none cursor-pointer bg-transparent z-10 [&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                      />
                  </div>
              </div>

              <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
          </div>
      </div>
    );
};

export default SimilarityPlayer;