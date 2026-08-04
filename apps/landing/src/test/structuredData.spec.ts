import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_SEO, SITE_ORIGIN } from '@/routes/seoConfig.ts';

/**
 * Per-page structured data.
 *
 * `Organization` and `WebSite` already shipped, but they describe the SITE — so every one of the
 * twenty URLs was declaring the same two facts and nothing about itself. `WebPage` says what this
 * page is; `BreadcrumbList` says where it sits.
 *
 * Asserted against the BUILT html, because it is baked in at build time on purpose: no major AI
 * crawler executes JavaScript, so runtime-injected JSON-LD is invisible to exactly the consumers
 * that read structured data most.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');

interface Node { '@type': string; [k: string]: unknown }

/** Every @graph node across every JSON-LD block in the document. */
const nodes = (route: string): Node[] =>
  [...html(route).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((m) => (JSON.parse(m[1]) as { '@graph'?: Node[] })['@graph'] ?? []);

const typed = (route: string, type: string) => nodes(route).filter((n) => n['@type'] === type);

describe.skipIf(!built)('per-page structured data', () => {
  const indexed = Object.keys(ROUTE_SEO).filter((r) => r !== '/404' && !ROUTE_SEO[r].noindex);

  it('emits a WebPage node on every indexed route', () => {
    const missing = indexed.filter((r) => typed(r, 'WebPage').length !== 1);
    expect(missing).toEqual([]);
  });

  it('keeps the site-level Organization and WebSite alongside it', () => {
    expect(typed('/', 'Organization')).toHaveLength(1);
    expect(typed('/', 'WebSite')).toHaveLength(1);
  });

  it('describes each page with its OWN title and description', () => {
    for (const route of indexed) {
      const page = typed(route, 'WebPage')[0];
      expect(page.name, `${route} name`).toBe(ROUTE_SEO[route].title);
      expect(page.description, `${route} description`).toBe(ROUTE_SEO[route].description);
    }
  });

  it('ties every page back to the site node', () => {
    for (const route of indexed) {
      expect(typed(route, 'WebPage')[0].isPartOf).toEqual({ '@id': `${SITE_ORIGIN}/#website` });
    }
  });

  it('builds a breadcrumb trail on nested routes', () => {
    const crumbs = (route: string) =>
      (typed(route, 'BreadcrumbList')[0].itemListElement as Array<{ name: string }>).map(
        (i) => i.name,
      );
    expect(crumbs('/solutions/djs')).toEqual(['Home', 'Solutions', 'DJs']);
    expect(crumbs('/product/catalog-intelligence')).toEqual([
      'Home',
      'Product',
      'Catalogue Intelligence',
    ]);
    expect(crumbs('/about')).toEqual(['Home', 'About']);
  });

  it('omits the breadcrumb on the homepage, where a one-item trail says nothing', () => {
    expect(typed('/', 'BreadcrumbList')).toHaveLength(0);
  });

  it('numbers breadcrumb positions from 1, without gaps', () => {
    const items = typed('/solutions/djs', 'BreadcrumbList')[0].itemListElement as Array<{
      position: number;
    }>;
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it('adds nothing to noindexed routes', () => {
    // /error is a real route but must stay out of the index; describing it to a crawler is noise.
    expect(typed('/error', 'WebPage')).toHaveLength(0);
  });

  it('stays valid JSON in every built file', () => {
    for (const route of indexed) {
      expect(() => nodes(route), `${route} has malformed JSON-LD`).not.toThrow();
    }
  });
});
