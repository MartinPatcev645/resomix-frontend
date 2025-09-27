import React from "react";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import NetworkSvg from "@/assets/icons/network-aleft.svg";
import { useWaveformControls, formatTime } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { WaveformLoader } from "@resomix/ui";


interface SimilarityPlayerProps {
    trackId: string;
    totalDuration: number;
    isPlaying?: boolean;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration }) => {
    const volumeStore = usePlayerStore((s) => ({ volume: s.volume, networkError: s.networkError }));
    const ctl = useWaveformControls({ id: trackId, totalDuration });
    const { volume, networkError } = volumeStore;

    return (
      <div className="flex flex-col w-full gap-[var(--px-5)]">
          <div className="h-[var(--px-50)] overflow-y-hidden">
              <div ref={ctl.containerRef} className="w-full h-full">
                  {ctl.wfLoading && <WaveformLoader/>}
                  {ctl.wfError && <div className="text-center text-sm text-red-500">Error: {ctl.wfError}</div>}
              </div>
          </div>

          <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-[var(--px-10)] justify-between lg:justify-start">
                  <button
                    type="button"
                    onClick={ctl.skipBackward}
                    className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                  >
                      <img src={NextTrackSvg} alt="Previous Track" className="w-[var(--px-14)] lg:w-[var(--px-10)] h-[var(--px-10)] rotate-180" />
                      <span className="mt-[var(--px-3)]">10s</span>
                  </button>

                  <button
                    type="button"
                    onClick={ctl.skipForward}
                    className="font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-7)] flex items-center gap-[var(--px-3)] py-[var(--px-2)] px-[var(--px-10)] lg:px-[var(--px-2)] cursor-pointer hover:bg-[var(--color-primary-background)] transition-colors rounded-sm shadow-[0_0_0_1px_var(--color-primary-background)]"
                  >
                      <span className="mt-[var(--px-3)]">10s</span>
                      <img src={NextTrackSvg} alt="Next Track" className="w-[var(--px-10)] lg:w-[var(--px-10)] h-[var(--px-10)] mt-[var(--px-3)]" />
                  </button>
              </div>

              <div className="hidden lg:flex items-center gap-[var(--px-8)]">
                  <button
                    type="button"
                    onClick={ctl.toggleMute}
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
                        onChange={ctl.handleVolumeChange}
                        className="relative w-full h-[var(--px-2)] appearance-none cursor-pointer bg-transparent z-10 [&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                      />
                  </div>
              </div>

              <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
          {formatTime(ctl.uiTime)} / {formatTime(totalDuration)}
        </span>
              {networkError && (
                <div className="absolute bottom-2 left-32 flex items-center gap-[var(--px-3)] text-yellow-200">
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
    );
};

export default SimilarityPlayer;
