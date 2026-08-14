import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { EMPTY_LIBRARY_FILTERS, type LibraryFilters } from "@resomix/stores";
import {
  clampTarget,
  needsRepair,
  parsePage,
  parseTab,
  shouldClamp,
  shouldScrollToTop,
  viewKey,
  type LibraryTab,
} from "./libraryUrlState.ts";

/**
 * The Library's URL is the single source of truth for **which tab** and **which page**.
 *
 * What this replaced
 * ------------------
 * `tab` was already in the URL; `page` lived only in the Zustand store. Two things followed, both
 * reported: opening a playlist from page 3 and pressing Back returned you to page 1, and a link to
 * page 3 could not be shared because no such link existed.
 *
 * The store still holds the page — it is what the loaders write back — but it is now written
 * *from* the URL and never independently. Every navigation goes through `searchParams`, so there
 * is exactly one place the current view is decided.
 *
 * Lives here rather than in `@resomix/hooks` because it depends on react-router. That package is
 * consumed by all three apps (landing is SSR-prerendered) and has no router dependency today;
 * adding one for a webapp-only page would be a heavier coupling than this earns.
 */

export type { LibraryTab };

interface Options {
  isAuthenticated: boolean;
  loadPlaylists: (page?: number, pageSize?: number) => unknown;
  loadTracks: (page?: number, pageSize?: number, opts?: { silent?: boolean }) => unknown;
  setActiveTab: (tab: LibraryTab) => void;
  applyFilters: (tab: LibraryTab, filters: LibraryFilters, opts?: { reload?: boolean }) => void;
  playlistsTotalPages: number;
  tracksTotalPages: number;
  /** The page each loader last reported. Used to tell a fresh answer from a stale default. */
  playlistsPage: number;
  tracksPage: number;
}

