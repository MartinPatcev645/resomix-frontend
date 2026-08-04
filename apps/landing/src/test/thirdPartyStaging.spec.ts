import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Lighthouse measured 399 KiB of third-party JavaScript on the landing homepage — more than the
 * app's own 249 KiB — and ~394 ms of main-thread time, none of it rendering content.
 *
 * The load order now is:
 *
 *   eager            Silktide consent banner (functional, and gates the rest)
 *   idle             Google One Tap (98 KiB, user-facing)
 *   idle + 1.5 s     Google Tag Manager (119 KiB) -> PostHog (182 KiB, 7 scripts)
 *
 * The ordering constraint worth remembering: PostHog is loaded BY the GTM container, not by this
 * repo. It cannot start before GTM, so putting GTM last puts PostHog last.
 *
 * Two things must never regress and are easy to undo by accident, which is why they are asserted:
 * the eager loader must not come back into index.html, and the Consent Mode defaults must stay
 * inline and synchronous ahead of it.
 */

const ROOT = resolve(process.cwd(), '../..');
const html = (app: string) => readFileSync(resolve(ROOT, `apps/${app}/index.html`), 'utf8');
const app = (a: string) => readFileSync(resolve(ROOT, `apps/${a}/src/App.tsx`), 'utf8');
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe.each(['landing', 'webapp'])('%s third-party staging', (name) => {
  it('does not load the GTM container from the document head', () => {
    // This is the regression that would silently undo the whole change.
    expect(strip(html(name))).not.toContain('googletagmanager.com/gtm.js');
  });

  it('keeps the Consent Mode defaults inline and synchronous', () => {
    // Consent Mode v2 requires these to run BEFORE the container. They cost no request.
    // The two apps quote differently (landing double, webapp single), so match either.
    const live = strip(html(name));
    expect(live).toMatch(/gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/);
    expect(live).toMatch(/['"]?ad_storage['"]?:\s*['"]denied['"]/);
    expect(live).toMatch(/['"]?analytics_storage['"]?:\s*['"]denied['"]/);
  });

  it('still ships the noscript fallback', () => {
    // Only applies with JS off, where none of the deferral runs.
    expect(html(name)).toContain('googletagmanager.com/ns.html');
  });

  it('injects GTM through the staged hook instead', () => {
    expect(app(name)).toContain('useGoogleTagManager(');
    expect(app(name)).toContain('analyticsReady');
  });

  it('loads analytics after One Tap, not before', () => {
    const src = app(name);
    const oneTap = Number(src.match(/const oneTapReady = useAfterIdle\((\d+)\)/)![1]);
    const analytics = Number(src.match(/const analyticsReady = useAfterIdle\((\d+)\)/)![1]);
    expect(analytics).toBeGreaterThan(oneTap);
  });

  it('leaves the consent banner eager', () => {
    // Silktide is functional, not analytics — deferring it would delay the banner itself.
    const src = app(name);
    expect(src).toContain('useSilktide(consentConfig)');
    expect(src).not.toMatch(/useSilktide\([^)]*Ready/);
  });
});

describe('preconnect hygiene', () => {
  it.each(['landing', 'webapp'])('%s preconnects to at most one origin', (name) => {
    /*
     * Lighthouse warned "More than 4 preconnect connections were found" on the first run with four.
     * Every third party is now deferred to an idle callback, so warming their sockets during load
     * buys nothing — only the API is on the critical path.
     */
    const links = [...html(name).matchAll(/<link rel="preconnect"[^>]*>/g)];
    expect(links.length).toBeLessThanOrEqual(1);
  });

  it.each(['landing', 'webapp'])('%s matches the API credentials mode', (name) => {
    // The API client sends withCredentials: true. A bare `crossorigin` is anonymous and does not
    // match, which is why Lighthouse reported the connection as "Unused preconnect".
    const tag = html(name).match(/<link rel="preconnect" href="https:\/\/bserver[^>]*>/)![0];
    expect(tag).toContain('crossorigin="use-credentials"');
  });
});

describe('One Tap gating', () => {
  it('landing defers it unconditionally', () => {
    // Landing has no auth screens of its own — /auth/* forwards to beta.
    expect(app('landing')).toMatch(/\{oneTapReady && \(/);
  });

  it('the webapp keeps it immediate on auth routes', () => {
    // Signing in is the point of those pages; a delayed prompt is worse than a later paint.
    expect(app('webapp')).toMatch(/\{\(onAuthRoute \|\| oneTapReady\) && \(/);
  });
});
