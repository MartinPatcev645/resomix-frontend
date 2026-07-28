import React, { useCallback, useEffect, useState } from "react";
import { useGlobalAudioController } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { DEMO_MODE } from "@resomix/config";
import { displayOrNA } from "@/utils/trackUtils.ts";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import {
  PLAYLIST_COMPACT_BAR_H_VAR,
  PLAYLIST_DIVIDER_STRONG,
  PLAYLIST_STICKY_REF_TOP,
} from "@/utils/playlistChrome.ts";
import PlaySvg from "@/assets/icons/play.svg";
import PauseSvg from "@/assets/icons/pause.svg";

interface StickyReferenceBarProps {
  /** Element that leaves the viewport when the full reference card scrolls away. */
  sentinelRef: React.RefObject<HTMLElement | null>;
  resultCount: number;
}

/**
 * Compact sticky reference context — same global playback source as InputPlayer / result rows.
 * Shown only after the full hero card scrolls out of view.
 */
export const StickyReferenceBar: React.FC<StickyReferenceBarProps> = ({
  sentinelRef,
  resultCount,
}) => {
  const { playlistData } = usePlaylistStore();
  const track = playlistData?.queried_track;
  const hlsController = useGlobalAudioController();
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    // IntersectionObserver rootMargin only accepts px/% — convert --nav-sticky-h (often rem).
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;height:var(--nav-sticky-h,3.25rem);pointer-events:none";
    document.body.appendChild(probe);
    const stickyPx = Math.max(1, Math.round(probe.getBoundingClientRect().height)) || 52;
    probe.remove();

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: `-${stickyPx}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef]);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, "3.5rem");
    } else {
      root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, "0px");
    }
    return () => {
      root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, "0px");
    };
  }, [visible]);

  const trackId = track?.id;
  const isRefPlaying = !!trackId && currentTrackId === trackId && isPlaying;

  const handlePlay = useCallback(() => {
    if (!trackId || DEMO_MODE) return;
    if (currentTrackId === trackId && isPlaying) {
      hlsController.stop();
    } else {
      hlsController.load(trackId, true);
    }
  }, [currentTrackId, hlsController, isPlaying, trackId]);

  if (!visible || !track) return null;

  const barClassName = [
    "pointer-events-auto fixed inset-x-0 z-[40] border-b bg-[#0b0b0b]",
    PLAYLIST_DIVIDER_STRONG,
  ].join(" ");

  return (
    <div
      className={barClassName}
      style={{ top: PLAYLIST_STICKY_REF_TOP }}
      role="region"
      aria-label="Reference track context"
      data-testid="playlist-sticky-reference-bar"
    >
      <div className="webapp-approved-container flex min-h-[3.5rem] items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] sm:px-[var(--px-32)]">
        <button
          type="button"
          onClick={handlePlay}
          aria-label={isRefPlaying ? "Pause reference track" : "Play reference track"}
          className="relative flex h-[var(--px-44)] w-[var(--px-44)] shrink-0 items-center justify-center rounded-full border border-solid border-[var(--playlist-divider-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
          id="playlist-sticky-ref-play"
        >
          <TrackArtwork
            artworkUrl={track.artwork_url}
            className="absolute inset-[var(--px-4)] h-auto w-auto rounded-full"
          />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
            <img
              src={isRefPlaying ? PauseSvg : PlaySvg}
              alt=""
              aria-hidden="true"
              className="h-[var(--px-10)] w-[var(--px-10)]"
            />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-helvetica text-[length:var(--px-13)] font-light uppercase leading-[var(--px-16)] text-[var(--color-primary)]">
            {displayOrNA(track.title)}
          </div>
          <div className="truncate font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-15)] text-[var(--color-primary-hover)]">
            {displayOrNA(track.artist)}
          </div>
        </div>
        <div className="shrink-0 font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-75">
          {resultCount} result{resultCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
};

export default StickyReferenceBar;
