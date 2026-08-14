/**
 * The Library URL's decision logic, as pure functions.
 *
 * Separated from `useLibraryUrlState` so it can be exercised directly: every rule here is one the
 * hook would otherwise express as an `if` buried in an effect, where the only way to check it is to
 * render the page and click. These are the parts that are actually easy to get wrong — parsing a
 * user-supplied page number, deciding when the server's `totalPages` can be trusted, and deciding
 * when a URL write is a correction rather than a navigation.
 *
 * Deliberately dependency-free (no React, no router, no store) so it stays that way.
 */

export type LibraryTab = "playlists" | "tracks";

/**
 * Highest page we will ask the server for.
 *
 * `page` becomes a SQL `OFFSET`, and the endpoint validates `ge=1` with **no upper bound** — so
 * `?page=1000000000` would issue `OFFSET 19999999980`. At 20 rows per page this ceiling is 200,000
 * items, far past any real library, and anything beyond it is corrected to the true last page by
 * the clamp anyway. This only bounds the *first* request's cost.
 */
export const MAX_REQUESTABLE_PAGE = 10_000;

/** Uploads is the landing tab, so anything unrecognised resolves to it rather than to an error. */
export function parseTab(raw: string | null): LibraryTab {
  return raw === "playlists" ? "playlists" : "tracks";
}

/**
 * Read a page number from the query string.
 *
 * Everything here is user-supplied and none of it can be trusted: `abc`, `0`, `-3`, `1.5`, `1e99`
 * and an absent value all have to resolve to something sane. Only the *upper* bound against the
 * real data needs the server's answer — see `shouldClamp`.
 */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_REQUESTABLE_PAGE);
}

/**
 * Does the address bar disagree with what is actually being shown?
 *
 * Compares the raw strings, not the parsed values, so `?page=01` and `?page=1.5` are normalised to
 * `?page=1` rather than left looking authoritative while meaning something else.
 */
export function needsRepair(
  rawTab: string | null,
  rawPage: string | null,
  tab: LibraryTab,
  page: number,
): boolean {
  return rawTab !== tab || rawPage !== String(page);
}

/**
 * Is the requested page past the end, and do we actually know that yet?
 *
 * `loadedPage === page` is the whole point. The store's `totalPages` starts at 1, so testing
 * `page > totalPages` on its own would fire before any request completed and drag a perfectly
 * valid `?page=3` back to page 1. The loaders write the page and its total in a single call, so
 * `loadedPage === page` is the proof that `totalPages` describes *this* request rather than the
 * initial default.
 */
export function shouldClamp(page: number, loadedPage: number, totalPages: number): boolean {
  if (loadedPage !== page) return false; // no answer for this page yet
  return totalPages >= 1 && page > totalPages;
}

/** The page a clamp should land on. */
export function clampTarget(totalPages: number): number {
  return Math.max(1, totalPages);
}

/**
 * Should a page change be scrolled to the top?
 *
 * `null` means first paint — a deep link to page 3 must not be jerked to the top of a list the
 * browser has already positioned. After that, only a genuine change of view scrolls; without this
 * the page would fight the user every time the artifact poll landed.
 */
export function shouldScrollToTop(previousView: string | null, nextView: string): boolean {
  return previousView !== null && previousView !== nextView;
}

/** The key `shouldScrollToTop` compares. Tab is included: a new tab is a new list. */
export function viewKey(tab: LibraryTab, page: number): string {
  return `${tab}:${page}`;
}
