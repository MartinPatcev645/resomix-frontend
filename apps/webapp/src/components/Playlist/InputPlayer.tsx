import React, { useCallback, useEffect, useRef, useState } from "react";
// White variants: the plain play.svg / pause.svg are filled #000 and rendered near-invisible on the
// player's dark, transparent-backed button.
import PlaySvg from "@/assets/icons/play_white.svg";
import PauseSvg from "@/assets/icons/pause_white.svg";
import NextTrackSvg from "@/assets/icons/next_track.svg";
import { VolumeControl } from "@/components/Playlist/VolumeControl.tsx";
import { useWaveformControls, formatTime, useGlobalAudioController } from "@resomix/hooks";
import { WaveformLoader } from "@resomix/ui";
import { usePlayerStore } from "@resomix/stores";
import { DEMO_MODE } from "@resomix/config";
import { PreviewProgressBar } from "@/components/Playlist/PreviewProgressBar.tsx";
import { PlaybackUnavailable } from "@/components/Playlist/PlaybackUnavailable.tsx";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";
import { StoreLinks } from "@/components/Playlist/StoreLinks.tsx";

interface InputPlayerProps {
  trackId?: string;
  totalDuration: number;
  /** Catalogue seed deep link — badge renders when type is internal and this is set. */
  deepLinkUrl?: string | null;
  traxsourceUrl?: string | null;
  bandcampUrl?: string | null;
  trackType?: string;
  playButtonDataAttributes?: Record<string, string>;
  /**
   * Phone layout: play + seek on one row, transport + attribution + elapsed on the next, and no
   * volume (phones have hardware volume). It is a different structure rather than a responsive
   * variant of the desktop row, so the two are separate branches below — the caller picks, exactly
   * as SimilarityPlayer does, which also keeps the choice tied to which hero is mounted instead of
   * to a second breakpoint that disagreed with it.
   */
  mobile?: boolean;
  /** Desktop only — sits at the right end of the seek row (the hero's favourite / visibility). */
  seekRowEnd?: React.ReactNode;
  /** Desktop only — sits in the control row, between the volume and the Apple badge. */
  controlRowActions?: React.ReactNode;
}

/**
 * A fixed 35×35 square on BOTH layouts, the same chrome the result rows use for ⋯ / 10s
 * (SimilarityPlayer's `mobile` branch), so the whole page reads as one control set. The arrow sits
 * ABOVE the label: side by side, a legible arrow plus "10s" does not fit 35px of width.
 */
const SKIP_BTN_CLASS =
  "font-fira text-[length:var(--px-8)] flex h-[var(--px-35)] w-[var(--px-35)] shrink-0 flex-col items-center justify-center leading-none rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)] cursor-pointer hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] transition-[background-color,border-color,color] player-control pl-focus-ring";

