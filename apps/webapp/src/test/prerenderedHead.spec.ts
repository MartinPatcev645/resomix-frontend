import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANDING_ORIGIN, ROUTE_SEO, SITE_ORIGIN } from '@/routes/seoConfig.ts';

/**
 * Same root cause as the marketing site: this is an SPA, so every URL was served one `index.html`,
 * and `RouteMeta` only rewrites the head after React boots. Link-preview scrapers (WhatsApp, Slack,
 * iMessage, LinkedIn, Upwork) never run JavaScript, so every shared beta URL previewed as the app
 * home page.
 *
 * The build now emits `dist/<route>/index.html` per route. These assertions run against that build
 * output, because what a scraper receives is the only thing that matters here.
 *
 * Two rules are specific to this app and are the ones worth guarding:
 *   - the signed-in workspace and auth screens must carry `noindex` STATICALLY, since the blanket
 *     noindex that used to cover them is gone;
 *   - /subscribe and /contact must canonicalise to the marketing site even in the raw HTML, or the
 *     two origins compete for the same query.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');
const tag = (src: string, re: RegExp) => src.match(re)?.[1];

const TITLE = /<title>([^<]*)<\/title>/;
const ROBOTS = /<meta\s+name="robots"\s+content="([^"]*)"/;
const CANONICAL = /<link\s+rel="canonical"\s+href="([^"]*)"/;

describe.skipIf(!built)('prerendered per-route head', () => {
  const routes = Object.keys(ROUTE_SEO).filter((r) => r !== '/404');

  it('emits an HTML file for every route', () => {
    const missing = routes.filter(
      (r) => !existsSync(resolve(DIST, r === '/' ? 'index.html' : `${r.slice(1)}/index.html`)),
    );
    expect(missing).toEqual([]);
  });

  it.each(routes)('%s ships its own title', (route) => {
    const esc = (s: string) => s.replace(/&/g, '&amp;');
    expect(tag(html(route), TITLE)).toBe(esc(ROUTE_SEO[route].title));
  });

  it('no longer serves the app-home title on a sub-route', () => {
    const home = tag(html('/'), TITLE);
    for (const route of ['/sonic-discovery', '/analysis', '/subscribe']) {
      expect(tag(html(route), TITLE)).not.toBe(home);
    }
  });
});

describe.skipIf(!built)('privacy holds in the raw HTML', () => {
  const PRIVATE = ['/library', '/profile', '/sessions', '/change-password'];
  const AUTH = ['/auth/login', '/auth/register', '/auth/forgot-password'];

  it.each([...PRIVATE, ...AUTH, '/error', '/loader'])('%s is noindex before any JS runs', (route) => {
    expect(tag(html(route), ROBOTS)).toBe('noindex, follow');
  });

  it('leaves the public workspace indexable', () => {
    for (const route of ['/', '/sonic-discovery', '/analysis']) {
      expect(tag(html(route), ROBOTS)).toBe('index, follow');
    }
  });

  it('never emits nofollow', () => {
    // The old blanket tag was noindex,nofollow; the nofollow stranded link equity for no benefit.
    for (const route of ['/', '/library', '/auth/login']) {
      expect(html(route).replace(/<!--[\s\S]*?-->/g, '')).not.toContain('nofollow');
    }
  });
});

describe.skipIf(!built)('pages shared with the marketing site defer to it', () => {
  it('/contact canonicalises cross-origin in the served HTML', () => {
    expect(tag(html('/contact'), CANONICAL)).toBe(`${LANDING_ORIGIN}/contact`);
  });

  it('/subscribe canonicalises to the marketing pricing page in the served HTML', () => {
    // Different content now: this page transacts, /pricing explains. The crawler is pointed at
    // the one that is meant to rank.
    expect(tag(html('/subscribe'), CANONICAL)).toBe(`${LANDING_ORIGIN}/pricing`);
  });

  it('keeps app-only pages canonical to this origin', () => {
    expect(tag(html('/sonic-discovery'), CANONICAL)).toBe(`${SITE_ORIGIN}/sonic-discovery`);
  });

  it('still lets them be crawled — canonical consolidates, noindex would contradict it', () => {
    // noindex + canonical is a conflicting pair: it tells a crawler to both drop the page and to
    // credit another URL. Canonical alone is the correct signal for a duplicate.
    expect(tag(html('/subscribe'), ROBOTS)).toBe('index, follow');
  });
});

describe.skipIf(!built)('the shell is otherwise untouched', () => {
  it('keeps asset URLs absolute, or nested pages would 404 their own JS', () => {
    const src = html('/sonic-discovery');
    expect(src).toMatch(/src="\/assets\//);
    expect(src).not.toMatch(/(src|href)="\.\.?\/[^"]*assets/);
  });

  it('changes nothing below <head>', () => {
    const body = (s: string) => s.slice(s.indexOf('<body'));
    expect(body(html('/sonic-discovery'))).toBe(body(html('/')));
  });
});
