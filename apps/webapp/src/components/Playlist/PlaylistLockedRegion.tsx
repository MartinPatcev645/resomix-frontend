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
  // The unlock panel is ~3 rows tall and floats `PANEL_TOP_ROWS` down. Now that the region is as
  // tall as the real number of locked rows rather than a fixed 5.5-row crop, a SMALL lock — a free
  // user asking for 25 tracks leaves 5 — would let the panel hang out of the bottom and over the
  // page beneath it. Reserve enough height for it to land inside; the surplus is just tinted glass.
  const minHeight = `calc(${rowHeightVar} * ${PANEL_TOP_ROWS + 3})`;

  return (
    <div
      className={`relative ${mobile ? "w-full" : ""}`}
      style={{ minHeight }}
      data-testid="playlist-locked-region"
    >
      {/* The decoy rows. Blurred here as well as under the glass layer below, deliberately: this
          one is a `filter` on the content itself, so it holds even where `backdrop-filter` is
          unsupported or disabled. The layer is the look; this is the guarantee. */}
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none relative select-none overflow-hidden border-t border-solid border-[var(--playlist-divider)]"
        style={{
          filter: "blur(6px)",
          opacity: 0.85,
        }}
        data-testid="playlist-locked-blur"
      >
        {children}
      </div>

      {/* The glass layer: over the rows, under the unlock panel.
          It has to be a SIBLING of the rows, not a child — `backdrop-filter` inside an element that
          already carries a `filter` blurs the wrong thing (the ancestor's filter creates a new
          containing block, and the backdrop it samples is the already-filtered output). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          backgroundColor: "rgba(11, 11, 11, 0.32)",
        }}
        data-testid="playlist-locked-scrim"
      >
        {/* Bottom fade, so the block ends by dissolving into the page rather than being cut off.
            Lives on the layer, not the rows, so the content filter cannot smear it. */}
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