const InputPlayer: React.FC<InputPlayerProps> = ({
  trackId,
  totalDuration,
  deepLinkUrl,
  traxsourceUrl,
  bandcampUrl,
  trackType,
  playButtonDataAttributes,
  mobile = false,
  seekRowEnd,
  controlRowActions,
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

  /** Elapsed readout — last item of the control row on both layouts. */
  const elapsedTime = (
    <time className="shrink-0 font-fira text-[length:var(--px-12)] font-light tabular-nums opacity-75">
      {formatTime(ctl.uiTime)}
    </time>
  );

  /**
   * Hands the waveform container to Peaks.js the moment it mounts.
   *
   * A callback ref rather than a mount effect: this element only exists on the waveform branch
   * below, so it can appear later than the component (e.g. after a playback error clears, or once
   * the track resolves). An effect keyed on mount would run while the node was still null and
   * never attach.
   */
  const attachWaveform = useCallback(
    (el: HTMLDivElement | null) => {
      ctl.containerRef.current = el;
      if (el) ctl.attachOverviewElement(el);
    },
    [ctl.attachOverviewElement, ctl.containerRef],
  );

  /**
   * The reference track is the user's own upload: it streams over HLS and we fetch real peaks for
   * it, so the hero shows the WAVEFORM. Only catalogue tracks fall back to the plain line — they
   * play from an Apple Music preview URL, which has no peaks to draw (useWaveformControls skips
   * the peaks fetch entirely for those).
   *
   * Same branch and the same loader as the result rows in SimilarityPlayer, so the hero and the
   * rows read as one instrument.
   */
  const seekSlot =
    playbackFailed && !isDeleted ? (
      <PlaybackUnavailable onRetry={retryPlayback} compact detail={playbackDetail} />
    ) : ctl.isPreview ? (
      <PreviewProgressBar compact currentTime={ctl.uiTime} duration={seekDuration} onSeek={ctl.seekTo} />
    ) : (
      <div className="relative flex h-[var(--px-28)] w-full min-w-0 items-center">
        <div
          ref={attachWaveform}
          className={`h-full w-full ${ctl.wfLoading ? "invisible" : "visible"}`}
        />
        {ctl.wfLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <WaveformLoader />
          </div>
        )}
      </div>
    );

  // Desktop matches the toolbar icons (16px); mobile stays a touch smaller inside the same 35px box.
  const skipIconClass = `${mobile ? "h-[var(--px-14)] w-[var(--px-14)]" : "h-[var(--px-16)] w-[var(--px-16)]"} shrink-0`;

  const skipBackButton = (
    <button
      type="button"
      onClick={ctl.skipBackward}
      aria-label="Skip back 10 seconds"
      className={`${SKIP_BTN_CLASS} player-control-skip-backward`}
    >
      <img src={NextTrackSvg} draggable={false} alt="" aria-hidden="true" className={`${skipIconClass} rotate-180`} />
      <span className="mt-[var(--px-1)]">10s</span>
    </button>
  );

  const skipForwardButton = (
    <button
      type="button"
      onClick={ctl.skipForward}
      aria-label="Skip forward 10 seconds"
      className={`${SKIP_BTN_CLASS} player-control-skip-forward`}
    >
      <img src={NextTrackSvg} draggable={false} alt="" aria-hidden="true" className={skipIconClass} />
      <span className="mt-[var(--px-1)]">10s</span>
    </button>
  );

  // One 35px-tall bordered pill holding the mute toggle AND the slider, so the volume reads as a
  // single control sitting at the same height as the 10s squares beside it. Shared with the
  // playlist row's inline player.
  const volumeControl = (
    <VolumeControl
      volume={volume}
      onToggleMute={ctl.toggleMute}
      onChange={ctl.handleVolumeChange}
      dimmed={controlsDimmed}
    />
  );

  const playButton = (
    <div className="relative shrink-0">
      {DEMO_MODE && showPreviewHint && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 animate-pulse rounded-full ring-2 ring-[#FFCC00]"
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
        className={`flex aspect-square ${mobile ? "w-[var(--px-35)]" : "w-[var(--px-44)]"} shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[background-color,border-color,color] player-control player-control-play-pause pl-focus-ring ${
          ctl.isPlaying
            ? "border-[rgba(238,74,38,0.7)] bg-[rgba(238,74,38,0.16)] text-[var(--rx-color-text-primary)]"
            : // A solid white ring: the 16%-white default is faint enough to read as a broken
              // outline rather than a button, especially at phone pixel densities.
              "border-white/70 bg-transparent text-[var(--rx-color-text-primary)] hover:border-white hover:bg-[rgba(255,255,255,0.06)]"
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
          className={mobile ? "h-[var(--px-14)] w-[var(--px-14)]" : "h-[var(--px-18)] w-[var(--px-18)]"}
        />
      </button>
    </div>
  );

  const appleBadge = showAppleBadge ? (
    <AppleMusicBadge
      deepLinkUrl={deepLinkUrl}
      playing
      fullHeightClass="player-control-apple-badge-lockup h-[var(--px-22)]"
      className={`player-control-apple-badge shrink-0 ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
    />
  ) : null;

  const storeLinks =
    trackType === "internal" ? (
      <StoreLinks
        traxsourceUrl={traxsourceUrl}
        bandcampUrl={bandcampUrl}
        className={`shrink-0 ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
      />
    ) : null;

  const deletedNote = isDeleted ? (
    <p className="w-full font-fira text-[length:var(--px-9)] text-red-500 opacity-90">
      Your uploaded track has been deleted.
    </p>
  ) : null;

  if (mobile) {
    return (
      <div className="flex w-full flex-col gap-[var(--px-8)]" data-testid="input-player">
        {/* Row 1 — play · seek. The bar takes every pixel left over. */}
        <div className="flex min-h-[var(--px-44)] w-full min-w-0 items-center gap-[var(--px-8)]">
          {playButton}
          <div className="min-w-0 flex-1">{seekSlot}</div>
        </div>

        {/* Row 2 — the transport pair on the left; attribution then elapsed pinned right. Dimmed as
            one row on playback error (no nested dim classes — opacity multiplies). */}
        <div
          className={`flex min-h-[var(--px-44)] w-full items-center gap-[var(--px-8)] ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
        >
          <div className="flex shrink-0 items-center gap-[var(--px-6)]">
            {skipBackButton}
            {skipForwardButton}
          </div>
          <div className="player-control-secondary-cluster flex min-w-0 flex-1 items-center justify-end gap-[var(--px-8)]">
            {appleBadge}
            {storeLinks}
            {elapsedTime}
          </div>
        </div>

        {deletedNote}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-[var(--px-12)]" data-testid="input-player">
      {/* Row 1 — play · seek · the hero's own actions. The bar stops short of the row end so the
          favourite / visibility controls sit in line with it rather than on a row of their own. */}
      <div className="flex min-h-[var(--px-44)] w-full min-w-0 items-center gap-[var(--px-12)]">
        {playButton}
        <div className="min-w-0 flex-1">{seekSlot}</div>
        {seekRowEnd && <div className="flex shrink-0 items-center gap-[var(--px-10)]">{seekRowEnd}</div>}
      </div>

      {/* Row 2 — transport + volume on the left, then the page's actions, attribution and elapsed
          grouped at the right so the row reads as two clusters instead of one long drift. */}
      <div className="flex min-h-[var(--px-44)] w-full flex-wrap items-center gap-x-[var(--px-16)] gap-y-[var(--px-8)]">
        <div
          className={`player-control-desktop-transport flex shrink-0 items-center gap-[var(--px-6)] ${controlsDimmed ? "pointer-events-none opacity-45" : ""}`}
        >
          {skipBackButton}
          {skipForwardButton}
        </div>

        {volumeControl}

        <div className="player-control-secondary-cluster ml-auto flex min-w-0 items-center justify-end gap-[var(--px-12)]">
          {controlRowActions}
          {appleBadge}
          {storeLinks}
          {elapsedTime}
        </div>
      </div>

      {deletedNote}
    </div>
  );
};

export default InputPlayer;
