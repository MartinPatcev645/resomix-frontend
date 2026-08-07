import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_SEO, SITE_ORIGIN, sitemapRoutes } from '@/routes/seoConfig.ts';
import { RouteMeta, canonicalUrlFor, seoFor } from '@/components/RouteMeta.tsx';

/**
 * The head and the sitemap had drifted apart badly: `public/sitemap.xml` was hand-maintained and
 * still advertised `/terms` and `/privacy` (never routes) while listing one of the seventeen
 * marketing pages, and index.html hardcoded a homepage canonical that every route inherited — so
 * all twenty URLs declared themselves to be the same page.
 *
 * Both now derive from `seoConfig`, and these assertions are what keeps them derived: a new route
 * with no entry, a duplicated title, or a sitemap URL that no longer resolves all fail here.
 */

// Comments stripped first: a commented-out <Route> (there is one for /test) is not a live route,
// and counting it would demand SEO metadata for a page that does not exist.
const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Paths that legitimately have no SEO entry: redirects and hand-offs to the beta app. */
const NOT_INDEXABLE = new Set([
  '/subscribe', // redirect → /pricing
  '/product/catalogue-intelligence', // redirect → the catalog- spelling
  '/auth/*',
  '/profile',
  '/sessions',
  '/change-password',
  '*', // catch-all, covered by the '/404' entry
]);

const declaredRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

describe('every route is accounted for', () => {
  it('has an SEO entry, or is explicitly a redirect', () => {
    const orphans = declaredRoutes.filter((r) => !NOT_INDEXABLE.has(r) && !ROUTE_SEO[r]);
    expect(orphans, 'routes missing from seoConfig').toEqual([]);
  });

  it('has no SEO entry for a path that is not a route', () => {
    // This is the failure the old sitemap shipped: /terms and /privacy were advertised for months.
    const ghosts = Object.keys(ROUTE_SEO).filter(
      (p) => p !== '/404' && !declaredRoutes.includes(p),
    );
    expect(ghosts, 'seoConfig entries with no matching route').toEqual([]);
  });
});

describe('metadata quality', () => {
  const entries = Object.entries(ROUTE_SEO);

  it('gives every page a distinct title', () => {
    const titles = entries.map(([, s]) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('gives every page a distinct description', () => {
    const descs = entries.map(([, s]) => s.description);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it('keeps titles inside the ~60 char SERP truncation', () => {
    const long = entries.filter(([, s]) => s.title.length > 60).map(([p, s]) => `${p} (${s.title.length})`);
    expect(long).toEqual([]);
  });

  it('keeps descriptions inside the ~160 char snippet limit', () => {
    const long = entries
      .filter(([, s]) => s.description.length > 160)
      .map(([p, s]) => `${p} (${s.description.length})`);
    expect(long).toEqual([]);
  });

  it('writes descriptions long enough to be usable', () => {
    const thin = entries.filter(([, s]) => !s.noindex && s.description.length < 50).map(([p]) => p);
    expect(thin).toEqual([]);
  });
});

describe('canonical URLs', () => {
  it('is absolute and on the production origin', () => {
    expect(canonicalUrlFor('/trust')).toBe(`${SITE_ORIGIN}/trust`);
  });

  it('collapses a trailing slash, so /trust and /trust/ are not two pages', () => {
    expect(canonicalUrlFor('/trust/')).toBe(canonicalUrlFor('/trust'));
  });

  it('keeps the root slash', () => {
    expect(canonicalUrlFor('/')).toBe(`${SITE_ORIGIN}/`);
  });
});

describe('RouteMeta applies the right head for a route', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  const meta = (sel: string) => document.head.querySelector<HTMLMetaElement>(sel)?.content;
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <RouteMeta />
      </MemoryRouter>,
    );

  it('sets the page title and description', () => {
    at('/trust');
    expect(document.title).toBe(ROUTE_SEO['/trust'].title);
    expect(meta('meta[name="description"]')).toBe(ROUTE_SEO['/trust'].description);
  });

  it('sets a per-route canonical rather than inheriting the homepage one', () => {
    at('/solutions/djs');
    const href = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    expect(href).toBe(`${SITE_ORIGIN}/solutions/djs`);
  });

  it('mirrors title and description into the social tags', () => {
    at('/developers');
    const { title, description } = ROUTE_SEO['/developers'];
    expect(meta('meta[property="og:title"]')).toBe(title);
    expect(meta('meta[property="og:description"]')).toBe(description);
    expect(meta('meta[name="twitter:title"]')).toBe(title);
    expect(meta('meta[property="og:url"]')).toBe(`${SITE_ORIGIN}/developers`);
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('marks an indexable page index, follow', () => {
    at('/');
    expect(meta('meta[name="robots"]')).toBe('index, follow');
  });

  it('marks an unknown path noindex, so a typo URL is never indexed', () => {
    at('/this-page-does-not-exist');
    expect(meta('meta[name="robots"]')).toBe('noindex, follow');
    expect(document.title).toBe(ROUTE_SEO['/404'].title);
  });

  it('uses absolute image URLs — crawlers do not resolve relative OG images', () => {
    at('/');
    expect(meta('meta[property="og:image"]')).toMatch(/^https:\/\//);
    expect(meta('meta[name="twitter:image"]')).toMatch(/^https:\/\//);
  });

  it('falls back to the 404 entry for an unmapped path', () => {
    expect(seoFor('/nope').title).toBe(ROUTE_SEO['/404'].title);
  });
});

describe('sitemap source', () => {
  it('excludes noindex routes', () => {
    const paths = sitemapRoutes().map((r) => r.path);
    expect(paths).not.toContain('/error');
    expect(paths).not.toContain('/404');
  });

  it('lists every indexable page', () => {
    const expected = Object.entries(ROUTE_SEO).filter(([, s]) => !s.noindex).length;
    expect(sitemapRoutes()).toHaveLength(expected);
  });

  it('is generated, not committed — a hand-edited file is what drifted before', () => {
    let exists = true;
    try {
      readFileSync(resolve(process.cwd(), 'public/sitemap.xml'));
    } catch {
      exists = false;
    }
    expect(exists, 'public/sitemap.xml is back; it must be built from seoConfig').toBe(false);
  });
});
