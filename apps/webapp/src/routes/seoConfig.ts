/**
 * Per-route SEO metadata for the app at beta.resomix.com — the single source for the document head
 * AND the sitemap.
 *
 * THE APP IS A SERVICE, NOT A SET OF PAGES (George, 23 September 2026). The only address that
 * belongs in a search result is the way in, so `/auth/login` is the single indexable route and
 * everything else is `noindex`. The words a search engine or an assistant should find live on
 * resomix.com, which is written to answer questions; this app is where someone works after they
 * arrive, and `beta.resomix.com/sonic-discovery` was competing with
 * `resomix.com/product/sonic-discovery` for exactly the query the marketing page was written to win.
 *
 * Three rules follow from that:
 *
 *  1. NOINDEX, NOT DISALLOW. Every route here stays crawlable and carries the tag. A page blocked
 *     in robots.txt is never fetched, so its noindex is never read, and a URL already in an index
 *     stays there as a bare link.
 *
 *  2. NO CANONICAL ALONGSIDE A NOINDEX. The pair contradicts itself: it asks a crawler both to drop
 *     the page and to credit another URL. `/subscribe` and `/contact` render the *same shared
 *     components* as resomix.com, so those two keep a cross-origin canonical instead, which is the
 *     correct signal for a duplicate.
 *
 *  3. THE SITEMAP IS DERIVED. It lists whatever is left indexable, which is now the sign-in page
 *     alone.
 */

/** Production origin for this app. */
export const SITE_ORIGIN = 'https://beta.resomix.com';

/** The marketing site, for cross-origin canonicals on pages shared between the two. */
export const LANDING_ORIGIN = 'https://resomix.com';

export interface RouteSeo {
  title: string;
  description: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Crawlable but kept out of the index: private, transient, or a duplicate. */
  noindex?: boolean;
  /**
   * Absolute canonical override. Used where this app renders a page that also exists on the
   * marketing site, so the ranking signal consolidates there instead of competing.
   */
  canonical?: string;
}

