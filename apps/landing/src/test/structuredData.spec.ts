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
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`), 'utf8');

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

  /*
   * The page's own entity. Assistants answer "whose page is this, and what is it about" from
   * exactly these nodes; the ShelfSignal report (Sept 2026) read our pages and could not lift the
   * claim out of the text. `Service` on partner and solutions routes, `WebAPI` on the developer
   * overview, and the WebPage points at it.
   */
  it('emits a Service on every partner and solutions route, tied to the Organization', () => {
    const expected = indexed.filter((r) => r.startsWith('/solutions/') || r.startsWith('/partners'));
    expect(expected.length).toBeGreaterThan(5);
    for (const route of expected) {
      const [service, ...extra] = typed(route, 'Service');
      expect(service, `${route} has no Service`).toBeDefined();
      expect(extra, `${route} has more than one Service`).toEqual([]);
      expect(service.provider).toEqual({ '@id': `${SITE_ORIGIN}/#organization` });
      expect(typed(route, 'WebPage')[0].mainEntity).toEqual({ '@id': service['@id'] });
    }
  });

  it('describes the developer overview as a WebAPI, not a Service', () => {
    const api = typed('/developers', 'WebAPI')[0];
    expect(api.provider).toEqual({ '@id': `${SITE_ORIGIN}/#organization` });
    expect(api.documentation).toMatch(/^https:\/\//);
    expect(typed('/developers', 'Service')).toHaveLength(0);
  });

  it('claims no entity on the product pages until one is approved', () => {
    // Those pages describe live software; a SoftwareApplication node there is a pending decision.
    for (const route of ['/product', '/product/sonic-discovery', '/product/track-intelligence']) {
      expect(typed(route, 'Service')).toHaveLength(0);
      expect(typed(route, 'SoftwareApplication')).toHaveLength(0);
    }
  });

  it('marks up the trust page Q&A as FAQPage, from the strings the page itself renders', () => {
    const faq = typed('/trust', 'FAQPage')[0];
    expect(faq).toBeDefined();
    const questions = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(questions.length).toBeGreaterThanOrEqual(5);
    const page = html('/trust');
    for (const q of questions) {
      // Google's rule: FAQPage may only describe Q&A a visitor can see on the page.
      expect(page, `question not visible on /trust: ${q.name}`).toContain(q.name);
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(20);
    }
  });

  it('gives the Organization real contact points and, when built with env, real profiles only', () => {
    const org = typed('/', 'Organization')[0];
    expect(org.contactPoint).toBeDefined();
    // sameAs is merged from VITE_*_URL at build time; a local build without them has none, which
    // is correct. What must never happen is an empty or malformed entry.
    const sameAs = org.sameAs as string[] | undefined;
    if (sameAs) {
      expect(sameAs.length).toBeGreaterThan(0);
      for (const u of sameAs) expect(u).toMatch(/^https:\/\/\S+$/);
    }
  });

  it('never asserts reviews or prices anywhere', () => {
    // We have no reviews, and prices live on /pricing only. Either fabricated is a manual action.
    for (const route of indexed) {
      for (const n of nodes(route)) {
        expect(n.aggregateRating, `${route} ${n['@type']} carries aggregateRating`).toBeUndefined();
        expect(n.review, `${route} ${n['@type']} carries review`).toBeUndefined();
        expect(n.offers, `${route} ${n['@type']} carries offers`).toBeUndefined();
      }
    }
  });
});
