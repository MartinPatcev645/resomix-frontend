import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGlobalAudioController, formatDuration } from "@resomix/hooks";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";
import { DEMO_MODE } from "@resomix/config";
import { displayOrNA } from "@/utils/trackUtils.ts";
import { TrackArtwork } from "@/components/Playlist/TrackArtwork.tsx";
import {
  PLAYLIST_COMPACT_BAR_H_VAR,
  PLAYLIST_DIVIDER_STRONG,
  PLAYLIST_STICKY_REF_TOP,
} from "@/utils/playlistChrome.ts";
import SimilarityPlayer from "@/components/Playlist/SimilarityPlayer.tsx";
// White glyphs, as on the result rows: the plain play.svg / pause.svg are filled black.
import PlaySvg from "@/assets/icons/play_white.svg";
import PauseSvg from "@/assets/icons/pause_white.svg";

interface StickyReferenceBarProps {
  /** Element that leaves the viewport when the full reference card scrolls away. */
  sentinelRef: React.RefObject<HTMLElement | null>;
  resultCount: number;
  /** Playlist controls to keep in reach while scrolled (desktop passes the hero toolbar's). */
  actions?: React.ReactNode;
  /** Element whose right edge the actions line up with, so they sit where they did in the hero. */
  actionsAlignRef?: React.RefObject<HTMLElement | null>;
  /** While the reference plays, open the same inline player the result rows open (desktop). */
  inlinePlayer?: boolean;
}

/**
 * A faint wash of the accent over the page black, so the bar reads apart from the nav above it and
 * the table below. One place to tune it.
 */
const STICKY_BAR_BG = "color-mix(in srgb, var(--rx-color-accent) 7%, #090909)";

/**
 * Compact sticky reference context — same global playback source as InputPlayer / result rows.
 * Shown only after the full hero card scrolls out of view.
 */
