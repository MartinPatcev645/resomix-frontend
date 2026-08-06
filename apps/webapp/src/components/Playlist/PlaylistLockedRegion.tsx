import React from "react";
import { PlaylistUnlockBand } from "@/components/Playlist/PlaylistUnlockBand.tsx";

/**
 * Where the floating unlock panel sits, in rows from the top of the locked block.
 *
 * The block itself is NOT cropped: every withheld track gets a blurred row, so the teaser shows
 * the true size of what is being held back. Cropping it to five rows made a 10-track lock look
 * like a 5-track one, which undersells the upgrade and reads as a bug. The total row count is
 * already bounded upstream by `useVisibleResultWindow`, so there is no unbounded-blur case here.
 */
const PANEL_TOP_ROWS = 1.5;

export interface PlaylistLockedRegionProps {
  isGuest: boolean;
  maxTracksPerPlaylist: number;
  mobile?: boolean;
  /** Approximate row height token used to anchor the floating unlock panel. */
  rowHeightVar: string;
  children: React.ReactNode;
}

/**
 * Guest locked-results block: one blur surface over every withheld row, floating unlock panel on top.
 * Blurred content is aria-hidden (server sends decoy metadata only).
 */
export const PlaylistLockedRegion: React.FC<PlaylistLockedRegionProps> = ({
  isGuest,
  maxTracksPerPlaylist,
  mobile = false,
  rowHeightVar,
  children,
}) => {
  const panelTop = `calc(${rowHeightVar} * ${PANEL_TOP_ROWS})`;

  return (
    <div className={`relative ${mobile ? "w-full" : ""}`} data-testid="playlist-locked-region">
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none relative select-none overflow-hidden border-t border-solid border-[var(--playlist-divider)]"
        style={{
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
