/**
 * Guards the `?id=` auto-similarity trigger so it CREATES at most one playlist per track id within a
 * single page load.
 *
 * The landing (UploadPage / UploadMobile) can mount more than once while a new tab boots — the auth
 * token-borrow re-render and the responsive-breakpoint settle both re-render it — and a per-component
 * ref can't dedup across those separate instances, so the "Sonic Discovery" button (which opens
 * `/?id=<track>` in a new tab) could create two playlists. This module-level set dedups across every
 * mount in the page load.
 *
 * Scope is the page load: a NEW tab (a new sonic-discovery) starts with an empty set, so each genuine
 * discovery still runs. The cache fast-path is intentionally NOT guarded (it creates nothing), so
 * revisiting an already-built id still resolves from cache.
 */
const triggered = new Set<string>();

/** Returns true the FIRST time an id is seen (and records it); false on any later call. */
export const claimDiscoveryTrigger = (id: string): boolean => {
  if (triggered.has(id)) return false;
  triggered.add(id);
  return true;
};
