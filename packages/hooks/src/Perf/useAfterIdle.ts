import { useEffect, useState } from 'react';

/**
 * Becomes true once the page has finished loading AND the browser is idle — optionally after a
 * further delay. Used to stage third-party scripts so they never compete with first paint.
 *
 * WHY
 * ---
 * Lighthouse measured 399 KiB of third-party JavaScript on the landing homepage — more than the
 * app's own 249 KiB — and ~394 ms of main-thread time. None of it contributes to the content a
 * visitor came to read, but all of it was requested during initial load.
 *
 * Staging with this hook keeps the render path clear: content paints first, then the deferred
 * work starts on an idle callback, ordered by how much each script matters to the user.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a replacement for consent gating. The Google Consent Mode defaults in index.html still run
 * inline and synchronously before anything is scheduled here, and the consent banner (Silktide)
 * is deliberately NOT deferred — it is functional, not analytics.
 *
 * `requestIdleCallback` is unavailable in Safari <16.4, so a timeout fallback is always armed;
 * whichever fires first wins. The result is a one-way latch — it never flips back to false.
 */

/** ms to wait before even asking for idle time, so stages can be ordered relative to each other. */
export function useAfterIdle(delayMs = 0): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    let delayHandle: number | undefined;
    let done = false;

    const fire = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    const schedule = () => {
      delayHandle = window.setTimeout(() => {
        const ric = (window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }).requestIdleCallback;
        if (ric) {
          idleHandle = ric(fire, { timeout: 3000 });
        }
        // Always armed: covers browsers without requestIdleCallback, and pages that never go idle.
        timeoutHandle = window.setTimeout(fire, 3000);
      }, delayMs);
    };

    // Wait for `load` so deferred work cannot compete with the resources that produce first paint.
    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      window.removeEventListener('load', schedule);
      if (delayHandle) window.clearTimeout(delayHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (idleHandle && cic) cic(idleHandle);
    };
  }, [delayMs]);

  return ready;
}
