import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_LOADERS } from '@/routes/pageLoaders.ts';
import { PAGE_MODULES } from '@/routes/pageModules.ts';

/**
 * Every page is code-split, so Vite gives each one its own stylesheet and injects it when that
 * route's JS loads. While the markup ALSO arrived with the JS, that was invisible.
 *
 * Prerendering broke that pairing: the markup now ships in the HTML and painted immediately, while
 * the page's CSS was still waiting on JavaScript. The result was a page that rendered unstyled and
 * restyled itself a moment later — worse than no prerendering, and a large layout shift.
 *
 * So each route's HTML must link its own stylesheet. These assertions guard the two ways that can
 * silently break: the route→module map drifting out of sync, and the link injection failing.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`), 'utf8');

const stylesheets = (src: string) =>
  [...src.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);

describe('route → page module map', () => {
  it('covers exactly the routes PAGE_LOADERS does', () => {
    expect(Object.keys(PAGE_MODULES).sort()).toEqual(Object.keys(PAGE_LOADERS).sort());
  });

  it('points at page modules under src/pages', () => {
    for (const [route, module] of Object.entries(PAGE_MODULES)) {
      expect(module, `${route} should map to a page module`).toMatch(/^src\/pages\/\w+\.tsx$/);
    }
  });
});

describe.skipIf(!built)('per-route stylesheets in the built HTML', () => {
  /* /subscribe and /contact import no CSS of their own — they are styled entirely by the global
     sheets. Asserted explicitly so "no stylesheet" stays a decision rather than a silent gap. */
  const NO_PAGE_CSS = ['/subscribe', '/contact', '/waitlist', '/error'];
  const routes = Object.keys(PAGE_MODULES).filter((r) => !NO_PAGE_CSS.includes(r));

  /* The CSS is INLINED, not linked. Three blocking stylesheets meant three round trips before
     anything could paint; on the throttled mobile profile Lighthouse attributed 1,160–1,510 ms to
     them and FCP sat at 3.2 s. So the assertions below check the stylesheet's *content* reached the
     document, and that no blocking request survived. */
  const styleBlocks = (route: string) =>
    [...html(route).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);

  /** The built asset that belongs to this route's page module, straight from the manifest. */
  const pageCssFor = (route: string): string | null => {
    const manifest = JSON.parse(readFileSync(resolve(DIST, '.vite/manifest.json'), 'utf8'));
    const href = manifest[PAGE_MODULES[route]]?.css?.[0];
    return href ? readFileSync(resolve(DIST, href), 'utf8') : null;
  };

  it('leaves no render-blocking stylesheet on any route', () => {
    const blocking = Object.keys(PAGE_MODULES).filter((r) => stylesheets(html(r)).length > 0);
    expect(blocking, 'these routes still block first paint on a CSS request').toEqual([]);
  });

  it('inlines the stylesheet that belongs to that page, not another one', () => {
    const wrong = routes.filter((route) => {
      const css = pageCssFor(route);
      if (!css) return false;
      // Match on a real slice of the file, so a stale or wrong asset cannot pass.
      const fingerprint = css.slice(0, 120);
      return !styleBlocks(route).some((block) => block.includes(fingerprint));
    });
    expect(wrong, "these routes are missing their own page's CSS").toEqual([]);
  });

  it('keeps the page CSS after the global CSS so the cascade is unchanged', () => {
    const doc = html('/');
    const globalCss = readFileSync(
      resolve(DIST, JSON.parse(readFileSync(resolve(DIST, '.vite/manifest.json'), 'utf8'))[
        'index.html'
      ].css[0]),
      'utf8',
    );
    const pageCss = pageCssFor('/')!;
    expect(doc.indexOf(globalCss.slice(0, 120))).toBeLessThan(doc.indexOf(pageCss.slice(0, 120)));
  });

  it('still emits the manifest the injection reads', () => {
    expect(existsSync(resolve(DIST, '.vite/manifest.json'))).toBe(true);
  });
});

describe('beta notice no-flash guard', () => {
  const shell = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  // Strip comments: the explanation below the script mentions the same key.
  const code = shell.replace(/<!--[\s\S]*?-->/g, '');

  it('reads the dismissal flag inline, before first paint', () => {
    expect(code).toMatch(/localStorage\.getItem\("demo_stage_notice_dismissed"\)/);
    expect(code).toContain('data-demo-dismissed');
  });

  it('hides the banner from that flag with a style rule, not JavaScript', () => {
    // A JS-driven hide would run after paint, which is the flash we are removing.
    expect(code).toMatch(/\[data-demo-dismissed\]\s*\[data-demo-banner\]\s*\{\s*display:\s*none/);
  });

  it('declares the consent stylesheet statically so it cannot restyle the page late', () => {
    // useSilktide otherwise appends it from an effect, a second or so after first paint.
    expect(code).toMatch(/<link id="resomix-consent-style" rel="stylesheet"/);
  });

  it.skipIf(!built)('inlines that stylesheet at build time, costing no round trip', () => {
    // It is small and always needed, so a render-blocking request for it is pure latency. The id
    // survives inlining because useSilktide checks for it before injecting its own copy.
    const home = readFileSync(resolve(DIST, 'index.html'), 'utf8');
    expect(home).toContain('<style id="resomix-consent-style">');
    expect(home, 'the link should be gone, not duplicated').not.toContain(
      '<link id="resomix-consent-style"',
    );
  });

  it('uses the same storage key the app writes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/OptionalAuthRoute.tsx'),
      'utf8',
    );
    expect(source).toContain('demo_stage_notice_dismissed');
  });
});
