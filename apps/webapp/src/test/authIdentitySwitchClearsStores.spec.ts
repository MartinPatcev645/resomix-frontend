/**
 * An identity change must DROP the previous identity's data.
 *
 * `setAuth` and `logout` have always contained the code to reset the playlist and cart stores.
 * It never ran. The call sites used CommonJS `require('./usePlayList')` inside `try { } catch { }`,
 * and `require` does not exist in an ESM browser bundle — Vite shipped the call verbatim, it threw
 * `ReferenceError` on the first statement, and the bare `catch` swallowed it. Confirmed by reading
 * the production bundle, which contained:
 *
 *     try{const s=require("./usePlayList");s.clearAllPlaylistCache(),
 *         s.usePlaylistStore.getState().reset()}catch{}
 *
 * Two consequences, both user-visible:
 *
 *   - After logging in, a guest's playlist stayed in the store. Google One Tap signs in WITHOUT
 *     navigating, so nothing remounted and nothing refetched: the user kept the 10-track guest
 *     copy and could not play past track 10 until they refreshed the page. Password login masked
 *     it by accident, because it routes through the auth page and navigates back.
 *   - After logging out, the cart and playlist were handed to whoever logged in next on the same
 *     browser.
 *
 * These tests assert at the store boundary, which is where the bug lived. A test that went through
 * the UI would have passed on the broken code in the password-login path.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore, usePlaylistStore, useCartStore } from "@resomix/stores";

const USER = { id: 1, uuid: "u-1", email: "a@b.c" } as never;

/** A stand-in for the redacted copy a guest is served. */
function seedGuestPlaylist() {
  usePlaylistStore.setState({
    playlistData: {
      playlist: { id: "pl-guest" },
      similar_tracks: [{ rank: 1 }, { rank: 2 }],
    },
    lastResolvedId: "pl-guest",
    lastResolvedAt: Date.now(),
    trackRatings: { "trk-1": 1 },
  } as never);
}

describe("an identity change clears the previous identity's stores", () => {
  beforeEach(() => {
    usePlaylistStore.getState().reset();
    useCartStore.getState().reset();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    } as never);
  });

  it("setAuth drops the guest playlist still sitting in the store", () => {
    seedGuestPlaylist();
    expect(usePlaylistStore.getState().playlistData).not.toBeNull();

    useAuthStore.getState().setAuth(USER, "fresh.access.token");

    // The assertion that fails on the pre-fix code: the guest copy survived login, and only a
    // page refresh cleared it.
    expect(usePlaylistStore.getState().playlistData).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("setAuth also clears the resolution markers, so the loader cannot treat it as a fresh hand-off", () => {
    seedGuestPlaylist();

    useAuthStore.getState().setAuth(USER, "fresh.access.token");

    // `usePlaylistLoader` serves the in-store copy without a visible refetch when these two say
    // the app just resolved this exact playlist. Leaving them set would reintroduce the stale
    // read through a different door.
    expect(usePlaylistStore.getState().lastResolvedId).toBeNull();
    expect(usePlaylistStore.getState().lastResolvedAt).toBe(0);
  });

  it("setAuth clears per-user track ratings", () => {
    seedGuestPlaylist();

    useAuthStore.getState().setAuth(USER, "fresh.access.token");

    // Ratings are per user. Carrying them across an identity change would show one person's
    // thumbs to another.
    expect(usePlaylistStore.getState().trackRatings).toEqual({});
  });

  it("logout clears the playlist so the next person on this browser does not inherit it", () => {
    useAuthStore.getState().setAuth(USER, "fresh.access.token");
    seedGuestPlaylist();

    useAuthStore.getState().logout({ broadcast: false });

    expect(usePlaylistStore.getState().playlistData).toBeNull();
  });

  it("logout clears the cart", () => {
    useAuthStore.getState().setAuth(USER, "fresh.access.token");
    useCartStore.setState({ items: [{ id: "t-1" }] } as never);
    expect(useCartStore.getState().items).toHaveLength(1);

    useAuthStore.getState().logout({ broadcast: false });

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("logout({reason:'expired'}) clears too — a dead session is an identity change", () => {
    useAuthStore.getState().setAuth(USER, "fresh.access.token");
    seedGuestPlaylist();

    // This is the path `useAuthInit` takes when a background token refresh fails. Without the
    // clear, a Pro user whose session died kept their full playlist on screen while the server
    // had already downgraded them to a guest.
    useAuthStore.getState().logout({ broadcast: false, reason: "expired" });

    expect(usePlaylistStore.getState().playlistData).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(true);
  });
});
