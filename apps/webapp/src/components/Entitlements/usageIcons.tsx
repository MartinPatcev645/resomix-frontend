import React from "react";

/**
 * Icons for the usage strip — one per metric.
 *
 * WHY THESE ARE INLINE SVG AND NOT THE `assets/icons/*.svg` FILES
 *
 * The strip's whole point is that the icon now carries the meaning on its own, so it has to react
 * to hover, focus and the spent state along with the number beside it. The asset files are stroked
 * `white` and are used through `<img src>`, which cannot inherit colour — the playlist hero hit
 * exactly this and moved to inline SVG (`heroToolbar.tsx` has the note about the `mask-image`
 * attempt rendering as solid white blocks). Painting in `currentColor` is what lets one CSS rule on
 * the button move the number and the icon together.
 *
 * The geometry is copied from the app's own assets so the language stays consistent —
 * `search.svg` and `arrow_upload.svg` — rather than invented here.
 *
 * `ExportIcon` is deliberately the SAME shape as the Export control in the playlist hero: an arrow
 * leaving a tray. The strip previously used `⤓`, a **download** glyph, which pointed the wrong way
 * for an action that sends a playlist out to Apple Music or an embed.
 */

/** One size for every metric icon. Larger than the numbers beside it, since it now stands alone. */
const ICON = "h-[var(--px-16)] w-[var(--px-16)] shrink-0";

export interface UsageIconProps {
  className?: string;
}

/** Sonic searches — magnifier. Geometry from `assets/icons/search.svg`. */
export const SearchesIcon: React.FC<UsageIconProps> = ({ className = "" }) => (
  <svg viewBox="0 0 13 13" className={`${ICON} ${className}`} fill="none" aria-hidden="true">
    <circle cx="8.07921" cy="5.03697" r="4.07407" stroke="currentColor" strokeWidth="0.9" />
    <line x1="5.37713" y1="8.26183" x2="0.932682" y2="12.7063" stroke="currentColor" strokeWidth="0.9" />
  </svg>
);

/** Track uploads — arrow rising off a baseline. Geometry from `assets/icons/arrow_upload.svg`. */
export const UploadsIcon: React.FC<UsageIconProps> = ({ className = "" }) => (
  <svg viewBox="0 0 19 19" className={`${ICON} ${className}`} fill="none" aria-hidden="true">
    <path d="M9.334 3.556L9.334 15.407" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
    <path d="M13.527 7.748C11.371 7.748 9.334 5.85 9.334 3.556" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
    <path d="M5.141 7.748C7.296 7.748 9.333 5.85 9.333 3.556" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
    <line x1="2.667" y1="17.889" x2="16" y2="17.889" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

/**
 * Playlist exports — arrow leaving a tray, matching the hero's Export button.
 * Replaces `⤓` (a download glyph), which described the opposite direction.
 */
export const ExportsIcon: React.FC<UsageIconProps> = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={`${ICON} ${className}`} fill="none" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 5L11.2929 4.29289L12 3.58579L12.7071 4.29289L12 5ZM13 14C13 14.5523 12.5523 15 12 15C11.4477 15 11 14.5523 11 14L13 14ZM6.29289 9.29289L11.2929 4.29289L12.7071 5.70711L7.70711 10.7071L6.29289 9.29289ZM12.7071 4.29289L17.7071 9.29289L16.2929 10.7071L11.2929 5.70711L12.7071 4.29289ZM13 5L13 14L11 14L11 5L13 5Z"
    />
    <path stroke="currentColor" strokeWidth={2} d="M5 16L5 17C5 18.1046 5.89543 19 7 19L17 19C18.1046 19 19 18.1046 19 17V16" />
  </svg>
);

/**
 * Library playlists — a stacked list with a note, not the bare `≡` it replaces.
 *
 * `≡` reads as a hamburger menu, which is the one thing in the header it must NOT be mistaken for.
 * The note is what separates "playlists" from a generic list.
 */
export const LibraryIcon: React.FC<UsageIconProps> = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    className={`${ICON} ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="3" y1="6" x2="15" y2="6" />
    <line x1="3" y1="11" x2="15" y2="11" />
    <line x1="3" y1="16" x2="10" y2="16" />
    <circle cx="17" cy="18" r="2.6" strokeWidth={1.6} />
    <path d="M19.6 18V9l2.4 1.4" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

/** Metric key → icon. Falls back to the hook's glyph when a key has no icon yet. */
export const USAGE_ICONS: Record<string, React.FC<UsageIconProps>> = {
  searches: SearchesIcon,
  uploads: UploadsIcon,
  exports: ExportsIcon,
  library: LibraryIcon,
};
