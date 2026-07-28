import React, { useEffect, useMemo } from "react";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { useWaveformControls, formatTime, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { WaveformLoader } from "@resomix/ui";
import { PreviewProgressBar } from "@/components/Playlist/PreviewProgressBar.tsx";
import { PlaybackUnavailable } from "@/components/Playlist/PlaybackUnavailable.tsx";


interface SimilarityPlayerProps {
  trackId: string;
  totalDuration: number;
  isPlaying?: boolean;
  /** Label + genre — shown in the control row while the track plays (row columns hide them). */
  label?: string | null;
  genre?: string | null;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration, label, genre }) => {
  const volume = usePlayerStore((s) => s.volume);
  const networkError = usePlayerStore((s) => s.networkError);
  const networkErrorReason = usePlayerStore((s) => s.networkErrorReason);
  const ctl = useWaveformControls({ id: trackId, totalDuration });
  const hlsController = useGlobalAudioController();

  const playbackFailed = Boolean(ctl.wfError || networkError);
  const playbackDetail = ctl.wfError || networkErrorReason || (networkError ? "network-error" : null);

  const retryPlayback = () => {
    hlsController.load(trackId, true);
  };

  const elapsed = formatTime(ctl.uiTime);
  const metaLine = useMemo(() => {
    const parts = [label, genre].filter(Boolean);
    return parts.length > 0 ? `${parts.join(" · ")} · ${elapsed}` : elapsed;
  }, [label, genre, elapsed]);

  useEffect(() => {
    if (ctl.containerRef.current) {
      ctl.attachOverviewElement(ctl.containerRef.current);
    }
  }, [ctl.attachOverviewElement, ctl.containerRef]);

  const skipClass =
    "font-fira text-[length:var(--px-10)] lg:text-[length:var(--px-9)] flex min-h-[var(--px-44)] min-w-[var(--px-44)] items-center justify-center gap-[var(--px-3)] rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-8)] text-[var(--rx-color-text-secondary)] cursor-pointer hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] transition-[background-color,border-color,color] player-control pl-focus-ring";

  const seekBar = ctl.isPreview ? (
    <PreviewProgressBar
      compact
      currentTime={ctl.uiTime}
      duration={ctl.getPlayableDuration()}
      onSeek={ctl.seekTo}
    />
  ) : (
    <div className="relative h-[var(--px-3)] w-full min-w-0 flex items-center">
      <div
        ref={ctl.containerRef}
        className={`h-full w-full ${ctl.wfLoading ? "invisible" : "visible"}`}
      />
      {ctl.wfLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <WaveformLoader />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-[var(--px-6)] py-[var(--px-4)]">
      {/* Desktop: seek · skips · volume · meta on one row. Mobile: controls row then meta row. */}
      <div className="flex w-full flex-col gap-[var(--px-6)] lg:flex-row lg:items-center lg:gap-[var(--px-10)]">
        <div className="flex min-h-[var(--px-44)] min-w-0 flex-1 items-center gap-[var(--px-6)] lg:gap-[var(--px-8)]">
          <div className="min-w-0 flex-1">
            {playbackFailed ? (
              <PlaybackUnavailable onRetry={retryPlayback} compact detail={playbackDetail} />
            ) : (
              seekBar
            )}
          </div>

          <div className="flex shrink-0 items-center gap-[var(--px-2)]">
            <button
              type="button"
              onClick={ctl.skipBackward}
              aria-label="Skip back 10 seconds"
              className={`${skipClass} player-control-skip-backward`}
            >
              <img
                src={NextTrackSvg}
                draggable={false}
                alt=""
                aria-hidden="true"
                className="h-[var(--px-10)] w-[var(--px-10)] rotate-180 lg:h-[var(--px-8)] lg:w-[var(--px-8)]"
              />
              <span className="mt-[var(--px-1)]">10s</span>
            </button>
            <button
              type="button"
              onClick={ctl.skipForward}
              aria-label="Skip forward 10 seconds"
              className={`${skipClass} player-control-skip-forward`}
            >
              <span className="mt-[var(--px-1)]">10s</span>
              <img
                src={NextTrackSvg}
                draggable={false}
                alt=""
                aria-hidden="true"
                className="mt-[var(--px-1)] h-[var(--px-10)] w-[var(--px-10)] lg:h-[var(--px-8)] lg:w-[var(--px-8)]"
              />
            </button>
          </div>

          <div className="flex w-[var(--px-64)] shrink-0 items-center gap-[var(--px-6)]">
            <button
              type="button"
              onClick={ctl.toggleMute}
              aria-label={volume === 0 ? "Unmute" : "Mute"}
              className="flex h-[var(--px-44)] min-w-[var(--px-44)] shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)] transition-[background-color,border-color,color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] player-control player-control-mute-toggle pl-focus-ring"
            >
              {volume === 0 ? (
                <img src={SoundMuteSvg} draggable={false} alt="" aria-hidden="true" className="h-full w-full" />
              ) : volume < 0.5 ? (
                <img src={SoundLowSvg} draggable={false} alt="" aria-hidden="true" className="h-full w-full" />
              ) : (
                <img src={SoundLoudSvg} draggable={false} alt="" aria-hidden="true" className="h-full w-full" />
              )}
            </button>
            <div className="relative flex min-w-0 flex-1 items-center">
              <div className="absolute h-[var(--px-1)] w-full bg-[rgba(255,255,255,0.14)]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={ctl.handleVolumeChange}
                aria-label="Volume"
                className="relative z-10 h-[var(--px-44)] w-full cursor-pointer appearance-none bg-transparent pl-focus-ring [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[rgba(255,255,255,0.8)] [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-[rgba(255,255,255,0.8)] [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-track]:bg-transparent player-control player-control-volume-slider"
              />
            </div>
          </div>
        </div>

        <p
          className="m-0 w-full shrink-0 text-right font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-75 lg:max-w-[40%] lg:truncate"
          title={metaLine}
        >
          {metaLine}
        </p>
      </div>
    </div>
  );
};

export default SimilarityPlayer;
