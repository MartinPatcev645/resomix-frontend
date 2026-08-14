/**
 * Library URL state — the rules, exercised directly
 * =================================================
 *
 * WHAT THESE ARE FOR
 *
 * `page` used to live only in the Zustand store. Two things followed: opening a playlist from
 * page 3 and pressing Back returned you to page 1, and a link to page 3 could not be shared
 * because no such link existed. Moving it into the URL fixes both and introduces a new class of
 * problem — every value in a query string is user-supplied, and a page number has an upper bound
 * that is not knowable until the server answers.
 *
 * THE ONE THAT NEARLY SHIPPED
 *
 * `test_a_valid_deep_link_is_not_clamped_before_the_data_arrives`. The store's `totalPages`
 * starts at 1, so a clamp written as `page > totalPages` fires on first render — before any
 * request completes — and drags a perfectly valid `?page=3` back to page 1. It looks correct in
 * review and it is correct on a one-page library, which is exactly why it needs a test.
 *
 * HOW TO RUN
 *
 *     node --experimental-strip-types apps/webapp/src/hooks/libraryUrlState.test.ts
 *
 * Node's own type stripping, deliberately: no vitest, no jsdom, no React. These rules are pure
 * functions and testing them should not require rendering a page.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REQUESTABLE_PAGE,
  clampTarget,
  needsRepair,
  parsePage,
  parseTab,
  shouldClamp,
  shouldScrollToTop,
  viewKey,
} from "./libraryUrlState.ts";

// --------------------------------------------------------------------------- //
// Reading the URL
// --------------------------------------------------------------------------- //

test("a shared link lands on the page it names", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parseTab("playlists"), "playlists");
});

test("a missing page is page 1", () => {
  assert.equal(parsePage(null), 1);
  assert.equal(parsePage(""), 1);
});

test("junk in the page parameter lands on page 1 rather than breaking the list", () => {
  // All of these are one keystroke away in an address bar.
  for (const raw of ["abc", "0", "-3", "NaN", "null", "1,2"]) {
    assert.equal(parsePage(raw), 1, `expected ${raw} to resolve to page 1`);
  }
});

test("a fractional page is floored, not rejected", () => {
  assert.equal(parsePage("1.5"), 1);
  assert.equal(parsePage("3.9"), 3);
});

test("an absurd page is bounded before it becomes a SQL offset", () => {
  // `page` becomes an OFFSET and the endpoint validates `ge=1` with no upper bound, so
  // `?page=1e9` would issue `OFFSET 19999999980`. The clamp corrects it to the real last page
  // afterwards; this only stops the *first* request being pathological.
  assert.equal(parsePage("1000000000"), MAX_REQUESTABLE_PAGE);
  assert.equal(parsePage("1e99"), MAX_REQUESTABLE_PAGE);
});

test("an unrecognised tab falls back to Uploads, the landing tab", () => {
  assert.equal(parseTab(null), "tracks");
  assert.equal(parseTab("favorites"), "tracks"); // retired tab; favorites are inline on Playlists
  assert.equal(parseTab("Playlists"), "tracks"); // case-sensitive on purpose
});

// --------------------------------------------------------------------------- //
// Keeping the address bar honest
// --------------------------------------------------------------------------- //

test("a canonical URL is left alone", () => {
  assert.equal(needsRepair("tracks", "2", "tracks", 2), false);
});

test("a URL that means something other than it says is repaired", () => {
  // Compared as raw strings, not parsed values — `?page=01` is not wrong, but it is not what
  // will be shown either, and an address bar that disagrees with the page is the thing being fixed.
  assert.equal(needsRepair("tracks", "01", "tracks", 1), true);
  assert.equal(needsRepair("tracks", "1.5", "tracks", 1), true);
  assert.equal(needsRepair(null, null, "tracks", 1), true);
  assert.equal(needsRepair("favorites", "1", "tracks", 1), true);
});

// --------------------------------------------------------------------------- //
// Clamping — the part that nearly shipped wrong
// --------------------------------------------------------------------------- //

test("a valid deep link is NOT clamped before the data arrives", () => {
  // First render of `?page=3`: the store still holds its defaults (page 1, totalPages 1). A clamp
  // written as `page > totalPages` fires here and sends the user to page 1 — for a link that was
  // perfectly valid. `loadedPage !== page` is what holds it back.
  assert.equal(shouldClamp(3, /* loadedPage */ 1, /* totalPages */ 1), false);
});

test("an out-of-range page is clamped once the server has answered", () => {
  // The loaders write the requested page and its total together, so loadedPage === page means
  // totalPages describes this request.
  assert.equal(shouldClamp(999, 999, 1), true);
  assert.equal(clampTarget(1), 1);
});

test("a valid page is left alone once the server has answered", () => {
  assert.equal(shouldClamp(3, 3, 5), false);
  assert.equal(shouldClamp(5, 5, 5), false);
});

test("an empty library still resolves to page 1, not page 0", () => {
  assert.equal(clampTarget(0), 1);
  assert.equal(clampTarget(-1), 1);
});

test("the clamp terminates rather than ping-ponging", () => {
  // ?page=999 on a 1-page library: request 999 → clamp to 1 → request 1 → no further clamp.
  // If the second step still wanted to clamp, the URL would rewrite forever.
  const target = clampTarget(1);
  assert.equal(shouldClamp(999, 999, 1), true);
  assert.equal(shouldClamp(target, target, 1), false);
});

test("a stale answer from the other page cannot trigger a clamp", () => {
  // Mid-navigation: the URL says page 2, the store still describes page 1. Acting on that pairing
  // would clamp against the wrong total.
  assert.equal(shouldClamp(2, 1, 1), false);
});

// --------------------------------------------------------------------------- //
// Scrolling
// --------------------------------------------------------------------------- //

test("first paint does not scroll", () => {
  // A deep link to page 3 arrives with the browser already positioned. Jerking it to the top
  // would undo that.
  assert.equal(shouldScrollToTop(null, viewKey("tracks", 3)), false);
});

test("a real page change scrolls to the top", () => {
  assert.equal(shouldScrollToTop(viewKey("tracks", 1), viewKey("tracks", 2)), true);
});

test("switching tabs scrolls to the top — it is a different list", () => {
  assert.equal(shouldScrollToTop(viewKey("tracks", 1), viewKey("playlists", 1)), true);
});

test("a re-render on the same view does NOT scroll", () => {
  // The artifact poll refreshes this page every 5 seconds. Scrolling on each one would make the
  // list unusable while anything is still generating.
  assert.equal(shouldScrollToTop(viewKey("tracks", 2), viewKey("tracks", 2)), false);
});
