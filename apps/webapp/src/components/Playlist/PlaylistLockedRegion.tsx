import React from "react";
import { PlaylistUnlockBand } from "@/components/Playlist/PlaylistUnlockBand.tsx";

/** Visible blurred rows in the locked block — bounds compositing cost on large playlists. */
export const LOCKED_BLUR_VISIBLE_ROWS = 5;

export interface PlaylistLockedRegionProps {
  isGuest: boolean;
  maxTracksPerPlaylist: number;
  mobile?: boolean;
  /** Approximate row height token used for crop + panel anchor. */
  rowHeightVar: string;
  children: React.ReactNode;
}

/**
 * Guest locked-results block: one blur surface over a bounded row crop, floating unlock panel on top.
 * Blurred content is aria-hidden (server sends decoy metadata only).
 */
export const PlaylistLockedRegion: React.FC<PlaylistLockedRegionProps> = ({
  isGuest,
  maxTracksPerPlaylist,
  mobile = false,
  rowHeightVar,
  children,
}) => {
  const maxHeight = `calc(${rowHeightVar} * ${LOCKED_BLUR_VISIBLE_ROWS + 0.5})`;
  const panelTop = `calc(${rowHeightVar} * 1.5)`;

  return (
    <div className={`relative ${mobile ? "w-full" : ""}`} data-testid="playlist-locked-region">
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none relative select-none overflow-hidden border-t border-dotted border-slate-200"
        style={{
          maxHeight,
          filter: "blur(7px)",
          opacity: 0.85,
        }}
        data-testid="playlist-locked-blur"
      >
        {children}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--px-48)] bg-gradient-to-b from-transparent to-[#0b0b0b]"
        />
      </div>
      <div
        className={
          mobile
            ? "pointer-events-auto absolute left-[var(--px-12)] right-[var(--px-12)] z-10"
            : "pointer-events-auto absolute left-1/2 z-10 w-[min(100%,var(--px-520))] -translate-x-1/2 px-[var(--px-16)]"
        }
        style={{ top: panelTop }}
      >
        <PlaylistUnlockBand
          isGuest={isGuest}
          maxTracksPerPlaylist={maxTracksPerPlaylist}
          mobile={mobile}
          variant="floating"
        />
      </div>
    </div>
  );
};

export default PlaylistLockedRegion;