export function useLibraryUrlState({
  isAuthenticated,
  loadPlaylists,
  loadTracks,
  setActiveTab,
  applyFilters,
  playlistsTotalPages,
  tracksTotalPages,
  playlistsPage,
  tracksPage,
}: Options) {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const rawPage = searchParams.get("page");

  // Both parsers live in `libraryUrlState.ts` — pure, and tested there.
  const tab = parseTab(rawTab);
  const page = parsePage(rawPage);

  const totalPages = tab === "playlists" ? playlistsTotalPages : tracksTotalPages;
  const loadedPage = tab === "playlists" ? playlistsPage : tracksPage;

  // ------------------------------------------------------------------ #
  // Navigation
  // ------------------------------------------------------------------ #

  /** Move to a page. **Pushes**, so Back steps back through pages — the point of the change. */
  const goToPage = useCallback(
    (next: number) => {
      if (next === page) return; // no history entry for a click that changes nothing
      setSearchParams({ tab, page: String(next) });
    },
    [tab, page, setSearchParams],
  );

  /**
   * Switch tabs, always landing on page 1.
   *
   * Resetting is not tidiness: the two tabs have different page counts, so carrying page 7 into a
   * two-page tab renders an empty screen.
   *
   * **Replaces** rather than pushes, matching the behaviour tabs already had. Pushing would make
   * Back toggle between tabs, which reads as the page refusing to let you leave.
   */
  const goToTab = useCallback(
    (next: LibraryTab) => setSearchParams({ tab: next, page: "1" }, { replace: true }),
    [setSearchParams],
  );

  /**
   * Apply a tab's filters and return to page 1 — a different result set makes the old page number
   * meaningless.
   *
   * The `reload` flag is what stops a double fetch. `applyFilters` normally issues its own page-1
   * load; when the URL is also moving to page 1 the load effect below will issue one anyway, so
   * exactly one of the two is asked to do it.
   */
  const applyFiltersAt = useCallback(
    (target: LibraryTab, filters: LibraryFilters) => {
      const urlWillMove = target === tab && page !== 1;
      applyFilters(target, filters, { reload: !urlWillMove });
      if (urlWillMove) setSearchParams({ tab, page: "1" }, { replace: true });
    },
    [tab, page, applyFilters, setSearchParams],
  );

  /** Reset a tab's filters and return to page 1 — the clear case of `applyFiltersAt`. */
  const clearFiltersAt = useCallback(
    (target: LibraryTab) => applyFiltersAt(target, { ...EMPTY_LIBRARY_FILTERS }),
    [applyFiltersAt],
  );

  /** Re-fetch the active tab at the current page, without moving. */
  const refresh = useCallback(() => {
    if (tab === "playlists") loadPlaylists(page);
    else loadTracks(page);
  }, [tab, page, loadPlaylists, loadTracks]);

  // ------------------------------------------------------------------ #
  // Keeping the URL canonical
  // ------------------------------------------------------------------ #

  // Fill in or repair the query string so what is shown is always what is in the address bar —
  // `/library` becomes `?tab=tracks&page=1`, `?page=abc` becomes `?page=1`, and the retired
  // `?tab=favorites` (favorites are inline on Playlists now) redirects instead of 404-ing.
  // Replace, never push: a correction is not somewhere the user navigated to.
  useEffect(() => {
    if (!needsRepair(rawTab, rawPage, tab, page)) return;
    setSearchParams({ tab, page: String(page) }, { replace: true });
  }, [rawTab, rawPage, tab, page, setSearchParams]);

  // Mirror the URL's tab into the store, which the rest of the page still reads.
  useEffect(() => {
    setActiveTab(tab);
  }, [tab, setActiveTab]);

  // ------------------------------------------------------------------ #
  // Loading
  // ------------------------------------------------------------------ #

  // The active tab, at the URL's page. This is the only place a page load is issued for the tab
  // being viewed, so a deep link, a Back press and a Next click all take the identical path.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === "playlists") loadPlaylists(page);
    else loadTracks(page);
  }, [isAuthenticated, tab, page, loadPlaylists, loadTracks]);

  // The *other* tab, once, at page 1 — purely so its count in the tab label is populated. Without
  // it a deep link to one tab shows "Playlists (0)" until you click it.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === "playlists") loadTracks(1);
    else loadPlaylists(1);
    // Deliberately keyed on auth alone: switching tabs is already covered by the effect above, and
    // re-running this on every switch would refetch a tab the user just left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ------------------------------------------------------------------ #
  // Clamping
  // ------------------------------------------------------------------ #

  // `?page=999` should land on the last page, not an empty list. The upper bound is only knowable
  // after a load — the response carries the total — so this runs afterwards and corrects.
  //
  // **`loadedPage === page` is what makes this safe, and it is not optional.** The store's
  // `totalPages` starts at 1, so clamping on it directly would fire before any request completed
  // and drag a perfectly valid `?page=3` back to page 1. The loaders write the page and its
  // total in a single call, so `loadedPage === page` is the proof that `totalPages` describes
  // *this* request rather than the initial default.
  //
  // Replace, emphatically: pushing the correction would put the out-of-range URL directly behind
  // the corrected one, so Back would return to `page=999`, which would clamp again, forward to the
  // corrected page. The user would be unable to leave.
  useEffect(() => {
    if (!shouldClamp(page, loadedPage, totalPages)) return;
    setSearchParams({ tab, page: String(clampTarget(totalPages)) }, { replace: true });
  }, [tab, page, totalPages, loadedPage, setSearchParams]);

  // ------------------------------------------------------------------ #
  // Scroll
  // ------------------------------------------------------------------ #

  // Top of the list on a page change — but *only* on a real change. Scrolling on every render
  // would fight the user every time a poll landed or a row updated, and scrolling on first paint
  // would jerk a deep link to page 3 that the browser had already positioned.
  const lastView = useRef<string | null>(null);
  useEffect(() => {
    const view = viewKey(tab, page);
    if (shouldScrollToTop(lastView.current, view)) window.scrollTo({ top: 0 });
    lastView.current = view;
  }, [tab, page]);

  return { tab, page, totalPages, goToPage, goToTab, applyFiltersAt, clearFiltersAt, refresh };
}
