/** Narrowly scoped playlist/results chrome — dividers, sticky stack, progressive disclosure. */

export const PLAYLIST_VISIBLE_PAGE = 25;

/** Solid low-contrast row/cell separators (replaces bright dotted slate-200). */
export const PLAYLIST_DIVIDER_BORDER = "border-solid border-[var(--playlist-divider)]";
export const PLAYLIST_DIVIDER_STRONG = "border-solid border-[var(--playlist-divider-strong)]";

export const PLAYLIST_PANEL_BORDER = `border ${PLAYLIST_DIVIDER_BORDER}`;
export const PLAYLIST_PANEL_BORDER_STRONG = `border ${PLAYLIST_DIVIDER_STRONG}`;

export const PLAYLIST_ROW_SEPARATOR = `border-t ${PLAYLIST_DIVIDER_BORDER}`;

/**
 * Sticky stack: compact reference bar sits at the top of the stack; column headers under the bar.
 * The stack top is `--playlist-sticky-stack-top` (defined in navigation.css): it equals the fixed
 * compact-nav height on desktop, and 0 on mobile (<1024px), where no fixed nav exists — so the bar
 * pins to the very top instead of floating below an empty nav-height gap.
 */
export const PLAYLIST_COMPACT_BAR_H_VAR = "--playlist-compact-bar-h";
export const PLAYLIST_STICKY_REF_TOP = "var(--playlist-sticky-stack-top, var(--nav-sticky-h))";
export const PLAYLIST_STICKY_HEADER_TOP =
  "calc(var(--playlist-sticky-stack-top, var(--nav-sticky-h)) + var(--playlist-compact-bar-h, 0px))";

export function initialVisibleCount(total: number, page = PLAYLIST_VISIBLE_PAGE): number {
  if (total <= page) return total;
  return page;
}

export function nextVisibleCount(current: number, total: number, page = PLAYLIST_VISIBLE_PAGE): number {
  return Math.min(total, current + page);
}
