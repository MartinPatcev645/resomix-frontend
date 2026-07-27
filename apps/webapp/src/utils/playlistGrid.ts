import type { CSSProperties } from "react";

/**
 * Desktop playlist table — 11 columns:
 * rank · play · cover · apple · artist · title · label+year · genre+length · score · feedback · chain
 *
 * Tailwind arbitrary `grid-cols-[…]` cannot parse comma-containing values such as `minmax(0,1fr)`;
 * apply via inline style (or real CSS) only.
 */
export const PLAYLIST_GRID_TEMPLATE_COLUMNS =
  "var(--px-24) var(--px-32) var(--px-36) var(--px-28) minmax(0,1.2fr) minmax(0,1.4fr) var(--px-108) var(--px-76) var(--px-126) var(--px-52) var(--px-32)";

export const PLAYLIST_GRID_GAP = "var(--px-10)";

export const PLAYLIST_ROW_GRID_CLASS = "grid items-center";

export const playlistRowGridStyle: CSSProperties = {
  gridTemplateColumns: PLAYLIST_GRID_TEMPLATE_COLUMNS,
  gap: PLAYLIST_GRID_GAP,
};

/** Two-column auto + fluid — safe alternative to `grid-cols-[auto_minmax(0,1fr)]`. */
export const autoFluidGridStyle: CSSProperties = {
  gridTemplateColumns: "auto minmax(0, 1fr)",
};

/** Mobile playlist row rank · play · meta. */
export const mobilePlaylistRowGridStyle: CSSProperties = {
  gridTemplateColumns: "var(--px-28) var(--px-40) minmax(0, 1fr)",
};
