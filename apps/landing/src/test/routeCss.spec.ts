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
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');

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

  it('links a page-specific stylesheet on every content route', () => {
    const missing = routes.filter((r) => stylesheets(html(r)).length < 3);
    expect(missing, 'these routes ship markup with no page CSS — they will paint unstyled').toEqual(
      [],
    );
  });

  it('links the stylesheet that belongs to that page, not another one', () => {
    // HomePage-*.css on /, DjsPage-*.css on /solutions/djs, and so on.
    const wrong = routes.filter((route) => {
      const component = PAGE_MODULES[route].replace('src/pages/', '').replace('.tsx', '');
      return !stylesheets(html(route)).some((href) => href.includes(`/${component}-`));
    });
    expect(wrong, 'these routes link the wrong page stylesheet').toEqual([]);
  });

  it('keeps the page stylesheet after the global ones so the cascade is unchanged', () => {
    const sheets = stylesheets(html('/'));
    expect(sheets[sheets.length - 1]).toContain('HomePage-');
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

  it('links the consent stylesheet statically so it cannot restyle the page late', () => {
    // useSilktide otherwise appends it from an effect, a second or so after first paint.
    expect(code).toMatch(/<link id="resomix-consent-style" rel="stylesheet"/);
  });

  it('uses the same storage key the app writes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/OptionalAuthRoute.tsx'),
      'utf8',
    );
    expect(source).toContain('demo_stage_notice_dismissed');
  });
});
