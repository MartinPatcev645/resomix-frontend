import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `/pricing` and `/subscribe` had converged on rendering the identical component
 * (`<PricingContent baseUrl="/" />`), so the site shipped the same page at two URLs. Consolidated
 * onto `/subscribe`.
 *
 * `/pricing` stays in the route table as a redirect rather than being deleted outright: it was a
 * live public URL, so removing it would 404 existing links, bookmarks and search results. These
 * assertions are what stops someone "finishing the cleanup" by dropping that line.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const app = read('src/App.tsx');

describe('pricing consolidation', () => {
  it('has no PricingPage component left', () => {
    expect(existsSync(resolve(process.cwd(), 'src/pages/PricingPage.tsx'))).toBe(false);
  });

  it('leaves no dangling references to it', () => {
    for (const f of ['src/App.tsx', 'src/pages/index.ts', 'src/routes/pageLoaders.ts']) {
      expect(read(f), `${f} still references PricingPage`).not.toContain('PricingPage');
    }
  });

  it('keeps /pricing reachable as a redirect, not a 404', () => {
    // The catch-all "*" route would otherwise render the 404 page for this path.
    expect(app).toMatch(
      /<Route\s+path="\/pricing"\s+element=\{<Navigate\s+to="\/subscribe"\s+replace\s*\/>\}\s*\/>/,
    );
  });

  it('redirects with replace, so Back does not bounce off the old URL', () => {
    // Non-greedy to the first `/>`, which is the nested <Navigate>'s — the route's own href
    // contains slashes, so a [^/]* scan stops short of the attribute being asserted.
    const route = app.match(/<Route\s+path="\/pricing"[\s\S]*?\/>/)?.[0] ?? '';
    expect(route).toContain('replace');
  });

  it('still serves the real page at /subscribe', () => {
    expect(app).toMatch(/<Route\s+path="\/subscribe"\s+element=\{<SubscribePage\s*\/>\}\s*\/>/);
    expect(read('src/routes/pageLoaders.ts')).toContain("'/subscribe'");
  });

  it('drops /pricing from the lazy loader map', () => {
    // A loader for a path with no route would only ever be dead weight in the bundle.
    expect(read('src/routes/pageLoaders.ts')).not.toContain("'/pricing'");
  });

  it('gives /subscribe a real layout mode', () => {
    // /subscribe was never in this list, so it fell through to the '404' mode — which decides
    // whether the shared backdrop renders and what SideLines is told the page is.
    const layout = read('src/components/Layout/LandingLayout.tsx');
    expect(layout).toContain("'/subscribe'");
    expect(layout).not.toContain("'/pricing'");
  });
});
