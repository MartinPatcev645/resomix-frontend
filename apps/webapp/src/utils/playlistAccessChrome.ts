import type { AccessVerdict } from "@resomix/hooks";

/** Dim + ⌾ + native title for verdict-gated playlist toolbar controls. */
export function playlistAccessChrome(
  verdict: AccessVerdict,
  ready: boolean,
  gateTitle: string,
): { className: string; title?: string; showLock: boolean } {
  if (!ready || verdict === "pending") {
    return { className: " opacity-60", showLock: false };
  }
  if (verdict === "login" || verdict === "upgrade") {
    return {
      className: " opacity-45 cursor-pointer",
      title: gateTitle,
      showLock: true,
    };
  }
  return { className: "", showLock: false };
}

export const PLAYLIST_LOCK_MARK = "⌾";
