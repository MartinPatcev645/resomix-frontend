import React, { useEffect, useCallback } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { useCustomPeaks, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { useConfig } from "@resomix/stores";
import { useDebouncedWaveformSeek } from "@resomix/hooks/Waveform/useDebouncedWaveformSeek.js";
import {WaveformLoader} from "@resomix/ui";

const SEEK_DEBOUNCE_MS = 300;
const HOLD_AFTER_SEEK_MS = 200;

// Simple time formatter mm:ss
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface InputPlayerProps {
    trackId?: string;
    totalDuration: number;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, totalDuration }) => {
    const effectiveId = trackId ?? "uploaded-local";

    const currentTime = usePlayerStore((s) => s.trackTimes?.[effectiveId] ?? 0);
    const setTrackTime = usePlayerStore((s) => s.setTrackTime);
    const currentTrackId = usePlayerStore((s) => s.currentTrackId);
    const isCommonPlay: boolean = usePlayerStore((s) => s.isPlaying);
    const volume: number = usePlayerStore((s) => s.volume);
    const setVolume = usePlayerStore((s) => s.setVolume);
    const networkError: boolean = usePlayerStore((s) => s.networkError);
    // const networkErrorReason: string | null = usePlayerStore((s) => s.networkErrorReason);

    const isPlaying = isCommonPlay && currentTrackId === effectiveId;

    const { loading: wfLoading, error: wfError, setTime, attachOverviewElement } = useCustomPeaks(trackId || "");

    const hlsController = useGlobalAudioController();

    const { containerRef, isDragging, uiTime, requestSeek } = useDebouncedWaveformSeek({
        id: effectiveId,
        totalDuration,
        currentTime,
        setTime,
        onPreview: (t) => setTrackTime(effectiveId, t),
        onCommit: (t) => {
            if (currentTrackId === effectiveId) {
                hlsController.seek(t, effectiveId);
            }
            setTrackTime(effectiveId, t);
        },
        debounceMs: SEEK_DEBOUNCE_MS,
        holdAfterMs: HOLD_AFTER_SEEK_MS,
    });

    useEffect(() => {
        hlsController.load(effectiveId);
    }, [hlsController, effectiveId]);

    useEffect(() => {
        if (containerRef.current) {
            attachOverviewElement(containerRef.current);
        }
    }, [containerRef, attachOverviewElement]);

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

    // skip +/- 10s
    const skipBackward = useCallback(() => {
        if (!hlsController) return;
        const base = uiTime || 0;
        requestSeek(Math.max(0, base - 10));
    }, [requestSeek, uiTime]);

    const skipForward = useCallback(() => {
        if (!hlsController) return;
        const d = Number.isFinite(hlsController.getDuration())
          ? hlsController.getDuration()
          : totalDuration;
        const base = uiTime || 0;
        requestSeek(Math.min(d, base + 10));
    }, [requestSeek, uiTime, totalDuration]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
    };

    const handleVolumeIconClick = () => {
        setVolume(volume === 0 ? 0.7 : 0);
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
                    alt={isPlaying ? "Pause" : "Play"}
                    className="w-[var(--px-16)] h-[var(--px-16)]"
                  />
              </button>

              <div className="flex flex-col w-full gap-[var(--px-5)]">
                  <div
                    ref={containerRef}
                    className="h-[var(--px-50)] overflow-y-hidden w-[var(--px-280)] max-w-[var(--px-280)] lg:w-[var(--px-444)] lg:max-w-[var(--px-444)]"
                    style={{ cursor: isDragging ? "grabbing" : "pointer" }}
                  >
                      {wfLoading && <WaveformLoader/>}
                      {wfError && <div className="text-center text-sm text-red-500">Error: {wfError}</div>}
                  </div>

                  <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-[var(--px-10)]">
                          {/* Skip Backward */}
                          <button
                            type="button"
                            onClick={skipBackward}
                            title="Skip back 10s"
                            className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                          >
                              <img
                                src={NextTrackSvg}
                                alt="Previous Track"
                                className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180"
                              />
                              <span className="mt-[var(--px-3)]">10s</span>
                          </button>
                          {/* Skip Forward */}
                          <button
                            type="button"
                            onClick={skipForward}
                            title="Skip forward 10s"
                            className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                          >
                              <span className="mt-[var(--px-3)]">10s</span>
                              <img
                                src={NextTrackSvg}
                                alt="Next Track"
                                className="w-[var(--px-10)] lg:w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]"
                              />
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
                                    background: "transparent",
                                    outline: "none",
                                }}
                              />
                          </div>
                      </div>

                      {/* Time Display */}
                      <div className="flex items-center gap-2">
              <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
                {formatTime(uiTime)} / {formatTime(totalDuration)}
              </span>
                          {networkError && <div className="absolute text-[length:var(--px-10)]  bottom-9 left-40 text-yellow-200">Network problems</div>}
                      </div>
                  </div>
              </div>
          </div>
          <div className="text-sm text-gray-500 text-right -my-2">
              Version: {useConfig((s) => s.version)}
          </div>
      </>
    );
};

export default InputPlayer;