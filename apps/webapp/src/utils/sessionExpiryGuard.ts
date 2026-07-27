import { useAuthStore } from "@resomix/stores";

/** True when the global auth layer has raised the session-expired modal. */
export function isSessionExpired(): boolean {
  return useAuthStore.getState().sessionExpired;
}

/**
 * Workspace operations should defer to SessionExpiredModal instead of guest gates or error banners.
 * Call in catch paths and before surfacing upload-store gateReason.
 */
export function shouldDeferToSessionExpiredModal(): boolean {
  return isSessionExpired();
}
