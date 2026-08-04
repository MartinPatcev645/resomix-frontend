import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_SEO, SITE_ORIGIN } from '@/routes/seoConfig.ts';

/**
 * Link previews on WhatsApp, Slack, iMessage, LinkedIn and Upwork all showed the homepage, whatever
 * URL was shared.
 *
 * Cause: this is an SPA, so every URL was served the one `index.html`, and `RouteMeta` only rewrites
 * the head after React boots. Those scrapers never execute JavaScript — they read the bytes the
 * server returned. Runtime head management cannot reach them by construction.
 *
 * The build now emits `dist/<route>/index.html` per route with the head already correct. These
 * assertions run against that build output, because the only thing that matters here is what a
 * scraper receives.
 *
 * Skipped when dist/ is absent (a plain `vitest` run with no prior build) rather than failing, so
 * the suite does not depend on build order.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');

const tag = (src: string, re: RegExp) => src.match(re)?.[1];

describe.skipIf(!built)('prerendered per-route head', () => {
  const routes = Object.keys(ROUTE_SEO).filter((r) => r !== '/404');

  it('emits an HTML file for every route', () => {
    const missing = routes.filter(
      (r) => !existsSync(resolve(DIST, r === '/' ? 'index.html' : `${r.slice(1)}/index.html`)),
    );
    expect(missing).toEqual([]);
  });

  it.each(routes)('%s ships its own title and description in the raw HTML', (route) => {
    const src = html(route);
    const seo = ROUTE_SEO[route];
    // & is escaped in the served markup, so compare on the escaped form.
    const esc = (s: string) => s.replace(/&/g, '&amp;');
    expect(tag(src, /<title>([^<]*)<\/title>/)).toBe(esc(seo.title));
    expect(tag(src, /<meta\s+name="description"\s+content="([^"]*)"/)).toBe(esc(seo.description));
  });

  it.each(routes)('%s ships its own og:title and canonical', (route) => {
    const src = html(route);
    const seo = ROUTE_SEO[route];
    const esc = (s: string) => s.replace(/&/g, '&amp;');
    expect(tag(src, /<meta\s+property="og:title"\s+content="([^"]*)"/)).toBe(esc(seo.title));
    const expectedUrl = route === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route}`;
    expect(tag(src, /<link\s+rel="canonical"\s+href="([^"]*)"/)).toBe(expectedUrl);
    expect(tag(src, /<meta\s+property="og:url"\s+content="([^"]*)"/)).toBe(expectedUrl);
  });

  it('does not leave the homepage title on a sub-route', () => {
    // The exact symptom that was reported: three different URLs, one preview.
    const home = tag(html('/'), /<title>([^<]*)<\/title>/);
    for (const route of ['/solutions/producers', '/product/track-intelligence', '/trust']) {
      expect(tag(html(route), /<title>([^<]*)<\/title>/)).not.toBe(home);
    }
  });

  it('carries robots per route, so noindex pages stay out statically too', () => {
    expect(tag(html('/error'), /<meta\s+name="robots"\s+content="([^"]*)"/)).toBe('noindex, follow');
    expect(tag(html('/trust'), /<meta\s+name="robots"\s+content="([^"]*)"/)).toBe('index, follow');
  });

  it('keeps asset URLs absolute, or nested pages would 404 their own JS', () => {
    // dist/solutions/producers/index.html resolving "./assets/x.js" would request
    // /solutions/producers/assets/x.js — the whole app would fail to boot at depth.
    const src = html('/solutions/producers');
    expect(src).toMatch(/src="\/assets\//);
    expect(src).not.toMatch(/(src|href)="\.\.?\/[^"]*assets/);
  });

  it('changes nothing below <head>', () => {
    const body = (s: string) => s.slice(s.indexOf('<body'));
    expect(body(html('/solutions/producers'))).toBe(body(html('/')));
  });

  it('escapes markup-significant characters in attributes', () => {
    // Several titles contain "&" ("Music Similarity & Audio Analysis Platform", "DJs & Sets").
    // A bare & in an attribute value is invalid markup, so assert against whichever titles
    // currently have one rather than hardcoding a single page's copy.
    const withAmp = routes.filter((r) => ROUTE_SEO[r].title.includes('&'));
    expect(withAmp.length, 'no title contains & — this test no longer proves anything').toBeGreaterThan(0);
    for (const r of withAmp) {
      expect(html(r)).toContain(ROUTE_SEO[r].title.replace(/&/g, '&amp;'));
    }
  });
});