export const ROUTE_SEO: Record<string, RouteSeo> = {
  /* ---------- the workspace: the service itself, kept out of search ----------
     These three were indexable until 23 September. They are the app a person uses once they are
     signed in, and their marketing equivalents on resomix.com (/, /product/sonic-discovery,
     /product/track-intelligence) carry the definitions, the buyer phrases and the questions that
     are meant to rank. Two hosts answering the same query split the signal between them. */
  '/': {
    title: 'Resomix: Find Tracks by Sound',
    description:
      'Drop a reference track and get ranked matches that actually belong next to it. Sonic discovery, track analysis and playlists in one workspace.',
    noindex: true,
  },
  '/sonic-discovery': {
    title: 'Sonic Discovery: Search by Reference | Resomix',
    description:
      'Search the catalogue by sound rather than tags: upload or pick a reference and explore what sits next to it.',
    noindex: true,
  },
  '/track-intelligence': {
    title: 'Track Intelligence: See What a Track Is Made Of | Resomix',
    description:
      'Upload a track to read its tempo, key, energy and sonic character, then jump straight to similar recordings.',
    noindex: true,
  },

  /* The full Track Intelligence dashboard. `noindex` on purpose: it is only ever reachable with a
     specific `?id=`, it is a Pro capability, and an indexed shell with no analysis behind it would
     be a dead result. `/track-intelligence` is the page that should rank. */
  '/track-intelligence/full': {
    title: 'Full Track Intelligence | Resomix',
    description:
      'The complete breakdown of a track: spectrograms, chromagram, beat and phrase grids, mood and genre over time, and stem composition.',
    noindex: true,
  },

  /* ---------- shared with the marketing site: canonical points there ---------- */
  '/subscribe': {
    title: 'Subscribe to Resomix: Unlock Deeper Sonic Discovery',
    description:
      'Upgrade your Resomix plan for expanded discovery and analysis, and manage billing securely. Start in the free production beta and grow when you are ready.',
    // The marketing page at /pricing is the indexable one; this is the signed-in flow behind it.
    canonical: `${LANDING_ORIGIN}/pricing`,
    priority: 0.6,
  },
  '/contact': {
    title: 'Contact Resomix: Support, Partnerships and Press Enquiries',
    description:
      'Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. Write to support@resomix.com and we will get back to you.',
    canonical: `${LANDING_ORIGIN}/contact`,
    priority: 0.5,
  },

  /* ---------- signed-in workspace: crawlable, never indexed ---------- */
  // A crawler sees a redirect or an empty shell here; indexing it would put a blank page in results.
  '/library': { title: 'Your Library | Resomix', description: 'Your saved playlists and uploads.', noindex: true },
  '/profile': { title: 'Your Profile | Resomix', description: 'Account, plan and billing settings.', noindex: true },
  '/sessions': { title: 'Active Sessions | Resomix', description: 'Devices signed in to your account.', noindex: true },
  '/change-password': { title: 'Change Password | Resomix', description: 'Update your account password.', noindex: true },

  /* ---------- auth screens ----------
     Sign-in is the ONE indexable page on this host: the entrance to the service, and the result a
     person searching "Resomix login" is actually looking for. Everything else here creates an
     account or resets a password, which nobody arrives at from a search engine. */
  '/auth/login': {
    title: 'Sign In | Resomix',
    description: 'Sign in to your Resomix account to search by sound, analyse tracks and build playlists.',
    changefreq: 'monthly',
    priority: 0.5,
  },
  '/auth/register': { title: 'Create an Account | Resomix', description: 'Create a Resomix account.', noindex: true },
  '/auth/forgot-password': { title: 'Reset Your Password | Resomix', description: 'Request a password reset link.', noindex: true },
  '/auth/reset-password': { title: 'Set a New Password | Resomix', description: 'Choose a new account password.', noindex: true },
  '/auth/verify-email': { title: 'Verify Your Email | Resomix', description: 'Confirm your email address.', noindex: true },
  '/auth/verify-2fa': { title: 'Two-Factor Verification | Resomix', description: 'Enter your verification code.', noindex: true },

  /* ---------- transient ---------- */
  '/error': { title: 'Something went wrong | Resomix', description: 'An unexpected error occurred.', noindex: true },
  '/loader': { title: 'Processing your upload | Resomix', description: 'Your upload is being analysed.', noindex: true },
  '/playlist': { title: 'Playlist | Resomix', description: 'Redirecting to the discovery workspace.', noindex: true },

  /* The page was called Analysis until Sept 2026. Both old paths still resolve, so that every
     link already shared or bookmarked keeps working, and they carry a head like `/playlist` does
     for the same reason. */
  '/analysis': { title: 'Redirecting to Track Intelligence | Resomix', description: 'This page moved to /track-intelligence.', noindex: true },
  '/analysis/full': { title: 'Redirecting to the full Track Intelligence | Resomix', description: 'This page moved to /track-intelligence/full.', noindex: true },
  '/404': { title: 'Page not found | Resomix', description: 'That page does not exist.', noindex: true },
};

export const SITEMAP_DEFAULTS = { changefreq: 'monthly' as const, priority: 0.7 };

/**
 * Social preview image. Absolute — crawlers do not resolve relative OG URLs.
 * 1200x630 landscape card, matching the marketing site.
 */
export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

/**
 * Sitemap contents: indexable pages only.
 *
 * A canonical-elsewhere page is deliberately excluded too — listing a URL whose canonical points at
 * another origin asks a crawler to index something we have just told it not to prefer.
 */
export function sitemapRoutes(): Array<{ path: string } & RouteSeo> {
  return Object.entries(ROUTE_SEO)
    .filter(([, seo]) => !seo.noindex && !seo.canonical)
    .map(([path, seo]) => ({ path, ...seo }));
}
