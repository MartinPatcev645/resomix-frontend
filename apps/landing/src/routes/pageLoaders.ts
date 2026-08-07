/**
 * One place that knows how to fetch each page chunk.
 *
 * Every page is code-split, so navigating to a route means downloading a hash-named JS file. That
 * download is the weak point in production: it can be slow, it can fail, and after a deploy the
 * file the running tab is asking for no longer exists. Centralising the loaders lets us
 *
 *   - retry and recover from a failed chunk fetch (see `lazyRoute`), and
 *   - warm a chunk before the click, from a nav link's hover/focus (see `prefetchRoute`).
 *
 * Keep the keys in sync with the <Route path> table in App.tsx: a key that no route matches is
 * harmless, but a route missing from here simply loses prefetching.
 */

import type { ComponentType } from 'react';
import i18n from '@/i18n.ts';

/* Pages differ in props (InfoPage takes a `mode`), so the loader map is intentionally loose here —
   each <Route> below still type-checks its own element. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Loader = () => Promise<{ default: ComponentType<any> }>;

/**
 * Pair a page chunk with its locale slice.
 *
 * The locale was one 204 KiB file loaded on every visit; it is now split per page. Both promises
 * are awaited together and the strings are registered BEFORE the module resolves, so React can
 * never mount a component whose keys are missing — that would render raw `about.hero.title` text
 * for a frame. Pages that need only the shared chrome strings pass no slice.
 */
const page = (
  load: () => Promise<any>,
  loadLocale?: () => Promise<{ default: Record<string, unknown> }>,
): Loader =>
  loadLocale
    ? async () => {
        const [mod, slice] = await Promise.all([load(), loadLocale()]);
        // deep merge, overwrite: safe to call twice if a route is revisited
        i18n.addResourceBundle('en', 'common', slice.default, true, true);
        return mod;
      }
    : load;

/** Route path → chunk loader. */
export const PAGE_LOADERS: Record<string, Loader> = {
  '/': page(() => import('@/pages/HomePage.tsx'), () => import('@/locales/en/pages/home.json')),
  '/about': page(() => import('@/pages/AboutPage.tsx'), () => import('@/locales/en/pages/about.json')),
  '/partners': page(() => import('@/pages/PartnersPage.tsx'), () => import('@/locales/en/pages/partners.json')),
  '/partners/pilot': page(() => import('@/pages/PartnersPilotPage.tsx'), () => import('@/locales/en/pages/partnersPilot.json')),
  '/product': page(() => import('@/pages/ProductPage.tsx'), () => import('@/locales/en/pages/product.json')),
  '/product/sonic-discovery': page(() => import('@/pages/SonicDiscoveryPage.tsx'), () => import('@/locales/en/pages/sonicDiscovery.json')),
  '/product/track-intelligence': page(() => import('@/pages/TrackIntelligencePage.tsx'), () => import('@/locales/en/pages/trackIntelligence.json')),
  '/product/catalog-intelligence': page(() => import('@/pages/CatalogueIntelligencePage.tsx'), () => import('@/locales/en/pages/catalogueIntelligence.json')),
  '/developers': page(() => import('@/pages/DevelopersPage.tsx'), () => import('@/locales/en/pages/developers.json')),
  '/trust': page(() => import('@/pages/TrustPage.tsx'), () => import('@/locales/en/pages/trust.json')),
  '/solutions/record-labels': page(() => import('@/pages/RecordLabelsPage.tsx'), () => import('@/locales/en/pages/recordLabels.json')),
  '/solutions/music-publishers': page(() => import('@/pages/MusicPublishersPage.tsx'), () => import('@/locales/en/pages/musicPublishers.json')),
  '/solutions/sync-agencies': page(() => import('@/pages/SyncAgenciesPage.tsx'), () => import('@/locales/en/pages/syncAgencies.json')),
  '/solutions/music-libraries-sample-providers': page(() => import('@/pages/MusicLibrariesPage.tsx'), () => import('@/locales/en/pages/musicLibraries.json')),
  '/solutions/djs': page(() => import('@/pages/DjsPage.tsx'), () => import('@/locales/en/pages/djs.json')),
  '/solutions/music-curators': page(() => import('@/pages/MusicCuratorsPage.tsx'), () => import('@/locales/en/pages/musicCurators.json')),
  '/solutions/producers': page(() => import('@/pages/ProducersPage.tsx'), () => import('@/locales/en/pages/producers.json')),
  '/pricing': page(() => import('@/pages/PricingPage.tsx')),
  '/contact': page(() => import('@/pages/InfoPage.tsx')),
  '/waitlist': page(() => import('@/pages/InfoPage.tsx')),
  '/error': page(() => import('@/pages/InfoPage.tsx')),
};

/** Chunks we have already asked for, so hovering a link repeatedly costs nothing. */
const warmed = new Set<string>();

/**
 * Reduce an href to a key in PAGE_LOADERS.
 *
 * Nav targets are not always bare paths — they carry hashes (`/product#compare`), and some are
 * absolute URLs on the landing origin. Anything cross-origin returns null and is not prefetched.
 */
export function routeKeyOf(href: string): string | null {
  if (!href || href.startsWith('#')) return null;
  let path = href;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.origin !== window.location.origin) return null;
      path = url.pathname;
    } catch {
      return null;
    }
  }
  path = path.split('#')[0].split('?')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path in PAGE_LOADERS ? path : null;
}

/**
 * Start downloading a route's chunk without navigating.
 *
 * Called from hover and keyboard focus on nav links, which buys roughly the pointer-travel time —
 * usually enough that the chunk is already in memory when the click lands, so the transition is
 * instant instead of network-bound.
 *
 * Deliberately swallows failures: this is opportunistic. If the fetch fails here, the real
 * navigation goes through `lazyRoute`, which retries and can recover from a stale deploy.
 */
export function prefetchRoute(href: string): void {
  const key = routeKeyOf(href);
  if (!key || warmed.has(key)) return;
  warmed.add(key);
  try {
    void PAGE_LOADERS[key]().catch(() => {
      // Let the navigation path own the error; allow a later attempt to try again.
      warmed.delete(key);
    });
  } catch {
    warmed.delete(key);
  }
}
