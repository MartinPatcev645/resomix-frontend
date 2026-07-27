/** Narrowly scoped playlist/results chrome — dividers, sticky stack, progressive disclosure. */

export const PLAYLIST_VISIBLE_PAGE = 25;

/** Solid low-contrast row/cell separators (replaces bright dotted slate-200). */
export const PLAYLIST_DIVIDER_BORDER = "border-solid border-[var(--playlist-divider)]";
export const PLAYLIST_DIVIDER_STRONG = "border-solid border-[var(--playlist-divider-strong)]";

export const PLAYLIST_PANEL_BORDER = `border ${PLAYLIST_DIVIDER_BORDER}`;
export const PLAYLIST_PANEL_BORDER_STRONG = `border ${PLAYLIST_DIVIDER_STRONG}`;

export const PLAYLIST_ROW_SEPARATOR = `border-t ${PLAYLIST_DIVIDER_BORDER}`;

/** Sticky stack: compact reference bar sits under sticky site nav; column headers under the bar. */
export const PLAYLIST_COMPACT_BAR_H_VAR = "--playlist-compact-bar-h";
export const PLAYLIST_STICKY_REF_TOP = "var(--nav-sticky-h)";
export const PLAYLIST_STICKY_HEADER_TOP =
  "calc(var(--nav-sticky-h) + var(--playlist-compact-bar-h, 0px))";

export function initialVisibleCount(total: number, page = PLAYLIST_VISIBLE_PAGE): number {
  if (total <= page) return total;
  return page;
}

export function nextVisibleCount(current: number, total: number, page = PLAYLIST_VISIBLE_PAGE): number {
  return Math.min(total, current + page);
}
