import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Cloudflare Pages served `index.html` with a **200** for every unmatched path — a soft 404.
 * Lighthouse caught it through the `llms.txt` audit: it fetched `/llms.txt`, got the SPA shell back
 * with a 200, and tried to parse HTML as Markdown. Every non-existent path behaved the same way,
 * which also let junk URLs into the index.
 *
 * Emitting `dist/404.html` switches Pages to a genuine 404 — but that cuts both ways: from then on
 * **any path without a file is a 404**, including real routes. So the contract this file guards is:
 *
 *   every live route has a shell  ∧  404.html exists  ∧  /auth/* has a rewrite
 *
 * Break any one of those and real pages start 404ing in production, which no unit test elsewhere
 * would catch. Skipped when dist/ is absent so the suite does not depend on build order.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));

/** Live routes, read from the router itself so this cannot drift. */
const declaredRoutes = (() => {
  const src = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((r) => r !== '*');
})();

const shellFor = (route: string) =>
  route === '/' ? resolve(DIST, 'index.html') : resolve(DIST, route.replace(/^\//, ''), 'index.html');

describe.skipIf(!built)('edge routing', () => {
  it('emits a real 404 page', () => {
    expect(existsSync(resolve(DIST, '404.html'))).toBe(true);
  });

  it('the 404 page is noindex', () => {
    const html = readFileSync(resolve(DIST, '404.html'), 'utf8');
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex, follow"/);
    expect(html).toMatch(/<title>Page not found/);
  });

  it('every live route has its own file, or it would now 404', () => {
    // This is the failure mode introduced by adding 404.html. It must be checked against the
    // router, not a hand-kept list.
    const missing = declaredRoutes.filter((r) => !r.endsWith('/*') && !existsSync(shellFor(r)));
    expect(missing, 'these routes would return 404 in production').toEqual([]);
  });

  it('covers wildcard routes with a rewrite instead', () => {
    const wildcards = declaredRoutes.filter((r) => r.endsWith('/*'));
    const redirects = readFileSync(resolve(DIST, '_redirects'), 'utf8');
    for (const w of wildcards) {
      // e.g. "/auth/*  /index.html  200" — a 200 rewrite, not a redirect.
      const prefix = w.slice(0, -1);
      expect(redirects).toMatch(new RegExp(`^\\s*${prefix.replace('/', '\\/')}\\*\\s+\\/index\\.html\\s+200`, 'm'));
    }
  });

  it('the rewrite is scoped, so it cannot shadow a prerendered page', () => {
    const rules = readFileSync(resolve(DIST, '_redirects'), 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'));
    // A bare "/*  /index.html  200" would reinstate the soft 404 for everything.
    expect(rules.filter((r) => /^\s*\/\*\s/.test(r))).toEqual([]);
  });

  it('redirect and hand-off shells are noindex but honestly titled', () => {
    for (const route of ['/pricing', '/profile']) {
      const html = readFileSync(shellFor(route), 'utf8');
      expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex, follow"/);
      // They exist and redirect — claiming "Page not found" would be untrue.
      expect(html).not.toMatch(/<title>Page not found/);
    }
  });

  it('every shell still boots the app', () => {
    // A shell without the entry script would render a blank page instead of redirecting.
    for (const route of ['/pricing', '/profile', '/trust']) {
      expect(readFileSync(shellFor(route), 'utf8')).toMatch(/<script[^>]+src="\/assets\//);
    }
  });
});

describe.skipIf(!built)('llms.txt', () => {
  const path = resolve(DIST, 'llms.txt');

  it('exists as a real file, not the SPA shell', () => {
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).not.toContain('<!DOCTYPE html>');
  });

  it('has the H1 the audit requires', () => {
    // "File is missing a required H1 header (e.g. '# Title')" — the reported failure.
    expect(readFileSync(path, 'utf8')).toMatch(/^# \S/m);
  });

  it('contains links, which the audit also requires', () => {
    const links = [...readFileSync(path, 'utf8').matchAll(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)];
    expect(links.length).toBeGreaterThan(5);
  });

  it('only links to routes that exist', () => {
    const urls = [...readFileSync(path, 'utf8').matchAll(/\((https:\/\/resomix\.com[^)]*)\)/g)]
      .map((m) => new URL(m[1]).pathname);
    const missing = urls.filter((u) => !existsSync(shellFor(u)));
    expect(missing).toEqual([]);
  });
});
