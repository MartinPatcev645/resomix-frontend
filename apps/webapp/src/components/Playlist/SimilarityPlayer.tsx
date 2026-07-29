import React, { useEffect } from "react";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import { VolumeControl } from "@/components/Playlist/VolumeControl.tsx";
import { useWaveformControls, formatTime, useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { WaveformLoader } from "@resomix/ui";
import { PreviewProgressBar } from "@/components/Playlist/PreviewProgressBar.tsx";
import { PlaybackUnavailable } from "@/components/Playlist/PlaybackUnavailable.tsx";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";


interface SimilarityPlayerProps {
  trackId: string;
  totalDuration: number;
  isPlaying?: boolean;
  /** Record label — mobile shows it in the player's meta line (its row has no label column). */
  label?: string | null;
  /** Apple Music deep link — desktop closes its control row with the lockup. */
  appleDeepLinkUrl?: string | null;
  /**
   * Mobile layout: a full-width seek bar on its own row, then skips + meta. It drops the volume
   * control (phones have hardware volume), and is a distinct structure rather than a responsive
   * variant of the desktop row, so the two are kept as separate branches below.
   */
  mobile?: boolean;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, totalDuration, label, appleDeepLinkUrl, mobile = false }) => {
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
  // What is actually playable (a preview is shorter than the track's own duration), so it is 0
  // until the engine has loaded — the meta line just omits the total until then.
  const playableDuration = ctl.getPlayableDuration();
  const timeLine = playableDuration > 0 ? `${elapsed} / ${formatTime(playableDuration)}` : elapsed;

  useEffect(() => {
    if (ctl.containerRef.current) {
      ctl.attachOverviewElement(ctl.containerRef.current);
    }
  }, [ctl.attachOverviewElement, ctl.containerRef]);

  const skipChrome =
    "font-fira rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] " +
    "text-[var(--rx-color-text-secondary)] cursor-pointer hover:border-[var(--rx-color-border-strong)] " +
    "hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] " +
    "transition-[background-color,border-color,color] player-control pl-focus-ring";

  // Mobile: a fixed 35×35 square matching the row's ⋯ / Chain Discover boxes. The arrow and "10s"
  // stack instead of sitting side by side — side by side, a legible arrow plus the label does not
  // fit 35px of width, and shrinking either to make it fit is what made the icons look tiny.
  const skipClass = [
    skipChrome,
    mobile
      ? "flex h-[var(--px-35)] w-[var(--px-35)] shrink-0 flex-col items-center justify-center leading-none text-[length:var(--px-8)]"
      : "flex h-[var(--px-26)] min-w-[var(--px-40)] items-center justify-center gap-[var(--px-3)] px-[var(--px-8)] text-[length:var(--px-9)]",
  ].join(" ");

  const skipIconClass = mobile
    ? "h-[var(--px-14)] w-[var(--px-14)] shrink-0"
    : "h-[var(--px-10)] w-[var(--px-10)] lg:h-[var(--px-8)] lg:w-[var(--px-8)]";

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

  const skipBackButton = (
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
        className={`${skipIconClass} rotate-180`}
      />
      <span className="mt-[var(--px-1)]">10s</span>
    </button>
  );

  const skipForwardIcon = (
    <img
      src={NextTrackSvg}
      draggable={false}
      alt=""
      aria-hidden="true"
      className={`${skipIconClass} mt-[var(--px-1)]`}
    />
  );

  // Stacked (mobile) puts the arrow above "10s" on BOTH buttons; the side-by-side desktop pill
  // keeps the arrow on the outside, so the label leads on the forward button.
  const skipForwardButton = (
    <button
      type="button"
      onClick={ctl.skipForward}
      aria-label="Skip forward 10 seconds"
      className={`${skipClass} player-control-skip-forward`}
    >
      {mobile ? skipForwardIcon : <span className="mt-[var(--px-1)]">10s</span>}
      {mobile ? <span className="mt-[var(--px-1)]">10s</span> : skipForwardIcon}
    </button>
  );

  if (mobile) {
    const metaClass =
      "font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-75";
    const separator = <span className={`${metaClass} shrink-0 opacity-40`}>·</span>;

    return (
      <div className="flex w-full flex-col gap-[var(--px-10)] py-[var(--px-4)]">
        {/* Row 1 — seek bar spans the row. Any failure replaces it, centred and full white. */}
        <div className="flex min-h-[var(--px-20)] w-full min-w-0 items-center">
          {playbackFailed ? (
            <PlaybackUnavailable onRetry={retryPlayback} compact centered detail={playbackDetail} />
          ) : (
            seekBar
          )}
        </div>

        {/* Row 2 — skips pinned left, meta fills the rest and truncates before it can overflow.
            No genre here: the collapsed row above already shows it. */}
        <div className="flex w-full min-w-0 items-center gap-[var(--px-8)]">
          <div className="flex shrink-0 items-center gap-[var(--px-6)]">
            {skipBackButton}
            {skipForwardButton}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-[var(--px-6)]">
            {label && (
              <span className={`${metaClass} min-w-0 max-w-[var(--px-160)] truncate`} title={label}>
                {label}
              </span>
            )}
            {label && separator}
            <span className={`${metaClass} shrink-0 whitespace-nowrap tabular-nums`}>{timeLine}</span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: one compact line — skips · volume · Apple size to their content on the right, and the
  // seek bar takes whatever is left. The elapsed time sits under the bar's right end.
  return (
    <div className="flex w-full items-center gap-[var(--px-12)] py-[var(--px-2)]">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center">
          {playbackFailed ? (
            <PlaybackUnavailable onRetry={retryPlayback} compact detail={playbackDetail} />
          ) : (
            seekBar
          )}
        </div>
        <div className="mt-[var(--px-4)] text-right font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] tabular-nums text-[var(--color-primary)] opacity-75">
          {timeLine}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--px-10)]">
        <div className="flex shrink-0 items-center gap-[var(--px-4)]">
          {skipBackButton}
          {skipForwardButton}
        </div>

        {/* Same control as the hero's reference player, just shorter to sit with the 26px skips. */}
        <VolumeControl
          volume={volume}
          onToggleMute={ctl.toggleMute}
          onChange={ctl.handleVolumeChange}
          heightClass="h-[var(--px-26)]"
          widthClass="w-[var(--px-110)]"
        />

        {appleDeepLinkUrl && (
          <AppleMusicBadge
            deepLinkUrl={appleDeepLinkUrl}
            playing
            fullHeightClass="h-[var(--px-20)]"
            className="shrink-0"
          />
        )}
      </div>
    </div>
  );
};

export default SimilarityPlayer;
