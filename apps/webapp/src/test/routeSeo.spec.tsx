import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANDING_ORIGIN, ROUTE_SEO, SITE_ORIGIN, sitemapRoutes } from '@/routes/seoConfig.ts';
import { RouteMeta, canonicalUrlFor, seoFor } from '@/components/RouteMeta.tsx';

/**
 * beta.resomix.com used to send three contradictory signals at once: index.html declared
 * `noindex, nofollow`, robots.txt disallowed every subpage, and a committed sitemap advertised four
 * URLs anyway. Crawling is now allowed, which shifts the burden onto per-route metadata — and makes
 * two things load-bearing:
 *
 *   - the signed-in workspace and the auth screens must individually say `noindex`, because the
 *     blanket tag that used to cover them is gone;
 *   - /subscribe and /contact render the SAME shared components as the marketing site, so they must
 *     canonicalise there or the two origins compete for one query.
 */

const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const declaredRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

/** Dev-only or non-page routes that need no metadata. */
const EXEMPT = new Set(['*', '/__ui-system', '/tidal-redirect', '/spotify-redirect']);

describe('every route is accounted for', () => {
  it('has an SEO entry', () => {
    const orphans = declaredRoutes.filter((r) => !EXEMPT.has(r) && !ROUTE_SEO[r]);
    expect(orphans, 'routes missing from seoConfig').toEqual([]);
  });

  it('has no entry for a path that is not a route', () => {
    const ghosts = Object.keys(ROUTE_SEO).filter((p) => p !== '/404' && !declaredRoutes.includes(p));
    expect(ghosts, 'seoConfig entries with no matching route').toEqual([]);
  });
});

describe('the signed-in app stays out of the index', () => {
  // These render a redirect or an empty shell to a logged-out crawler.
  const PRIVATE = ['/library', '/profile', '/sessions', '/change-password'];
  const AUTH = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/verify-2fa',
  ];

  it.each([...PRIVATE, ...AUTH, '/error', '/loader', '/playlist'])('%s is noindex', (path) => {
    expect(ROUTE_SEO[path]?.noindex, `${path} would be indexed`).toBe(true);
  });

  it('keeps the public workspace indexable', () => {
    for (const path of ['/', '/sonic-discovery', '/analysis']) {
      expect(ROUTE_SEO[path].noindex).toBeUndefined();
    }
  });

  it('follows links even on noindex pages, so link equity is not stranded', () => {
    // The old blanket tag was `noindex, nofollow`; the nofollow bought nothing.
    document.head.innerHTML = '';
    render(
      <MemoryRouter initialEntries={['/library']}>
        <RouteMeta />
      </MemoryRouter>,
    );
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe(
      'noindex, follow',
    );
  });
});

describe('pages shared with the marketing site do not compete with it', () => {
  it.each(['/subscribe', '/contact'])('%s canonicalises to the landing origin', (path) => {
    expect(canonicalUrlFor(path)).toBe(`${LANDING_ORIGIN}${path}`);
  });

  it('leaves app-only pages canonical to this origin', () => {
    expect(canonicalUrlFor('/sonic-discovery')).toBe(`${SITE_ORIGIN}/sonic-discovery`);
  });

  it('keeps them out of the sitemap', () => {
    // Advertising a URL whose canonical points elsewhere asks a crawler to index a page we have
    // just told it not to prefer.
    const paths = sitemapRoutes().map((r) => r.path);
    expect(paths).not.toContain('/subscribe');
    expect(paths).not.toContain('/contact');
  });
});

describe('sitemap contents', () => {
  it('lists only genuinely indexable app pages', () => {
    expect(sitemapRoutes().map((r) => r.path).sort()).toEqual(['/', '/analysis', '/sonic-discovery']);
  });

  it('is generated, not committed', () => {
    let exists = true;
    try {
      readFileSync(resolve(process.cwd(), 'public/sitemap.xml'));
    } catch {
      exists = false;
    }
    expect(exists, 'public/sitemap.xml is back; it must be built from seoConfig').toBe(false);
  });
});

describe('static head no longer contradicts the per-route tags', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(
    /<!--[\s\S]*?-->/g,
    '',
  );

  it('does not blanket-block the whole app', () => {
    expect(html).not.toContain('noindex');
    expect(html).not.toContain('nofollow');
  });

  it('declares index, follow as the default', () => {
    expect(html).toMatch(/<meta name="robots" content="index, follow">/);
  });

  it('ships absolute social image URLs', () => {
    const imgs = [...html.matchAll(/(?:og:image|twitter:image)" content="([^"]+)"/g)].map((m) => m[1]);
    expect(imgs.length).toBeGreaterThan(0);
    for (const src of imgs) expect(src).toMatch(/^https:\/\//);
  });
});

describe('metadata quality', () => {
  const entries = Object.entries(ROUTE_SEO);

  it('gives every page a distinct title', () => {
    const t = entries.map(([, s]) => s.title);
    expect(new Set(t).size).toBe(t.length);
  });

  it('keeps titles inside the ~60 char SERP truncation', () => {
    expect(entries.filter(([, s]) => s.title.length > 60).map(([p]) => p)).toEqual([]);
  });

  it('keeps descriptions inside the ~160 char snippet limit', () => {
    expect(entries.filter(([, s]) => s.description.length > 160).map(([p]) => p)).toEqual([]);
  });
});

describe('RouteMeta output', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets title, description and canonical for a public page', () => {
    render(
      <MemoryRouter initialEntries={['/sonic-discovery']}>
        <RouteMeta />
      </MemoryRouter>,
    );
    expect(document.title).toBe(ROUTE_SEO['/sonic-discovery'].title);
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      `${SITE_ORIGIN}/sonic-discovery`,
    );
  });

  it('drops a query string from the canonical, collapsing ?id= variants onto one page', () => {
    // Playlist results live at /sonic-discovery?id=… — user-generated and effectively infinite.
    expect(canonicalUrlFor('/sonic-discovery')).not.toContain('?');
  });

  it('falls back to the 404 entry for an unmapped path', () => {
    expect(seoFor('/nope').noindex).toBe(true);
  });
});
