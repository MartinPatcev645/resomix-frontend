import React, { useEffect } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import NetworkSvg from "@/assets/icons/network-aleft.svg";
import { useWaveformControls, formatTime } from "@resomix/hooks";
import { usePlayerStore, useConfig } from "@resomix/stores";
import { WaveformLoader } from "@resomix/ui";

interface InputPlayerProps {
    trackId?: string;
    totalDuration: number;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId, totalDuration }) => {
    const volume = usePlayerStore((s) => s.volume);
    const networkError = usePlayerStore((s) => s.networkError);

    const effectiveId = trackId ?? "uploaded-local";

    const ctl = useWaveformControls({ id: effectiveId, totalDuration, withPlayPause: true });

    // Initialize Peaks by attaching the overview element (matches previous behavior)
    useEffect(() => {
        if (ctl.containerRef.current) {
            ctl.attachOverviewElement(ctl.containerRef.current);
        }
    }, [ctl.attachOverviewElement, ctl.containerRef]);

    

    return (
      <>
          <div className="flex items-center gap-2 w-full">
              {/* Play / Pause */}
              <button
                type="button"
                id="input-player-play-pause"
                className="w-[var(--px-35)] aspect-square flex items-center justify-center rounded-full bg-white text-black border border-black hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer flex-shrink-0 player-control player-control-play-pause"
                onClick={ctl.togglePlay}
              >
                  <img
                    src={ctl.isPlaying ? PauseSvg : PlaySvg}
                    alt={ctl.isPlaying ? "Pause" : "Play"}
                    className="w-[var(--px-16)] h-[var(--px-16)]"
                  />
              </button>

              <div className="flex flex-col w-full gap-[var(--px-5)]">
                  <div
                    ref={ctl.containerRef}
                    className="h-[var(--px-50)] overflow-y-hidden w-[var(--px-280)] max-w-[var(--px-280)] lg:w-[var(--px-444)] lg:max-w-[var(--px-444)]"
                    style={{ cursor: ctl.isDragging ? "grabbing" : "pointer" }}
                  >
                      {ctl.wfLoading && <WaveformLoader/>}
                      {ctl.wfError && <div className="text-center text-sm text-red-500">Error: {ctl.wfError}</div>}
                  </div>

                  <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-[var(--px-10)]">
                          {/* Skip Backward */}
                          <button
                            type="button"
                            onClick={ctl.skipBackward}
                            title="Skip back 10s"
                            className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)] player-control player-control-skip-backward"
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
                            onClick={ctl.skipForward}
                            title="Skip forward 10s"
                            className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] p-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)] player-control player-control-skip-forward"
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
                            onClick={ctl.toggleMute}
                            className="flex items-center justify-center w-[var(--px-16)] h-[var(--px-16)] player-control player-control-mute-toggle"
                          >
                              {volume === 0 ? (
                                <img src={SoundMuteSvg} aria-label="Muted" draggable={false} alt="Muted" className="w-full h-full" />
                              ) : volume < 0.5 ? (
                                <img src={SoundLowSvg} aria-label="Low Volume" draggable={false} alt="Low Volume" className="w-full h-full" />
                              ) : (
                                <img src={SoundLoudSvg} aria-label="High Volume" draggable={false} alt="High Volume" className="w-full h-full" />
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
                                onChange={ctl.handleVolumeChange}
                                className="relative w-full h-[var(--px-2)] appearance-none cursor-pointer bg-transparent z-10 [&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer player-control player-control-volume-slider"
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
                {formatTime(ctl.uiTime)} / {formatTime(totalDuration)}
              </span>
                          {networkError && (
                            <div className="absolute bottom-9 left-40 flex items-center gap-[var(--px-3)] text-yellow-200">
                                <span aria-hidden="true" className="inline-block w-[var(--px-12)] h-[var(--px-12)] bg-current"
                                style={{
                                    WebkitMaskImage: `url("${NetworkSvg}")`,
                                    WebkitMaskRepeat: "no-repeat",
                                    WebkitMaskPosition: "center",
                                    WebkitMaskSize: "contain",
                                    maskImage: `url("${NetworkSvg}")`,
                                    maskRepeat: "no-repeat",
                                    maskPosition: "center",
                                    maskSize: "contain",
                                }}
                                />
                                <span className="text-[length:var(--px-10)]">Network</span>
                            </div>
                          )}
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
