/**
 * A dead session must END, not linger.
 *
 * `useAuthInit` refreshes an expired access token in the background. When that refresh FAILS the
 * old code deliberately did nothing — the comment read "let the interceptor handle it on the next
 * API call". That was sound only while every endpoint returned 401 for a dead token.
 *
 * It stopped being true when the shared-playlist endpoint began serving a GUEST view instead of
 * refusing (backend: `get_current_user_or_anonymous`). On a public page the interceptor may never
 * fire, so the app kept showing the visitor as logged in while the server treated them as a
 * guest — a Pro user seeing a 10-track redacted playlist with no explanation.
 *
 * These tests pin the contract the fix relies on, at the store boundary:
 *   - a dead session raises the "log in again" modal,
 *   - a user-initiated logout never does,
 *   - and a deactivated account never does either, because "log in again" is advice that cannot
 *     work for them.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@resomix/stores";

function signedIn() {
  useAuthStore.setState({
    user: { id: 1, uuid: "u-1", email: "a@b.c" } as never,
    accessToken: "stale.token.value",
    isAuthenticated: true,
    sessionExpired: false,
    accountDeactivated: false,
  } as never);
}

describe("a stale session ends cleanly", () => {
  beforeEach(() => {
    signedIn();
  });

  it("logout({reason:'expired'}) clears the token AND raises the modal", () => {
    // This is exactly what useAuthInit now calls when the background refresh fails.
    useAuthStore.getState().logout({ broadcast: false, reason: "expired" });

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
    // Without this the UI would keep rendering a logged-in shell over a guest session.
    expect(s.sessionExpired).toBe(true);
  });

  it("a user-initiated logout does NOT raise the modal", () => {
    useAuthStore.getState().logout({ broadcast: false });

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.sessionExpired).toBe(false);
  });

  it("a deactivated account does NOT get told to log in again", () => {
    useAuthStore.getState().logout({ broadcast: false, reason: "deactivated" });

    const s = useAuthStore.getState();
    expect(s.sessionExpired).toBe(false);
    expect(s.accountDeactivated).toBe(true);
  });
});
