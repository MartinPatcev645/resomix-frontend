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

/* Pages differ in props (InfoPage takes a `mode`), so the loader map is intentionally loose here —
   each <Route> below still type-checks its own element. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Loader = () => Promise<{ default: ComponentType<any> }>;

const page = (load: () => Promise<any>): Loader => load;

/** Route path → chunk loader. */
export const PAGE_LOADERS: Record<string, Loader> = {
  '/': page(() => import('@/pages/HomePage.tsx')),
  '/about': page(() => import('@/pages/AboutPage.tsx')),
  '/partners': page(() => import('@/pages/PartnersPage.tsx')),
  '/partners/pilot': page(() => import('@/pages/PartnersPilotPage.tsx')),
  '/pricing': page(() => import('@/pages/PricingPage.tsx')),
  '/product': page(() => import('@/pages/ProductPage.tsx')),
  '/product/sonic-discovery': page(() => import('@/pages/SonicDiscoveryPage.tsx')),
  '/product/track-intelligence': page(() => import('@/pages/TrackIntelligencePage.tsx')),
  '/product/catalog-intelligence': page(() => import('@/pages/CatalogueIntelligencePage.tsx')),
  '/developers': page(() => import('@/pages/DevelopersPage.tsx')),
  '/trust': page(() => import('@/pages/TrustPage.tsx')),
  '/solutions/record-labels': page(() => import('@/pages/RecordLabelsPage.tsx')),
  '/solutions/music-publishers': page(() => import('@/pages/MusicPublishersPage.tsx')),
  '/solutions/sync-agencies': page(() => import('@/pages/SyncAgenciesPage.tsx')),
  '/solutions/music-libraries-sample-providers': page(() => import('@/pages/MusicLibrariesPage.tsx')),
  '/solutions/djs': page(() => import('@/pages/DjsPage.tsx')),
  '/solutions/music-curators': page(() => import('@/pages/MusicCuratorsPage.tsx')),
  '/solutions/producers': page(() => import('@/pages/ProducersPage.tsx')),
  '/subscribe': page(() => import('@/pages/SubscribePage.tsx')),
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
