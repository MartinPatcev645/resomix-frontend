import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * `React.lazy` that survives a failed chunk download.
 *
 * Plain `lazy(() => import(...))` has two failure modes that only show up in production, because
 * `vite dev` serves unhashed modules from a server that never changes underneath the tab:
 *
 *  1. A deploy replaces every hash-named chunk. A tab that was already open still asks for the OLD
 *     filename, which no longer exists, and the import rejects with a 404.
 *  2. A slow or flaky connection drops the request.
 *
 * In both cases the rejection is thrown during render. With no error boundary the tree unmounts and
 * the click appears to do nothing — and because `lazy` memoises the settled promise, that route
 * stays dead for the rest of the session while already-loaded routes keep working. That is exactly
 * the "clicked Sonic Discovery and nothing happened" symptom.
 *
 * So: retry once for a transient blip, then treat a second failure as a stale document and reload,
 * which fetches a fresh index.html pointing at the new hashes. The reload is one-shot per session —
 * a genuinely broken build must surface as an error, never as a reload loop.
 */

/** Set once we have spent this session's single reload. */
const RELOAD_KEY = 'rx-chunk-reload';

/** sessionStorage throws in some privacy modes; never let bookkeeping break navigation. */
const readFlag = (): boolean => {
  try {
    return sessionStorage.getItem(RELOAD_KEY) !== null;
  } catch {
    return false;
  }
};

const writeFlag = (): void => {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* best effort */
  }
};

const clearFlag = (): void => {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* best effort */
  }
};

/** Exposed so the error boundary's "try again" can re-arm the recovery reload. */
export const clearChunkReloadGuard = clearFlag;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = { default: ComponentType<any> };

export function lazyRoute<T extends AnyModule>(
  load: () => Promise<T>,
): LazyExoticComponent<T['default']> {
  return lazy(async () => {
    try {
      const mod = await load();
      // A successful load means this document is current, so re-arm recovery for the NEXT deploy.
      // Without this, the first stale chunk of the session would burn the only reload we allow.
      clearFlag();
      return mod;
    } catch (first) {
      try {
        // One immediate retry. A dropped request on a weak connection usually succeeds now, and it
        // costs nothing when the real problem is a 404.
        const mod = await load();
        clearFlag();
        return mod;
      } catch (second) {
        if (!readFlag()) {
          writeFlag();
          // The URL is already the destination the user asked for, so the reload lands on the page
          // they clicked rather than bouncing them home.
          window.location.reload();
          // Resolve never: the document is being torn down, and rejecting here would flash the
          // error boundary for the frame before navigation commits.
          return new Promise<T>(() => {});
        }
        // Already reloaded once this session and it still fails — this is not staleness. Let the
        // error boundary render something the user can act on.
        throw second ?? first;
      }
    }
  }) as LazyExoticComponent<T['default']>;
}