export const StickyReferenceBar: React.FC<StickyReferenceBarProps> = ({
  sentinelRef,
  resultCount,
  actions,
  actionsAlignRef,
  inlinePlayer = false,
}) => {
  const { playlistData } = usePlaylistStore();
  const track = playlistData?.queried_track;
  const hlsController = useGlobalAudioController();
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [visible, setVisible] = useState(false);
  const hasActions = !!actions;
  const barRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Distance from the bar's inner right edge to the hero toolbar's right edge (the results column's
  // edge, left of the rail). The trailing cell takes this width so the actions end exactly there.
  const [actionsInset, setActionsInset] = useState(0);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    // IntersectionObserver rootMargin only accepts px/% — resolve the sticky-stack top (rem/0)
    // to px. It's 0 on mobile (no fixed nav) and the compact-nav height on desktop.
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;height:var(--playlist-sticky-stack-top,var(--nav-sticky-h,3.25rem));pointer-events:none";
    document.body.appendChild(probe);
    const stickyPx = Math.max(0, Math.round(probe.getBoundingClientRect().height));
    probe.remove();

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show ONLY once the reference card has scrolled UP past the sticky line (we're now down in
        // the tracks). `!isIntersecting` is ALSO true when the card sits BELOW the viewport — i.e. the
        // user scrolled back ABOVE the reference — so guard on the card's top edge to stay hidden there.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top <= stickyPx);
      },
      { root: null, threshold: 0, rootMargin: `-${stickyPx}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef]);

  // The column headers stick right under the bar, so they need its real height. It is not fixed: the
  // bar grows a player row while the reference plays.
  const shown = visible && !!track;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    if (!shown || !bar) {
      root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, "0px");
      return;
    }
    const sync = () => root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, `${bar.offsetHeight}px`);
    sync();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.setProperty(PLAYLIST_COMPACT_BAR_H_VAR, "0px");
    };
  }, [shown]);

  useLayoutEffect(() => {
    if (!visible || !hasActions) return;
    const frame = frameRef.current;
    const anchor = actionsAlignRef?.current;
    if (!frame || !anchor) return;

    const measure = () => {
      const innerRight = frame.getBoundingClientRect().left + frame.clientLeft + frame.clientWidth;
      setActionsInset(Math.max(0, Math.round(innerRight - anchor.getBoundingClientRect().right)));
    };
    measure();
    // The rail comes and goes with login, and the window can be resized while the bar is up.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(frame);
    observer?.observe(anchor);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visible, hasActions, actionsAlignRef]);

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

  const resultCountCell = (
    <div className="shrink-0 whitespace-nowrap border-l border-[var(--rx-color-border-subtle)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
      {resultCount} result{resultCount === 1 ? "" : "s"}
    </div>
  );

  const showPlayer = inlinePlayer && isRefPlaying && !DEMO_MODE;

  const barClassName = [
    "pointer-events-auto fixed inset-x-0 z-[40] border-b",
    PLAYLIST_DIVIDER_STRONG,
  ].join(" ");

  return (
    <div
      ref={barRef}
      className={barClassName}
      style={{ top: PLAYLIST_STICKY_REF_TOP, background: STICKY_BAR_BG }}
      role="region"
      aria-label="Reference track context"
      data-testid="playlist-sticky-reference-bar"
    >
      {/* Match the page frame: centre to the same max-width column as the page content, then inset by
          the side-line margin so the bar's content and vertical borders land inside the dotted
          side-lines (px-20 on mobile, px-63 on desktop) instead of bleeding edge-to-edge. */}
      <div className="mx-auto w-full max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)]">
        {/* No overflow clip when the bar carries actions: the Export menu drops down out of it. The
            title still truncates on its own (pl-sticky-strip__text). */}
        <div
          ref={frameRef}
          className={`mx-[var(--px-20)] lg:mx-[var(--px-63)] ${hasActions ? "" : "overflow-hidden"} border-x border-[var(--rx-color-border-default)] ${isRefPlaying ? "shadow-[inset_3px_0_0_0_var(--rx-color-accent)]" : ""}`}
          style={{ background: STICKY_BAR_BG }}
        >
        <div className="flex min-h-[3.5rem] items-center gap-0">
        {/* Same button as a result row's: the cover fills a bordered box, with the white glyph over a
            scrim so it reads on any artwork, and the accent edge and wash while it plays. */}
        <button
          type="button"
          onClick={handlePlay}
          aria-label={isRefPlaying ? "Pause reference track" : "Play reference track"}
          className={[
            "relative ml-[var(--px-12)] flex h-[var(--px-44)] w-[var(--px-44)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent transition-[background-color,border-color,color] pl-focus-ring",
            isRefPlaying
              ? "border-[rgba(238,74,38,0.7)]"
              : "hover:cursor-pointer hover:border-[var(--rx-color-border-strong)]",
          ].join(" ")}
          id="playlist-sticky-ref-play"
        >
          <TrackArtwork
            artworkUrl={track.artwork_url}
            className="absolute inset-0 h-full w-full rounded-[var(--rx-radius-control)] border-0"
          />
          <span className={`absolute inset-0 flex items-center justify-center rounded-[var(--rx-radius-control)] ${isRefPlaying ? "bg-[rgba(238,74,38,0.28)]" : "bg-black/40"}`}>
            <img
              src={isRefPlaying ? PauseSvg : PlaySvg}
              alt=""
              aria-hidden="true"
              className="h-[var(--px-18)] w-[var(--px-18)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            />
          </span>
        </button>
        <div className="pl-sticky-strip__text min-w-0 flex-1 px-[var(--px-12)] py-[var(--px-8)]">
          <div className="font-helvetica text-[length:var(--px-13)] font-light uppercase leading-[var(--px-16)] text-[var(--rx-color-text-primary)]">
            {displayOrNA(track.title)}
          </div>
          <div className="font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-15)] text-[var(--rx-color-text-secondary)]">
            {displayOrNA(track.artist)}
            {track.duration ? ` · ${formatDuration(Math.floor(track.duration))}` : ""}
          </div>
        </div>
        {hasActions ? (
          <>
            <div className="flex shrink-0 items-center gap-[var(--px-8)] pl-[var(--px-12)]">{actions}</div>
            {/* At least as wide as the count, and otherwise as wide as the gap to the hero toolbar's
                right edge, so the actions end where they did in the hero. */}
            <div className="flex shrink-0 justify-end" style={{ width: actionsInset, minWidth: "max-content" }}>
              {resultCountCell}
            </div>
          </>
        ) : (
          resultCountCell
        )}
        </div>
        {/* The result rows' own inline player: seek, elapsed / total, ±10s, volume and the Apple
            lockup. It ends under the hero's right edge, like the actions above it. */}
        {showPlayer && (
          <div
            className="pb-[var(--px-8)] pl-[var(--px-12)] pr-[var(--px-12)]"
            style={hasActions ? { paddingRight: actionsInset } : undefined}
          >
            <SimilarityPlayer
              trackId={track.id}
              isPlaying={isRefPlaying}
              totalDuration={track.duration ?? 0}
              appleDeepLinkUrl={track.type === "internal" ? track.deep_link_url : null}
              waveformHeightClass="h-[var(--px-28)]"
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default StickyReferenceBar;
