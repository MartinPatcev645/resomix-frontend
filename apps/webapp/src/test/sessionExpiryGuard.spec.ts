import { describe, expect, it, vi, beforeEach } from "vitest";

const getState = vi.fn();

vi.mock("@resomix/stores", () => ({
  useAuthStore: {
    getState: () => getState(),
  },
}));

import { isSessionExpired, shouldDeferToSessionExpiredModal } from "../utils/sessionExpiryGuard.ts";

describe("sessionExpiryGuard", () => {
  beforeEach(() => {
    getState.mockReset();
  });

  it("returns true when sessionExpired flag is set", () => {
    getState.mockReturnValue({ sessionExpired: true });
    expect(isSessionExpired()).toBe(true);
    expect(shouldDeferToSessionExpiredModal()).toBe(true);
  });

  it("returns false for active sessions", () => {
    getState.mockReturnValue({ sessionExpired: false });
    expect(isSessionExpired()).toBe(false);
    expect(shouldDeferToSessionExpiredModal()).toBe(false);
  });
});
