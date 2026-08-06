/**
 * Quota-denial signal (pricing v2.1, E1).
 *
 * When the server refuses an action with a 402, the cached entitlements are stale by definition:
 * the user just spent the thing the chip is displaying. Without this the chip keeps showing "2/3"
 * after the request that made it 3/3, and the only fix the user has is a page reload.
 *
 * A standalone module with **no imports** on purpose — `utils.ts` fires it and `useEntitlements`
 * listens, and those two already point at each other through the package root. Anything with a
 * dependency of its own would close that loop.
 *
 * Listeners are notified, never awaited: this fires from inside error handling, and a slow or
 * throwing listener must not delay or replace the error the caller is already dealing with.
 */

type QuotaListener = (code: string | null) => void;

const listeners = new Set<QuotaListener>();

/** Subscribe to quota denials. Returns an unsubscribe function. */
export function onQuotaDenied(listener: QuotaListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fire after any 402. `code` is the machine denial code, when the server sent one. */
export function emitQuotaDenied(code: string | null = null): void {
  listeners.forEach((listener) => {
    try {
      listener(code);
    } catch {
      /* a broken listener must not swallow the API error the caller is handling */
    }
  });
}
