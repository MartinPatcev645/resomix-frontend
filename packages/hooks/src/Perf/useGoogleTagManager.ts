import { useEffect } from 'react';

/**
 * Injects the Google Tag Manager container, once, when the caller says it is time.
 *
 * This used to be an inline loader in `index.html`'s `<head>`, so it was requested during initial
 * load on every page. It is the most expensive third party on the site — and not only for its own
 * 119 KiB:
 *
 *   gtm.js  ->  PostHog (7 scripts, 182 KiB, ~307 ms of main-thread time)
 *
 * PostHog is not an npm dependency and appears nowhere in this repo; the GTM container loads it.
 * That means deferring GTM defers PostHog with it — together roughly 301 KiB and ~375 ms that no
 * longer competes with first paint.
 *
 * WHAT STAYS IN index.html AND WHY
 * --------------------------------
 * The `gtag('consent', 'default', {...denied})` snippet must execute BEFORE the container, or
 * Google Consent Mode v2 has no defaults to honour and tags may fire unconsented. It is inline,
 * costs no request, and is left exactly where it was. The `<noscript>` iframe also stays — it only
 * applies when JavaScript is off, in which case none of this deferral runs anyway.
 */

const SCRIPT_ID = 'gtm-container-script';

export function useGoogleTagManager(containerId: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !containerId) return;
    if (typeof window === 'undefined') return;
    if (document.getElementById(SCRIPT_ID)) return;

    // GTM expects the dataLayer to exist and to carry the container-start event.
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
    document.head.appendChild(script);
  }, [containerId, enabled]);
}
