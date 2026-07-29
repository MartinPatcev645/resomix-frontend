import type { CSSProperties } from "react";

/**
 * Desktop playlist table — 9 columns:
 * rank · play · artist · title · label+year · genre+length · score · feedback · chain
 *
 * The cover no longer has a column of its own: it is the play button's background, so that column
 * is sized to hold the 44px button (it used to be 32px and the button overflowed it). The Apple
 * Music column is gone too, freeing its width for artist/title, which are the fluid columns.
 *
 * Tailwind arbitrary `grid-cols-[…]` cannot parse comma-containing values such as `minmax(0,1fr)`;
 * apply via inline style (or real CSS) only.
 */
export const PLAYLIST_GRID_TEMPLATE_COLUMNS =
  "var(--px-24) var(--px-44) minmax(0,1fr) minmax(0,1.2fr) var(--px-97) var(--px-68) var(--px-108) var(--px-100) var(--px-52)";

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
