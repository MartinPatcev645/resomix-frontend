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
    title: 'Resomix: Find & Analyse Electronic Music by Sound',
    description:
      'Drop one track and hear what belongs next. The PYXIS-1 engine powers sonic similarity search, track analysis and catalogue intelligence for electronic music.',
    changefreq: 'weekly',
    priority: 1.0,
  },
  '/about': {
    title: 'About Resomix: The Team Behind PYXIS-1 Audio Analysis',
    description:
      'Built in Thessaloniki by DJs and signal-processing engineers, Resomix powers Sonic Discovery, Track Intelligence and Catalogue Intelligence from the audio.',
    changefreq: 'monthly',
    priority: 0.6,
  },

  /* ---------- product ---------- */
  '/product': {
    title: 'Music Similarity & Audio Analysis Platform | Resomix',
    description:
      'Resomix uses PYXIS-1 to find sonically related tracks, analyse one recording in detail and make authorised catalogues searchable: one engine, three workflows.',
    priority: 0.9,
  },
  '/product/sonic-discovery': {
    title: 'Find Similar Tracks by Sound: Sonic Discovery | Resomix',
    description:
      'Start with one track or upload a reference. PYXIS-1 compares sonic profiles against a pre-analysed index and returns a ranked playlist of close matches.',
    priority: 0.9,
  },
  '/product/track-intelligence': {
    title: 'Track Analysis: Structure, Key, BPM & Energy | Resomix',
    description:
      'Track Intelligence turns PYXIS-1 audio analysis into a readable view of one recording: structure, tempo, key, energy, timbre, spectral character, confidence.',
    priority: 0.9,
  },
  '/product/catalog-intelligence': {
    title: 'Make Your Music Catalog Searchable by Sound | Resomix',
    description:
      'Resomix processes authorised catalogue recordings into a private, partner-scoped sonic index. One reference query returns ranked matches from your catalogue.',
    priority: 0.9,
  },

  /* ---------- developers & partners ---------- */
  '/developers': {
    title: 'Music Similarity & Audio Analysis API | Resomix Developers',
    description:
      'Integrate partner-scoped similarity and track-analysis services behind your own product. REST access through a guided pilot, with no public sandbox to misuse.',
    priority: 0.8,
  },
  '/partners': {
    title: 'Partner With Resomix: Catalogue Discovery by Sound',
    description:
      'Labels, distributors, publishers and platforms make authorised catalogues searchable by sound. Keep your brand, storefront, licensing and customer control.',
    priority: 0.8,
  },
  '/partners/pilot': {
    title: 'Request a Guided Catalogue Pilot: Resomix for Partners',
    description:
      'Test PYXIS-1 on your own catalogue. Define the scope, references and evaluation criteria, then review ranked results before deciding whether to integrate.',
    priority: 0.8,
  },
  '/trust': {
    title: 'Trust and Control at Resomix: How We Handle Audio',
    description:
      'User uploads are deleted within 24 hours. Partner catalogues stay inside private, partner-scoped indexes. No training on your content. No generated audio.',
    changefreq: 'monthly',
    priority: 0.7,
  },

  /* ---------- solutions ---------- */
  '/solutions/record-labels': {
    title: 'Catalogue Search by Sound for Record Labels | Resomix',
    description:
      'Make authorised label and distributor catalogues searchable by sound. Surface older, relevant recordings beside new releases through ranked sonic matches.',
    priority: 0.8,
  },
  '/solutions/music-publishers': {
    title: 'Sonic Catalogue Search for Music Publishers | Resomix',
    description:
      'Turn your catalogue into a living asset. Resomix analyses authorised recordings so publishers can rediscover works and explore representation by sound.',
    priority: 0.8,
  },
  '/solutions/sync-agencies': {
    title: 'Reference-Based Music Search for Sync Agencies | Resomix',
    description:
      'Use an audio reference to surface sonically relevant candidates for human review. Resomix supports the search, never automated clearance or rights calls.',
    priority: 0.8,
  },
  '/solutions/music-libraries-sample-providers': {
    title: 'Sound-First Search for Music & Sample Libraries | Resomix',
    description:
      'Help authorised libraries and sample catalogues be explored through structure, texture and sonic relationships, with ranked results from one audio reference.',
    priority: 0.8,
  },
  '/solutions/djs': {
    title: 'Find Your Next Track by Sound: Resomix for DJs & Sets',
    description:
      'Start from one known record and audition ranked, sonically related candidates. Build sets by energy, groove and character, beyond genre tags and charts.',
    priority: 0.8,
  },
  '/solutions/music-curators': {
    title: 'Playlist Curation by Sound: Resomix for Music Curators',
    description:
      'Move beyond charts and static tags. Start from an audio reference and review ranked, sonically related candidates for playlists and editorial programming.',
    priority: 0.8,
  },
  '/solutions/producers': {
    title: 'Reference & Track Analysis by Sound: Resomix for Producers',
    description:
      'Inspect arrangement, energy and timbre in your own recording, then explore sonically related references. Evidence for decisions that stay creatively yours.',
    priority: 0.8,
  },

  /* ---------- conversion & support ---------- */
  '/pricing': {
    title: 'Resomix Pricing: Free and Pro Plans Compared',
    description:
      'Compare the free and Pro Resomix plans for sonic discovery and track analysis. Start free in the production beta and upgrade when you are ready.',
    changefreq: 'monthly',
    priority: 0.7,
  },
  '/contact': {
    title: 'Contact Resomix: Support, Partnerships and Press Enquiries',
    description:
      'Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. We reply from support@resomix.com within the beta.',
    changefreq: 'yearly',
    priority: 0.5,
  },
  '/waitlist': {
    title: 'Join the Waitlist | Resomix',
    description:
      'Request early access to Resomix for reference-based sonic discovery, track analysis and catalogue search.',
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
 * 1200x630 landscape card, generated in the brand fonts — the correct aspect ratio for every
 * platform. Previously the 399x399 logo, which cropped to a small square thumbnail.
 */
export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

/** The routes that belong in the sitemap: everything real, minus the noindexed ones. */
export function sitemapRoutes(): Array<{ path: string } & RouteSeo> {
  return Object.entries(ROUTE_SEO)
    .filter(([, seo]) => !seo.noindex)
    .map(([path, seo]) => ({ path, ...seo }));
}
