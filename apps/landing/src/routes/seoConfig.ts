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

/**
 * The thing a page is ABOUT, for structured data: a `Service` on the partner and solutions pages, a
 * `WebAPI` on the developer overview (docs/STRUCTURED_DATA_PLAN.md §4). Emitted at build time by
 * tooling/prerenderHead.ts, which also points the page's `WebPage.mainEntity` at it. Neither type
 * earns a Google rich result; the value is entity clarity for AI answer engines, which read the
 * static JSON-LD and nothing rendered by JavaScript.
 */
export interface RouteEntity {
  type: 'Service' | 'WebAPI';
  name: string;
  /** Service only: what kind of service, in plain words. */
  serviceType?: string;
  /** WebAPI only: where the reference lives. */
  documentation?: string;
}

export interface RouteSeo {
  title: string;
  description: string;
  /** Sitemap hints. Omit `changefreq`/`priority` to use the defaults below. */
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Real route, but must stay out of the index and the sitemap (thin, transient or duplicate). */
  noindex?: boolean;
  entity?: RouteEntity;
}

/** The one provider every entity below resolves to; keeps the ten entries from restating it. */
const RESOMIX_SERVICE = (name: string, serviceType: string): RouteEntity => ({
  type: 'Service',
  name,
  serviceType,
});

/*
 * Adding a route here also adds its Markdown twin, at `<route>.md`, built by
 * tooling/markdownForAgents.ts and served to anything sending `Accept: text/markdown`.
 *
 * Nothing outside this repository needs updating for that, as long as the Cloudflare rewrite rule
 * named "Every other page" is on the wildcard expression rather than the explicit path list it
 * started on. Both versions, and how to tell which is deployed, are in
 * docs/AGENT_READINESS_FINDINGS.md.
 */
export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Resomix: Find & Analyse Electronic Music by Sound',
    description:
      'Resomix finds electronic music by how it sounds. Drop one track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue.',
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
      'Resomix Sonic Discovery is a music similarity search tool. Start with one track or upload a reference and PYXIS-1 returns a ranked playlist of similar tracks.',
    priority: 0.9,
  },
  '/product/track-intelligence': {
    title: 'Track Analysis: Structure, Key, BPM & Energy | Resomix',
    description:
      'Resomix Track Intelligence is track analysis software. It reads BPM, key and Camelot, structure, energy, loudness, timbre, genre and mood from one recording.',
    priority: 0.9,
  },
  '/product/catalog-intelligence': {
    title: 'Make Your Music Catalog Searchable by Sound | Resomix',
    description:
      'Search your music catalogue by sound. Resomix processes authorised recordings into a private, partner-scoped index, and one reference returns ranked matches.',
    priority: 0.9,
  },

  /* ---------- developers & partners ---------- */
  '/developers': {
    title: 'Music Similarity & Audio Analysis API | Resomix Developers',
    description:
      'The Resomix API is a music similarity and audio analysis API with search, similarity by track or upload, and versioned track analysis of your own catalogue.',
    priority: 0.8,
    entity: { type: 'WebAPI', name: 'Resomix API', documentation: 'https://api-docs.resomix.com/' },
  },
  '/partners': {
    title: 'Partner With Resomix: Catalogue Discovery by Sound',
    description:
      'Partner with Resomix. Labels, distributors, publishers and platforms make authorised catalogues searchable by sound through a private pilot or the live API.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Partners', 'Music catalogue search by sound'),
  },
  '/partners/pilot': {
    title: 'Request a Guided Catalogue Pilot: Resomix for Partners',
    description:
      'Test Resomix on your own catalogue. A managed private pilot for labels, distributors and catalogue teams. Agree scope and scorecard, then review ranked results.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix Private Catalogue Pilot', 'Managed music catalogue evaluation'),
  },
  '/trust': {
    title: 'Trust and Control at Resomix: How We Handle Audio',
    description:
      'How Resomix handles audio. Uploads are deleted within 24 hours, partner catalogues stay in private indexes, and your audio is never used for training.',
    changefreq: 'monthly',
    priority: 0.7,
  },

  /* ---------- solutions ---------- */
  '/solutions/record-labels': {
    title: 'Catalogue Search by Sound for Record Labels | Resomix',
    description:
      'Resomix lets record labels search their catalogue by sound. Authorised recordings become a private index where older, relevant tracks surface beside new ones.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Record Labels', 'Catalogue search by sound'),
  },
  '/solutions/music-publishers': {
    title: 'Sonic Catalogue Search for Music Publishers | Resomix',
    description:
      'Turn your catalogue into a living asset. Resomix analyses authorised recordings so publishers can rediscover works and explore representation by sound.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Music Publishers', 'Catalogue search by sound'),
  },
  '/solutions/sync-agencies': {
    title: 'Reference-Based Music Search for Sync Agencies | Resomix',
    description:
      'Use an audio reference to surface sonically relevant candidates for human review. Resomix supports the search, never automated clearance or rights calls.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Sync Agencies', 'Reference-based music search'),
  },
  '/solutions/music-libraries-sample-providers': {
    title: 'Sound-First Search for Music & Sample Libraries | Resomix',
    description:
      'Resomix gives music libraries and sample providers search by sound. Start from one sound and PYXIS-1 surfaces related loops, samples and tracks in the library.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Music Libraries and Sample Providers', 'Music library search by sound'),
  },
  '/solutions/djs': {
    title: 'Find Your Next Track by Sound: Resomix for DJs & Sets',
    description:
      'Resomix is a music discovery tool for DJs. Start from one record and audition a ranked shortlist that mixes well, matched on groove, energy and character.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for DJs', 'Music discovery by sound'),
  },
  '/solutions/music-curators': {
    title: 'Playlist Curation by Sound: Resomix for Music Curators',
    description:
      'Resomix is a playlist curation tool for music curators. Start from an audio reference and review ranked, sonically related candidates beyond charts and tags.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Music Curators', 'Playlist curation by sound'),
  },
  '/solutions/producers': {
    title: 'Reference & Track Analysis by Sound: Resomix for Producers',
    description:
      'Resomix helps producers decode a reference track. Inspect arrangement, energy and timbre, then explore sonically related music. The creative decision is yours.',
    priority: 0.8,
    entity: RESOMIX_SERVICE('Resomix for Producers', 'Reference track analysis and discovery'),
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
      'Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. Write to support@resomix.com and we will get back to you.',
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
