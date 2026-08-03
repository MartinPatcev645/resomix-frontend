/**
 * Per-route SEO metadata — the single source for the document head AND the sitemap.
 *
 * These were previously two independent things that had drifted badly: titles were set by an
 * ad-hoc `document.title` effect in 16 separate pages (with none at all on the other four), and
 * `public/sitemap.xml` was hand-maintained — it still advertised `/terms` and `/privacy`, which
 * are not routes, while listing only one of the seventeen marketing pages.
 *
 * Keeping both derived from this file means a new page cannot ship with a stale sitemap or an
 * inherited homepage title. `routeSeo.spec.ts` fails if a route in App.tsx has no entry here.
 *
 * Descriptions are per page on purpose: a shared description makes every result in a SERP look
 * identical and gives search engines nothing to distinguish the pages by.
 */

/** Production origin. Canonicals are always absolute and always point at production. */
export const SITE_ORIGIN = 'https://resomix.com';

export interface RouteSeo {
  title: string;
  description: string;
  /** Sitemap hints. Omit `changefreq`/`priority` to use the defaults below. */
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Real route, but must stay out of the index and the sitemap (thin, transient or duplicate). */
  noindex?: boolean;
}

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Resomix — Hear the Invisible | Sonic Intelligence Platform',
    description:
      'Resomix finds music by how it sounds, not how it is tagged. Drop one track and discover what belongs next to it.',
    changefreq: 'weekly',
    priority: 1.0,
  },
  '/about': {
    title: 'About — The Listening Observatory | Resomix',
    description:
      'Resomix helps people discover sonically related tracks, understand one recording in greater detail and make authorised catalogues searchable through sound.',
    changefreq: 'monthly',
    priority: 0.6,
  },

  /* ---------- product ---------- */
  '/product': {
    title: 'Product — Sonic Routing Desk | Resomix',
    description:
      'Resomix uses PYXIS-1 to help you find sonically related tracks, understand one recording in greater detail, or make an authorised catalogue searchable by sound.',
    priority: 0.9,
  },
  '/product/sonic-discovery': {
    title: 'Sonic Discovery — Find Tracks by Sound, Not Tags | Resomix',
    description:
      'Drop one track and get ranked matches that genuinely belong next to it — reference-based discovery instead of genre keywords.',
    priority: 0.9,
  },
  '/product/track-intelligence': {
    title: 'Track Intelligence — See What a Track Is Made Of | Resomix',
    description:
      'Tempo, key, energy and sonic character extracted straight from the audio, so you can judge a recording without listening to all of it.',
    priority: 0.9,
  },
  '/product/catalog-intelligence': {
    title: 'Catalogue Intelligence — Discoverable by Sound | Resomix',
    description:
      'Resomix processes authorised catalogue recordings with PYXIS-1, creates a sonic profile for each track and makes the catalogue searchable by reference.',
    priority: 0.9,
  },

  /* ---------- developers & partners ---------- */
  '/developers': {
    title: 'Resomix API — Audio Similarity & Sonic Analysis',
    description:
      'One API for search, similarity and track analysis. Integrate Resomix sonic discovery into your own platform.',
    priority: 0.8,
  },
  '/partners': {
    title: 'Partners — Three Ways to Work with Resomix',
    description:
      'A private catalogue pilot, the partner API, or a custom integration. Pick the route that fits your catalogue.',
    priority: 0.8,
  },
  '/partners/pilot': {
    title: 'Catalogue Pilot — Test Resomix on Your Catalogue | Resomix',
    description:
      'A guided evaluation on your own authorised audio, indexed in a partner-scoped namespace, with results you can measure.',
    priority: 0.8,
  },
  '/trust': {
    title: 'Trust, Rights & Security — Audio and Data at Resomix',
    description:
      'What happens to your audio and your data: rights, retention, security boundaries, and what we never do with your catalogue.',
    changefreq: 'monthly',
    priority: 0.7,
  },

  /* ---------- solutions ---------- */
  '/solutions/record-labels': {
    title: 'Record Labels — Maximise Your Catalogue with Resomix',
    description:
      'Surface back catalogue by sound and put every recording back in play, instead of leaving it buried behind sparse metadata.',
    priority: 0.8,
  },
  '/solutions/music-publishers': {
    title: 'Music Publishers — Catalogue as a Living Asset | Resomix',
    description:
      'Make every recording findable by how it sounds, so a publishing catalogue keeps earning instead of sitting idle.',
    priority: 0.8,
  },
  '/solutions/sync-agencies': {
    title: 'Sync Agencies — Translating Tags into Emotions | Resomix',
    description:
      'Brief-to-track search that matches on feel, so a sync search stops dead-ending on keywords nobody agreed on.',
    priority: 0.8,
  },
  '/solutions/music-libraries-sample-providers': {
    title: 'Music Libraries & Sample Providers | Resomix',
    description:
      'Turn a library into a discovery engine so customers find the right sound instead of scrolling through tag pages.',
    priority: 0.8,
  },
  '/solutions/djs': {
    title: 'DJs — Dig Less. Discover More. | Resomix',
    description:
      'Find tracks that sit next to your reference by sound rather than by genre folders, and spend the time mixing instead of digging.',
    priority: 0.8,
  },
  '/solutions/music-curators': {
    title: 'Music Curators — Hear Music Differently | Resomix',
    description:
      'Build playlists that flow by sonic character instead of metadata, so a sequence holds together on listening.',
    priority: 0.8,
  },
  '/solutions/producers': {
    title: 'Producers — One Reference, New Sonic Directions | Resomix',
    description:
      'Find sounds adjacent to what you are already making, starting from a single reference track.',
    priority: 0.8,
  },

  /* ---------- conversion & support ---------- */
  '/subscribe': {
    title: 'Pricing — Plans for Creators and Partners | Resomix',
    description:
      'Monthly plans for individual creators, and partner tiers that scale by catalogue size and API volume.',
    changefreq: 'monthly',
    priority: 0.7,
  },
  '/contact': {
    title: 'Contact Resomix — Support, Business and Partnerships',
    description:
      'Reach the Resomix team for product support, business enquiries, or partnership and API access.',
    changefreq: 'yearly',
    priority: 0.5,
  },
  '/waitlist': {
    title: 'Join the Waitlist | Resomix',
    description:
      'Request early access to Resomix — reference-based sonic discovery, track analysis and catalogue search.',
    changefreq: 'monthly',
    priority: 0.5,
  },

  /* ---------- real routes that must NOT be indexed ---------- */
  // Transient state, no standalone content, and duplicates of pages already in the index.
  '/error': {
    title: 'Something went wrong | Resomix',
    description: 'An unexpected error occurred.',
    noindex: true,
  },
  '/404': {
    title: 'Page not found | Resomix',
    description: 'That page does not exist.',
    noindex: true,
  },
};

/** Sitemap defaults for entries that do not override them. */
export const SITEMAP_DEFAULTS = { changefreq: 'monthly' as const, priority: 0.8 };

/** Head defaults — used for any path with no entry, and as the static fallback in index.html. */
export const DEFAULT_SEO: RouteSeo = ROUTE_SEO['/'];

/**
 * Social preview image. Absolute, because crawlers do not resolve relative OG URLs.
 *
 * NOTE: this is the 399x399 logo, which every platform will crop to a small square card. A proper
 * 1200x630 landscape asset dropped in at `public/og-cover.png` (and pointed to here) is the single
 * biggest remaining win for how shared links look.
 */
export const OG_IMAGE = `${SITE_ORIGIN}/logo.png`;

/** The routes that belong in the sitemap: everything real, minus the noindexed ones. */
export function sitemapRoutes(): Array<{ path: string } & RouteSeo> {
  return Object.entries(ROUTE_SEO)
    .filter(([, seo]) => !seo.noindex)
    .map(([path, seo]) => ({ path, ...seo }));
}
