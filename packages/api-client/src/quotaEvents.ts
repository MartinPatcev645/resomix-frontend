/**
 * Quota-denial signal (pricing v2.1, E1 + E2).
 *
 * Fires once for every 402 the API returns, carrying everything the client needs to react:
 *
 *   * **E1** — the cached entitlements are stale by definition, because the user just spent the
 *     thing the usage chip is displaying. Without this the chip keeps reading "2/3" after the very
 *     request that made it 3/3, and the only fix available is a page reload.
 *   * **E2** — the upgrade modal opens from here rather than from each call site. Every metered
 *     action already handles its own errors; routing the *quota* case through one listener means a
 *     new metered endpoint gets the right modal without touching any UI.
 *
 * A standalone module with **no imports** on purpose: `utils.ts` fires it and `useEntitlements`
 * listens, and those two already point at each other through the package root. Anything with a
 * dependency of its own would close that loop.
 *
 * Listeners are notified, never awaited — this fires from inside error handling, and a slow or
 * throwing listener must not delay or replace the error the caller is already dealing with.
 */

/** The 402 body, as the client sees it. Mirrors `app/utils/quota_response.py`. */
export interface QuotaDenial {
  /** Machine code: quota_exceeded | library_full | export_limit_reached | plan_required | login_required. */
  code: string | null;
  /** The server's human sentence. Safe to show; it is written for users. */
  error: string | null;
  /** Older soft-gate contract, still sent: login_required | upgrade_required. */
  reason: string | null;
  /** Present when an allowance was spent; absent when the plan simply lacks the capability. */
  quota: {
    metric?: string;
    used?: number;
    limit?: number;
    resets_at?: string;
    upgrade?: string;
  } | null;
}

type QuotaListener = (denial: QuotaDenial) => void;

const listeners = new Set<QuotaListener>();

/** Subscribe to quota denials. Returns an unsubscribe function. */
export function onQuotaDenied(listener: QuotaListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fire after any 402. */
export function emitQuotaDenied(denial: QuotaDenial): void {
  listeners.forEach((listener) => {
    try {
      listener(denial);
    } catch {
      /* a broken listener must not swallow the API error the caller is handling */
    }
  });
}


/**
 * Fired after an action that SPENDS an allowance succeeds (a search, an upload, an export).
 *
 * The denial signal above only covers the moment someone is refused — but the usage chip is just
 * as wrong after a *successful* action, and that is the common case: create a playlist, watch the
 * chip still say 0/3 until you reload the page.
 *
 * Separate from `emitQuotaDenied` because the two mean different things: this refreshes the
 * numbers, that one also opens a modal.
 */
type UsageListener = () => void;

const usageListeners = new Set<UsageListener>();

/** Subscribe to "an allowance was just spent". Returns an unsubscribe function. */
export function onUsageChanged(listener: UsageListener): () => void {
  usageListeners.add(listener);
  return () => {
    usageListeners.delete(listener);
  };
}

/** Fire after a metered action succeeds. */
export function emitUsageChanged(): void {
  usageListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a broken listener must not break the action that just succeeded */
    }
  });
}
