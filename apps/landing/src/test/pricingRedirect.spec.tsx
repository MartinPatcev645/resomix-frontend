import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The public pricing page lives at `/pricing`; the purchase flow lives at
 * `beta.resomix.com/subscribe`.
 *
 * These were once the same component served at two URLs on this origin, consolidated onto
 * `/subscribe`. That is now inverted: the marketing site explains and compares (`/pricing`) and the
 * app transacts (`/subscribe`, other origin). Nobody is signed in here, so a purchase started on
 * this origin would have to bounce the visitor to another domain mid-checkout.
 *
 * `/subscribe` stays in the route table as a redirect rather than being deleted: it was a live
 * public URL, so removing it would 404 existing links, bookmarks and search results. These
 * assertions are what stops someone "finishing the cleanup" by dropping that line.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const app = read('src/App.tsx');

describe('pricing / subscribe split', () => {
  it('has no SubscribePage component left on the marketing site', () => {
    expect(existsSync(resolve(process.cwd(), 'src/pages/SubscribePage.tsx'))).toBe(false);
  });

  it('leaves no dangling references to it', () => {
    for (const f of ['src/App.tsx', 'src/routes/pageLoaders.ts', 'src/routes/pageModules.ts']) {
      expect(read(f), `${f} still references SubscribePage`).not.toContain('SubscribePage');
    }
  });

  it('keeps /subscribe reachable as a redirect, not a 404', () => {
    // The catch-all "*" route would otherwise render the 404 page for this path.
    expect(app).toMatch(
      /<Route\s+path="\/subscribe"\s+element=\{<Navigate\s+to="\/pricing"\s+replace\s*\/>\}\s*\/>/,
    );
  });

  it('redirects with replace, so Back does not bounce off the old URL', () => {
    // Non-greedy to the first `/>`, which is the nested <Navigate>'s — the route's own href
    // contains slashes, so a [^/]* scan stops short of the attribute being asserted.
    const route = app.match(/<Route\s+path="\/subscribe"[\s\S]*?\/>/)?.[0] ?? '';
    expect(route).toContain('replace');
  });

  it('serves the real page at /pricing', () => {
    expect(app).toMatch(/<Route\s+path="\/pricing"\s+element=\{<PricingPage\s*\/>\}\s*\/>/);
    expect(read('src/routes/pageLoaders.ts')).toContain("'/pricing'");
  });

  it('drops /subscribe from the lazy loader map', () => {
    // A loader for a path with no route would only ever be dead weight in the bundle.
    expect(read('src/routes/pageLoaders.ts')).not.toContain("'/subscribe'");
  });

  it('gives /pricing a real layout mode', () => {
    // A path missing from this list falls through to the '404' mode — which decides whether the
    // shared backdrop renders and what SideLines is told the page is.
    const layout = read('src/components/Layout/LandingLayout.tsx');
    expect(layout).toContain("'/pricing'");
    expect(layout).not.toContain("'/subscribe'");
  });

  it('sends the marketing CTAs to the app, not to a checkout on this origin', () => {
    // The whole point of the split: /pricing must hand off rather than transact.
    const page = read('src/pages/PricingPage.tsx');
    expect(page).toContain('variant="marketing"');
    expect(page).toContain('/subscribe');
    expect(page).toContain('BETA_URL');
  });

  it('301s the old URL at the edge, not just in the SPA', () => {
    // A crawler that never boots React still has to be told where the page went.
    const redirects = read('public/_redirects');
    expect(redirects).toMatch(/^\/subscribe\s+\/pricing\s+301/m);
  });
});
