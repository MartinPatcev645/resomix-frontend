import React, { useCallback, useEffect, useRef, useState } from "react";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";
import { useWaveformControls, formatTime, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { DEMO_MODE } from "@resomix/config";
import { PreviewProgressBar } from "@/components/Playlist/PreviewProgressBar.tsx";
import { PlaybackUnavailable } from "@/components/Playlist/PlaybackUnavailable.tsx";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";

interface InputPlayerProps {
  trackId?: string;
  totalDuration: number;
  /** Catalogue seed deep link — badge renders when type is internal and this is set. */
  deepLinkUrl?: string | null;
  trackType?: string;
  playButtonDataAttributes?: Record<string, string>;
}

const SKIP_DESKTOP_CLASS =
  "font-fira text-[length:var(--px-9)] flex min-h-[var(--px-44)] min-w-[var(--px-44)] items-center justify-center gap-[var(--px-3)] rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-8)] text-[var(--rx-color-text-secondary)] cursor-pointer hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] transition-[background-color,border-color,color] player-control pl-focus-ring";

/** Mobile — mono micro inline skips (no boxed chrome). */
const SKIP_MOBILE_CLASS =
  "font-fira text-[length:var(--px-9)] flex min-h-[var(--px-44)] min-w-[var(--px-44)] shrink-0 items-center justify-center gap-[var(--px-2)] rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-8)] text-[var(--rx-color-text-secondary)] cursor-pointer hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] transition-[background-color,border-color,color] player-control pl-focus-ring";

const InputPlayer: React.FC<InputPlayerProps> = ({
  trackId,
  totalDuration,
  deepLinkUrl,
  trackType,
  playButtonDataAttributes,
}) => {
  const volume = usePlayerStore((s) => s.volume);
  const networkError = usePlayerStore((s) => s.networkError);
  const isDeleted = usePlayerStore((s) => !!s.deletedTracks[trackId ?? "uploaded-local"]);

  const effectiveId = trackId ?? "uploaded-local";

  const ctl = useWaveformControls({ id: effectiveId, totalDuration, withPlayPause: true });
  const hlsController = useGlobalAudioController();
  const networkErrorReason = usePlayerStore((s) => s.networkErrorReason);
  const forcePlaybackError =
    typeof window !== "undefined" && sessionStorage.getItem("resomix-e2e-force-playback-error") === "1";
  const playbackFailed = forcePlaybackError || Boolean(ctl.wfError || networkError);
  const playbackDetail = forcePlaybackError
    ? "e2e-forced"
    : ctl.wfError || networkErrorReason || (networkError ? "network-error" : null);
  const controlsDimmed = playbackFailed || isDeleted;

  const showAppleBadge = trackType === "internal" && Boolean(deepLinkUrl);

  const retryPlayback = useCallback(() => {
    hlsController.load(effectiveId, true);
  }, [effectiveId, hlsController]);

  const [showPreviewHint, setShowPreviewHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayClick = useCallback(() => {
    if (isDeleted) return;

    if (!DEMO_MODE) {
      ctl.togglePlay?.();
      return;
    }

    setShowPreviewHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowPreviewHint(false), 3000);
  }, [ctl.togglePlay, isDeleted]);

  useEffect(() => {
    if (!DEMO_MODE) return;
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const seekDuration = ctl.isPreview
    ? ctl.getPlayableDuration()
    : Math.max(totalDuration, ctl.getPlayableDuration() || 0);

  const seekSlot =
    playbackFailed && !isDeleted ? (
      <PlaybackUnavailable onRetry={retryPlayback} compact detail={playbackDetail} />
    ) : (
      <PreviewProgressBar compact currentTime={ctl.uiTime} duration={seekDuration} onSeek={ctl.seekTo} />
    );

  const skipBackButton = (className: string) => (
    <button
      type="button"
      onClick={ctl.skipBackward}
      aria-label="Skip back 10 seconds"
      className={`${className} player-control-skip-backward`}
    >
      <img
        src={NextTrackSvg}
        draggable={false}
        alt=""
        aria-hidden="true"
        className="h-[var(--px-8)] w-[var(--px-8)] rotate-180"
      />
      <span>10s</span>
    </button>
  );

  const skipForwardButton = (className: string) => (
    <button
      type="button"
      onClick={ctl.skipForward}
      aria-label="Skip forward 10 seconds"
      className={`${className} player-control-skip-forward`}
    >
      <span>10s</span>
      <img src={NextTrackSvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-8)] w-[var(--px-8)]" />
    </button>
  );

  const volumeControl = (
    <div
      className={`flex w-[var(--px-64)] shrink-0 items-center gap-[var(--px-6)] max-[767px]:min-w-0 max-[767px]:flex-1 ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
    >
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
  );

  return (
    <div
      className="flex w-full flex-col gap-[var(--px-8)] min-[768px]:min-h-[var(--px-44)] min-[768px]:flex-row min-[768px]:flex-wrap min-[768px]:items-center min-[768px]:gap-x-[var(--px-8)] min-[768px]:gap-y-[var(--px-6)]"
      data-testid="input-player"
    >
      {/* Row A (mobile): play · seek · elapsed · −10s */}
      <div className="flex min-h-[var(--px-44)] min-w-0 items-center gap-[var(--px-8)] max-[767px]:w-full min-[768px]:contents">
        <div className="relative shrink-0">
          {DEMO_MODE && showPreviewHint && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-1 animate-pulse rounded-[var(--rx-radius-control)] ring-2 ring-[#FFCC00]"
              />
              <div
                role="status"
                aria-live="polite"
                className="absolute -top-9 left-2 z-20 whitespace-nowrap rounded bg-[#FFCC00] px-2 py-1 text-[length:var(--px-10)] font-semibold text-black shadow-md ring-2 ring-black/10"
              >
                Demo mode - Audio playback limited while we complete licensing
              </div>
            </>
          )}
          <button
            type="button"
            id="input-player-play-pause"
            className={`flex aspect-square w-[var(--px-44)] shrink-0 cursor-pointer items-center justify-center rounded-[var(--rx-radius-control)] border transition-[background-color,border-color,color] player-control player-control-play-pause pl-focus-ring ${
              ctl.isPlaying
                ? "border-[rgba(238,74,38,0.7)] bg-[rgba(238,74,38,0.16)] text-[var(--rx-color-text-primary)]"
                : "border-[var(--rx-color-border-default)] bg-transparent text-[var(--rx-color-text-primary)] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
            } ${isDeleted ? "cursor-not-allowed opacity-50" : ""}`}
            onClick={handlePlayClick}
            disabled={isDeleted}
            aria-label={ctl.isPlaying ? "Pause" : "Play"}
            {...(playButtonDataAttributes as Record<string, string> | undefined)}
          >
            <img
              src={ctl.isPlaying ? PauseSvg : PlaySvg}
              alt=""
              aria-hidden="true"
              className="h-[var(--px-18)] w-[var(--px-18)]"
            />
          </button>
        </div>

        <div className="min-w-0 flex-1 min-[768px]:min-w-[14rem] min-[768px]:basis-[14rem]">{seekSlot}</div>

        <time className="shrink-0 font-fira text-[length:var(--px-9)] font-light tabular-nums opacity-75">
          {formatTime(ctl.uiTime)}
        </time>

        <div className={`max-[767px]:flex min-[768px]:hidden ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}>
          {skipBackButton(SKIP_MOBILE_CLASS)}
        </div>
      </div>

      {/* Row B (mobile): +10s · volume · Apple badge — dimmed in place on playback error */}
      <div
        className={`flex min-h-[var(--px-44)] w-full items-center gap-[var(--px-8)] max-[767px]:flex min-[768px]:contents ${controlsDimmed ? "max-[767px]:pointer-events-none max-[767px]:opacity-45" : ""}`}
      >
        <div className={`max-[767px]:flex min-[768px]:hidden ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}>
          {skipForwardButton(SKIP_MOBILE_CLASS)}
        </div>

        <div
          className={`hidden min-[768px]:flex shrink-0 items-center gap-[var(--px-2)] ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
        >
          {skipBackButton(SKIP_DESKTOP_CLASS)}
          {skipForwardButton(SKIP_DESKTOP_CLASS)}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-[var(--px-8)] max-[767px]:min-w-0 max-[767px]:flex-1 min-[768px]:basis-full min-[768px]:justify-end xl:ml-auto xl:basis-auto">
          {volumeControl}
          {showAppleBadge && (
            <AppleMusicBadge
              deepLinkUrl={deepLinkUrl}
              playing
              fullHeightClass="h-[var(--px-22)]"
              className={controlsDimmed ? "pointer-events-none opacity-45" : ""}
            />
          )}
        </div>
      </div>

      {isDeleted && (
        <p className="w-full font-fira text-[length:var(--px-9)] text-red-500 opacity-90">
          Your uploaded track has been deleted.
        </p>
      )}
    </div>
  );
};

export default InputPlayer;
