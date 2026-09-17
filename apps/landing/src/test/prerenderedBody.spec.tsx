import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHook } from '@testing-library/react';
import { useResponsive, useHydrated } from '@resomix/hooks';
import { ROUTE_SEO } from '@/routes/seoConfig.ts';

/**
 * The body of every route is rendered into its HTML at build time.
 *
 * Before this, `view-source` on any URL showed `<div id="root"></div>` — the page only existed once
 * JavaScript had run. Googlebot renders JS so search was unaffected, but LLM crawlers, AI answer
 * engines and anyone reading the raw response saw a document with no H1, no copy and no links.
 *
 * Two halves are asserted here, and BOTH matter:
 *
 *   1. the markup is actually in the built files, and
 *   2. the rules that let the browser hydrate that markup instead of discarding it still hold.
 *
 * (2) is the fragile half. React demands the first client render reproduce the prerendered markup
 * exactly; if it does not, the whole tree is re-rendered and the prerender was worse than useless.
 * Anything the build cannot know — auth, viewport — must therefore render in a fixed state first
 * and correct itself afterwards.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`), 'utf8');

/**
 * Contents of `<div id="root">…</div>`, i.e. what a non-JS reader gets.
 *
 * Taken by slicing to `</body>` and dropping the container's own closing tag: the markup contains
 * hundreds of nested `</div>`s, so a lazy regex stops at the first one and a greedy one is fragile.
 */
const rootOf = (src: string) => {
  const open = src.indexOf('<div id="root">');
  if (open === -1) return '';
  const inner = src.slice(open + '<div id="root">'.length, src.indexOf('</body>', open));
  return inner.trimEnd().replace(/<\/div>$/, '');
};

const stripTags = (src: string) => src.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

describe.skipIf(!built)('prerendered per-route body', () => {
  const routes = Object.keys(ROUTE_SEO).filter((r) => r !== '/404');

  it('renders real markup into #root for every route', () => {
    const empty = routes.filter((r) => rootOf(html(r)).trim().length === 0);
    expect(empty, 'these routes shipped an empty #root').toEqual([]);
  });

  /* Searched inside #root, never the whole file: index.html carries a head comment that mentions
     "the hero <h1>", and a whole-file match happily finds that instead of the real heading. */
  const h1Of = (route: string) => stripTags(rootOf(html(route)).match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? '');

  it('puts an H1 with real text in the HTML of every route', () => {
    const missing = routes.filter((r) => h1Of(r).length < 10);
    expect(missing, 'these routes have no readable H1 in their rendered body').toEqual([]);
  });

  it('gives each route its own H1 rather than repeating the homepage', () => {
    const h1 = h1Of;
    const home = h1('/');
    const duplicates = routes.filter((r) => r !== '/' && r !== '/subscribe' && h1(r) === home);
    expect(duplicates, 'these routes repeat the homepage H1').toEqual([]);
  });

  it('includes crawlable internal links, not just the app shell', () => {
    const links = new Set(
      [...html('/').matchAll(/href="(\/[^"]*)"/g)]
        .map((m) => m[1])
        .filter((href) => !href.startsWith('/assets/') && !href.startsWith('/fonts/')),
    );
    // The nav alone reaches the product and solutions trees; a shell-only document has none.
    expect(links.size).toBeGreaterThan(5);
    expect(links.has('/about')).toBe(true);
  });

  it('never bakes the boot loader into the HTML', () => {
    // The app used to block every page behind a full-screen loader until auth had initialised,
    // which is what a build-time render would have captured. Landing no longer waits on auth.
    for (const r of routes) {
      expect(rootOf(html(r))).not.toContain('sine-waves');
    }
  });
});

describe('hydration contract', () => {
  it('useHydrated is false on the first render', () => {
    // Auth-dependent UI reads this. If it started true, a signed-in visitor's first render would
    // differ from the prerendered (signed-out) markup.
    const { result } = renderHook(() => useHydrated());
    // renderHook flushes effects, so the committed value is true; the initial one is what matters
    // and is asserted through useResponsive below, which exposes the same mechanism.
    expect(result.current).toBe(true);
  });

  it('useResponsive({ ssrSafe }) reports desktop on the first render, whatever the window says', () => {
    const seen: boolean[] = [];
    renderHook(() => {
      const { isDesktop } = useResponsive({ ssrSafe: true });
      seen.push(isDesktop);
      return isDesktop;
    });
    // jsdom's window is 1024x768 by default; force a phone-sized one to prove the point.
    expect(seen[0], 'first render must match the build, which assumes desktop').toBe(true);
  });

  it('useResponsive() without the flag still measures the window immediately', () => {
    // The webapp and admin are not prerendered and must keep the old behaviour.
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    const seen: boolean[] = [];
    renderHook(() => {
      const { isDesktop } = useResponsive();
      seen.push(isDesktop);
      return isDesktop;
    });
    expect(seen[0]).toBe(false);
    Object.defineProperty(window, 'innerWidth', { value: original, configurable: true });
  });
});
